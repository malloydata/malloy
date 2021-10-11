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

import { Dialect, DialectFieldList } from "./dialect";

export class PostgresDialect extends Dialect {
  name = "postgres";

  quoteTableName(tableName: string): string {
    return `${tableName}`;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `GENERATE_SERIES(0,${groupSetCount},1)`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `MAX(${fieldName})`;
  }

  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string {
    let tail = "";
    if (limit !== undefined) {
      tail += `[1:${limit}]`;
    }
    const fields = fieldList
      .map((f) => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(", ");
    //return `ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}) END IGNORE NULLS ${tail})`;
    return `(ARRAY_AGG((SELECT __ FROM (SELECT ${fields}) as __) ${orderBy} ) FILTER (WHERE group_set=${groupSet}))${tail}`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map((f) => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(", ");
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}))`;
  }

  sqlAnyValueLastTurtle(name: string, sqlName: string): string {
    return `(ARRAY_AGG(${name}__0) FILTER (WHERE group_set=0 AND ${name}__0 IS NOT NULL))[1] as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    // const nullValues = fieldList
    //   .map((f) => `NULL as ${f.sqlOutputName}`)
    //   .join(", ");

    return `(${this.sqlAggregateTurtle(
      groupSet,
      fieldList,
      "",
      undefined
    )})[1]`;
  }
}
