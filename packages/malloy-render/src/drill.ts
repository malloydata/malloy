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

import {
  DateTimeframe,
  TimestampTimeframe,
  DataRecord,
  DataArrayOrRecord,
  Explore,
  DataArray,
} from "@malloydata/malloy";
import { timeToString } from "./html/utils";

type FilterItem = { key: string; value: string | undefined };

function filterQuote(s: string): string {
  return `'${s.replace("'", "\\'")}'`;
}

function timestampToDateFilter(
  key: string,
  value: Date,
  timeframe: DateTimeframe | TimestampTimeframe | undefined
): FilterItem {
  const adjustedTimeframe =
    timeframe === TimestampTimeframe.Minute
      ? TimestampTimeframe.Second
      : timeframe || TimestampTimeframe.Second;
  const filterValue = "@" + timeToString(value, adjustedTimeframe);
  return { key, "value": filterValue };
}

function getTableFilters(table: DataArray): FilterItem[] {
  const filters: FilterItem[] = [];
  for (const f of table.field.filters || []) {
    if (f.expressionType === "scalar") {
      filters.push({ "key": f.code, "value": undefined });
    }
  }
  return filters;
}

function getRowFilters(row: DataRecord): FilterItem[] {
  const filters: FilterItem[] = [];
  const dimensions = row.field.intrinsicFields.filter(
    (field) => field.isAtomicField() && field.sourceWasDimension()
  );

  for (const dim of dimensions) {
    const cell = row.cell(dim);
    // if we have an expression, use it instead of the name of the field.
    const key =
      dim.isAtomicField() || dim.isQueryField() ? dim.expression : undefined;
    if (key && !cell.isArray()) {
      if (cell.isNull()) {
        filters.push({ key, "value": "null" });
      } else if (cell.isString()) {
        filters.push({ key, "value": filterQuote(cell.value) });
      } else if (cell.isNumber() || cell.isBoolean()) {
        filters.push({ key, "value": cell.value.toString() });
      } else if (cell.isTimestamp() || cell.isDate()) {
        filters.push(
          timestampToDateFilter(key, cell.value, cell.field.timeframe)
        );
      }
    }
  }
  return filters;
}

function getFilters(data: DataArrayOrRecord) {
  if (data.isRecord()) {
    return getRowFilters(data);
  } else {
    return getTableFilters(data);
  }
}

export function getDrillFilters(data: DataArrayOrRecord): {
  formattedFilters: string[];
  source: Explore | undefined;
} {
  const filters: FilterItem[] = [];
  let current = data;
  while (current.parent) {
    filters.push(...getFilters(current));
    current = current.parent;
  }
  filters.push(...getFilters(current));

  const source = current.field.parentExplore;

  const formattedFilters: string[] = [];
  for (const { key, value } of filters) {
    if (value !== undefined) {
      formattedFilters.push(`${key}: ${value}`);
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

  return { "formattedFilters": dedupedFilters, source };
}

export function getDrillQuery(data: DataArrayOrRecord): {
  drillQuery: string;
  drillFilters: string[];
} {
  const { formattedFilters, source } = getDrillFilters(data);
  let ret = `query: ${source?.name || '"unable to compute source"'} `;
  if (formattedFilters.length) {
    ret += `{ \n  where: \n    ${formattedFilters.join(",\n    ")}\n  \n}\n`;
  }
  const drillQuery = ret + "-> ";
  return { drillQuery, "drillFilters": formattedFilters };
}

export type DrillFunction = (
  drillQuery: string,
  target: HTMLElement,
  drillFilters: string[]
) => void;
