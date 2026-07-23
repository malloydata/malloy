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
import {NULL_SYMBOL} from '@/util';

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

  // Each axis's title/ticks/domain is tinted to its mark's color (via the
  // shared `color` scale) so the two independent scales read as separate rulers
  // — the visual defense against misreading the crossover. Value labels stay
  // neutral for legibility.
  test('each single-measure axis is tinted to its mark color', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `# combo_chart ${TWO_MEASURES}`
    );
    const left = spec.axes?.find(a => a.scale === 'yscale');
    const right = spec.axes?.find(a => a.scale === 'yscaleRight');
    // Title + axis line bound to the color scale, keyed by the measure name.
    expect((left?.encode?.title?.update as {fill: unknown})?.fill).toEqual({
      scale: 'color',
      value: 'total_reach',
    });
    expect((left?.encode?.domain?.update as {stroke: unknown})?.stroke).toEqual(
      {scale: 'color', value: 'total_reach'}
    );
    expect((right?.encode?.title?.update as {fill: unknown})?.fill).toEqual({
      scale: 'color',
      value: 'avg_reach',
    });
    // Numeric labels stay legible (not tinted).
    expect(
      (left?.encode?.labels?.update as {fill?: unknown})?.fill
    ).toBeUndefined();
  }, 60000);

  test('color_axes=false leaves axes neutral', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `# combo_chart { color_axes=false } ${TWO_MEASURES}`
    );
    const left = spec.axes?.find(a => a.scale === 'yscale');
    const right = spec.axes?.find(a => a.scale === 'yscaleRight');
    expect(
      (left?.encode?.title?.update as {fill?: unknown})?.fill
    ).toBeUndefined();
    expect(
      (right?.encode?.title?.update as {fill?: unknown})?.fill
    ).toBeUndefined();
  }, 60000);

  test('a multi-measure axis is not tinted (color would be ambiguous)', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `
      # combo_chart { y=['total_reach','avg_reach'] y2=max_reach }
      run: data -> {
        group_by: audience_name
        aggregate:
          total_reach is reach.sum()
          avg_reach is reach.avg()
          max_reach is reach.max()
      }
      `
    );
    const left = spec.axes?.find(a => a.scale === 'yscale');
    // Two measures on the left axis → no single color, so no title tint.
    expect(
      (left?.encode?.title?.update as {fill?: unknown})?.fill
    ).toBeUndefined();
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

describe('combo_chart cross-chart X highlighting', () => {
  // The x_highlight band drives both the outgoing brush (`[datum.x]`) and the
  // sibling-lit test (`indexof(brushXIn, datum.x)`), so its source dataset must
  // re-materialize `x`. Aggregating only `values`→`v` leaves datum.x undefined
  // and the brush never fires (matches bar chart's fields:['x','x']).
  test('x_facet_values re-materializes x for the highlight band', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `# combo_chart ${TWO_MEASURES}`
    );
    const group = findMark(spec.marks, 'x_group') as GroupMark;
    const facet = group.data?.find(d => d.name === 'x_facet_values');
    const agg = facet?.transform?.find(t => t.type === 'aggregate');
    expect(agg).toMatchObject({
      fields: ['x', 'x'],
      ops: ['values', 'min'],
      as: ['v', 'x'],
    });
  }, 60000);
});

const TIME_SOURCE =
  "source: tdata is duckdb.sql(\"SELECT * FROM (VALUES (DATE '2024-01-15', 10), (DATE '2024-02-15', 20)) AS t(event_date, reach)\")";
const TIME_TWO_MEASURES = `
  run: tdata -> {
    group_by: event_date
    aggregate:
      total_reach is reach.sum()
      avg_reach is reach.avg()
  }
`;

describe('combo_chart null time-x', () => {
  // A null time value comes through as NULL_SYMBOL. Without a guard the tooltip
  // does new Date(NULL_SYMBOL) → "Invalid Date"; line_chart guards it, so must
  // combo. This asserts the guard on a genuine time x (xIsDateorTime === true).
  test('tooltip title is NULL_SYMBOL, not "Invalid Date"', async () => {
    const {props, rootCell} = await buildCombo(
      TIME_SOURCE,
      `# combo_chart ${TIME_TWO_MEASURES}`
    );
    const records = [{x: NULL_SYMBOL, __row: rootCell.rows[0]}];
    const tooltip = props.getTooltipData?.(
      fakeTooltipItem('x_highlight', {x: NULL_SYMBOL, v: records}),
      fakeTooltipView()
    );
    expect(tooltip?.title).toEqual([NULL_SYMBOL]);
  }, 60000);
});

describe('combo_chart x limit', () => {
  // SOURCE has three distinct x values; a numeric x.limit must cap the plotted
  // bands and surface the drop as isDataLimited + a "Showing N of M" note. The
  // stub's plotWidth can't reach the auto path, but a numeric limit doesn't
  // depend on it, so the "limit never applied" bug is fully covered here.
  test('numeric x.limit caps bands and reports the truncation', async () => {
    const {props, rootCell} = await buildCombo(
      SOURCE,
      `# combo_chart { x.limit=2 } ${TWO_MEASURES}`
    );
    const xscale = props.spec.scales?.find(s => s.name === 'xscale') as {
      domain: unknown[];
    };
    expect(xscale.domain).toHaveLength(2);

    const mapped = props.mapMalloyDataToChartData(rootCell);
    expect(mapped.data).toHaveLength(2);
    expect(mapped.isDataLimited).toBe(true);
    expect(mapped.dataLimitMessage).toBe('Showing 2 of 3');
  }, 60000);

  test('no limit → every band plotted, not flagged as limited', async () => {
    const {props, rootCell} = await buildCombo(
      SOURCE,
      `# combo_chart ${TWO_MEASURES}`
    );
    const mapped = props.mapMalloyDataToChartData(rootCell);
    expect(mapped.data).toHaveLength(3);
    expect(mapped.isDataLimited).toBe(false);
    expect(mapped.dataLimitMessage).toBe('');
  }, 60000);
});

describe('combo_chart bars on both axes', () => {
  // Both axes drawing bars must sit side-by-side, never stacked on the same x
  // slot. A single shared `xOffset` scale over the union of both axes' bar
  // measures (not one scale per channel) is what gives each bar its own slot.
  test('both-bar uses one shared xOffset scale over the union of measures', async () => {
    const {spec} = await buildComboProps(
      SOURCE,
      `# combo_chart { y2.chart=bar } ${TWO_MEASURES}`
    );
    const offsetScales = (spec.scales ?? []).filter(s =>
      s.name.startsWith('xOffset')
    );
    // Exactly one offset scale (not xOffsetLeft + xOffsetRight).
    expect(offsetScales.map(s => s.name)).toEqual(['xOffset']);
    // Its domain is the union of both axes' measures.
    expect((offsetScales[0] as {domain: string[]}).domain).toEqual([
      'total_reach',
      'avg_reach',
    ]);
    // Both bar groups position off the shared scale.
    const leftBars = findMark(spec.marks, 'left_values_bars');
    const rightBars = findMark(spec.marks, 'right_values_bars');
    expect((leftBars?.encode?.enter?.width as {scale: string})?.scale).toBe(
      'xOffset'
    );
    expect((rightBars?.encode?.enter?.width as {scale: string})?.scale).toBe(
      'xOffset'
    );
  }, 60000);

  test('single bar channel → xOffset spans only that channel (unchanged layout)', async () => {
    // Default combo is bars-left + line-right, so only the left measure draws
    // bars: the offset scale collapses to that one measure, exactly as before.
    const {spec} = await buildComboProps(
      SOURCE,
      `# combo_chart ${TWO_MEASURES}`
    );
    const offset = (spec.scales ?? []).find(s => s.name === 'xOffset') as {
      domain: string[];
    };
    expect(offset.domain).toEqual(['total_reach']);
  }, 60000);
});

describe('combo_chart measure dedupe', () => {
  // A measure named both explicitly (y=…) and via an embedded `# y` tag would
  // otherwise be pushed twice → duplicate series + legend entry.
  test('a measure listed both explicitly and via # y is not doubled', async () => {
    const {settings} = await buildCombo(
      SOURCE,
      `
      # combo_chart { y=total_reach y2=avg_reach }
      run: data -> {
        group_by: audience_name
        aggregate:
          # y
          total_reach is reach.sum()
          avg_reach is reach.avg()
      }
      `
    );
    expect(settings.yChannel.fields).toHaveLength(1);
    expect(settings.y2Channel.fields).toHaveLength(1);
  }, 60000);
});
