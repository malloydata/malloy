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
  defaultNumberType = "double precision";

  quoteTableName(tableName: string): string {
    return `${tableName}`;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN GENERATE_SERIES(0,${groupSetCount},1) as group_set`;
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
      .map(
        (f) =>
          `${f.sqlExpression}${f.type == "number" ? "::numeric" : ""} as ${
            f.sqlOutputName
          }`
        //`${f.sqlExpression} ${f.type} as ${f.sqlOutputName}`
      )
      .join(", ");
    return `(ARRAY_AGG((SELECT __x FROM (SELECT ${fields}) as __x) ${orderBy} ) FILTER (WHERE group_set=${groupSet}))${tail}`;
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

  // UNNEST((select ARRAY((SELECT ROW(gen_random_uuid()::text, state, airport_count) FROM UNNEST(base.by_state) as by_state(state text, airport_count numeric, by_fac_type record[]))))) as by_state(__distinct_key text, state text, airport_count numeric)

  sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    needDistinctKey: boolean
  ): string {
    const fields = [];
    for (const f of fieldList) {
      let t = undefined;
      switch (f.type) {
        case "string":
          t = "text";
          break;
        case "number":
          t = "numeric";
          break;
        case "struct":
          t = "record[]";
          break;
      }
      fields.push(`${f.sqlOutputName} ${t || f.type}`);
    }
    if (needDistinctKey) {
      return `UNNEST((select ARRAY((SELECT ROW(gen_random_uuid()::text, ${fieldList
        .map((f) => f.sqlOutputName)
        .join(", ")}) FROM UNNEST(${source}) as ${alias}(${fields.join(
        ", "
      )}))))) as ${alias}(__distinct_key text, ${fields.join(", ")})`;
    } else {
      return `UNNEST(${source}) as ${alias}(${fields.join(", ")})`;
    }
  }

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    return `('x' || MD5(${sqlDistinctKey}::varchar))::bit(64)::bigint::DECIMAL(65,0)  *18446744073709551616 + ('x' || SUBSTR(MD5(${sqlDistinctKey}::varchar),17))::bit(64)::bigint::DECIMAL(65,0)`;
  }

  sqlGenerateUUID(): string {
    return `GEN_RANDOM_UUID()`;
  }

  // TODO
  sqlMaybeQuoteIdentifier(identifier: string): string {
    return identifier;
  }
}
