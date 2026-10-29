/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

const textWidths = new Map<string, number>();

// Scale behavior for the `vega` stub below. `domain` is what `.domain()` returns
// as a getter; `ticks` is what `.ticks()` returns (null = same as `domain`, i.e.
// the top tick reaches the domain max, so no top-overflow correction fires).
//
// `perCall` overrides these per `scale('linear')()` call, in creation order:
// getChartLayoutSettings builds the primary axis's scale first and the secondary
// (combo y2) axis's second, so [primary, secondary] lets a test give the two
// axes different overflow and exercise the max-of-the-two correction.
const scaleBehavior: {
  domain: number[];
  ticks: number[] | null;
  perCall: {domain: number[]; ticks: number[] | null}[] | null;
  calls: number;
} = {domain: [0, 1], ticks: null, perCall: null, calls: 0};

function resetScaleBehavior() {
  scaleBehavior.domain = [0, 1];
  scaleBehavior.ticks = null;
  scaleBehavior.perCall = null;
  scaleBehavior.calls = 0;
}

// A chainable stub for d3/vega's `scale('linear')()`. `.domain()` with args is a
// setter (returns the scale); with no args it's a getter. Values come from
// `scaleBehavior` so a test can drive the top-tick-overflow branch, which a
// fixed [0, 1] domain/ticks pair can never reach.
jest.mock('vega', () => {
  type ScaleStub = {
    domain: (...a: unknown[]) => ScaleStub | number[];
    nice: () => ScaleStub;
    range: () => ScaleStub;
    ticks: () => number[];
  };
  const makeScale = () => {
    const which = scaleBehavior.perCall?.[scaleBehavior.calls];
    scaleBehavior.calls += 1;
    const domain = which?.domain ?? scaleBehavior.domain;
    const ticks = (which ? which.ticks : scaleBehavior.ticks) ?? domain;
    const s = {} as ScaleStub;
    s.domain = (...args: unknown[]) => (args.length > 0 ? s : domain);
    s.nice = () => s;
    s.range = () => s;
    s.ticks = () => ticks;
    return s;
  };
  return {
    scale: () => () => makeScale(),
    locale: () => ({format: () => (n: number) => String(n)}),
  };
});

jest.mock('@/component/util', () => ({
  getTextWidthDOM: (text: string) => textWidths.get(text) ?? 6 * text.length,
  getTextHeightDOM: () => 12,
}));

import {
  getXAxisSettings,
  getChartLayoutSettings,
} from './chart-layout-settings';
import type {ChartSizeConfig} from '@/component/chart/resolve-chart-display';
import type {RenderMetadata} from '@/component/render-result-metadata';
import type {Field, NestField} from '@/data_tree';

function makeXField(uniqueValuesCt: number, name = 'x'): Field {
  return {
    name,
    valueSet: {size: uniqueValuesCt},
  } as unknown as Field;
}

function makeParentField(name: string, maxCount: number): NestField {
  return {
    maxUniqueFieldValueCounts: new Map([[name, maxCount]]),
  } as unknown as NestField;
}

function callSettings({
  maxString,
  width,
  uniqueValues,
  height = 200,
  isSpark = false,
}: {
  maxString: string;
  width: number;
  uniqueValues: number;
  height?: number;
  isSpark?: boolean;
}) {
  const xField = makeXField(uniqueValues);
  const parentField = makeParentField('x', uniqueValues);
  return getXAxisSettings({
    maxString,
    chartHeight: height,
    chartWidth: width,
    xField,
    parentField,
    isSpark,
  });
}

describe('getXAxisSettings', () => {
  beforeEach(() => resetScaleBehavior());
  beforeEach(() => {
    textWidths.clear();
    textWidths.set('1979', 25);
    textWidths.set('January 2024', 80);
    textWidths.set('very long category label', 160);
    textWidths.set('...', 10);
  });

  test('short label + wide chart picks horizontal (0°) without truncation', () => {
    const s = callSettings({maxString: '1979', width: 1000, uniqueValues: 10});
    expect(s.labelAngle).toBe(0);
    expect(s.labelLimit).toBe(0);
    expect(s.labelAlign).toBeUndefined();
    expect(s.labelBaseline).toBe('top');
  });

  test('short label + narrow chart picks vertical (-90°) without truncating "1979"', () => {
    const s = callSettings({maxString: '1979', width: 200, uniqueValues: 40});
    expect(s.labelAngle).toBe(-90);
    expect(s.labelLimit).toBe(0);
    expect(s.labelAlign).toBe('right');
  });

  test('medium label + medium chart picks diagonal (-45°)', () => {
    const s = callSettings({
      maxString: 'January 2024',
      width: 500,
      uniqueValues: 7,
    });
    expect(s.labelAngle).toBe(-45);
    expect(s.labelLimit).toBe(0);
    expect(s.labelAlign).toBe('right');
    expect(s.labelBaseline).toBe('top');
  });

  test('-45° reserved label band = (maxStringSize + lineHeight) * cos(45°)', () => {
    const s = callSettings({
      maxString: 'January 2024',
      width: 500,
      uniqueValues: 7,
    });
    // (80 + 12) * cos(45°) — line-height contributes to the rotated band.
    const expectedBand = (80 + 12) * Math.SQRT1_2;
    expect(s.minExtent).toBeCloseTo(expectedBand, 5);
    expect(s.maxExtent).toBeCloseTo(expectedBand, 5);
  });

  test('long label + dense axis picks vertical and truncates to the binding cap', () => {
    // chartHeight=80, titleBlock = 2*16 + 12 + 6 = 50, budget = 30.
    // plotProtectionCap = 0.35 * 80 = 28, which is tighter than the 30px budget,
    // so the cap is the binding constraint: labelLimit = min(28, 30) = 28.
    // reservedLabelBand reserves space for Vega's appended ellipsis = 28 + 10.
    const s = callSettings({
      maxString: 'very long category label',
      width: 200,
      uniqueValues: 40,
      height: 80,
    });
    expect(s.labelAngle).toBe(-90);
    expect(s.labelLimit).toBe(28);
    expect(s.minExtent).toBe(38);
    expect(s.maxExtent).toBe(38);
  });

  test('long but fitting label on a medium-tall chart still caps the band (PR #2777 review regression)', () => {
    // mtoy-googly-moogly's review case: a ~160px label on an md chart (252px tall).
    // Without the cap, labelLimit=0 reserved the full 160px band, dropping the
    // plot to ~14px. plotProtectionCap = 0.35 * 252 = 88.2 < 160, so the cap
    // truncates: labelLimit = min(88.2, 202) = 88.2, band = 88.2 + 10 ellipsis.
    const s = callSettings({
      maxString: 'very long category label',
      width: 400,
      uniqueValues: 10,
      height: 252,
    });
    expect(s.labelAngle).toBe(-90);
    expect(s.labelLimit).toBeCloseTo(88.2, 5);
    expect(s.minExtent).toBeCloseTo(98.2, 5);
    expect(s.maxExtent).toBeCloseTo(98.2, 5);
  });

  test('degenerate chart (height <= titleBlock) does not explode xAxisHeight', () => {
    // chartHeight=40, titleBlock=50, labelHeightBudget=0.
    // Old code would set reservedLabelBand = maxStringSize (160) via the
    // `labelLimit || maxStringSize` falsy-zero idiom, ballooning xAxisHeight
    // past the entire chart. New code forces truncation to 1px + ellipsis.
    const s = callSettings({
      maxString: 'very long category label',
      width: 200,
      uniqueValues: 40,
      height: 40,
    });
    expect(s.labelAngle).toBe(-90);
    expect(s.labelLimit).toBe(1);
    expect(s.minExtent).toBe(11);
    expect(s.height).toBe(11 + 50);
  });

  test('isSpark returns hidden: true', () => {
    const s = callSettings({
      maxString: '1979',
      width: 200,
      uniqueValues: 40,
      isSpark: true,
    });
    expect(s.hidden).toBe(true);
  });
});

describe('getChartLayoutSettings (dual-axis / combo)', () => {
  beforeEach(() => {
    textWidths.clear();
    resetScaleBehavior();
  });

  function makeMeasure(name: string, min: number, max: number): Field {
    return {
      name,
      minNumber: min,
      maxNumber: max,
      // Force the locale-format label path (not renderNumericField) so the test
      // stays independent of numeric-field rendering.
      isBasic: () => false,
    } as unknown as Field;
  }

  function makeXField(name = 'x'): Field {
    return {
      name,
      maxString: '1979',
      valueSet: {size: 5},
    } as unknown as Field;
  }

  function makeNest(xField: Field, yField: Field): NestField {
    return {
      fields: [xField, yField],
      isRoot: () => false,
      maxUniqueFieldValueCounts: new Map([['x', 5]]),
    } as unknown as NestField;
  }

  function layout(opts: {
    preset?: string;
    height?: number;
    y2Field?: Field;
    independentY2?: boolean;
    independentY?: boolean;
  }) {
    const xField = makeXField();
    const yField = makeMeasure('y', 0, 100);
    const nest = makeNest(xField, yField);
    return getChartLayoutSettings(nest, {
      size: {
        preset: opts.preset ?? 'md',
        ...(opts.height !== undefined && {height: opts.height}),
      } as unknown as ChartSizeConfig,
      metadata: {
        parentSize: {width: 400, height: 300},
      } as unknown as RenderMetadata,
      xField,
      yField,
      chartType: 'combo',
      y2Field: opts.y2Field,
      independentY: opts.independentY,
      independentY2: opts.independentY2,
    });
  }

  // The mocked scale domain is [0, 1], so both axes' min/max labels format to
  // '0'/'1' (6px each → maxLabel 6). With getTextHeightDOM=12: width =
  // maxLabel(6) + 2*titleOffset(12) + titleSize(12) + labelPadding(6) = 48. Both
  // axes run through the same measureAxisMetrics, so both get 48 — that
  // shared-path equality is the point of the refactor.
  const AXIS_WIDTH = 6 + 2 * 12 + 12 + 6;

  test('no y2Field (bar/line path): no secondary axis, right padding stays the 8px fallback', () => {
    const s = layout({});
    expect(s.y2Axis).toBeUndefined();
    expect(s.y2Scale).toBeUndefined();
    expect(s.isSpark).toBe(false);
    expect(s.yAxis.width).toBe(AXIS_WIDTH);
    expect(s.padding.left).toBe(AXIS_WIDTH);
    expect(s.padding.right).toBe(8);
    expect(s.yScale.domain).toEqual([0, 1]);
  });

  test('independentY nulls the shared yScale domain (bar/line path)', () => {
    expect(layout({independentY: true}).yScale.domain).toBeNull();
  });

  test('y2Field present (combo): secondary axis sized by the same helper, right padding reserves it', () => {
    const s = layout({y2Field: makeMeasure('y2', 0, 50)});
    expect(s.y2Axis).toBeDefined();
    expect(s.y2Axis!.width).toBe(AXIS_WIDTH);
    // Right padding is the secondary-axis width, not the 8px fallback.
    expect(s.padding.right).toBe(AXIS_WIDTH);
    expect(s.y2Scale).toEqual({domain: [0, 1]});
  });

  test('independentY2 nulls only the secondary domain', () => {
    const s = layout({y2Field: makeMeasure('y2', 0, 50), independentY2: true});
    expect(s.y2Scale!.domain).toBeNull();
    expect(s.yScale.domain).toEqual([0, 1]);
  });

  test('spark suppresses the secondary axis and keeps its fixed padding even when a y2Field is supplied', () => {
    const s = layout({preset: 'spark', y2Field: makeMeasure('y2', 0, 50)});
    expect(s.isSpark).toBe(true);
    expect(s.y2Axis).toBeUndefined();
    expect(s.y2Scale).toBeUndefined();
    expect(s.padding).toEqual({top: 4, left: 0, bottom: 4, right: 0});
  });

  // --- Top-tick overflow correction -------------------------------------
  // When `nice()`'s last tick stops short of the domain max, the top data point
  // would clip, so the layout borrows from the top padding and pins the tick
  // count. The refactor moved this math into the shared measureAxisMetrics /
  // topTickOverflowExtra helpers, and it is the one branch a fixed [0, 1]
  // domain/ticks stub can never reach — hence the configurable scale stub.
  //
  // With height=80: tickCount = ceil(80/40) = 2, and base topPadding =
  // ROW_HEIGHT - 1 = 27 (padding.top adds 1).
  describe('top-tick overflow correction', () => {
    test('top tick reaching the domain max leaves padding and tick count alone', () => {
      scaleBehavior.domain = [0, 100];
      scaleBehavior.ticks = null; // ticks == domain -> topTick === max
      const s = layout({height: 80});
      expect(s.padding.top).toBe(28); // 27 + 1, nothing borrowed
      expect(s.yAxis.tickCount).toBeUndefined();
    });

    test('top tick short of the max borrows from top padding and pins the tick count', () => {
      // offRatio = (100-80)/100 = 0.2 -> extra = 80/0.8 - 80 = 20
      scaleBehavior.domain = [0, 100];
      scaleBehavior.ticks = [0, 80];
      const s = layout({height: 80});
      expect(s.padding.top).toBe(27 - 20 + 1);
      expect(s.yAxis.tickCount).toBe(2);
    });

    test('a large overflow clamps top padding at 0 rather than going negative', () => {
      // offRatio = 0.5 -> extra = 80 > 27, so the subtraction is floored at 0.
      scaleBehavior.domain = [0, 100];
      scaleBehavior.ticks = [0, 50];
      const s = layout({height: 80});
      expect(s.padding.top).toBe(1); // 0 + 1
      expect(s.yAxis.tickCount).toBe(2);
    });

    test('dual axis: the larger of the two corrections is applied, and only once', () => {
      // primary extra = 80/0.9 - 80 ~= 8.89; secondary extra = 80/0.8 - 80 = 20.
      // Applying both would floor top padding at 0; taking the max gives 7 (+1).
      scaleBehavior.perCall = [
        {domain: [0, 100], ticks: [0, 90]},
        {domain: [0, 100], ticks: [0, 80]},
      ];
      const s = layout({height: 80, y2Field: makeMeasure('y2', 0, 100)});
      expect(s.padding.top).toBe(27 - 20 + 1);
      expect(s.yAxis.tickCount).toBe(2);
    });

    test('dual axis: a secondary-only overflow still corrects the shared top padding', () => {
      // Primary top tick reaches its max (no correction); only y2 overflows.
      scaleBehavior.perCall = [
        {domain: [0, 100], ticks: null},
        {domain: [0, 100], ticks: [0, 80]},
      ];
      const s = layout({height: 80, y2Field: makeMeasure('y2', 0, 100)});
      expect(s.padding.top).toBe(27 - 20 + 1);
      // The primary axis needed no correction, so its tick count stays unpinned.
      expect(s.yAxis.tickCount).toBeUndefined();
      expect(s.y2Axis!.tickCount).toBe(2);
    });
  });
});
