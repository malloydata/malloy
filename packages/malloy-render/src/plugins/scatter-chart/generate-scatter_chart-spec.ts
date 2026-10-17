/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Field, Cell, NestField, RecordCell} from '@/data_tree';
import type * as lite from 'vega-lite';
import {mergeVegaConfigs} from '@/component/vega/merge-vega-configs';
import {DEFAULT_SPEC} from '@/html/vega_spec';
import {getColorScale, normalizeToTimezone} from '@/html/utils';
import {
  VEGA_LITE_VALUES,
  firstSeriesColor,
} from '@/component/vega/vega-lite-spec';

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

export function getScatterSize(field: Field): {height: number; width: number} {
  return field.isRoot() ? {height: 350, width: 500} : {height: 175, width: 250};
}

/**
 * The scatter chart's Vega-Lite spec. It reads its rows (see mapScatterRow)
 * from the `values` data source at render time.
 */
export function generateScatterChartSpec(
  field: NestField,
  vegaConfigOverride: Record<string, unknown> = {}
): lite.TopLevelSpec {
  const fields = field.fields;
  const xField = fields[0];
  const yField = fields[1];
  const colorField = fields[2];
  const sizeField = fields[3];
  const shapeField = fields[4];

  const xType = getDataType(xField);
  const yType = getDataType(yField);
  const colorType = colorField ? getDataType(colorField) : undefined;
  const sizeType = sizeField ? getDataType(sizeField) : undefined;
  const shapeType = shapeField ? getDataType(shapeField) : undefined;

  const colorDef =
    colorField !== undefined
      ? {
          field: colorField.name,
          type: colorType,
          legend: {title: colorField.getLabel()},
          scale: getColorScale(colorType, false),
        }
      : // No color field: every point takes the theme's first series color.
        {value: firstSeriesColor(vegaConfigOverride)};

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
    ...DEFAULT_SPEC,
    data: {name: VEGA_LITE_VALUES},
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

  spec.config = mergeVegaConfigs(spec.config ?? {}, vegaConfigOverride);

  return spec;
}
