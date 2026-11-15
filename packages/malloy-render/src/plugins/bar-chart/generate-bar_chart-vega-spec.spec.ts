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
  SOURCE4,
} from '@/plugins/spec-test-support/harness';
import type {VegaChartProps} from '@/component/types';
import type {GroupMark} from 'vega';
import {getBarChartSettings} from '@/plugins/bar-chart/get-bar_chart-settings';
import {
  generateBarChartVegaSpecV2,
  type BarChartSpecInputs,
} from '@/plugins/bar-chart/generate-bar_chart-vega-spec';
import {BarChartPluginFactory} from '@/plugins/bar-chart/bar-chart-plugin';
import {barChartSettingsToTag} from '@/plugins/bar-chart/settings-to-tag';

async function buildBar(source: string, query: string) {
  const {root, rootCell, metadata} = await runChartQuery(source, query);
  const settings = getBarChartSettings(root);
  const plugin: BarChartSpecInputs = {
    field: root,
    chartDisplay: {size: {}},
    getMetadata: () => ({type: 'bar', field: root, settings}),
  };
  return {props: generateBarChartVegaSpecV2(metadata, plugin), rootCell};
}

async function buildBarProps(
  source: string,
  query: string
): Promise<VegaChartProps> {
  return (await buildBar(source, query)).props;
}

describeChartLabelTests('bar_chart', buildBarProps);

describe('bar_chart honors # label tags in default tooltips', () => {
  test('measure-series tooltip labels use the # label tags, not field names', async () => {
    const props = await buildBarProps(
      SOURCE,
      `
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
      fakeTooltipItem('x_highlight', {x: 'Total Universe (HH)', v: records}),
      fakeTooltipView()
    );
    expect(tooltip?.entries.map(e => e.label)).toEqual([
      'Reach (HH)',
      'Avg Reach',
    ]);
  }, 60000);

  test('dimensional-series tooltip labels stay series values, not labels', async () => {
    const props = await buildBarProps(
      SOURCE,
      `
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
      `
    );
    const records = [{x: 'Total Universe (HH)', y: 75, series: '1Q26'}];
    const tooltip = props.getTooltipData?.(
      fakeTooltipItem('x_highlight', {x: 'Total Universe (HH)', v: records}),
      fakeTooltipView()
    );
    expect(tooltip?.entries.map(e => e.label)).toEqual(['1Q26']);
  }, 60000);

  test('custom # tooltip entries use the # label tag, not the field name', async () => {
    const {props, rootCell} = await buildBar(
      SOURCE,
      `
      # bar_chart
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
      fakeTooltipItem('x_highlight', {x: 'Total Universe (HH)', v: records}),
      fakeTooltipView()
    );
    expect(tooltip?.entries.map(e => e.label)).toEqual([
      'Reach (HH)',
      'Avg Reach',
    ]);
  }, 60000);
});

describe('bar_chart stack without a series', () => {
  function barEncode(spec: VegaChartProps['spec']) {
    const group = spec.marks?.find((m): m is GroupMark => m.type === 'group');
    const bars = group?.marks?.find(m => m.name === 'bars');
    return bars?.encode?.enter;
  }
  function yScaleDomain(spec: VegaChartProps['spec']) {
    return spec.scales?.find(s => s.name === 'yscale')?.domain;
  }

  test('uses the unstacked encoding', async () => {
    const {spec} = await buildBarProps(
      SOURCE,
      `
      # bar_chart.stack
      run: data -> {
        group_by: audience_name
        aggregate: total_reach is reach.sum()
      }
      `
    );
    const enter = barEncode(spec);
    expect(enter?.y).toMatchObject({scale: 'yscale', field: 'y'});
    expect(enter?.y2).toMatchObject({scale: 'yscale', value: 0});
    expect(yScaleDomain(spec)).toEqual([0, 100]);
  }, 60000);

  test('still stacks y0/y1 when a series is present', async () => {
    const {spec} = await buildBarProps(
      SOURCE,
      `
      # bar_chart.stack
      run: data -> {
        group_by: audience_name, period
        aggregate: total_reach is reach.sum()
      }
      `
    );
    const enter = barEncode(spec);
    expect(enter?.y).toMatchObject({scale: 'yscale', field: 'y0'});
    expect(enter?.y2).toMatchObject({scale: 'yscale', field: 'y1'});
    expect(yScaleDomain(spec)).toMatchObject({data: 'values', field: 'y1'});
  }, 60000);
});

describe('bar_chart synthetic multi-series field', () => {
  test('legend title joins the # label tags of the tagged series fields', async () => {
    const {root, rootCell, metadata} = await runChartQuery(
      SOURCE4,
      `
      # bar_chart
      run: data4 -> {
        group_by:
          audience_name
          # series
          # label="Quarter"
          period
          # series
          # label="Region"
          region
        aggregate: total_reach is reach.sum()
      }
      `
    );
    const plugin = BarChartPluginFactory.create(root);
    plugin.processData?.(root, rootCell);
    expect(plugin.syntheticSeriesField?.getLabel()).toBe('Quarter - Region');
    const {spec} = generateBarChartVegaSpecV2(metadata, plugin);
    expect(spec.legends?.[0]?.title).toBe('Quarter - Region');
  }, 60000);
});

describe('bar_chart orient=horizontal', () => {
  const QUERY = (tag: string) => `
    ${tag}
    run: data4 -> { group_by: audience_name, region; aggregate: r is reach.sum() }
  `;
  const build = (tag: string) => buildBarProps(SOURCE4, QUERY(tag));
  const barsOf = (spec: VegaChartProps['spec']) => {
    const group = spec.marks!.find(m => m.name === 'x_group') as GroupMark;
    return {
      group,
      bars: group.marks!.find(m => m.name === 'bars')!,
      highlight: group.marks!.find(m => m.name === 'x_highlight')!,
    };
  };

  test('categories run down the left and the measure along the bottom', async () => {
    const {spec} = await build('# bar_chart { orient=horizontal }');
    const xscale = spec.scales!.find(s => s.name === 'xscale');
    const yscale = spec.scales!.find(s => s.name === 'yscale');
    // First category at the top.
    expect(xscale).toMatchObject({
      type: 'band',
      range: [0, {signal: 'height'}],
    });
    expect(yscale).toMatchObject({range: 'width'});
    expect(spec.axes!.map(a => [a.orient, a.scale])).toEqual([
      ['left', 'xscale'],
      ['bottom', 'yscale'],
    ]);
    expect(spec.axes![1]).toMatchObject({grid: true});
    expect(spec.axes![0]).toMatchObject({grid: false});
  });

  test('bars and the row highlight are positioned across, not up', async () => {
    const {spec} = await build('# bar_chart { orient=horizontal }');
    const {group, bars, highlight} = barsOf(spec);
    expect(group.encode!.enter).toEqual({y: {scale: 'xscale', field: 'x'}});
    expect(Object.keys(bars.encode!.enter!).sort()).toEqual([
      'height',
      'x',
      'x2',
      'y',
    ]);
    expect(bars.encode!.enter).toMatchObject({
      x: {scale: 'yscale', field: 'y'},
      x2: {scale: 'yscale', value: 0},
    });
    expect(highlight.encode!.enter).toMatchObject({
      height: {scale: 'xscale', band: 1},
      x2: {signal: 'width'},
    });
  });

  test('stacked horizontal bars span y0..y1 across', async () => {
    const {spec} = await build('# bar_chart { orient=horizontal stack }');
    expect(barsOf(spec).bars.encode!.enter).toMatchObject({
      x: {scale: 'yscale', field: 'y0'},
      x2: {scale: 'yscale', field: 'y1'},
    });
  });

  test('hovering the bottom axis brushes the measure', async () => {
    const {spec} = await build('# bar_chart { orient=horizontal }');
    const names = spec.marks!.map(m => m.name);
    expect(names).toContain('x_measure_axis_overlay');
    expect(names).toContain('x_reference_line_group');
    const brushMeasure = spec.signals!.find(s => s.name === 'brushMeasure');
    expect(JSON.stringify(brushMeasure)).toContain(
      '@x_measure_axis_overlay:mousemove'
    );
  });

  test('without orient the chart is vertical', async () => {
    const {spec} = await build('# bar_chart');
    expect(spec.axes!.map(a => [a.orient, a.scale])).toEqual([
      ['bottom', 'xscale'],
      ['left', 'yscale'],
    ]);
    expect(spec.scales!.find(s => s.name === 'xscale')).toMatchObject({
      range: 'width',
    });
  });

  test('orient round-trips through the settings tag', async () => {
    const {root} = await runChartQuery(
      SOURCE4,
      QUERY('# bar_chart { orient=horizontal }')
    );
    const settings = getBarChartSettings(root);
    expect(settings.orient).toBe('horizontal');
    expect(barChartSettingsToTag(settings).text('viz', 'orient')).toBe(
      'horizontal'
    );
    expect(
      barChartSettingsToTag({...settings, orient: 'vertical'}).has(
        'viz',
        'orient'
      )
    ).toBe(false);
  });

  test('an unknown orient falls back to vertical', async () => {
    const {root} = await runChartQuery(
      SOURCE4,
      QUERY('# bar_chart { orient=sideways }')
    );
    expect(getBarChartSettings(root).orient).toBe('vertical');
  });
});
