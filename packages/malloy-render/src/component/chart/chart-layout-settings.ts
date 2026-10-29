/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
    // null when the axis domain is independent (per-row); consumers fall back
    // to a data-driven domain. Matches y2Scale below.
    domain: number[] | null;
  };
  // Secondary (right) measure axis, present only for dual-axis charts (combo).
  // Bar/line charts leave these undefined and are unaffected.
  y2Axis?: {
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
  y2Scale?: {
    domain: number[] | null;
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

// When d3's `.nice()` ticks stop short of the domain max, the top data point
// would be clipped at the plot's top edge. Returns the extra virtual chart
// height needed to keep that top value visible (0 when the top tick already
// reaches the domain max). Callers subtract this from the top padding. Shared
// by the primary and secondary (combo) axes so both get the same correction.
function topTickOverflowExtra(
  domain: number[],
  topTick: number | undefined,
  chartHeight: number
): number {
  const maxAxisVal = domain.at(1);
  const minAxisVal = domain.at(0);
  if (
    topTick !== undefined &&
    maxAxisVal !== undefined &&
    minAxisVal !== undefined &&
    topTick < maxAxisVal
  ) {
    const offRatio = (maxAxisVal - topTick) / (maxAxisVal - minAxisVal);
    return chartHeight / (1 - offRatio) - chartHeight;
  }
  return 0;
}

// Compute the width/domain metrics for a single measure axis. Both the primary
// axis and the secondary (right) axis of a combo chart run through this one
// helper, so their label-measuring math is shared and can't drift.
function measureAxisMetrics(
  yField: Field,
  minVal: number,
  maxVal: number,
  chartHeight: number,
  fontSettings: ReturnType<typeof getAxisFontSettings>,
  vegaConfig?: Config
): {
  width: number;
  domain: number[];
  minExtent: number;
  maxExtent: number;
  tickCount: number;
  topOverflowExtra: number;
  yTitleSize: number;
  labelPadding: number;
  titlePadding: number;
  titleFont: string;
  titleFontSize: number;
  titleFontWeight?: FontWeightValue;
} {
  const yScale = scale('linear')()
    .domain([minVal, maxVal])
    .nice()
    .range([chartHeight, 0]);
  const domain = yScale.domain();
  const tickCount = Math.ceil(chartHeight / 40);
  const topOverflowExtra = topTickOverflowExtra(
    domain,
    yScale.ticks(tickCount).at(-1),
    chartHeight
  );

  const maxAxisVal = domain.at(1);
  const minAxisVal = domain.at(0);
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

  const yTitleSize = getTextHeightDOM(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZgy',
    yTitleFontStyles
  );

  const axisYTitlePadding = vegaConfig?.axisY?.titlePadding;
  const axisTitlePadding = vegaConfig?.axis?.titlePadding;
  const configTitleOffset = vegaConfig?.title?.offset;
  let yTitleOffset = yTitleSize;
  if (axisYTitlePadding !== undefined) yTitleOffset = Number(axisYTitlePadding);
  else if (axisTitlePadding !== undefined)
    yTitleOffset = Number(axisTitlePadding);
  else if (configTitleOffset !== undefined)
    yTitleOffset = Number(configTitleOffset);

  const axisYLabelPadding = vegaConfig?.axisY?.labelPadding;
  const axisLabelPadding = vegaConfig?.axis?.labelPadding;
  let yLabelPadding = 6;
  if (axisYLabelPadding !== undefined)
    yLabelPadding = Number(axisYLabelPadding);
  else if (axisLabelPadding !== undefined)
    yLabelPadding = Number(axisLabelPadding);

  const maxYLabelWidth = Math.max(
    getTextWidthDOM(formattedMin, yLabelFontStyles),
    getTextWidthDOM(formattedMax, yLabelFontStyles)
  );
  const width = maxYLabelWidth + 2 * yTitleOffset + yTitleSize + yLabelPadding;

  return {
    width,
    domain,
    minExtent: maxYLabelWidth,
    maxExtent: maxYLabelWidth,
    tickCount,
    topOverflowExtra,
    yTitleSize,
    labelPadding: yLabelPadding,
    titlePadding: yTitleOffset,
    titleFont: fontSettings.yTitle.fontFamily,
    titleFontSize: parseInt(fontSettings.yTitle.fontSize),
    ...(fontSettings.yTitle.fontWeight && {
      titleFontWeight: fontSettings.yTitle.fontWeight as FontWeightValue,
    }),
  };
}

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
    // Secondary (right) measure axis for dual-axis charts (combo). When
    // provided, a second y-axis is sized and right padding is reserved for it.
    y2Field?: Field;
    getY2MinMax?: () => [number, number];
    independentY2?: boolean;
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
  // Extra height each axis needs so its top data point isn't clipped (see
  // topTickOverflowExtra). Applied once, below, using the larger of the two so
  // a dual-axis (combo) chart protects whichever axis needs it.
  let primaryTopOverflow = 0;
  let y2TopOverflow = 0;

  const fontSettings = getAxisFontSettings(options.vegaConfig);
  const [minVal, maxVal] = options?.getYMinMax?.() ?? [
    yField.minNumber!,
    yField.maxNumber!,
  ];

  // Primary (left) axis. Sized by the shared measureAxisMetrics helper — the
  // same path the secondary (combo) axis takes — so the two can't drift. The
  // nice()'d domain it returns is also what the yScale return uses; for the
  // spark case (no labels measured) we compute that domain directly.
  let yDomain: number[];
  if (hasYAxis) {
    const m = measureAxisMetrics(
      yField,
      minVal,
      maxVal,
      chartHeight,
      fontSettings,
      options.vegaConfig
    );
    yAxisWidth = m.width;
    maxYLabelWidth = m.minExtent;
    yTitleSize = m.yTitleSize;
    yTitleOffset = m.titlePadding;
    yLabelPadding = m.labelPadding;
    yDomain = m.domain;
    primaryTopOverflow = m.topOverflowExtra;
    if (primaryTopOverflow > 0) {
      // Hardcode # of ticks, or the resize could make room for more ticks and
      // then screw things up.
      yTickCount = m.tickCount;
    }
  } else {
    yDomain = scale('linear')()
      .domain([minVal, maxVal])
      .nice()
      .range([chartHeight, 0])
      .domain();
  }

  // Secondary (right) measure axis for combo charts.
  let y2Axis: ChartLayoutSettings['y2Axis'];
  let y2Domain: number[] | null = null;
  if (options.y2Field && hasYAxis) {
    const [min2, max2] = options.getY2MinMax?.() ?? [
      options.y2Field.minNumber!,
      options.y2Field.maxNumber!,
    ];
    const m = measureAxisMetrics(
      options.y2Field,
      min2,
      max2,
      chartHeight,
      fontSettings,
      options.vegaConfig
    );
    y2Axis = {
      width: m.width,
      minExtent: m.minExtent,
      maxExtent: m.maxExtent,
      tickCount: m.tickCount,
      hidden: false,
      yTitleSize: m.yTitleSize,
      titlePadding: m.titlePadding,
      labelPadding: m.labelPadding,
      titleFont: m.titleFont,
      titleFontSize: m.titleFontSize,
      ...(m.titleFontWeight && {titleFontWeight: m.titleFontWeight}),
    };
    y2Domain = options.independentY2 ? null : m.domain;
    y2TopOverflow = m.topOverflowExtra;
  }

  // Reserve top room for whichever axis's top value would otherwise be clipped.
  // A single subtraction (not one per axis) keeps a dual-axis chart from
  // double-counting the correction.
  if (hasYAxis) {
    topPadding = Math.max(
      0,
      topPadding - Math.max(primaryTopOverflow, y2TopOverflow)
    );
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
        // Reserve room on the right for the secondary axis when present; the
        // legend (if any) is added on top of this by the spec generator.
        right: y2Axis ? y2Axis.width : 8,
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
    ...(y2Axis && {y2Axis, y2Scale: {domain: y2Domain}}),
    padding: isSpark ? {top: 4, left: 0, bottom: 4, right: 0} : padding,
    xField,
    yField,
    totalWidth,
    totalHeight,
    isSpark,
  };
}
