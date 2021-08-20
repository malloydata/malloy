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
  StructDef,
  QueryData,
  QueryDataRow,
  QueryScalar,
  FieldDef,
  FilterCondition,
} from "malloy";

export type DataValue = QueryScalar | DataTree;

export function isDataTree(dv: DataValue): dv is DataTree {
  return dv instanceof DataTree;
}

export class DataPointer {
  table: DataTree;
  rowNumber: number;
  fieldName: string;

  constructor(table: DataTree, rowNumber: number, fieldName: string) {
    this.table = table;
    this.rowNumber = rowNumber;
    this.fieldName = fieldName;
  }

  getFieldDef(): FieldDef {
    return this.table.getFieldDef(this.fieldName);
  }
}

type SubTreeRow = Record<string, DataTree>;

export class DataTree {
  parent: DataPointer | undefined;
  structDef: StructDef;
  rows: QueryDataRow[];
  subTreeRows: SubTreeRow[] | undefined;
  nameMap: Record<string, FieldDef> = {};

  constructor(
    data: QueryData,
    structDef: StructDef,
    parent: DataPointer | undefined
  ) {
    this.parent = parent;
    this.structDef = structDef;
    this.rows = [];

    for (const field of this.structDef.fields) {
      this.nameMap[field.name] = field;
    }
    this.addRows(data);
  }

  addRows(data: QueryData): void {
    let rowNum = this.rows.length;
    for (const row of data) {
      this.rows.push(row);
      for (const field of this.getSubTreeStructs()) {
        if (this.subTreeRows === undefined) {
          this.subTreeRows = [];
        }
        if (this.subTreeRows[rowNum] === undefined) {
          this.subTreeRows[rowNum] = {};
        }
        const value = row[field.name] || null;
        this.subTreeRows[rowNum][field.name] = new DataTree(
          value as QueryData,
          field,
          new DataPointer(this, rowNum, field.name)
        );
      }
      rowNum++;
    }
  }

  root(): DataTreeRoot {
    // to avoid aliasing this.
    if (this.parent === undefined) {
      // LTNOTE: clean this up.
      return this as unknown as DataTreeRoot;
    }
    let r: DataTree = this.parent.table;
    while (r.parent != undefined) {
      r = r.parent.table;
    }
    return r as DataTreeRoot;
  }

  getSubTreeStructs(): StructDef[] {
    const ret: StructDef[] = [];
    for (const field of this.structDef.fields) {
      if (field.type === "struct") {
        ret.push(field);
      }
    }
    return ret;
  }

  hasSubTrees(): boolean {
    return this.subTreeRows !== undefined;
  }

  getSubTable(rowNum: number, fieldName: string): DataTree {
    if (this.subTreeRows === undefined) {
      throw new Error("Internal Error: no rows for subtree");
    }
    return this.subTreeRows[rowNum][fieldName];
  }

  getValue(rowNum: number, fieldName: string): DataValue {
    const value = this.rows[rowNum][fieldName];
    if (value instanceof Array) {
      return this.getSubTable(rowNum, fieldName);
    } else {
      return value;
    }
  }

  getFieldNames(): string[] {
    return this.structDef.fields.map((field) => field.name);
  }

  getFieldDef(fieldName: string): FieldDef {
    return this.nameMap[fieldName];
  }
}

export class DataTreeRoot extends DataTree {
  sourceExplore: string;
  sourceFilterList: FilterCondition[];
  constructor(
    data: QueryData,
    structDef: StructDef,
    sourceExplore: string,
    sourceFilterList: FilterCondition[]
  ) {
    super(data, structDef, undefined);
    this.sourceExplore = sourceExplore;
    this.sourceFilterList = sourceFilterList;
  }
}
