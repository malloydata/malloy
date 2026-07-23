/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Headless dispatch/config tests against the current renderer.
 *
 * Markup is compiled to a result schema with getPreparedResult() — no query
 * execution, no data files; DuckDB is used only to describe inline SQL at
 * compile time. RenderFieldMetadata is constructed directly on the stable
 * result, so these tests exercise dispatch (shouldRenderAs) and the
 * setup-time tag resolvers without a DOM, Solid, or Vega.
 */

import {DuckDBConnection} from '@malloydata/db-duckdb';
import {SingleConnectionRuntime} from '@malloydata/malloy';
import {RenderFieldMetadata} from './render-field-metadata';
import {getBarChartSettings} from './plugins/bar-chart/get-bar_chart-settings';
import {getComboChartSettings} from './plugins/combo-chart/get-combo_chart-settings';
import type {Field, NestField} from './data_tree';

let connection: DuckDBConnection;
let runtime: SingleConnectionRuntime;

beforeAll(async () => {
  connection = new DuckDBConnection('duckdb');
  await connection.connecting;
  runtime = new SingleConnectionRuntime({connection});
});

afterAll(async () => {
  await connection.close();
});

async function metadataFor(malloySource: string): Promise<RenderFieldMetadata> {
  const pr = await runtime
    .loadModel(malloySource)
    .loadQueryByName('q')
    .getPreparedResult();
  return new RenderFieldMetadata(pr.toStableResult());
}

function childField(metadata: RenderFieldMetadata, name: string): Field {
  const root = metadata.getRootField();
  const field = root.fields.find(f => f.name === name);
  if (!field) {
    throw new Error(`No field named ${name} in result root`);
  }
  return field;
}

const SQL_SOURCE =
  "duckdb.sql(\"SELECT 1 as val, 'a' as str, DATE '2026-01-01' as d\")";

describe('dispatch (shouldRenderAs) on the compiled schema', () => {
  test('untagged query renders as table; atomic children as cell', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> { select: val, str }
    `);
    expect(metadata.getRootField().renderAs()).toBe('table');
    expect(childField(metadata, 'val').renderAs()).toBe('cell');
  });

  test('# bar_chart on a nest renders as chart', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # bar_chart
        nest: by_val is { group_by: val; aggregate: c is count() }
      }
    `);
    expect(childField(metadata, 'by_val').renderAs()).toBe('chart');
  });

  test('# viz=table on a tagged chart nest wins over legacy flag', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # bar_chart viz=table
        nest: by_val is { group_by: val; aggregate: c is count() }
      }
    `);
    expect(childField(metadata, 'by_val').renderAs()).toBe('table');
  });

  test('KNOWN BUG: # table declared after # bar_chart still renders as chart', async () => {
    // Pins today's behavior deliberately: cross-type selection ignores
    // declaration order (viz short-circuit + fixed RENDER_TAG_LIST priority),
    // so the later # table cannot displace the earlier # bar_chart. If this
    // ever changes, it should change knowingly, not by surprise.
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # bar_chart
        # table
        nest: by_val is { group_by: val; aggregate: c is count() }
      }
    `);
    expect(childField(metadata, 'by_val').renderAs()).toBe('chart');
  });

  test('# combo_chart on a nest renders as chart', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # combo_chart
        nest: by_val is {
          group_by: d
          aggregate:
            a is count()
            b is sum(val)
        }
      }
    `);
    expect(childField(metadata, 'by_val').renderAs()).toBe('chart');
  });

  test('# viz=combo on a nest renders as chart', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # viz=combo
        nest: by_val is {
          group_by: d
          aggregate:
            a is count()
            b is sum(val)
        }
      }
    `);
    expect(childField(metadata, 'by_val').renderAs()).toBe('chart');
  });

  test('# viz=combo is a recognized viz type (no "invalid viz type" log)', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # viz=combo
        nest: by_val is {
          group_by: d
          aggregate:
            a is count()
            b is sum(val)
        }
      }
    `);
    const invalidVizErrors = metadata.logCollector
      .getLogs()
      .filter(l => /Invalid viz type/.test(l.message));
    expect(invalidVizErrors).toEqual([]);
  });

  test('legacy # combo_chart on a scalar is flagged (needs a nested query)', async () => {
    // combo_chart, like bar_chart/line_chart, is nest-only: on a scalar it must
    // produce a source-located "requires a nested query" error, not a bare red
    // tile. (# viz=combo already went through the 'viz' entry.)
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # combo_chart
        aggregate: val_sum is sum(val)
      }
    `);
    const errs = metadata.logCollector
      .getLogs()
      .filter(l => /'combo_chart'.*requires a nested query/.test(l.message));
    expect(errs).toHaveLength(1);
  });

  test('# link on a string field renders as link', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        select:
          # link
          str
      }
    `);
    expect(childField(metadata, 'str').renderAs()).toBe('link');
  });
});

describe('setup-time tag resolvers (tag-configs)', () => {
  test('# transpose.limit lands in the table nest config', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # transpose.limit=5
        nest: by_val is { group_by: val; aggregate: c is count() }
      }
    `);
    const field = childField(metadata, 'by_val');
    expect(field.renderAs()).toBe('table');
    const config = field.getTagConfig<{transposeLimit?: number}>();
    expect(config?.transposeLimit).toBe(5);
  });

  test('explicit viz.x and viz.stack land in chart settings', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: d
        # viz=bar { x=str stack }
        nest: by_str is {
          group_by: str, val
          aggregate: c is count()
        }
      }
    `);
    const chart = childField(metadata, 'by_str') as NestField;
    const settings = getBarChartSettings(chart);
    // Channel fields are key-encoded paths (JSON.stringify of the path
    // relative to the chart), not bare field names.
    expect(settings.xChannel.fields).toEqual([JSON.stringify(['str'])]);
    expect(settings.isStack).toBe(true);
  });

  test('PINNED: embedded # x alongside explicit viz.x accumulates (throws), not suppressed', async () => {
    // The channel sources are not a pick order: an embedded # x is added to
    // the x channel even when viz.x already named a different field, and the
    // resolver then rejects the 2-dimension x axis.
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: d
        # viz=bar { x=str }
        nest: by_str is {
          group_by:
            str
            # x
            val
          aggregate: c is count()
        }
      }
    `);
    const chart = childField(metadata, 'by_str') as NestField;
    expect(() => getBarChartSettings(chart)).toThrow(
      'at most 1 dimension for the x axis'
    );
  });

  test('combo: two measures auto-assign to the left (y) and right (y2) axes', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # combo_chart
        nest: by_val is {
          group_by: d
          aggregate:
            a is count()
            b is sum(val)
        }
      }
    `);
    const chart = childField(metadata, 'by_val') as NestField;
    const settings = getComboChartSettings(chart);
    expect(settings.yChannel.fields).toEqual([JSON.stringify(['a'])]);
    expect(settings.y2Channel.fields).toEqual([JSON.stringify(['b'])]);
    // Smart defaults: bars on the left axis, line on the right.
    expect(settings.yChannel.chart).toBe('bar');
    expect(settings.y2Channel.chart).toBe('line');
  });

  test('combo: explicit y2 and per-channel chart type land in settings', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # viz=combo { x=d y=a y2=b y.chart=line y2.chart=bar }
        nest: by_val is {
          group_by: d
          aggregate:
            a is count()
            b is sum(val)
        }
      }
    `);
    const chart = childField(metadata, 'by_val') as NestField;
    const settings = getComboChartSettings(chart);
    expect(settings.xChannel.fields).toEqual([JSON.stringify(['d'])]);
    expect(settings.yChannel.fields).toEqual([JSON.stringify(['a'])]);
    expect(settings.y2Channel.fields).toEqual([JSON.stringify(['b'])]);
    expect(settings.yChannel.chart).toBe('line');
    expect(settings.y2Channel.chart).toBe('bar');
  });

  test('combo: a bad y2 field reference is flagged with a source-located error', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # viz=combo { y=a y2=nonexistent }
        nest: by_val is {
          group_by: d
          aggregate:
            a is count()
            b is sum(val)
        }
      }
    `);
    const errs = metadata.logCollector
      .getLogs()
      .filter(l => /'nonexistent' for 'y2'/.test(l.message));
    expect(errs).toHaveLength(1);
  });

  test('combo: a non-numeric y2 field is flagged as needing to be numeric', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # viz=combo { y=a y2=d }
        nest: by_val is {
          group_by: d
          aggregate:
            a is count()
            b is sum(val)
        }
      }
    `);
    const errs = metadata.logCollector
      .getLogs()
      .filter(l =>
        /y2-channel field 'd'.*must be numeric or a measure/.test(l.message)
      );
    expect(errs).toHaveLength(1);
  });

  test('combo: an invalid chart type falls back to the channel default', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        group_by: str
        # viz=combo { y=a y2=b y2.chart=pie }
        nest: by_val is {
          group_by: d
          aggregate:
            a is count()
            b is sum(val)
        }
      }
    `);
    const chart = childField(metadata, 'by_val') as NestField;
    const settings = getComboChartSettings(chart);
    // 'pie' is not a supported mark type, so y2 keeps its default ('line').
    expect(settings.y2Channel.chart).toBe('line');
  });

  test('# currency resolves to a currency cell-format config', async () => {
    const metadata = await metadataFor(`
      query: q is ${SQL_SOURCE} -> {
        select:
          # currency
          val
      }
    `);
    const field = childField(metadata, 'val');
    expect(field.renderAs()).toBe('cell');
    const config = field.getTagConfig<{mode: string}>();
    expect(config?.mode).toBe('currency');
  });
});
