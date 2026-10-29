/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Field, Cell, RecordCell, RepeatedRecordCell} from '@/data_tree';
import type * as lite from 'vega-lite';
import {mergeVegaConfigs} from '@/component/vega/merge-vega-configs';
import {DEFAULT_SPEC} from '@/html/vega_spec';
import {getColorScale, normalizeToTimezone} from '@/html/utils';

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

function mapData(
  rows: RecordCell[],
  timezone: string | undefined
): Record<string, unknown>[] {
  return rows.map(row => {
    const mapped: Record<string, unknown> = {};
    for (const f of row.field.fields) {
      let value = getDataValue(row.column(f.name));
      if (value instanceof Date) {
        value = normalizeToTimezone(value, timezone);
      }
      mapped[f.name] = value;
    }
    return mapped;
  });
}

function getSize(field: Field): {height: number; width: number} {
  return field.isRoot() ? {height: 350, width: 500} : {height: 175, width: 250};
}

export function generateScatterChartSpec(
  data: RepeatedRecordCell,
  field: Field,
  vegaConfigOverride: Record<string, unknown> = {}
): lite.TopLevelSpec {
  const fields = data.field.fields;
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

  const timezone = field.root().queryTimezone;

  const colorDef =
    colorField !== undefined
      ? {
          field: colorField.name,
          type: colorType,
          legend: {title: colorField.getLabel()},
          scale: getColorScale(colorType, false),
        }
      : {value: '#4285F4'};

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
    ...getSize(field),
    data: {values: mapData(data.rows, timezone)},
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
