/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// These modules do not load under the node test env; the stubs document why.
jest.mock('@/component/chart/chart-layout-settings', () =>
  jest.requireActual('@/plugins/spec-test-support/chart-layout-settings-stub')
);
jest.mock('@/component/renderer/apply-renderer', () =>
  jest.requireActual('@/plugins/spec-test-support/apply-renderer-stub')
);
jest.mock('@/component/chart/chart-v2', () =>
  jest.requireActual('@/plugins/spec-test-support/chart-v2-stub')
);
// ESM-only packages the plugin module imports but these tests never call.
jest.mock('vega', () => ({}));
jest.mock('vega-interpreter', () => ({}));
jest.mock('solid-js/jsx-runtime', () => ({}));

import {
  describeChartLabelTests,
  runChartQuery,
  fakeTooltipItem,
  fakeTooltipView,
  SOURCE,
  YOY_SOURCE,
} from '@/plugins/spec-test-support/harness';
import type {VegaChartProps} from '@/component/types';
import {getLineChartSettings} from '@/plugins/line-chart/get-line_chart-settings';
import {
  generateLineChartVegaSpecV2,
  type LineChartSpecInputs,
} from '@/plugins/line-chart/generate-line_chart-vega-spec';
import {LineChartPluginFactory} from '@/plugins/line-chart/line-chart-plugin';

async function buildLine(source: string, query: string) {
  const {root, rootCell, metadata} = await runChartQuery(source, query);
  const settings = getLineChartSettings(root);
  const plugin: LineChartSpecInputs = {
    field: root,
    chartDisplay: {size: {}},
    getTopNSeries: () => [],
    getMetadata: () => ({type: 'line', field: root, settings}),
  };
  return {props: generateLineChartVegaSpecV2(metadata, plugin), rootCell};
}

async function buildLineProps(
  source: string,
  query: string
): Promise<VegaChartProps> {
  return (await buildLine(source, query)).props;
}

describeChartLabelTests('line_chart', buildLineProps);

describe('line_chart honors # label tags in default tooltips', () => {
  test('measure-series tooltip labels use the # label tags, not field names', async () => {
    const props = await buildLineProps(
      SOURCE,
      `
      # line_chart
      run: data -> {
        group_by:
          # label="Audience"
          audience_name
        aggregate:
          # y
          # label="Reach (HH)"
          total_reach is reach.sum()
          # y
          # label="Avg Reach"
          avg_reach is reach.avg()
      }
      `
    );
    const records = [
      {x: 'Total Universe (HH)', y: 75, series: 'total_reach'},
      {x: 'Total Universe (HH)', y: 30, series: 'avg_reach'},
    ];
    const tooltip = props.getTooltipData?.(
      fakeTooltipItem('x_hit_target', {
        datum: {x: 'Total Universe (HH)', v: records},
      }),
      fakeTooltipView()
    );
    expect(tooltip?.entries.map(e => e.label)).toEqual([
      'Reach (HH)',
      'Avg Reach',
    ]);
  }, 60000);

  test('custom # tooltip entries use the # label tag, not the field name', async () => {
    const {props, rootCell} = await buildLine(
      SOURCE,
      `
      # line_chart
      run: data -> {
        group_by:
          # label="Audience"
          audience_name
        aggregate:
          # label="Reach (HH)"
          total_reach is reach.sum()
          # tooltip
          # label="Avg Reach"
          avg_reach is reach.avg()
      }
      `
    );
    const records = [
      {
        x: 'Total Universe (HH)',
        y: 75,
        series: 'total_reach',
        __row: rootCell.rows[0],
      },
    ];
    const tooltip = props.getTooltipData?.(
      fakeTooltipItem('x_hit_target', {
        datum: {x: 'Total Universe (HH)', v: records},
      }),
      fakeTooltipView()
    );
    expect(tooltip?.entries.map(e => e.label)).toEqual([
      'Reach (HH)',
      'Avg Reach',
    ]);
  }, 60000);
});

describe('line_chart YoY synthetic series field', () => {
  test('legend title is the synthetic Year label in yoy mode', async () => {
    const {root, rootCell, metadata} = await runChartQuery(
      YOY_SOURCE,
      `
      # viz=line {mode=yoy}
      run: yoy_data -> {
        group_by: event_date
        aggregate: total_sales is sales.sum()
      }
      `
    );
    const plugin = LineChartPluginFactory.create(root);
    plugin.processData?.(root, rootCell);
    expect(plugin.syntheticSeriesField?.getLabel()).toBe('Year');
    const {spec} = generateLineChartVegaSpecV2(metadata, plugin);
    expect(spec.legends?.[0]?.title).toBe('Year');
  }, 60000);
});

describe('line_chart measure series with a null # y value', () => {
  const WEEKLY_SALES = `source: weekly_sales is duckdb.sql("""
    select 1 as week_no, 10 as sales, 11 as last_year_sales
    union all select 2, null, 12
    union all select 3, 20, null
    union all select 4, null, null
  """)`;

  test('a null drops the point from its own series only', async () => {
    const {props, rootCell} = await buildLine(
      WEEKLY_SALES,
      `
      # line_chart
      run: weekly_sales -> {
        # x
        select:
          week_no
          # y
          sales
          # y
          last_year_sales
        order_by: week_no
      }
      `
    );
    const mapped = props.mapMalloyDataToChartData(rootCell);
    expect(mapped.data).toMatchObject([{x: 1}, {x: 2}, {x: 3}]);

    const transforms =
      props.spec.data?.find(d => d.name === 'values')?.transform ?? [];
    const fold = transforms.findIndex(t => t.type === 'fold');
    expect(fold).toBeGreaterThanOrEqual(0);
    expect(transforms.slice(fold + 1)).toContainEqual({
      type: 'filter',
      expr: 'isValid(datum.y)',
    });
  }, 60000);
});
