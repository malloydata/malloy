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
import type {AlignValue, TextBaselineValue, Config} from 'vega';
import {scale, locale} from 'vega';
import {getTextWidthDOM, getTextHeightDOM} from '@/component/util';
import {renderNumericField} from '@/component/render-numeric-field';
import type {Field, NestField} from '@/data_tree';
import type {RenderMetadata} from '@/component/render-result-metadata';

type XAxisSettings = {
  labelAngle: number;
  labelAlign?: AlignValue;
  labelBaseline?: TextBaselineValue;
  labelLimit: number;
  height: number;
  titleSize: number;
  hidden: boolean;
};

interface FontSettings {
  fontFamily: string;
  fontSize: string;
  fontWeight?: string;
}

function getAxisFontSettings(vegaConfig?: Config): {
  xLabel: FontSettings;
  yLabel: FontSettings;
  xTitle: FontSettings;
  yTitle: FontSettings;
} {
  const defaultLabelFont = {
    fontFamily: 'Inter, sans-serif',
    fontSize: '10px',
  };

  const defaultTitleFont = {
    fontFamily: 'Inter, sans-serif',
    fontSize: '10px',
    fontWeight: '500',
  };

  if (!vegaConfig) {
    return {
      xLabel: defaultLabelFont,
      yLabel: defaultLabelFont,
      xTitle: defaultTitleFont,
      yTitle: defaultTitleFont,
    };
  }

  // Extract label font settings with proper fallback chain
  const xLabelFontWeight =
    vegaConfig.axisX?.labelFontWeight || vegaConfig.axis?.labelFontWeight;
  const yLabelFontWeight =
    vegaConfig.axisY?.labelFontWeight || vegaConfig.axis?.labelFontWeight;

  const xLabelFont: FontSettings = {
    fontFamily: (vegaConfig.axisX?.labelFont ||
      vegaConfig.axis?.labelFont ||
      'Inter, sans-serif') as string,
    fontSize: `${
      vegaConfig.axisX?.labelFontSize || vegaConfig.axis?.labelFontSize || 10
    }px`,
    ...(xLabelFontWeight && {fontWeight: String(xLabelFontWeight)}),
  };

  const yLabelFont: FontSettings = {
    fontFamily: (vegaConfig.axisY?.labelFont ||
      vegaConfig.axis?.labelFont ||
      'Inter, sans-serif') as string,
    fontSize: `${
      vegaConfig.axisY?.labelFontSize || vegaConfig.axis?.labelFontSize || 10
    }px`,
    ...(yLabelFontWeight && {fontWeight: String(yLabelFontWeight)}),
  };

  // Extract title font settings with proper fallback chain
  const xTitleFontWeight =
    vegaConfig.axisX?.titleFontWeight || vegaConfig.axis?.titleFontWeight;
  const yTitleFontWeight =
    vegaConfig.axisY?.titleFontWeight || vegaConfig.axis?.titleFontWeight;

  const xTitleFont: FontSettings = {
    fontFamily: (vegaConfig.axisX?.titleFont ||
      vegaConfig.axis?.titleFont ||
      'Inter, sans-serif') as string,
    fontSize: `${
      vegaConfig.axisX?.titleFontSize || vegaConfig.axis?.titleFontSize || 10
    }px`,
    ...(xTitleFontWeight && {fontWeight: String(xTitleFontWeight)}),
  };

  const yTitleFont: FontSettings = {
    fontFamily: (vegaConfig.axisY?.titleFont ||
      vegaConfig.axis?.titleFont ||
      'Inter, sans-serif') as string,
    fontSize: `${
      vegaConfig.axisY?.titleFontSize || vegaConfig.axis?.titleFontSize || 10
    }px`,
    ...(yTitleFontWeight && {fontWeight: String(yTitleFontWeight)}),
  };

  return {
    xLabel: xLabelFont,
    yLabel: yLabelFont,
    xTitle: xTitleFont,
    yTitle: yTitleFont,
  };
}

export function getXAxisSettings({
  maxString,
  chartHeight,
  chartWidth,
  xField,
  parentField,
  parentTag,
  vegaConfig,
}: {
  maxString: string;
  chartHeight: number;
  chartWidth: number;
  xField: Field;
  parentField: NestField;
  parentTag: Tag;
  vegaConfig?: Config;
}): XAxisSettings {
  let xAxisHeight = 0;
  let labelAngle = -90;
  let labelAlign: AlignValue | undefined = 'right';
  let labelBaseline: TextBaselineValue | undefined = 'middle';
  let labelLimit = 0;
  const xTitleSize = 20;

  // Get font settings from vega config
  const fontSettings = getAxisFontSettings(vegaConfig);
  const xFontStyles = {
    fontFamily: fontSettings.xLabel.fontFamily,
    fontSize: fontSettings.xLabel.fontSize,
    ...(fontSettings.xLabel.fontWeight && {
      fontWeight: fontSettings.xLabel.fontWeight,
    }),
    width: 'fit-content',
    opacity: '0',
    fontVariantNumeric: 'tabular-nums',
    position: 'absolute',
  };

  const maxStringSize = getTextWidthDOM(maxString, xFontStyles) + 4;
  const ellipsesSize = getTextWidthDOM('...', xFontStyles) + 4;

  const X_AXIS_THRESHOLD = 0.35;
  const xAxisBottomPadding = 12;
  const plotHeight =
    chartHeight - xAxisBottomPadding - xTitleSize - ellipsesSize;

  xAxisHeight =
    Math.min(maxStringSize, X_AXIS_THRESHOLD * plotHeight) + xAxisBottomPadding;
  labelLimit = xAxisHeight;
  if (xAxisHeight < maxStringSize) {
    xAxisHeight += ellipsesSize;
  }

  // TODO: improve this, this logic exists in more detail in generate vega spec. this is a hacky partial solution for now :/
  const uniqueValuesCt = xField.valueSet.size;
  const isSharedDomain = uniqueValuesCt <= 20;
  const recordsToFit = isSharedDomain
    ? uniqueValuesCt
    : parentField.maxUniqueFieldValueCounts.get(xField.name)!;
  // TODO: shouldn't yTitleSize and yAxisWidth be subtracted from this chartWidth?
  const xSpacePerLabel = chartWidth / recordsToFit;
  if (xSpacePerLabel > xAxisHeight || xSpacePerLabel > maxStringSize) {
    labelAngle = 0;
    // Remove label limit; our vega specs should use labelOverlap setting to hide overlapping labels
    labelLimit = 0;
    labelAlign = undefined;
    labelBaseline = 'top';
    xAxisHeight = 28;
  }

  return {
    labelAngle,
    labelLimit,
    labelBaseline,
    labelAlign,
    height: xAxisHeight,
    titleSize: xTitleSize,
    hidden: parentTag.text('size') === 'spark',
  };
}

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
    titlePadding: number;
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
  isSpark: boolean;
};

// [width, height multiplier of row height]
const CHART_SIZES = {
  'spark': [180, 1],
  'xs': [170, 4],
  'sm': [315, 6],
  'md': [355, 9],
  'lg': [570, 12],
  'xl': [606, 16],
  '2xl': [828, 20],
};

// TODO: read from theme CSS
const ROW_HEIGHT = 28;

export function getChartLayoutSettings(
  field: NestField,
  chartTag: Tag,
  options: {
    metadata: RenderMetadata;
    xField?: Field;
    yField?: Field;
    chartType: string;
    getXMinMax?: () => [number, number];
    getYMinMax?: () => [number, number];
    independentY?: boolean;
    vegaConfig?: Config;
  }
): ChartLayoutSettings {
  // TODO: improve logic for field extraction
  // may not need this anymore if we enforce the options, so each chart passes its specific needs for calculating layout
  const xField = options?.xField ?? field.fields[0];
  const yField = options?.yField ?? field.fields[1];
  const tag = field.tag;

  // For now, support legacy API of size being its own tag
  const taggedWidth =
    chartTag.numeric('size', 'width') ?? tag.numeric('size', 'width');
  const taggedHeight =
    chartTag.numeric('size', 'height') ?? tag.numeric('size', 'height');
  const taggedPresetSize = chartTag.text('size') ?? tag.text('size');
  const hasNoDefinedSize = !taggedWidth && !taggedHeight && !taggedPresetSize;
  const isFillMode =
    taggedPresetSize === 'fill' || (hasNoDefinedSize && field.isRoot());
  const presetSize =
    taggedPresetSize &&
    Object.prototype.hasOwnProperty.call(CHART_SIZES, taggedPresetSize)
      ? taggedPresetSize
      : 'md';
  let chartWidth = 0,
    chartHeight = 0;

  if (isFillMode) {
    chartWidth = options.metadata.parentSize.width;
    chartHeight = options.metadata.parentSize.height;
  } else {
    const [presetWidth, heightRows] = CHART_SIZES[presetSize];
    const presetHeight = heightRows * ROW_HEIGHT;
    chartWidth = taggedWidth ?? presetWidth;
    chartHeight = taggedHeight ?? presetHeight;
  }

  let yAxisWidth = 0;
  let yTitleSize = 0;
  let yTitleOffset = 10; // Default value
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
    const formattedMin = yField.isBasic()
      ? renderNumericField(yField, minAxisVal)
      : l.format(',')(minAxisVal);
    const formattedMax = yField.isBasic()
      ? renderNumericField(yField, maxAxisVal)
      : l.format(',')(maxAxisVal);

    // Get font settings from vega config
    const fontSettings = getAxisFontSettings(options.vegaConfig);
    const yLabelFontStyles = {
      fontFamily: fontSettings.yLabel.fontFamily,
      fontSize: fontSettings.yLabel.fontSize,
      ...(fontSettings.yLabel.fontWeight && {
        fontWeight: fontSettings.yLabel.fontWeight,
      }),
      width: 'fit-content',
      opacity: '0',
      fontVariantNumeric: 'tabular-nums',
      position: 'absolute',
    };

    const yTitleFontStyles = {
      fontFamily: fontSettings.yTitle.fontFamily,
      fontSize: fontSettings.yTitle.fontSize,
      ...(fontSettings.yTitle.fontWeight && {
        fontWeight: fontSettings.yTitle.fontWeight,
      }),
      width: 'fit-content',
      opacity: '0',
      position: 'absolute',
    };

    // Measure the height of title text with capital letters to get accurate vertical spacing
    yTitleSize = getTextHeightDOM(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZgy',
      yTitleFontStyles
    );

    // Calculate dynamic Y title offset
    // First check if title offset is specified in Vega config
    const configTitleOffset = options.vegaConfig?.title?.offset;

    if (configTitleOffset !== undefined) {
      // Use the configured value
      yTitleOffset = Number(configTitleOffset);
    } else {
      // Use the title size as the offset
      yTitleOffset = yTitleSize;
    }

    const yPadding = 4;
    yAxisWidth =
      Math.max(
        getTextWidthDOM(formattedMin, yLabelFontStyles) + yPadding,
        getTextWidthDOM(formattedMax, yLabelFontStyles) + yPadding
      ) +
      yTitleOffset * 2 + // Equal spacing on both sides of title
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
      // Hardcode # of ticks, or the resize could make room for more ticks and then screw things up
      yTickCount = noOfTicks;
    }
  }

  const xAxisSettings = getXAxisSettings({
    maxString: xField.maxString!,
    chartHeight,
    chartWidth,
    xField,
    parentField: field,
    parentTag: tag,
    vegaConfig: options.vegaConfig,
  });

  const isSpark = tag.text('size') === 'spark';

  const padding = xAxisSettings.hidden
    ? {top: 0, left: 0, bottom: 0, right: 0}
    : {
        top: topPadding + 1,
        left: yAxisWidth,
        bottom: xAxisSettings.height + xAxisSettings.titleSize,
        right: 8,
      };

  // TODO: do we need these different sizes anymore, since all the same?
  const plotWidth = chartWidth;
  const plotHeight = chartHeight;
  const totalWidth = chartWidth;
  const totalHeight = chartHeight;

  return {
    plotWidth,
    plotHeight,
    xAxis: xAxisSettings,
    yAxis: {
      width: yAxisWidth,
      tickCount: yTickCount,
      hidden: isSpark,
      yTitleSize,
      titlePadding: yTitleOffset,
    },
    yScale: {
      domain: options.independentY ? null : yDomain,
    },
    padding: isSpark ? {top: 0, left: 0, bottom: 0, right: 0} : padding,
    xField,
    yField,
    totalWidth,
    totalHeight,
    isSpark,
  };
}
