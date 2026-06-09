/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// See generate-bar_chart-vega-spec.spec.ts for why the layout math and custom
// tooltip path are stubbed: they pull in vega's scale()/DOM measurement and
// solid-js, which do not load under the node test environment. Axis/legend
// titles are derived from field labels and are unaffected by the stubs.
jest.mock('@/component/chart/chart-layout-settings', () => ({
  getChartLayoutSettings: () => ({
    plotWidth: 300,
    plotHeight: 200,
    totalWidth: 400,
    totalHeight: 300,
    isSpark: false,
    padding: {top: 0, left: 0, right: 0, bottom: 0},
    xAxis: {labelAngle: 0, hidden: false},
    yAxis: {hidden: false, tickCount: 5, width: 40, yTitleSize: 12},
    yScale: {domain: [0, 100]},
  }),
  getXAxisSettings: () => ({}),
}));
jest.mock('@/component/bar-chart/get-custom-tooltips-entries', () => ({
  getCustomTooltipEntries: () => [],
}));

import type {Spec} from 'vega';
import {runtimeFor} from '../../../../../test/src/runtimes';
import {API} from '@malloydata/malloy';
import {RenderFieldMetadata} from '@/render-field-metadata';
import {getDataTree} from '@/data_tree';
import {getResultMetadata} from '@/component/render-result-metadata';
import {getLineChartSettings} from '@/plugins/line-chart/get-line_chart-settings';
import {generateLineChartVegaSpecV2} from '@/plugins/line-chart/generate-line_chart-vega-spec';
import type {LineChartPluginInstance} from '@/plugins/line-chart/line-chart-plugin';

const duckdb = runtimeFor('duckdb');

afterAll(async () => {
  await duckdb.connection.close();
});

async function buildLineSpec(
  sourceModel: string,
  query: string
): Promise<Spec> {
  const result = await duckdb.loadModel(sourceModel).loadQuery(query).run();
  const malloyResult = API.util.wrapResult(result);
  const rfm = new RenderFieldMetadata(malloyResult);
  getDataTree(malloyResult, rfm);
  const root = rfm.getRootField();
  const settings = getLineChartSettings(root);
  const plugin = {
    name: 'line',
    field: root,
    chartDisplay: {},
    getMetadata: () => ({type: 'line', field: root, settings}),
  } as unknown as LineChartPluginInstance;
  const metadata = getResultMetadata(root, {
    renderFieldMetadata: rfm,
    parentSize: {width: 400, height: 300},
  });
  return generateLineChartVegaSpecV2(metadata, plugin).spec;
}

const DATA =
  'duckdb.sql("SELECT * FROM (VALUES ' +
  "('Jan', 75, '1Q26'), " +
  "('Feb', 28, '1Q26'), " +
  "('Mar', 25, '2Q26')) " +
  'AS t(month_name, reach, period)")';

describe('line chart honors # label tags on axis/legend titles', () => {
  const SOURCE = `source: data is ${DATA}`;

  test('x and y axis titles use the # label tag, not the field name', async () => {
    const query = `
      # line_chart
      run: data -> {
        group_by:
          # label="Month"
          month_name
        aggregate:
          # label="Reach (HH)"
          total_reach is reach.sum()
      }
    `;
    const spec = await buildLineSpec(SOURCE, query);
    const xAxis = spec.axes?.find(a => a.scale === 'xscale');
    const yAxis = spec.axes?.find(a => a.scale === 'yscale');
    expect(xAxis?.title).toBe('Month');
    expect(yAxis?.title).toBe('Reach (HH)');
  }, 60000);

  test('legend title uses the # label tag of the series dimension', async () => {
    const query = `
      # line_chart
      run: data -> {
        group_by:
          # label="Month"
          month_name
          # label="Quarter"
          period
        aggregate:
          # label="Reach (HH)"
          total_reach is reach.sum()
      }
    `;
    const spec = await buildLineSpec(SOURCE, query);
    expect(spec.legends?.[0]?.title).toBe('Quarter');
  }, 60000);

  test('measure-series legend entries use the # label tags, not field names', async () => {
    const query = `
      # line_chart
      run: data -> {
        group_by:
          # label="Month"
          month_name
        aggregate:
          # y
          # label="Reach (HH)"
          total_reach is reach.sum()
          # y
          # label=""
          avg_reach is reach.avg()
      }
    `;
    const spec = await buildLineSpec(SOURCE, query);
    // Labels are mapped through an ordinal scale (data-driven), so they survive
    // any label text and an explicit empty # label="" (no truthy fallback to
    // the field name), and the legend references that scale.
    const scale = (spec.scales ?? []).find(
      s => s.name === 'measureSeriesLabel'
    );
    const range = scale && 'range' in scale ? scale.range : undefined;
    const rangeArr: unknown[] = Array.isArray(range) ? range : [];
    expect(rangeArr).toContain('Reach (HH)');
    expect(rangeArr).toContain('');
    expect(rangeArr).not.toContain('avg_reach');
    expect(JSON.stringify(spec.legends?.[0] ?? {})).toContain(
      'measureSeriesLabel'
    );
  }, 60000);
});
