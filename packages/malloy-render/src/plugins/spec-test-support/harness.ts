/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Spec} from 'vega';
import {API} from '@malloydata/malloy';
import {runtimeFor} from '../../../../../test/src/runtimes';
import {RenderFieldMetadata} from '@/render-field-metadata';
import {getDataTree, type RootField} from '@/data_tree';
import {
  getResultMetadata,
  type RenderMetadata,
} from '@/component/render-result-metadata';
import {MEASURE_SERIES_LABEL_SCALE} from '@/component/vega/measure-series-label-scale';

const duckdb = runtimeFor('duckdb');

export interface ChartQueryResult {
  root: RootField;
  metadata: RenderMetadata;
}

/**
 * Compile and run a query, returning the data-tree root (with `# label` tags
 * resolved) and the render metadata a spec generator takes as input.
 */
export async function runChartQuery(
  source: string,
  query: string
): Promise<ChartQueryResult> {
  const result = await duckdb.loadModel(source).loadQuery(query).run();
  const malloyResult = API.util.wrapResult(result);
  const rfm = new RenderFieldMetadata(malloyResult);
  getDataTree(malloyResult, rfm);
  const root = rfm.getRootField();
  const metadata = getResultMetadata(root, {
    renderFieldMetadata: rfm,
    parentSize: {width: 400, height: 300},
  });
  return {root, metadata};
}

const DATA =
  'duckdb.sql("SELECT * FROM (VALUES ' +
  "('Total Universe (HH)', 75, '1Q26'), " +
  "('1Q26: High Income Earners', 28, '1Q26'), " +
  "('1Q26: Auto Intenders', 25, '2Q26')) " +
  'AS t(audience_name, reach, period)")';

const SOURCE = `source: data is ${DATA}`;

/**
 * The label-honoring cases shared by the bar and line chart specs,
 * parametrized by chart tag and each chart's spec builder.
 */
export function describeChartLabelTests(
  chartTag: 'bar_chart' | 'line_chart',
  buildSpec: (source: string, query: string) => Promise<Spec>
) {
  afterAll(async () => {
    await duckdb.connection.close();
  });

  describe(`${chartTag} honors # label tags on axis/legend titles`, () => {
    test('x and y axis titles use the # label tag, not the field name', async () => {
      const spec = await buildSpec(
        SOURCE,
        `
        # ${chartTag}
        run: data -> {
          group_by:
            # label="Audience"
            audience_name
          aggregate:
            # label="Reach (HH)"
            total_reach is reach.sum()
        }
        `
      );
      const xAxis = spec.axes?.find(a => a.scale === 'xscale');
      const yAxis = spec.axes?.find(a => a.scale === 'yscale');
      expect(xAxis?.title).toBe('Audience');
      expect(yAxis?.title).toBe('Reach (HH)');
    }, 60000);

    test('legend title uses the # label tag of the series dimension', async () => {
      const spec = await buildSpec(
        SOURCE,
        `
        # ${chartTag}
        run: data -> {
          group_by:
            # label="Audience"
            audience_name
            # label="Quarter"
            period
          aggregate:
            # label="Reach (HH)"
            total_reach is reach.sum()
        }
        `
      );
      expect(spec.legends?.[0]?.title).toBe('Quarter');
    }, 60000);

    test('measure-series legend entries use the # label tags, not field names', async () => {
      const spec = await buildSpec(
        SOURCE,
        `
        # ${chartTag}
        run: data -> {
          group_by:
            # label="Audience"
            audience_name
          aggregate:
            # y
            # label="Reach (HH)"
            total_reach is reach.sum()
            # y
            # label=""
            avg_reach is reach.avg()
        }
        `
      );
      // The labels ride a data-driven ordinal scale, so an explicit empty
      // # label="" survives verbatim instead of falling back to the name.
      const scale = (spec.scales ?? []).find(
        s => s.name === MEASURE_SERIES_LABEL_SCALE
      );
      const range = scale && 'range' in scale ? scale.range : undefined;
      const rangeArr: unknown[] = Array.isArray(range) ? range : [];
      expect(rangeArr).toContain('Reach (HH)');
      expect(rangeArr).toContain('');
      expect(rangeArr).not.toContain('avg_reach');
      expect(JSON.stringify(spec.legends?.[0] ?? {})).toContain(
        MEASURE_SERIES_LABEL_SCALE
      );
    }, 60000);
  });
}
