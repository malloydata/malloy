/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const textWidths = new Map<string, number>();

jest.mock('vega', () => ({
  scale: () => () => ({
    domain: () => ({nice: () => ({range: () => ({domain: () => [0, 1]})})}),
  }),
  locale: () => ({format: () => (n: number) => String(n)}),
}));

jest.mock('@/component/util', () => ({
  getTextWidthDOM: (text: string) => textWidths.get(text) ?? 6 * text.length,
  getTextHeightDOM: () => 12,
}));

import {getXAxisSettings} from './chart-layout-settings';
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
