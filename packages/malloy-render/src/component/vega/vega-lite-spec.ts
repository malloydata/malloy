/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The Solid-free half of drawing a Vega-Lite chart through ChartV2 (the other
// half is VegaLiteChart in ./vega-lite-chart). Spec code and its tests use
// only this file.

import type {Item} from 'vega';
import {parse, type Runtime} from 'vega';
import * as lite from 'vega-lite';
import {RecordCell, type Field} from '@/data_tree';
import type {ChartTooltipEntry} from '@/component/types';
import {renderCellValue} from '@/component/cell-utils';
import type {MalloyExplicitTheme} from '@/api/types';
import {getColorScale} from '@/html/utils';
import {CATEGORY_PALETTE} from './base-vega-config';

export type VegaLiteChartSize = {width: number; height: number};

export type CompiledVegaLiteChart = {
  runtime: Runtime;
  vegaSpec: unknown;
  size: VegaLiteChartSize;
};

/**
 * Compile a Vega-Lite spec whose rows come from ChartV2's values data source,
 * sized to fill `size` exactly.
 */
export function compileVegaLiteChart(
  spec: lite.TopLevelSpec,
  size: VegaLiteChartSize,
  useVegaInterpreter = false
): CompiledVegaLiteChart {
  const vegaSpec = lite.compile({
    ...spec,
    ...size,
    // ChartV2 sizes the view to its container, so the spec's width and height
    // must be the whole chart, axes and legend included.
    autosize: {type: 'fit', contains: 'padding'},
  }).spec;
  const runtime = parse(
    vegaSpec,
    undefined,
    useVegaInterpreter ? {ast: true} : undefined
  );
  return {runtime, vegaSpec, size};
}

/** The theme's series colors: the host's override if it sets one. */
export function categoryPalette(
  vegaConfigOverride: Record<string, unknown>
): readonly string[] {
  const range = vegaConfigOverride['range'];
  if (typeof range === 'object' && range !== null && 'category' in range) {
    const category = range.category;
    if (
      Array.isArray(category) &&
      category.length > 0 &&
      category.every((c): c is string => typeof c === 'string')
    ) {
      return category;
    }
  }
  return CATEGORY_PALETTE;
}

/**
 * The color scale for a color field. Categories take the theme's series
 * colors, as the bar and line charts do; ordered values keep a gradient.
 */
export function colorFieldScale(
  type: 'temporal' | 'ordinal' | 'quantitative' | 'nominal',
  palette: readonly string[],
  explicitTheme?: MalloyExplicitTheme
): {range: string[]} | undefined {
  return type === 'nominal'
    ? {range: [...palette]}
    : getColorScale(type, false, false, explicitTheme);
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
