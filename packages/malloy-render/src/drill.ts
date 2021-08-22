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
  getDimensions,
  isValueBoolean,
  isValueNumber,
  isValueString,
  isValueTimestamp,
  isValueDate,
  TimeTimeframe,
  isFieldTimeBased,
} from "malloy";
import { DataPointer, DataTree, DataTreeRoot, isDataTree } from "./data_table";

type FilterItem = { key: string; value: string | undefined };

export function getDrillPath(
  ref: DataPointer | undefined,
  rows: number
): string {
  const path = [rows.toString()];
  let p = ref;
  while (p) {
    path.push(`${p.rowNumber}:${p.fieldName}`);
    p = p.table.parent;
  }
  return path.reverse().join("|").toString();
}

function filterQuote(s: string): string {
  return `'${s.replace("'", "\\'")}'`;
}

// Use a record instead of a map so we know we have all the types.
const timeFrameMap: Record<TimeTimeframe, RegExp | null> = {
  year: /^(\d\d\d\d)/,
  month: /^(\d\d\d\d-\d\d)/,
  date: /^(\d\d\d\d-\d\d-\d\d)/,
  day: /^(\d\d\d\d-\d\d-\d\d)/,
  hour: /^(\d\d\d\d-\d\d-\d\dT\d\d)/,
  minute: /^(\d\d\d\d-\d\d-\d\dT\d\d:\d\d)/,
  second: /^(\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d)/,
  week: /^(\d\d\d\d-\d\d-\d\d)/,
  quarter: /^(\d\d\d\d)-\d\d/,
  day_of_month: null,
  day_of_week: null,
  day_of_year: null,
  month_of_year: null,
  hour_of_day: null,
};

function timestampToDateFilter(
  key: string,
  value: string,
  timeFrame: TimeTimeframe | undefined
): FilterItem {
  if (timeFrame) {
    const regex = timeFrameMap[timeFrame];
    if (regex !== null) {
      let m;
      if ((m = value.match(regex))) {
        if (timeFrame === "quarter") {
          value = `@${m[1]}-Q${
            Math.trunc(parseInt(m[0].substring(m[0].length - 2)) / 4) + 1
          }`;
        } else if (timeFrame === "week") {
          value = `@WK${m[1]}`;
        } else {
          value = `@${m[1]}`;
        }
      }
      // if the key looks like dep_time.year, drop the truncation.  It
      //  is implied in the filter. Don't love this...
      const dateExpr = key.split(".");
      if (dateExpr.length === 2) {
        // Lookup might fail so we cast.
        const timeframe = (timeFrameMap as Record<string, RegExp | null>)[
          dateExpr[1]
        ];
        if (timeframe && timeframe != null) {
          key = dateExpr[0];
        }
      }
    }
  }
  return { key, value };
}

function getTableFilters(
  table: DataTree,
  row: number,
  dest: FilterItem[]
): void {
  for (const f of table.structDef.resultMetadata?.filterList || []) {
    dest.push({ key: f.source, value: undefined });
  }
  for (const dim of getDimensions(table.structDef)) {
    const value = table.getValue(row, dim.name);
    // if we have an expression, use it instead of the name of the field.
    const key = dim.resultMetadata?.sourceExpression || dim.name;
    if (!isDataTree(value)) {
      if (value === null) {
        dest.push({ key, value: "= null" });
      } else if (isValueString(value, dim)) {
        dest.push({ key, value: filterQuote(value) });
      } else if (isValueNumber(value, dim) || isValueBoolean(value, dim)) {
        dest.push({ key, value: value.toString() });
      } else if (
        isFieldTimeBased(dim) &&
        (isValueTimestamp(value, dim) || isValueDate(value, dim))
      ) {
        dest.push(timestampToDateFilter(key, value.value, dim.timeframe));
      }
    }
  }
}

export function getDrillFilters(root: DataTree, path: string): string[] {
  const filters: FilterItem[] = [];
  const tablePath = path.split("|");
  let dataTable = root;
  for (const t of tablePath) {
    const [rowNumString, nextTableFieldName] = t.split(":");
    const rowNum = parseInt(rowNumString);
    getTableFilters(dataTable, rowNum, filters);
    if (nextTableFieldName) {
      dataTable = dataTable.getSubTable(rowNum, nextTableFieldName);
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

export function getDrillQuery(root: DataTreeRoot, path: string): string {
  let ret = `${root.sourceExplore} `;
  const filters = getDrillFilters(root, path);
  if (filters.length) {
    ret += `:\n  [\n  ${filters.join(",\n  ")}\n  ]\n`;
  }
  return ret + "|";
}
