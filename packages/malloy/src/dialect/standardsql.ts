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

import { indent } from "../model/utils";
import {
  DateTimeframe,
  Dialect,
  DialectExpr,
  DialectFieldList,
  ExtractDateTimeframe,
  isDateTimeframe,
  TimestampTimeframe,
} from "./dialect";

const timeTruncMap: { [key: string]: string } = {
  date: "day",
};

export class StandardSQLDialect extends Dialect {
  name = "standardsql";
  defaultNumberType = "FLOAT64";
  udfPrefix = "__udf";
  hasFinalStage = false;
  stringTypeName = "STRING";
  divisionIsInteger = false;

  quoteTableName(tableName: string): string {
    return `\`${tableName}\``;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT row_number() OVER() -1  group_set FROM UNNEST(GENERATE_ARRAY(0,${groupSetCount},1)))`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${fieldName} END)`;
  }
  // can array agg or any_value a struct...
  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string {
    let tail = "";
    if (limit !== undefined) {
      tail += ` LIMIT ${limit}`;
    }
    const fields = fieldList
      .map((f) => `\n  ${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(", ");
    return `ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}\n  ) END IGNORE NULLS ${orderBy} ${tail})`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map((f) => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(", ");
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}))`;
  }

  sqlAnyValueLastTurtle(name: string, sqlName: string): string {
    return `ANY_VALUE(CASE WHEN group_set=0 THEN ${name}__0 END) as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = fieldList
      .map((f) => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(", ");
    const nullValues = fieldList
      .map((f) => `NULL as ${f.sqlOutputName}`)
      .join(", ");

    return `COALESCE(ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}) END), STRUCT(${nullValues}))`;
  }

  //
  // this code used to be:
  //
  //   from += `JOIN UNNEST(GENERATE_ARRAY(0,${this.maxGroupSet},1)) as group_set\n`;
  //
  // BigQuery will allocate more resources if we use a CROSS JOIN so we do that instead.
  //
  sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    needDistinctKey: boolean
  ): string {
    if (needDistinctKey) {
      return `, UNNEST(ARRAY(( SELECT AS STRUCT GENERATE_UUID() as __distinct_key, * FROM UNNEST(${source})))) as ${alias}`;
    } else {
      return `, UNNEST(${source}) as ${alias}`;
    }
  }

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    sqlDistinctKey = `CAST(${sqlDistinctKey} AS STRING)`;
    const upperPart = `cast(cast(concat('0x', substr(to_hex(md5(${sqlDistinctKey})), 1, 15)) as int64) as numeric) * 4294967296`;
    const lowerPart = `cast(cast(concat('0x', substr(to_hex(md5(${sqlDistinctKey})), 16, 8)) as int64) as numeric)`;
    // See the comment below on `sql_sum_distinct` for why we multiply by this decimal
    const precisionShiftMultiplier = "0.000000001";
    return `(${upperPart} + ${lowerPart}) * ${precisionShiftMultiplier}`;
  }

  sqlGenerateUUID(): string {
    return `GENERATE_UUID()`;
  }

  sqlFieldReference(
    alias: string,
    fieldName: string,
    _fieldType: string,
    _isNested: boolean
  ): string {
    return `${alias}.${fieldName}`;
  }

  sqlUnnestPipelineHead(): string {
    return "UNNEST(__param)";
  }

  sqlCreateFunction(id: string, funcText: string): string {
    return `CREATE TEMPORARY FUNCTION ${id}(__param ANY TYPE) AS ((\n${indent(
      funcText
    )}));\n`;
  }

  sqlCreateTableAsSelect(tableName: string, sql: string): string {
    return `
CREATE TABLE IF NOT EXISTS \`${tableName}\`
OPTIONS (
    expiration_timestamp=TIMESTAMP_ADD(current_timestamp(),  INTERVAL 1 hour)
)
AS (
${indent(sql)}
);
`;
  }

  sqlCreateFunctionCombineLastStage(lastStageName: string): string {
    return `SELECT ARRAY((SELECT AS STRUCT * FROM ${lastStageName}))\n`;
  }

  sqlSelectAliasAsStruct(alias: string): string {
    return `(SELECT AS STRUCT ${alias}.*)`;
  }

  keywords = `
  ALL
  AND
  ANY
  ARRAY
  AS
  ASC
  ASSERT_ROWS_MODIFIED
  AT
  BETWEEN
  BY
  CASE
  CAST
  COLLATE
  CONTAINS
  CREATE
  CROSS
  CUBE
  CURRENT
  DEFAULT
  DEFINE
  DESC
  DISTINCT
  ELSE
  END
  ENUM
  ESCAPE
  EXCEPT
  EXCLUDE
  EXISTS
  EXTRACT
  FALSE
  FETCH
  FOLLOWING
  FOR
  FROM
  FULL
  GROUP
  GROUPING
  GROUPS
  HASH
  HAVING
  IF
  IGNORE
  IN
  INNER
  INTERSECT
  INTERVAL
  INTO
  IS
  JOIN
  LATERAL
  LEFT
  LIKE
  LIMIT
  LOOKUP
  MERGE
  NATURAL
  NEW
  NO
  NOT
  NULL
  NULLS
  OF
  ON
  OR
  ORDER
  OUTER
  OVER
  PARTITION
  PRECEDING
  PROTO
  RANGE
  RECURSIVE
  RESPECT
  RIGHT
  ROLLUP
  ROWS
  SELECT
  SET
  SOME
  STRUCT
  TABLESAMPLE
  THEN
  TO
  TREAT
  TRUE
  UNBOUNDED
  UNION
  UNNEST
  USING
  WHEN
  WHERE
  WINDOW
  WITH
  WITHIN`.split(/\s/);

  sqlMaybeQuoteIdentifier(identifier: string): string {
    return this.keywords.indexOf(identifier.toUpperCase()) > 0
      ? "`" + identifier + "`"
      : identifier;
  }

  static mapTimeframe(timeframe: TimestampTimeframe): string {
    const t = timeTruncMap[timeframe];
    return (t || timeframe).toUpperCase();
  }

  sqlDateTrunc(expr: unknown, timeframe: DateTimeframe): DialectExpr {
    const units = StandardSQLDialect.mapTimeframe(timeframe);
    return [`DATE_TRUNC(`, expr, `, ${units})`];
  }

  sqlTimestampTrunc(
    expr: unknown,
    timeframe: TimestampTimeframe,
    timezone: string
  ): DialectExpr {
    const units = StandardSQLDialect.mapTimeframe(timeframe);
    if (isDateTimeframe(timeframe)) {
      return [`DATE_TRUNC(DATE(`, expr, `, '${timezone}'), ${units})`];
    } else {
      return [`TIMESTAMP_TRUNC(`, expr, `, ${units})`];
    }
  }

  sqlExtractDateTimeframe(
    expr: unknown,
    timeframe: ExtractDateTimeframe
  ): DialectExpr {
    return [`EXTRACT(${timeframe} FROM `, expr, ")"];
  }

  sqlDateCast(expr: unknown): DialectExpr {
    return ["DATE(", expr, ")"];
  }

  sqlTimestampCast(expr: unknown): DialectExpr {
    return ["TIMESTAMP(", expr, ")"];
  }

  sqlDateAdd(
    op: "+" | "-",
    expr: unknown,
    n: unknown,
    timeframe: DateTimeframe
  ): DialectExpr {
    const add = op === "+" ? "_ADD" : "_SUB";
    const units = StandardSQLDialect.mapTimeframe(timeframe);
    return [`DATE${add}(`, expr, `,INTERVAL `, n, ` ${units})`];
  }

  sqlTimestampAdd(
    op: "+" | "-",
    expr: unknown,
    n: unknown,
    timeframe: DateTimeframe
  ): DialectExpr {
    const useDatetime = ["week", "month", "quarter", "year"].includes(
      timeframe
    );
    const add = op === "+" ? "_ADD" : "_SUB";
    const units = StandardSQLDialect.mapTimeframe(timeframe);
    if (useDatetime) {
      return [
        `TIMESTAMP(DATETIME${add}(DATETIME(`,
        expr,
        `),INTERVAL `,
        n,
        ` ${units}))`,
      ];
    }
    // const typeFrom = fromNotTimestamp ? ["TIMESTAMP(", expr, ")"] : expr;
    return [`TIMESTAMP${add}(`, expr, `,INTERVAL `, n, ` ${units})`];
  }

  ignoreInProject(fieldName: string): boolean {
    return fieldName === "_PARTITIONTIME";
  }
}
