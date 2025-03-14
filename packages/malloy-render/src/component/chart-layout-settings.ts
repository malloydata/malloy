/*
 * Copyright 2023 Google LLC
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

import type {Tag} from '@malloydata/malloy-tag';
import type {AlignValue, TextBaselineValue} from 'vega';
import {scale, locale} from 'vega';
import {getTextWidthDOM} from './util';
import {renderNumericField} from './render-numeric-field';
import type {Field, NestField} from '../data_tree';

export type ChartLayoutSettings = {
  plotWidth: number;
  plotHeight: number;
  xAxis: {
    labelAngle: number;
    labelAlign?: AlignValue;
    labelBaseline?: TextBaselineValue;
    labelLimit: number;
    height: number;
    titleSize: number;
    hidden: boolean;
  };
  yAxis: {
    width: number;
    tickCount?: number;
    hidden: boolean;
    yTitleSize: number;
  };
  yScale: {
    domain: number[];
  };
  xField: Field;
  yField: Field;
  padding: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
  totalWidth: number;
  totalHeight: number;
};

// Later should depend on chart type?
const CHART_SIZES = {
  'spark': [180, 1], // row height
  'xs': [170, 2], // 2x row height
  'sm': [216, 3], // 3x row height
  'md': [256, 4], // 4x row height
  'lg': [472, 7], // 7x row height
  'xl': [508, 10], // 10x row height
  '2xl': [730, 14], // 14x row height
};

// TODO: read from theme CSS
const ROW_HEIGHT = 28;

export function getChartLayoutSettings(
  field: NestField,
  chartTag: Tag,
  options: {
    xField?: Field;
    yField?: Field;
    chartType: string;
    getXMinMax?: () => [number, number];
    getYMinMax?: () => [number, number];
  }
): ChartLayoutSettings {
  // TODO: improve logic for field extraction
  // may not need this anymore if we enforce the options, so each chart passes its specific needs for calculating layout
  const xField = options?.xField ?? field.fields[0];
  const yField = options?.yField ?? field.fields[1];
  const tag = field.tag;

  // For now, support legacy API of size being its own tag
  const customWidth =
    chartTag.numeric('size', 'width') ?? tag.numeric('size', 'width');
  const customHeight =
    chartTag.numeric('size', 'height') ?? tag.numeric('size', 'height');
  const presetSize = (chartTag.text('size') ?? tag.text('size')) || 'md';
  let chartWidth = 0,
    chartHeight = 0,
    heightRows = 0;
  [chartWidth, heightRows] = CHART_SIZES[presetSize];
  chartHeight = heightRows * ROW_HEIGHT;
  if (customWidth) chartWidth = customWidth;
  if (customHeight) chartHeight = customHeight;

  let xAxisHeight = 0;
  let yAxisWidth = 0;
  let labelAngle = -90;
  let labelAlign: AlignValue | undefined = 'right';
  let labelBaseline: TextBaselineValue | undefined = 'middle';
  let labelLimit = 0;
  let xTitleSize = 0;
  let yTitleSize = 0;
  const hasXAxis = presetSize !== 'spark';
  const hasYAxis = presetSize !== 'spark';
  let topPadding = presetSize !== 'spark' ? ROW_HEIGHT - 1 : 0; // Subtract 1 to account for top border
  let yTickCount: number | undefined;
  const [minVal, maxVal] = options?.getYMinMax?.() ?? [
    yField.minNumber!,
    yField.maxNumber!,
  ];
  const yScale = scale('linear')()
    .domain([minVal, maxVal])
    .nice()
    .range([chartHeight, 0]);
  const yDomain = yScale.domain();

  if (hasYAxis) {
    const maxAxisVal = yScale.domain().at(1);
    const minAxisVal = yScale.domain().at(0);
    const l = locale();
    const formattedMin = yField.isAtomic()
      ? renderNumericField(yField, minAxisVal)
      : l.format(',')(minAxisVal);
    const formattedMax = yField.isAtomic()
      ? renderNumericField(yField, maxAxisVal)
      : l.format(',')(maxAxisVal);
    // const formattedMin = l.format(',')(minAxisVal);
    // const formattedMax = l.format(',')(maxAxisVal);
    yTitleSize = 31; // Estimate for now, can be dynamic later
    const yLabelOffset = 5;
    yAxisWidth =
      Math.max(
        getTextWidthDOM(formattedMin, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '10px',
          width: 'fit-content',
          opacity: '0',
          fontVariantNumeric: 'tabular-nums',
          position: 'absolute',
        }) + 4,
        getTextWidthDOM(formattedMax, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '10px',
          width: 'fit-content',
          opacity: '0',
          fontVariantNumeric: 'tabular-nums',
          position: 'absolute',
        }) + 4
      ) +
      yLabelOffset +
      yTitleSize;

    // Check whether we need to adjust axis values manually
    const noOfTicks = Math.ceil(chartHeight / 40);
    const ticks = yScale.ticks(noOfTicks);
    const topTick = ticks.at(-1);
    if (topTick < maxAxisVal) {
      const offRatio = (maxAxisVal - topTick) / (maxAxisVal - minAxisVal);
      // adjust chart height
      const newChartHeight = chartHeight / (1 - offRatio);
      // adjust chart padding
      topPadding = Math.max(0, topPadding - (newChartHeight - chartHeight));
      chartHeight = newChartHeight;

      // Hardcode # of ticks, or the resize could make room for more ticks and then screw things up
      yTickCount = noOfTicks;
    }
  }

  if (hasXAxis) {
    // TODO: add type checking here for axis. for now assume number, string
    const maxString = xField.maxString!;
    const maxStringSize =
      getTextWidthDOM(maxString, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        width: 'fit-content',
        opacity: '0',
        fontVariantNumeric: 'tabular-nums',
        position: 'absolute',
      }) + 4;

    const X_AXIS_THRESHOLD = 1;
    xTitleSize = 26;
    xAxisHeight = Math.min(maxStringSize, X_AXIS_THRESHOLD * chartHeight);
    labelLimit = xAxisHeight;

    // TODO: improve this, this logic exists in more detail in generate vega spec. this is a hacky partial solution for now :/
    const uniqueValuesCt = xField.valueSet.size;
    const isSharedDomain = uniqueValuesCt <= 20;
    const recordsToFit = isSharedDomain
      ? uniqueValuesCt
      : field.maxUniqueFieldValueCounts.get(xField.name)!;
    const xSpacePerLabel = chartWidth / recordsToFit;
    if (xSpacePerLabel > xAxisHeight || xSpacePerLabel > maxStringSize) {
      labelAngle = 0;
      // Remove label limit; our vega specs should use labelOverlap setting to hide overlapping labels
      labelLimit = 0;
      labelAlign = undefined;
      labelBaseline = 'top';
      xTitleSize = 22;
      xAxisHeight = 14;
    }
  }

  // Additional xTitle padding to snap to row height grid
  const totalSize = chartHeight + xAxisHeight + xTitleSize;
  const roundedUpRowHeight = Math.ceil(totalSize / ROW_HEIGHT) * ROW_HEIGHT;
  xTitleSize += roundedUpRowHeight - totalSize;

  const isSpark = tag.text('size') === 'spark';

  return {
    plotWidth: chartWidth,
    plotHeight: chartHeight,
    xAxis: {
      labelAngle,
      labelAlign,
      labelBaseline,
      labelLimit,
      height: xAxisHeight,
      titleSize: xTitleSize,
      hidden: isSpark,
    },
    yAxis: {
      width: yAxisWidth,
      tickCount: yTickCount,
      hidden: isSpark,
      yTitleSize,
    },
    yScale: {
      domain: chartTag.has('y', 'independent') ? null : yDomain,
    },
    padding: isSpark
      ? {top: 0, left: 0, bottom: 0, right: 0}
      : {
          top: topPadding + 1,
          left: yAxisWidth,
          bottom: xAxisHeight + xTitleSize,
          right: 8,
        },
    xField,
    yField,
    get totalWidth() {
      return this.plotWidth + this.padding.left + this.padding.right;
    },
    get totalHeight() {
      return this.plotHeight + this.padding.top + this.padding.bottom;
    },
  };
}
