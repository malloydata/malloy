/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The Solid-free half of drawing a Vega-Lite chart through ChartV2 (the other
// half is ./vega-lite-chart). Spec code and its tests use only this file, so
// it must not load vega at runtime.

import type {Config, Item} from 'vega';
import type * as lite from 'vega-lite';
import {RecordCell, type Field} from '@/data_tree';
import type {ChartTooltipEntry} from '@/component/types';
import {renderCellValue} from '@/component/cell-utils';
import type {MalloyExplicitTheme} from '@/api/types';
import {getColorScale, mapCanvasBackground} from '@/html/utils';
import {baseVegaConfig} from './base-vega-config';
import {mergeVegaConfigs} from './merge-vega-configs';

export type VegaLiteChartSize = {width: number; height: number};

/** The whole chart's box, axes and legend included. */
export function chartSize(field: Field): VegaLiteChartSize {
  return field.isRoot() ? {width: 500, height: 350} : {width: 250, height: 175};
}

/**
 * The config to parse a compiled chart with: the base theme, then the chart's
 * own config, then the host's override. Bar and line charts use the same
 * order, so a host's series colors (a list or a named scheme) and fonts reach
 * these charts too.
 */
export function chartVegaConfig(
  chartConfig: Config | undefined,
  vegaConfigOverride: Record<string, unknown>
): Config {
  return mergeVegaConfigs(
    mergeVegaConfigs(baseVegaConfig(), chartConfig ?? {}),
    vegaConfigOverride
  ) as Config;
}

/**
 * The color scale for a color field. A text field gets no explicit range, so
 * it takes the config's category range: the theme's series colors. Ordered
 * values get a gradient. Pass `explicitTheme` only for maps, where the
 * theme's `mapColor` ends that gradient.
 */
export function colorFieldScale(
  type: 'temporal' | 'ordinal' | 'quantitative' | 'nominal',
  explicitTheme?: MalloyExplicitTheme
): {range: string[]} | undefined {
  return type === 'nominal'
    ? undefined
    : getColorScale(type, false, false, explicitTheme);
}

const MAP_FONT = "var(--malloy-font-family, 'Inter')";
const MAP_TITLE_COLOR = 'var(--malloy-title-color, #505050)';
const MAP_LABEL_COLOR = 'var(--malloy-label-color, #000000)';

const MAP_VEGA_CONFIG: lite.Config = {
  axis: {
    labelFont: MAP_FONT,
    titleFont: MAP_FONT,
    titleFontWeight: 500,
    titleColor: MAP_TITLE_COLOR,
    labelColor: MAP_LABEL_COLOR,
    titleFontSize: 12,
  },
  legend: {
    labelFont: MAP_FONT,
    titleFont: MAP_FONT,
    titleFontWeight: 500,
    titleColor: MAP_TITLE_COLOR,
    labelColor: MAP_LABEL_COLOR,
    titleFontSize: 12,
  },
  header: {labelFont: MAP_FONT, titleFont: MAP_FONT, titleFontWeight: 500},
  mark: {font: MAP_FONT},
  title: {font: MAP_FONT, subtitleFont: MAP_FONT, fontWeight: 500},
};

/** The parts of a US map spec that the shape and segment maps share. */
export function usMapFrame(explicitTheme: MalloyExplicitTheme | undefined) {
  return {
    projection: {type: 'albersUsa'} as const,
    // A host's vegaConfigOverride can't change the background: a top-level
    // background shadows config.background.
    background: mapCanvasBackground(explicitTheme),
    config: MAP_VEGA_CONFIG,
  };
}

/** The row a mark was drawn from; undefined for marks such as map backgrounds. */
export function rowOfMark(item: Item): RecordCell | undefined {
  const row: unknown = item.datum?.__row;
  return row instanceof RecordCell ? row : undefined;
}

/** A row's value, formatted as its table cell would be. */
export function cellText(row: RecordCell, field: Field): string {
  return renderCellValue(row.column(field.name));
}

/** One labeled line of a tooltip. */
export function tooltipLine(
  row: RecordCell,
  field: Field
): ChartTooltipEntry['entries'][number] {
  return {
    label: field.getLabel(),
    value: cellText(row, field),
    highlight: false,
    entryType: 'list-item',
  };
}
