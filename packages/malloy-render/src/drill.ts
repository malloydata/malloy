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
  for (const f of table.getField().getFilters() || []) {
    dest.push({ key: f.source, value: undefined });
  }

  const dimensions = table
    .getField()
    .getFields()
    .filter((field) => field.isDimensional());

  for (const dim of dimensions) {
    const value = table.getRowByIndex(row).getColumn(dim.getName());
    // if we have an expression, use it instead of the name of the field.
    const key =
      dim.isAtomicField() || dim.isQueryField()
        ? dim.getExpression()
        : undefined;
    if (key && !value.isArray()) {
      if (value.isNull()) {
        dest.push({ key, value: "= null" });
      } else if (value.isString()) {
        dest.push({ key, value: filterQuote(value.getValue()) });
      } else if (value.isNumber() || value.isBoolean()) {
        dest.push({ key, value: value.getValue().toString() });
      } else if (value.isTimestamp() || value.isDate()) {
        dest.push(
          timestampToDateFilter(
            key,
            value.getValue(),
            value.getField().getTimeframe()
          )
        );
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
      dataTable = dataTable
        .getRowByIndex(rowNum)
        .getColumn(nextTableFieldName)
        .asArray();
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
  let ret = `${root.getField().getSource()?.getName()} `;
  const filters = getDrillFilters(root, path);
  if (filters.length) {
    ret += `:\n  [\n  ${filters.join(",\n  ")}\n  ]\n`;
  }
  return ret + "|";
}
