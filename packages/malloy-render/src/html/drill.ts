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

import {RecordCell} from '../component/render-result-metadata';
import {
  getCell,
  getCellValue,
  getNestFields,
  isAtomic,
  isDate,
  isTimestamp,
  NestCell,
  NestFieldInfo,
  tagFor,
  wasDimension,
} from '../component/util';
import {timeToString} from './utils';
import * as Malloy from '@malloydata/malloy-interfaces';

type FilterItem = {key: string; value: string | undefined};

function filterQuote(s: string): string {
  return `'${s.replace(/(['\\])/g, '\\$1')}'`;
}

function timestampToDateFilter(
  key: string,
  value: Date,
  timeframe: Malloy.DateTimeframe | Malloy.TimestampTimeframe | undefined
): FilterItem {
  const adjustedTimeframe =
    timeframe === 'minute' ? 'second' : timeframe || 'second';
  const filterValue = '@' + timeToString(value, adjustedTimeframe);
  return {key, value: filterValue};
}

function getDrillViewFilters(field: Malloy.DimensionInfo): string[] {
  const tag = tagFor(field);
  return (
    tag
      .array('filters')
      ?.map(f => f.text() ?? '')
      .filter(f => f) ?? []
  );
}

function getTableFilters(
  table: Malloy.CellWithArrayCell,
  field: NestFieldInfo
): FilterItem[] {
  const filters: FilterItem[] = [];
  for (const f of getDrillViewFilters(field)) {
    filters.push({key: f, value: undefined});
  }
  return filters;
}

function getFilterFieldExpression(
  field: Malloy.DimensionInfo
): string | undefined {
  const tag = tagFor(field);
  // if we have an expression, use it instead of the name of the field.
  let key = tag.text('expression');
  // Multi word column names.
  if (key !== undefined && key.includes(' ') && key === field.name) {
    key = '`' + key + '`';
  }
  return key;
}

function getRowFilters(
  row: Malloy.CellWithRecordCell,
  field: NestFieldInfo
): FilterItem[] {
  const filters: FilterItem[] = [];
  const dimensions = getNestFields(field).filter(
    field => isAtomic(field) && wasDimension(field)
  );

  for (const dim of dimensions) {
    const key = getFilterFieldExpression(dim);
    const cell = getCell(field, row.record_value, dim.name);
    if (key) {
      if (cell.kind === 'null_cell') {
        filters.push({key, value: 'null'});
      } else if (cell.kind === 'string_cell') {
        filters.push({key, value: filterQuote(cell.string_value)});
      } else if (cell.kind === 'number_cell') {
        filters.push({key, value: cell.number_value.toString()});
      } else if (cell.kind === 'boolean_cell') {
        filters.push({key, value: cell.boolean_value.toString()});
      } else if (cell.kind === 'timestamp_cell') {
        if (!isTimestamp(dim)) {
          throw new Error('Invalid date cell for non-date field');
        }
        const timeframe = dim.type.timeframe;
        filters.push(
          timestampToDateFilter(key, getCellValue(cell) as Date, timeframe)
        );
      } else if (cell.kind === 'date_cell') {
        if (!isDate(dim)) {
          throw new Error('Invalid date cell for non-date field');
        }
        const timeframe = dim.type.timeframe;
        filters.push(
          timestampToDateFilter(key, getCellValue(cell) as Date, timeframe)
        );
      }
    }
  }
  return filters;
}

function getFilters(data: NestCell, field: NestFieldInfo) {
  if (data.kind === 'record_cell') {
    return getRowFilters(data, field);
  } else {
    return getTableFilters(data, field);
  }
}

export function getDrillFilters(
  data: NestCell,
  field: NestFieldInfo
): {
  formattedFilters: string[];
  source: string | undefined;
} {
  const filters: FilterItem[] = [];
  let current = data;
  const currentField = field;
  while (current.parent) {
    filters.push(...getFilters(current, currentField));
    current = current.parent;
  }
  filters.push(...getFilters(current, currentField));

  const source = current.field.parentExplore;

  const formattedFilters: string[] = [];
  for (const {key, value} of filters) {
    if (value !== undefined) {
      formattedFilters.push(`${key} = ${value}`);
    } else {
      formattedFilters.push(key);
    }
  }

  // TODO HACK: some filters get duplicated by the language, and this
  //      is a workaround until that is fixed
  const dedupedFilters = formattedFilters.filter(
    (filter, index) =>
      formattedFilters.find(
        (otherFilter, otherIndex) =>
          otherFilter === filter && index < otherIndex
      ) === undefined
  );

  return {formattedFilters: dedupedFilters, source};
}

export function getDrillQuery(data: RecordCell): {
  drillQuery: string;
  drillFilters: string[];
} {
  const {formattedFilters, source} = getDrillFilters(data, field);
  let ret = `run: ${source || '"unable to compute source"'} -> `;
  if (formattedFilters.length) {
    ret += `{ \n  where: \n    ${formattedFilters.join(
      ',\n    '
    )}  \n} + {select: *}\n`;
  } else {
    ret += '{select: *}';
  }
  return {drillQuery: ret, drillFilters: formattedFilters};
}
