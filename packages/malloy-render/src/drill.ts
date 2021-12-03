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
  DataArray,
} from "@malloy-lang/malloy";
import { timeToString } from "./html/utils";

type FilterItem = { key: string; value: string | undefined };

function filterQuote(s: string): string {
  return `'${s.replace("'", "\\'")}'`;
}

function timestampToDateFilter(
  key: string,
  value: Date,
  timeFrame: DateTimeframe | TimestampTimeframe | undefined
): FilterItem {
  const filterValue =
    "@" + timeToString(value, timeFrame || TimestampTimeframe.Second);
  return { key, value: filterValue };
}

function getTableFilters(
  table: DataArray,
  row: number,
  dest: FilterItem[]
): void {
  for (const f of table.field.filters || []) {
    dest.push({ key: f.source, value: undefined });
  }

  const dimensions = table.field.fields.filter((field) =>
    field.isDimensional()
  );

  for (const dim of dimensions) {
    const cell = table.row(row).cell(dim);
    // if we have an expression, use it instead of the name of the field.
    const key =
      dim.isAtomicField() || dim.isQueryField() ? dim.expression : undefined;
    if (key && !cell.isArray()) {
      if (cell.isNull()) {
        dest.push({ key, value: "= null" });
      } else if (cell.isString()) {
        dest.push({ key, value: filterQuote(cell.value) });
      } else if (cell.isNumber() || cell.isBoolean()) {
        dest.push({ key, value: cell.value.toString() });
      } else if (cell.isTimestamp() || cell.isDate()) {
        dest.push(timestampToDateFilter(key, cell.value, cell.field.timeframe));
      }
    }
  }
}

export function getDrillFilters(root: DataArray, path: string): string[] {
  const filters: FilterItem[] = [];
  const tablePath = path.split("|");
  let dataTable = root;
  for (const t of tablePath) {
    const [rowNumString, nextTableFieldName] = t.split(":");
    const rowNum = parseInt(rowNumString);
    getTableFilters(dataTable, rowNum, filters);
    if (nextTableFieldName) {
      dataTable = dataTable.row(rowNum).cell(nextTableFieldName).array;
    }
  }

  const ret = [];
  for (const { key, value } of filters) {
    if (value !== undefined) {
      ret.push(`${key}:${value}`);
    } else {
      ret.push(key);
    }
  }
  return ret;
}

export function getDrillQuery(root: DataArray, path: string): string {
  let ret = `${root.field.source?.name} `;
  const filters = getDrillFilters(root, path);
  if (filters.length) {
    ret += `:\n  [\n  ${filters.join(",\n  ")}\n  ]\n`;
  }
  return ret + "|";
}
