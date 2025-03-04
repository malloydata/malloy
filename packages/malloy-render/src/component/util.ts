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
import * as Malloy from '@malloydata/malloy-interfaces';
import {Tag} from '@malloydata/malloy-tag';
import {DurationUnit, isDurationUnit} from '../html/data_styles';
import {format} from 'ssf';
import {RenderResultMetadata} from './types';
import {Field} from './render-result-metadata';

export function tagFromAnnotations(
  annotations: Malloy.Annotation[] | undefined,
  prefix = '# '
) {
  const tagLines =
    annotations?.map(a => a.value)?.filter(l => l.startsWith(prefix)) ?? [];
  return Tag.fromTagLines(tagLines).tag ?? new Tag();
}

function getLocationInParent(
  f: Malloy.DimensionInfo,
  metadata: RenderResultMetadata
) {
  const parent = metadata.fields.get(f)?.parent?.field;
  return (
    (parent && getNestFields(parent).findIndex(pf => pf.name === f.name)) ?? -1
  );
}

export function isLastChild(
  f: Malloy.DimensionInfo,
  metadata: RenderResultMetadata
) {
  const parent = metadata.fields.get(f)?.parent?.field;
  if (parent)
    return (
      getLocationInParent(f, metadata) === getNestFields(parent).length - 1
    );
  return true;
}

export function isFirstChild(
  f: Malloy.DimensionInfo,
  metadata: RenderResultMetadata
) {
  return getLocationInParent(f, metadata) === 0;
}

export function valueIsNumber(
  f: Malloy.DimensionInfo,
  v: unknown
): v is number {
  return isNumber(f) && v !== null;
}

// export function valueIsTable(
//   f: Malloy.DimensionInfo,
//   v: unknown
// ): v is Malloy.Table {
//   return f.kind === 'join' && v !== null;
// }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function valueIsArray(f: Malloy.DimensionInfo, v: unknown): v is any[] {
  return isAtomic(f) && isArray(f) && v !== null;
}

export function valueIsNull(v: Malloy.Cell) {
  return v.kind === 'null_cell';
}

export type CellDataValue =
  | string
  | number
  | boolean
  | Malloy.Cell[]
  | Malloy.Row
  | Date
  | null;

export function getCellValue(v: Malloy.Cell): CellDataValue {
  switch (v.kind) {
    case 'null_cell':
      return null;
    case 'number_cell':
      return v.number_value;
    case 'string_cell':
      return v.string_value;
    case 'boolean_cell':
      return v.boolean_value;
    case 'date_cell':
      return new Date(v.date_value);
    case 'timestamp_cell':
      return new Date(v.timestamp_value);
    case 'array_cell':
      return v.array_value;
    case 'record_cell':
      return v.record_value;
    case 'json_cell':
      return v.json_value; // TODO parse?
    case 'sql_native_cell':
      return v.sql_native_value;
  }
}

export function valueIsBoolean(
  f: Malloy.DimensionInfo,
  v: unknown
): v is boolean {
  return isAtomic(f) && isBoolean(f) && v !== null;
}

export function valueIsString(
  f: Malloy.DimensionInfo,
  s: unknown
): s is string {
  return isAtomic(f) && isString(f) && s !== null;
}

export function valueIsDateTime(
  f: Malloy.DimensionInfo,
  v: unknown
): v is Date {
  return isAtomic(f) && (isDate(f) || isTimestamp(f)) && v !== null;
}

export function getTextWidthCanvas(
  text: string,
  font: string,
  canvasToUse?: HTMLCanvasElement
) {
  const canvas = canvasToUse ?? document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

export function getTextWidthDOM(text: string, styles: Record<string, string>) {
  const measureDiv = document.createElement('div');
  measureDiv.innerHTML = text;
  for (const [key, value] of Object.entries(styles)) {
    measureDiv.style[key] = value;
  }
  document.body.appendChild(measureDiv);
  const rect = measureDiv.getBoundingClientRect();
  document.body.removeChild(measureDiv);
  return rect.width;
}

export function clamp(s: number, e: number, v: number) {
  return Math.max(s, Math.min(e, v));
}

export function getRangeSize(range: [number, number]) {
  return range[1] - range[0] + 1;
}

export function tagFor(item: Malloy.DimensionInfo, prefix = '# '): Tag {
  const lines =
    item.annotations?.map(a => a.value)?.filter(l => l.startsWith(prefix)) ??
    [];
  return Tag.fromTagLines(lines).tag ?? new Tag();
}

export function isAtomic(field: Malloy.DimensionInfo): boolean {
  return !isNest(field);
}

export function wasDimension(field: Malloy.DimensionInfo) {
  const tag = tagFor(field, '#(malloy) ');
  return !tag.has('calculation');
}

export function wasCalculation(field: Malloy.DimensionInfo) {
  const tag = tagFor(field, '#(malloy) ');
  return tag.has('calculation');
}

export type TimestampFieldInfo = Malloy.FieldInfoWithDimension & {
  type: Malloy.AtomicTypeWithTimestampType;
};

export function isTimestamp(
  field: Malloy.DimensionInfo
): field is TimestampFieldInfo {
  return field.type.kind === 'timestamp_type';
}

export type DateFieldInfo = Malloy.FieldInfoWithDimension & {
  type: Malloy.AtomicTypeWithDateType;
};

export function isDate(field: Malloy.DimensionInfo): field is DateFieldInfo {
  return field.type.kind === 'date_type';
}

export function getFieldTimeframe(
  field: Malloy.DimensionInfo
): Malloy.TimestampTimeframe | undefined {
  if (field.type.kind !== 'date_type' && field.type.kind !== 'timestamp_type') {
    throw new Error('Not a date or timeframe');
  }
  return field.type.timeframe;
}

export type RepeatedRecordFieldInfo = Malloy.DimensionInfo & {
  type: {
    kind: 'array_type';
    element_type: {
      kind: 'record_type';
    };
  };
};

export type RecordFieldInfo = Malloy.DimensionInfo & {
  type: {
    kind: 'record_type';
  };
};

export type NestFieldInfo = RepeatedRecordFieldInfo | RecordFieldInfo;

export type NestCell = Malloy.CellWithArrayCell | Malloy.CellWithRecordCell;

export function isNest(field: Malloy.DimensionInfo): field is NestFieldInfo {
  return (
    (field.type.kind === 'array_type' &&
      field.type.element_type.kind === 'record_type') ||
    field.type.kind === 'record_type'
  );
}

export function getNestFields(field: NestFieldInfo): Malloy.DimensionInfo[] {
  if (field.type.kind === 'array_type') {
    return field.type.element_type.fields;
  }
  return field.type.fields;
}

export function isNumber(field: Malloy.DimensionInfo): boolean {
  return field.type.kind === 'number_type';
}

export function isArray(field: Malloy.DimensionInfo): boolean {
  return field.type.kind === 'array_type';
}

export function isBoolean(field: Malloy.DimensionInfo): boolean {
  return field.type.kind === 'boolean_type';
}

export function isString(field: Malloy.DimensionInfo): boolean {
  return field.type.kind === 'string_type';
}

export function formatTimeUnit(
  value: number,
  unit: DurationUnit,
  options: {numFormat?: string; terse?: boolean} = {}
) {
  let unitString = unit.toString();
  if (options.terse) {
    unitString = terseDurationUnitsMap.get(unit) ?? unitString;
  } else if (value === 1) {
    unitString = unitString.substring(0, unitString.length - 1);
  }

  const formattedValue = options.numFormat
    ? format(options.numFormat, value)
    : value.toLocaleString();
  return `${formattedValue}${options.terse ? '' : ' '}${unitString}`;
}

const terseDurationUnitsMap = new Map<DurationUnit, string>([
  [DurationUnit.Nanoseconds, 'ns'],
  [DurationUnit.Microseconds, 'µs'],
  [DurationUnit.Milliseconds, 'ms'],
  [DurationUnit.Seconds, 's'],
  [DurationUnit.Minutes, 'm'],
  [DurationUnit.Hours, 'h'],
  [DurationUnit.Days, 'd'],
]);

const multiplierMap = new Map<DurationUnit, number>([
  [DurationUnit.Nanoseconds, 1000],
  [DurationUnit.Microseconds, 1000],
  [DurationUnit.Milliseconds, 1000],
  [DurationUnit.Seconds, 60],
  [DurationUnit.Minutes, 60],
  [DurationUnit.Hours, 24],
  [DurationUnit.Days, Number.MAX_VALUE],
]);

export function getText(
  field: Field,
  value: number,
  options: {
    durationUnit?: string;
  }
): string | null {
  const targetUnit =
    options.durationUnit && isDurationUnit(options.durationUnit)
      ? options.durationUnit
      : DurationUnit.Seconds;
  const tag = field.tag;
  const numFormat = tag.text('number');
  const terse = tag.has('duration', 'terse');

  let currentDuration = value;
  let currentUnitValue = 0;
  let durationParts: string[] = [];
  let foundUnit = false;

  for (const [unit, multiplier] of multiplierMap) {
    if (unit === targetUnit) {
      foundUnit = true;
    }

    if (!foundUnit) {
      continue;
    }

    currentUnitValue = currentDuration % multiplier;
    currentDuration = Math.floor((currentDuration /= multiplier));

    if (currentUnitValue > 0) {
      durationParts = [
        formatTimeUnit(currentUnitValue, unit, {numFormat, terse}),
        ...durationParts,
      ];
    }

    if (currentDuration === 0) {
      break;
    }
  }

  if (durationParts.length > 0) {
    return durationParts.slice(0, 2).join(' ');
  }

  return formatTimeUnit(0, targetUnit, {numFormat, terse});
}

// export function getParentRecord(
//   data: Malloy.Cell,
//   field: Malloy.DimensionInfo,
//   metadata: RenderResultMetadata,
//   n = 0
// ) {
//   let record = data;
//   while (n > 0 && metadata.fields.get(field)?.parent) {
//     n -= 1;
//     record = metadata.fields.get(field)!.parent!;
//   }
//   return record;
// }

// function getPathInfo(path: string): {levelsUp: number; pathSegments: string[]} {
//   const pathParts = path.split('/');
//   const levelsUp = pathParts.filter(part => part === '..').length + 1;
//   const pathSegments = pathParts.filter(part => part !== '..' && part !== '');
//   return {levelsUp, pathSegments};
// }

export function getDynamicValue<T = unknown>(_foo: {
  tag: Tag;
  data: Malloy.Cell;
  // field: Malloy.FieldInfo;
  // metadata: RenderResultMetadata;
}): T | undefined {
  return undefined; // TODO
  // try {
  //   const path = tag.tag('field')?.text() ?? '';
  //   const {levelsUp, pathSegments} = getPathInfo(path);
  //   let scope = getParentRecord(data, field, metadata, levelsUp);
  //   while (pathSegments.length > 0 && 'cell' in scope) {
  //     const fieldName = pathSegments.shift()!;
  //     scope = scope.cell(fieldName);
  //   }
  //   return scope?.value as T;
  // } catch (err) {
  //   return undefined;
  // }
}

export function getCell(
  parent: NestFieldInfo,
  row: Malloy.Row,
  name: string
): Malloy.Cell {
  const index = getNestFields(parent).findIndex(f => f.name === name);
  return row.cells[index];
}

export function getAllCells(
  parent: NestFieldInfo,
  row: Malloy.Row
): {[name: string]: Malloy.Cell} {
  const fields = getNestFields(parent);
  const obj = {};
  for (let i = 0; i < fields.length; i++) {
    obj[fields[i].name] = row.cells[i];
  }
  return obj;
}

export function getAllCellValues(
  parent: NestFieldInfo,
  row: Malloy.Row
): {[name: string]: CellDataValue} {
  const fields = getNestFields(parent);
  const obj = {};
  for (let i = 0; i < fields.length; i++) {
    obj[fields[i].name] = getCellValue(row.cells[i]);
  }
  return obj;
}
