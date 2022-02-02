/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
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
  return { key, value: filterValue };
}

function getTableFilters(table: DataArray): FilterItem[] {
  const filters = [];
  for (const f of table.field.filters || []) {
    if (!f.aggregate) {
      filters.push({ key: f.source, value: undefined });
    }
  }
  return filters;
}

function getRowFilters(row: DataRecord): FilterItem[] {
  const filters = [];
  const dimensions = row.field.intrinsicFields.filter(
    (field) => field.isAtomicField() && field.sourceWasDimension()
  );

  for (const dim of dimensions) {
    const cell = row.cell(dim);
    // if we have an expression, use it instead of the name of the field.
    console.log(cell);
    const key =
      dim.isAtomicField() || dim.isQueryField() ? dim.expression : undefined;
    if (key && !cell.isArray()) {
      if (cell.isNull()) {
        filters.push({ key, value: "= null" });
      } else if (cell.isString()) {
        filters.push({ key, value: filterQuote(cell.value) });
      } else if (cell.isNumber() || cell.isBoolean()) {
        filters.push({ key, value: cell.value.toString() });
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

  return { formattedFilters: dedupedFilters, source };
}

export function getDrillQuery(data: DataArrayOrRecord): string {
  const { formattedFilters, source } = getDrillFilters(data);
  let ret = `query: ${source?.name} `;
  if (formattedFilters.length) {
    ret += `{ \n  where: [\n    ${formattedFilters.join(",\n    ")}\n  ]\n}\n`;
  }
  return ret + "-> ";
}
