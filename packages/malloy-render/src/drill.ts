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
} from "malloy";
import { DataPointer, DataTree, DataTreeRoot, isDataTree } from "./data_table";

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

function getTableFilters(
  table: DataTree,
  row: number,
  dest: Record<string, string | null>
): void {
  for (const f of table.structDef.resultMetadata?.filterList || []) {
    dest[f.source] = null;
  }
  for (const dim of getDimensions(table.structDef)) {
    const value = table.getValue(row, dim.name);
    // if we have an expression, use it instead of the name of the field.
    const name = dim.resultMetadata?.sourceExpression || dim.name;
    if (!isDataTree(value)) {
      if (value === null) {
        dest[name] = "= null";
      } else if (isValueString(value, dim)) {
        dest[name] = filterQuote(value);
      } else if (isValueNumber(value, dim)) {
        dest[name] = value.toString();
      } else if (isValueBoolean(value, dim)) {
        dest[name] = value.toString();
      } else if (isValueTimestamp(value, dim)) {
        dest[name] = `@${value.toString()}`;
      }
    }
  }
}

export function getDrillFilters(root: DataTree, path: string): string[] {
  const filters: Record<string, string | null> = {};
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
  for (const key of Object.keys(filters)) {
    const value = filters[key];
    if (value !== null) {
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
