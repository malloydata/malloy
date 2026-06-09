/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The bar-chart spec generator computes axis/legend titles directly from each
// field's resolved label (`field.getLabel()`), independent of the chart layout
// math. The layout math (`chart-layout-settings`) pulls in vega's `scale()` and
// DOM text measurement, and the custom-tooltip path pulls in solid-js, neither
// of which loads under the node test environment. Stub both so the generator
// runs; the titles we assert on do not depend on them.
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
import {getBarChartSettings} from '@/plugins/bar-chart/get-bar_chart-settings';
import {generateBarChartVegaSpecV2} from '@/plugins/bar-chart/generate-bar_chart-vega-spec';
import type {BarChartPluginInstance} from '@/plugins/bar-chart/bar-chart-plugin';

const duckdb = runtimeFor('duckdb');

afterAll(async () => {
  await duckdb.connection.close();
});

// Compile + run the query, build field metadata (resolves `# label` tags at
// setup time), build the data tree, then drive the bar-chart spec generator
// with a minimal plugin instance, the same inputs the renderer would pass.
async function buildBarSpec(sourceModel: string, query: string): Promise<Spec> {
  const result = await duckdb.loadModel(sourceModel).loadQuery(query).run();
  const malloyResult = API.util.wrapResult(result);
  const rfm = new RenderFieldMetadata(malloyResult);
  getDataTree(malloyResult, rfm);
  const root = rfm.getRootField();
  const settings = getBarChartSettings(root);
  const plugin = {
    name: 'bar',
    field: root,
    chartDisplay: {},
    getMetadata: () => ({type: 'bar', field: root, settings}),
  } as unknown as BarChartPluginInstance;
  const metadata = getResultMetadata(root, {
    renderFieldMetadata: rfm,
    parentSize: {width: 400, height: 300},
  });
  return generateBarChartVegaSpecV2(metadata, plugin).spec;
}

const DATA =
  'duckdb.sql("SELECT * FROM (VALUES ' +
  "('Total Universe (HH)', 75, '1Q26'), " +
  "('1Q26: High Income Earners', 28, '1Q26'), " +
  "('1Q26: Auto Intenders', 25, '2Q26')) " +
  'AS t(audience_name, reach, period)")';

describe('bar chart honors # label tags on axis/legend titles', () => {
  const SOURCE = `source: data is ${DATA}`;

  test('x and y axis titles use the # label tag, not the field name', async () => {
    const query = `
      # bar_chart
      run: data -> {
        group_by:
          # label="Audience"
          audience_name
        aggregate:
          # label="Reach (HH)"
          total_reach is reach.sum()
        order_by: total_reach desc
      }
    `;
    const spec = await buildBarSpec(SOURCE, query);
    const xAxis = spec.axes?.find(a => a.scale === 'xscale');
    const yAxis = spec.axes?.find(a => a.scale === 'yscale');
    expect(xAxis?.title).toBe('Audience');
    expect(yAxis?.title).toBe('Reach (HH)');
  }, 60000);

  test('legend title uses the # label tag of the series dimension', async () => {
    const query = `
      # bar_chart
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
    `;
    const spec = await buildBarSpec(SOURCE, query);
    expect(spec.legends?.[0]?.title).toBe('Quarter');
  }, 60000);

  test('measure-series legend entries use the # label tags, not field names', async () => {
    const query = `
      # bar_chart
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
    `;
    const spec = await buildBarSpec(SOURCE, query);
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
