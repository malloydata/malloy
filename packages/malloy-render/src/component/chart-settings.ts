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

import {ExploreField, Field} from '@malloydata/malloy';
import {scale, locale} from 'vega';
import {getFieldKey, getTextWidth} from './util';
import {RenderResultMetadata} from './render-result-metadata';

export type ChartSettings = {
  plotWidth: number;
  plotHeight: number;
  xAxis: {
    labelAngle: number;
    labelSize: number;
    height: number;
    titleSize: number;
  };
  yAxis: {
    width: number;
    tickCount?: number;
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

export function getChartSettings(
  field: ExploreField,
  metadata: RenderResultMetadata
): ChartSettings {
  // TODO: improve logic for field extraction
  const xField = field.allFields.at(0)!;
  const yField = field.allFields.at(1)!;
  const {tag} = field.tagParse();

  let chartWidth = 0,
    chartHeight = 0;
  const customWidth = tag.numeric('size', 'width');
  const customHeight = tag.numeric('size', 'height');
  let presetSize = tag.text('size');
  if (customWidth && customHeight) {
    chartWidth = customWidth;
    chartHeight = customHeight;
  } else {
    presetSize = presetSize || 'md';
    [chartWidth, chartHeight] = CHART_SIZES[presetSize];
    chartHeight = chartHeight * ROW_HEIGHT;
  }

  let xAxisHeight = 0;
  let yAxisWidth = 0;
  let labelAngle = -90;
  let labelSize = 0;
  let xTitleSize = 0;
  const hasXAxis = presetSize !== 'spark';
  const hasYAxis = presetSize !== 'spark';
  const exploreMetadata = metadata.fields[getFieldKey(field)];
  let topPadding = presetSize !== 'spark' ? ROW_HEIGHT - 1 : 0; // Subtract 1 to account for top border
  let yTickCount: number | undefined;
  const yKey = getFieldKey(yField);
  const maxVal = metadata.fields[yKey]!.max!;
  const yScale = scale('linear')()
    .domain([0, maxVal])
    .nice()
    .range([chartHeight, 0]);
  const yDomain = yScale.domain();

  if (hasYAxis) {
    const maxAxisVal = yScale.domain().at(1);
    const l = locale();
    const formatted = l.format(',')(maxAxisVal);
    const yTitleSize = 31; // Estimate for now, can be dynamic later
    const yLabelOffset = 5;
    yAxisWidth =
      getTextWidth(formatted, 'Inter, sans-serif 12px') +
      yLabelOffset +
      yTitleSize;

    // Check whether we need to adjust axis values manually
    const noOfTicks = Math.ceil(chartHeight / 40);
    const ticks = yScale.ticks(noOfTicks);
    if (ticks.at(-1) < maxAxisVal) {
      const offRatio = (maxAxisVal - ticks.at(-1)) / maxAxisVal;
      // adjust chart height
      const newChartHeight = chartHeight / (1 - offRatio);
      // adjust chart padding
      topPadding = topPadding - (newChartHeight - chartHeight);
      chartHeight = newChartHeight;

      // Hardcode # of ticks, or the resize could make room for more ticks and then screw things up
      yTickCount = noOfTicks;
    }
  }

  if (hasXAxis) {
    // TODO: add type checking here for axis. for now assume number, string
    const xKey = getFieldKey(xField);
    const maxString = metadata.fields[xKey]!.maxString!;
    const maxStringSize = getTextWidth(maxString, 'Inter, sans-serif 12px');
    const X_AXIS_THRESHOLD = 0.3;
    const minBottomPadding = 15;
    xTitleSize = 22 + minBottomPadding;
    xAxisHeight = Math.min(maxStringSize, X_AXIS_THRESHOLD * chartHeight);
    labelSize = xAxisHeight;

    const xSpacePerLabel =
      (chartWidth - yAxisWidth) / exploreMetadata.maxRecordCt!;
    if (xSpacePerLabel > xAxisHeight) {
      labelAngle = 0;
      labelSize = xSpacePerLabel;
    }
  }

  // Additional xTitle padding to snap to row height grid
  const totalSize = chartHeight + xAxisHeight + xTitleSize;
  const roundedUpRowHeight = Math.ceil(totalSize / ROW_HEIGHT) * ROW_HEIGHT;
  xTitleSize += roundedUpRowHeight - totalSize;

  return {
    plotWidth: chartWidth,
    plotHeight: chartHeight,
    xAxis: {
      labelAngle,
      labelSize,
      height: xAxisHeight,
      titleSize: xTitleSize,
    },
    yAxis: {
      width: yAxisWidth,
      tickCount: yTickCount,
    },
    yScale: {
      domain: yDomain,
    },
    padding: {
      top: topPadding,
      left: yAxisWidth,
      bottom: xAxisHeight + xTitleSize,
      right: 0,
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
