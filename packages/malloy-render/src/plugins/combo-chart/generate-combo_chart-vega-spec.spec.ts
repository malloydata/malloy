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
});
