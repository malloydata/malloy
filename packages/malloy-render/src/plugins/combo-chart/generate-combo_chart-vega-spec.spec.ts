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
  runChartQuery,
  closeChartTestRuntime,
  fakeTooltipItem,
  fakeTooltipView,
  SOURCE,
} from '@/plugins/spec-test-support/harness';
import type {VegaChartProps} from '@/component/types';
import type {GroupMark, Mark} from 'vega';
import {getComboChartSettings} from '@/plugins/combo-chart/get-combo_chart-settings';
import {
  generateComboChartVegaSpec,
  type ComboChartSpecInputs,
} from '@/plugins/combo-chart/generate-combo_chart-vega-spec';
import {comboChartSettingsToTag} from '@/plugins/combo-chart/settings-to-tag';
import {defaultComboChartSettings} from '@/plugins/combo-chart/combo-chart-settings';

async function buildCombo(source: string, query: string) {
  const {root, rootCell, metadata} = await runChartQuery(source, query);
  const settings = getComboChartSettings(root);
  const plugin: ComboChartSpecInputs = {
    field: root,
    chartDisplay: {size: {}},
    getMetadata: () => ({type: 'combo', field: root, settings}),
  };
  return {
    props: generateComboChartVegaSpec(metadata, plugin),
    rootCell,
    settings,
  };
}

async function buildComboProps(
  source: string,
  query: string
): Promise<VegaChartProps> {
  return (await buildCombo(source, query)).props;
}

// Find a named mark anywhere in the (possibly nested) mark tree.
function findMark(marks: Mark[] | undefined, name: string): Mark | undefined {
  for (const m of marks ?? []) {
    if (m.name === name) return m;
    const nested = findMark((m as GroupMark).marks, name);
    if (nested) return nested;
  }
  return undefined;
}

afterAll(async () => {
  await closeChartTestRuntime();
});

const TWO_MEASURES = `
  run: data -> {
    group_by:
      # label="Audience"
      audience_name
    aggregate:
      # label="Reach (HH)"
      total_reach is reach.sum()
      # label="Avg Reach"
      avg_reach is reach.avg()
  }
`;

describe('combo_chart dual axis structure', () => {
  test('defines both a left (yscale) and right (yscaleRight) scale', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `# combo_chart ${TWO_MEASURES}`
    );
    const scaleNames = (spec.scales ?? []).map(s => s.name);
    expect(scaleNames).toContain('yscale');
    expect(scaleNames).toContain('yscaleRight');
  }, 60000);

  test('renders a left axis and a right axis on the correct scales', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `# combo_chart ${TWO_MEASURES}`
    );
    const left = spec.axes?.find(a => a.scale === 'yscale');
    const right = spec.axes?.find(a => a.scale === 'yscaleRight');
    expect(left?.orient).toBe('left');
    expect(right?.orient).toBe('right');
    // Only the left axis draws gridlines (the two axes' ticks don't align).
    expect(right?.grid).toBe(false);
    expect(left?.grid).not.toBe(false);
  }, 60000);

  test('smart default: first measure → bars on left, second → line on right', async () => {
    const {props, settings} = await buildCombo(
      SOURCE,
      `# combo_chart ${TWO_MEASURES}`
    );
    // Auto-assignment
    expect(settings.yChannel.fields).toHaveLength(1);
    expect(settings.y2Channel.fields).toHaveLength(1);
    expect(settings.yChannel.chart).toBe('bar');
    expect(settings.y2Channel.chart).toBe('line');
    // Left bars bound to yscale, right line bound to yscaleRight
    const bars = findMark(props.spec.marks, 'left_values_bars');
    const line = findMark(props.spec.marks, 'right_values_lines');
    expect((bars?.encode?.enter?.y as {scale: string})?.scale).toBe('yscale');
    expect((line?.encode?.enter?.y as {scale: string})?.scale).toBe(
      'yscaleRight'
    );
  }, 60000);

  test('mark types can be swapped: line on left, bars on right', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `
      # combo_chart { y.chart=line y2.chart=bar }
      ${TWO_MEASURES}
      `
    );
    // Left is now a line, right is now bars.
    expect(findMark(spec.marks, 'left_values_lines')).toBeDefined();
    expect(findMark(spec.marks, 'right_values_bars')).toBeDefined();
    const line = findMark(spec.marks, 'left_values_lines');
    const bars = findMark(spec.marks, 'right_values_bars');
    expect((line?.encode?.enter?.y as {scale: string})?.scale).toBe('yscale');
    expect((bars?.encode?.enter?.y as {scale: string})?.scale).toBe(
      'yscaleRight'
    );
  }, 60000);

  test('axis titles use the # label tags of their measures', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `# combo_chart ${TWO_MEASURES}`
    );
    const left = spec.axes?.find(a => a.scale === 'yscale');
    const right = spec.axes?.find(a => a.scale === 'yscaleRight');
    expect(left?.title).toBe('Reach (HH)');
    expect(right?.title).toBe('Avg Reach');
  }, 60000);

  test('tooltip lists both measures with their # label tags', async () => {
    const {props, rootCell} = await buildCombo(
      SOURCE,
      `# combo_chart ${TWO_MEASURES}`
    );
    const records = [{x: 'Total Universe (HH)', __row: rootCell.rows[0]}];
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

describe('combo_chart hover targets', () => {
  // The full-band `x_highlight` rect is the sole interactive mark; bars, lines
  // and points must be non-interactive so hover falls through to it and the
  // tooltip fires on top of a bar/point, not only in the gaps.
  test('bars, lines and points are non-interactive', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `# combo_chart { y.chart=line y2.chart=bar } ${TWO_MEASURES}`
    );
    const bars = findMark(spec.marks, 'right_values_bars');
    const lines = findMark(spec.marks, 'left_values_lines');
    const points = findMark(spec.marks, 'left_values_points');
    expect(bars?.interactive).toBe(false);
    expect(lines?.interactive).toBe(false);
    expect(points?.interactive).toBe(false);
    // The highlight target stays interactive (default true, not disabled).
    const highlight = findMark(spec.marks, 'x_highlight');
    expect(highlight?.interactive).not.toBe(false);
  }, 60000);
});

describe('combo_chart line styling', () => {
  test('y2.line_width sets the line stroke width', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `# combo_chart { y2.line_width=5 } ${TWO_MEASURES}`
    );
    const line = findMark(spec.marks, 'right_values_lines');
    expect((line?.encode?.enter?.strokeWidth as {value: number})?.value).toBe(
      5
    );
  }, 60000);

  test('default line stroke width is 2', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `# combo_chart ${TWO_MEASURES}`
    );
    const line = findMark(spec.marks, 'right_values_lines');
    expect((line?.encode?.enter?.strokeWidth as {value: number})?.value).toBe(
      2
    );
  }, 60000);

  test('points=false hides dots; default auto-hides multi-point series', async () => {
    const forced = await buildComboProps(
      SOURCE,
      `# combo_chart { y2.points=false } ${TWO_MEASURES}`
    );
    const forcedPoints = findMark(forced.spec.marks, 'right_values_points');
    expect(
      (forcedPoints?.encode?.update?.fillOpacity as {value: number})?.value
    ).toBe(0);

    const auto = await buildComboProps(SOURCE, `# combo_chart ${TWO_MEASURES}`);
    const autoPoints = findMark(auto.spec.marks, 'right_values_points');
    // Auto mode carries the count-based signal rule, not a fixed opacity.
    expect(JSON.stringify(autoPoints?.encode?.update?.fillOpacity)).toContain(
      'item.mark.group.datum.count'
    );
  }, 60000);

  test('settings round-trip: y2 line_width / points serialize back to tags', () => {
    const tag = comboChartSettingsToTag({
      ...defaultComboChartSettings,
      xChannel: {...defaultComboChartSettings.xChannel, fields: ['x']},
      yChannel: {...defaultComboChartSettings.yChannel, fields: ['a']},
      y2Channel: {
        ...defaultComboChartSettings.y2Channel,
        fields: ['b'],
        lineWidth: 4,
        showPoints: false,
      },
    });
    expect(tag.numeric('viz', 'y2', 'line_width')).toBe(4);
    expect(tag.text('viz', 'y2', 'points')).toBe('false');
  });
});

describe('combo_chart axis bounds', () => {
  test('y.min/y.max and y2.min/y2.max pin the scale domains', async () => {
    const {props, settings} = await buildCombo(
      SOURCE,
      `# combo_chart { y.min=0 y.max=200 y2.max=50 } ${TWO_MEASURES}`
    );
    expect(settings.yChannel.min).toBe(0);
    expect(settings.yChannel.max).toBe(200);
    expect(settings.y2Channel.max).toBe(50);
    // domainMin/domainMax pin the endpoints regardless of the domain source
    // (a fixed domain, the data-driven fallback, or an independent axis).
    const yscale = props.spec.scales?.find(s => s.name === 'yscale') as {
      domainMin?: number;
      domainMax?: number;
    };
    expect(yscale?.domainMin).toBe(0);
    expect(yscale?.domainMax).toBe(200);
    // Right axis pins only max; min is left unset (data-driven).
    const yscaleRight = props.spec.scales?.find(
      s => s.name === 'yscaleRight'
    ) as {
      domainMin?: number;
      domainMax?: number;
    };
    expect(yscaleRight?.domainMax).toBe(50);
    expect(yscaleRight?.domainMin).toBeUndefined();
  }, 60000);
});

describe('combo_chart validation', () => {
  test('throws when there is only one measure (no second axis possible)', async () => {
    const {root} = await runChartQuery(
      SOURCE,
      `
      # combo_chart
      run: data -> {
        group_by: audience_name
        aggregate: total_reach is reach.sum()
      }
      `
    );
    expect(() => getComboChartSettings(root)).toThrow(/two measures/);
  }, 60000);

  test('invalid y.chart falls back to the channel default (bar)', async () => {
    const {settings} = await buildCombo(
      SOURCE,
      `# combo_chart { y.chart=pie } ${TWO_MEASURES}`
    );
    // Invalid mark type must not drive behavior; it falls back to the default.
    expect(settings.yChannel.chart).toBe('bar');
  }, 60000);
});
