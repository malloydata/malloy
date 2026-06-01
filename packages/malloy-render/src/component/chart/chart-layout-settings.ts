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

import type {
  AlignValue,
  TextBaselineValue,
  Config,
  FontWeightValue,
} from 'vega';
import {scale, locale} from 'vega';
import {getTextWidthDOM, getTextHeightDOM} from '@/component/util';
import {renderNumericField} from '@/component/render-numeric-field';
import type {Field, NestField} from '@/data_tree';
import type {RenderMetadata} from '@/component/render-result-metadata';
import type {ChartSizeConfig} from '@/component/chart/resolve-chart-display';

type XAxisSettings = {
  labelAngle: number;
  labelAlign?: AlignValue;
  labelBaseline?: TextBaselineValue;
  labelLimit: number;
  minExtent: number;
  maxExtent: number;
  height: number;
  titleSize: number;
  titleBaseline: TextBaselineValue;
  titleY: number;
  hidden: boolean;
  labelPadding: number;
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
  vegaConfig,
  isSpark,
}: {
  maxString: string;
  chartHeight: number;
  chartWidth: number;
  xField: Field;
  parentField: NestField;
  vegaConfig?: Config;
  isSpark: boolean;
}): XAxisSettings {
  let xAxisHeight = 0;
  let labelAngle = -90;
  let labelAlign: AlignValue | undefined = 'right';
  let labelLimit = 0;
  let xTitleSize = 12;
  let xTitleOffset = 16;
  let xLabelPadding = 6;

  // Get font settings from vega config
  const fontSettings = getAxisFontSettings(vegaConfig);
  const xLabelFontStyles = {
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

  const xTitleFontStyles = {
    fontFamily: fontSettings.xTitle.fontFamily,
    fontSize: fontSettings.xTitle.fontSize,
    ...(fontSettings.xTitle.fontWeight && {
      fontWeight: fontSettings.xTitle.fontWeight,
    }),
    width: 'fit-content',
    opacity: '0',
    position: 'absolute',
  };

  // Measure X title size dynamically
  xTitleSize = getTextHeightDOM(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZgy',
    xTitleFontStyles
  );

  // Calculate dynamic X title offset with fallback chain
  const axisXTitlePadding = vegaConfig?.axisX?.titlePadding;
  const axisTitlePadding = vegaConfig?.axis?.titlePadding;
  const configTitleOffset = vegaConfig?.title?.offset;

  if (axisXTitlePadding !== undefined) {
    xTitleOffset = Number(axisXTitlePadding);
  } else if (axisTitlePadding !== undefined) {
    xTitleOffset = Number(axisTitlePadding);
  } else if (configTitleOffset !== undefined) {
    xTitleOffset = Number(configTitleOffset);
  }

  // Calculate dynamic X label padding with fallback chain
  const axisXLabelPadding = vegaConfig?.axisX?.labelPadding;
  const axisLabelPadding = vegaConfig?.axis?.labelPadding;
  if (axisXLabelPadding !== undefined) {
    xLabelPadding = Number(axisXLabelPadding);
  } else if (axisLabelPadding !== undefined) {
    xLabelPadding = Number(axisLabelPadding);
  }

  const maxStringSize = getTextWidthDOM(maxString, xLabelFontStyles);
  const ellipsesSize = getTextWidthDOM('...', xLabelFontStyles);
  const horizontalLabelHeight = getTextHeightDOM(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZgy',
    xLabelFontStyles
  );

  const titleBlock = xTitleOffset * 2 + xTitleSize + xLabelPadding;
  const labelHeightBudget = Math.max(0, chartHeight - titleBlock);

  // TODO: improve this, this logic exists in more detail in generate vega spec. this is a hacky partial solution for now :/
  const uniqueValuesCt = xField.valueSet.size;
  const isSharedDomain = uniqueValuesCt <= 20;
  const recordsToFit = isSharedDomain
    ? uniqueValuesCt
    : parentField.maxUniqueFieldValueCounts.get(xField.name)!;
  // TODO: shouldn't yTitleSize and yAxisWidth be subtracted from this chartWidth?
  const xSpacePerLabel = chartWidth / recordsToFit;

  // labelSeparation in the Vega axis spec; keep in sync with generate-*-vega-spec.ts.
  const LABEL_SEPARATION = 4;
  // cos(45°) = sin(45°) = √2/2. The vertical bounding box of a -45° rotated
  // label is (width + lineHeight) * cos(45°), since both the width and the
  // line-height project onto the vertical axis after rotation.
  const SQRT2_OVER_2 = Math.SQRT1_2;
  const diagonalBand = (maxStringSize + horizontalLabelHeight) * SQRT2_OVER_2;
  // Cap the vertical (-90°) label band at this fraction of the chart height so a
  // long categorical label can't starve the plot. The pre-3-tier code used the
  // same 0.35 fraction but against a plotHeight estimate that subtracted the
  // title block and ellipsis; that expression collapsed to a few pixels on short
  // charts and over-truncated labels (the #2777 complaint). Capping against
  // chartHeight keeps the plot protection without that degenerate collapse.
  const MAX_VERTICAL_LABEL_HEIGHT_FRACTION = 0.35;

  let reservedLabelBand: number;

  if (xSpacePerLabel >= maxStringSize + LABEL_SEPARATION) {
    // Tier 1: horizontal. Labels fit without overlap, no truncation needed.
    labelAngle = 0;
    labelLimit = 0;
    labelAlign = undefined;
    reservedLabelBand = horizontalLabelHeight;
  } else if (
    xSpacePerLabel >= maxStringSize * SQRT2_OVER_2 + LABEL_SEPARATION &&
    diagonalBand <= labelHeightBudget
  ) {
    // Tier 2: diagonal (-45°). Both the horizontal and vertical projections fit.
    labelAngle = -45;
    labelAlign = 'right';
    labelLimit = 0;
    reservedLabelBand = diagonalBand;
  } else {
    // Tier 3: vertical (-90°). Truncate when the label doesn't fit the available
    // label band, OR when leaving it un-truncated would crush the plot. Short
    // labels still skip truncation, preserving the #2777 fix.
    labelAngle = -90;
    labelAlign = 'right';
    const plotProtectionCap = MAX_VERTICAL_LABEL_HEIGHT_FRACTION * chartHeight;
    if (
      maxStringSize <= labelHeightBudget &&
      maxStringSize <= plotProtectionCap
    ) {
      labelLimit = 0;
      reservedLabelBand = maxStringSize;
    } else {
      // Vega appends '...' past labelLimit, so the rendered band is
      // labelLimit + ellipsesSize. Math.max(1, ...) avoids labelLimit=0
      // which Vega treats as "no limit".
      labelLimit = Math.max(1, Math.min(plotProtectionCap, labelHeightBudget));
      reservedLabelBand = labelLimit + ellipsesSize;
    }
  }

  xAxisHeight = reservedLabelBand + titleBlock;
  const titleArea = xAxisHeight - (xLabelPadding + reservedLabelBand);

  return {
    labelAngle,
    labelLimit,
    labelPadding: xLabelPadding,
    minExtent: reservedLabelBand,
    maxExtent: reservedLabelBand,
    labelBaseline: 'top',
    labelAlign,
    height: xAxisHeight,
    titleSize: xTitleSize,
    titleBaseline: 'middle',
    titleY: xAxisHeight - titleArea / 2,
    hidden: isSpark,
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
    titleY: number;
    hidden: boolean;
  };
  yAxis: {
    width: number;
    minExtent: number;
    maxExtent: number;
    tickCount?: number;
    hidden: boolean;
    yTitleSize: number;
    labelPadding: number;
    titlePadding: number;
    titleFont: string;
    titleFontSize: number;
    titleFontWeight?: FontWeightValue;
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
  options: {
    size: ChartSizeConfig;
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

  const taggedWidth = options.size.width;
  const taggedHeight = options.size.height;
  const taggedPresetSize = options.size.preset;
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
  let yLabelPadding = 6;
  let maxYLabelWidth = 0;
  const hasYAxis = presetSize !== 'spark';
  let topPadding = presetSize !== 'spark' ? ROW_HEIGHT - 1 : 0; // Subtract 1 to account for top border
  let yTickCount: number | undefined;

  const fontSettings = getAxisFontSettings(options.vegaConfig);
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

    const axisYTitlePadding = options.vegaConfig?.axisY?.titlePadding;
    const axisTitlePadding = options.vegaConfig?.axis?.titlePadding;
    const configTitleOffset = options.vegaConfig?.title?.offset;

    if (axisYTitlePadding !== undefined) {
      yTitleOffset = Number(axisYTitlePadding);
    } else if (axisTitlePadding !== undefined) {
      yTitleOffset = Number(axisTitlePadding);
    } else if (configTitleOffset !== undefined) {
      yTitleOffset = Number(configTitleOffset);
    } else {
      // Default title offset
      yTitleOffset = yTitleSize;
    }

    // Repeat this logic for labelPadding, but only check axisY and axis (not title)

    const axisYLabelPadding = options.vegaConfig?.axisY?.labelPadding;
    const axisLabelPadding = options.vegaConfig?.axis?.labelPadding;

    if (axisYLabelPadding !== undefined) {
      yLabelPadding = Number(axisYLabelPadding);
    } else if (axisLabelPadding !== undefined) {
      yLabelPadding = Number(axisLabelPadding);
    } else {
      // Default label padding
      yLabelPadding = 6;
    }

    maxYLabelWidth = Math.max(
      getTextWidthDOM(formattedMin, yLabelFontStyles),
      getTextWidthDOM(formattedMax, yLabelFontStyles)
    );
    yAxisWidth = maxYLabelWidth + 2 * yTitleOffset + yTitleSize + yLabelPadding;

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

  const isSpark = options.size.preset === 'spark';

  const xAxisSettings = getXAxisSettings({
    maxString: xField.maxString!,
    chartHeight,
    chartWidth,
    xField,
    parentField: field,
    vegaConfig: options.vegaConfig,
    isSpark,
  });

  const padding = xAxisSettings.hidden
    ? {top: 0, left: 0, bottom: 0, right: 0}
    : {
        top: topPadding + 1,
        left: yAxisWidth,
        bottom: xAxisSettings.height,
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
      minExtent: maxYLabelWidth,
      maxExtent: maxYLabelWidth,
      tickCount: yTickCount,
      hidden: isSpark,
      yTitleSize,
      titlePadding: yTitleOffset,
      labelPadding: yLabelPadding,
      titleFont: fontSettings.yTitle.fontFamily,
      titleFontSize: parseInt(fontSettings.yTitle.fontSize),
      ...(fontSettings.yTitle.fontWeight && {
        titleFontWeight: fontSettings.yTitle.fontWeight as FontWeightValue,
      }),
    },
    yScale: {
      domain: options.independentY ? null : yDomain,
    },
    padding: isSpark ? {top: 4, left: 0, bottom: 4, right: 0} : padding,
    xField,
    yField,
    totalWidth,
    totalHeight,
    isSpark,
  };
}
