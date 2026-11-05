/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Field, Cell, NestField, RecordCell} from '@/data_tree';
import type * as lite from 'vega-lite';
import type {ChartTooltipEntry} from '@/component/types';
import {CHART_VALUES_DATA} from '@/component/chart/chart-values-data';
import {DEFAULT_SPEC} from '@/html/vega_spec';
import {normalizeToTimezone} from '@/html/utils';
import {colorFieldScale, tooltipLine} from '@/component/vega/vega-lite-spec';

function getDataType(
  field: Field
): 'temporal' | 'ordinal' | 'quantitative' | 'nominal' {
  if (field.isTime()) return 'temporal';
  if (field.isString()) return 'nominal';
  if (field.isNumber()) return 'quantitative';
  throw new Error('Invalid field type for scatter chart.');
}

function getDataValue(data: Cell): Date | string | number | null {
  if (data.isNull()) return null;
  if (data.isTime() || data.isString()) return data.value;
  if (data.isNumber()) return data.value;
  throw new Error('Invalid field type for scatter chart.');
}

/** One row's record for the scatter spec. */
export function mapScatterRow(
  row: RecordCell,
  timezone: string | undefined
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const f of row.field.fields) {
    let value = getDataValue(row.column(f.name));
    if (value instanceof Date) {
      value = normalizeToTimezone(value, timezone);
    }
    mapped[f.name] = value;
  }
  return mapped;
}

/** The scatter's columns, by position: x, y, then optional color, size, shape. */
function scatterChannels(field: NestField) {
  const [x, y, color, size, shape] = field.fields;
  return {x, y, color, size, shape};
}

/** The tooltip for one point: each column the chart draws, labeled. */
export function scatterTooltip(field: NestField) {
  const {x, y, color, size, shape} = scatterChannels(field);
  const drawn = [x, y, color, size, shape].filter(f => f !== undefined);
  return (row: RecordCell): ChartTooltipEntry => ({
    title: [],
    entries: drawn.map(f => tooltipLine(row, f)),
  });
}

// Vega-Lite reads config.color as a table of named colors and points the
// category range at it, which would hide the theme's series colors.
const {color: _namedColors, ...SCATTER_CONFIG} = DEFAULT_SPEC.config ?? {};

/**
 * The scatter chart's Vega-Lite spec. It reads its rows (see mapScatterRow)
 * from ChartV2's values data source at render time.
 */
export function generateScatterChartSpec(field: NestField): lite.TopLevelSpec {
  const {
    x: xField,
    y: yField,
    color: colorField,
    size: sizeField,
    shape: shapeField,
  } = scatterChannels(field);

  const xType = getDataType(xField);
  const yType = getDataType(yField);
  const sizeType = sizeField ? getDataType(sizeField) : undefined;
  const shapeType = shapeField ? getDataType(shapeField) : undefined;

  let colorDef;
  if (colorField !== undefined) {
    const colorType = getDataType(colorField);
    colorDef = {
      field: colorField.name,
      type: colorType,
      legend: {title: colorField.getLabel()},
      // No theme: its mapColor tints maps only.
      scale: colorFieldScale(colorType),
    };
  } else {
    // One constant on the category scale draws every point in the theme's
    // first series color, whether the theme lists its colors or names a scheme.
    colorDef = {datum: '', legend: null};
  }

  const sizeDef = sizeField
    ? {
        field: sizeField.name,
        type: sizeType,
        legend: {title: sizeField.getLabel()},
      }
    : undefined;

  const shapeDef = shapeField
    ? {
        field: shapeField.name,
        type: shapeType,
        legend: {title: shapeField.getLabel()},
      }
    : undefined;

  const xSort = xType === 'nominal' ? null : undefined;
  const ySort = yType === 'nominal' ? null : undefined;

  const spec: lite.TopLevelSpec = {
    $schema: DEFAULT_SPEC.$schema,
    config: SCATTER_CONFIG,
    data: {name: CHART_VALUES_DATA},
    mark: 'point',
    encoding: {
      x: {
        field: xField.name,
        type: xType,
        sort: xSort,
        axis: {title: xField.getLabel()},
        scale: {zero: false},
      },
      y: {
        field: yField.name,
        type: yType,
        sort: ySort,
        axis: {title: yField.getLabel()},
        scale: {zero: false},
      },
      size: sizeDef,
      color: colorDef,
      shape: shapeDef,
    },
    background: 'transparent',
  };

  return spec;
}
