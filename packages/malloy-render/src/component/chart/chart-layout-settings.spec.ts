/*
 * Copyright 2026 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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

  test('long label + dense axis picks vertical and truncates to labelHeightBudget', () => {
    // chartHeight=80, titleBlock = 2*16 + 12 + 6 = 50, budget = 30.
    // maxString 'very long category label' = 160 px > 30 px, so labelLimit = 30.
    // reservedLabelBand reserves space for Vega's appended ellipsis = 30 + 10.
    const s = callSettings({
      maxString: 'very long category label',
      width: 200,
      uniqueValues: 40,
      height: 80,
    });
    expect(s.labelAngle).toBe(-90);
    expect(s.labelLimit).toBe(30);
    expect(s.minExtent).toBe(40);
    expect(s.maxExtent).toBe(40);
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
