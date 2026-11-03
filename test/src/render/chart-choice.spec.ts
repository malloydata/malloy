/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Which visualization a field gets, as decided by the built renderer with
// all of its built-in plugins registered: an explicit `viz` wins over every
// chart tag, and without `viz` the last-declared chart tag wins.

import {runtimeFor} from '../runtimes';

const runtime = runtimeFor('duckdb');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MalloyRenderer: any;

beforeAll(async () => {
  // The renderer bundle reads `window` while loading (see render-validator).
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  global.window = global.document.defaultView;
  MalloyRenderer = (await import('@malloydata/render')).MalloyRenderer;
});

afterAll(async () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  delete global.window;
  await runtime.connection.close();
});

const SQL_SOURCE = 'duckdb.sql("SELECT 1 as val, \'a\' as str")';

/** Name of the renderer each named top-level field of query `q` gets. */
async function renderAs(
  malloySource: string,
  fieldName: string
): Promise<{renderAs: string; logs: string[]}> {
  const pr = await runtime
    .loadModel(malloySource)
    .loadQueryByName('q')
    .getPreparedResult();
  const viz = new MalloyRenderer().createViz();
  viz.setResult(pr.toStableResult());
  const field = viz
    .getMetadata()
    .getRootField()
    .fields.find((f: {name: string}) => f.name === fieldName);
  return {
    renderAs: field.renderAs(),
    logs: viz.getLogs().map((l: {message: string}) => l.message),
  };
}

function nestTagged(tags: string): string {
  return `
    query: q is ${SQL_SOURCE} -> {
      group_by: str
      ${tags}
      nest: by_val is { group_by: val; aggregate: c is count() }
    }
  `;
}

describe('explicit viz wins over every chart tag', () => {
  test.each([
    ['# shape_map viz=table', 'table'],
    ['# segment_map viz=table', 'table'],
    ['# scatter_chart viz=table', 'table'],
    ['# big_value viz=table', 'table'],
    ['# bar_chart viz=scatter', 'scatter_chart'],
    ['# line_chart viz=big_value', 'big_value'],
    ['# big_value viz=bar', 'bar'],
  ])('%s renders as %s', async (tags, expected) => {
    expect((await renderAs(nestTagged(tags), 'by_val')).renderAs).toBe(
      expected
    );
  });

  test.each(['big_value', 'scatter', 'shape_map', 'segment_map'])(
    'viz=%s is a valid viz type',
    async viz => {
      const {logs} = await renderAs(nestTagged(`# viz=${viz}`), 'by_val');
      expect(logs.filter(m => /Invalid viz type/.test(m))).toEqual([]);
    }
  );
});

describe('without viz, the last-declared chart tag wins', () => {
  test.each([
    ['# bar_chart\n# big_value', 'big_value'],
    ['# big_value\n# bar_chart', 'bar'],
    ['# line_chart\n# scatter_chart', 'scatter_chart'],
    ['# shape_map\n# line_chart', 'line'],
  ])('%j renders as %s', async (tags, expected) => {
    expect((await renderAs(nestTagged(tags), 'by_val')).renderAs).toBe(
      expected
    );
  });

  test("a nest's own chart tag replaces the one its view declares", async () => {
    const source = `
      source: s is ${SQL_SOURCE} extend {
        # bar_chart
        view: by_str is { group_by: str; aggregate: c is count() }
        # line_chart
        view: by_val is { group_by: val; aggregate: c is count() }
      }
      query: q is s -> {
        group_by: str
        # big_value
        nest: own_over_bar is by_str
        # scatter_chart
        nest: own_over_line is by_val
      }
    `;
    expect((await renderAs(source, 'own_over_bar')).renderAs).toBe('big_value');
    expect((await renderAs(source, 'own_over_line')).renderAs).toBe(
      'scatter_chart'
    );
  });

  test('a chart tag declared again moves to last place', async () => {
    // The merged tag keeps a re-declared key where it first appeared, so the
    // order has to come from the annotation lines.
    const source = `
      source: s is ${SQL_SOURCE} extend {
        # scatter_chart
        # big_value
        view: by_str is { group_by: str; aggregate: c is count() }
      }
      query: q is s -> {
        group_by: str
        # scatter_chart
        nest: redeclared is by_str
        # -big_value
        nest: removed is by_str
      }
    `;
    expect((await renderAs(source, 'redeclared')).renderAs).toBe(
      'scatter_chart'
    );
    expect((await renderAs(source, 'removed')).renderAs).toBe('scatter_chart');
  });
});
