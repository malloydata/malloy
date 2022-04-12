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
import { TimestampUnit, ExtractUnit, Expr, mkExpr, TimeValue } from "../model";
import { Dialect, DialectFieldList, FunctionInfo } from "./dialect";

const castMap: Record<string, string> = {
  number: "float64",
};

// These are the units that "TIMESTAMP_ADD" accepts
const timestampAddUnits = [
  "microsecond",
  "millisecond",
  "second",
  "minute",
  "hour",
  "day",
];

const extractMap: Record<string, string> = {
  day_of_week: "dayofweek",
  day_of_year: "dayofyear",
};

export class StandardSQLDialect extends Dialect {
  name = "standardsql";
  defaultNumberType = "FLOAT64";
  udfPrefix = "__udf";
  hasFinalStage = false;
  stringTypeName = "STRING";
  divisionIsInteger = false;
  functionInfo: Record<string, FunctionInfo> = {
    timestamp_seconds: { returnType: "timestamp" },
  };

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
      return `LEFT JOIN UNNEST(ARRAY(( SELECT AS STRUCT GENERATE_UUID() as __distinct_key, * FROM UNNEST(${source})))) as ${alias}`;
    } else {
      return `LEFT JOIN UNNEST(${source}) as ${alias}`;
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

  sqlUnnestPipelineHead(isSingleton: boolean): string {
    let p = "__param";
    if (isSingleton) {
      p = `[${p}]`;
    }
    return `UNNEST(${p})`;
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

  sqlTrunc(sqlTime: TimeValue, units: TimestampUnit): Expr {
    if (sqlTime.valueType == "date") {
      return mkExpr`DATE_TRUNC(${sqlTime.value}, ${units})`;
    }
    return mkExpr`TIMESTAMP_TRUNC(${sqlTime.value}, ${units})`;
  }

  sqlExtract(expr: TimeValue, units: ExtractUnit): Expr {
    const extractTo = extractMap[units] || units;
    return mkExpr`EXTRACT(${extractTo} FROM ${expr.value})`;
  }

  sqlDateCast(expr: Expr): Expr {
    return mkExpr`DATE(${expr})`;
  }

  sqlTimestampCast(expr: Expr): Expr {
    return mkExpr`TIMESTAMP(${expr})`;
  }

  sqlAlterTime(
    op: "+" | "-",
    expr: TimeValue,
    n: Expr,
    timeframe: TimestampUnit
  ): Expr {
    let theTime = expr.value;
    let computeType: string = expr.valueType;
    if (timestampAddUnits.includes(timeframe)) {
      // The units must be done in timestamp, no matter the input type
      computeType = "timestamp";
      if (expr.valueType != "timestamp") {
        theTime = mkExpr`TIMESTAMP(${theTime})`;
      }
    } else if (expr.valueType == "timestamp") {
      theTime = mkExpr`DATETIME(${theTime})`;
      computeType = "datetime";
    }
    const funcName = computeType.toUpperCase() + (op == "+" ? "_ADD" : "_SUB");
    const newTime = mkExpr`${funcName}(${theTime}, INTERVAL ${n} ${timeframe})`;
    return computeType == "datetime" ? mkExpr`TIMESTAMP(${newTime})` : newTime;
  }

  ignoreInProject(fieldName: string): boolean {
    return fieldName === "_PARTITIONTIME";
  }

  sqlCast(expr: Expr, castTo: string, safe: boolean): Expr {
    const dstType = castMap[castTo] || castTo;
    return mkExpr`${safe ? "SAFE_CAST" : "CAST"}(${expr}  AS ${dstType})`;
  }

  sqlLiteralTime(
    timeString: string,
    type: "date" | "timestamp",
    timezone: string
  ): string {
    if (type === "date") {
      return `DATE('${timeString}')`;
    } else if (type === "timestamp") {
      return `TIMESTAMP('${timeString}', '${timezone}')`;
    } else {
      throw new Error(`Unknown Liternal time format ${type}`);
    }
  }

  sqlMeasureTime(from: TimeValue, to: TimeValue, units: string): Expr {
    let lVal = from.value;
    let rVal = to.value;
    let diffUsing = "TIMESTAMP_DIFF";

    if (units == "second" || units == "minute" || units == "hour") {
      if (from.valueType != "timestamp") {
        lVal = mkExpr`TIMESTAMP(${lVal})`;
      }
      if (to.valueType != "timestamp") {
        rVal = mkExpr`TIMESTAMP(${rVal})`;
      }
    } else {
      diffUsing = "DATE_DIFF";
      if (from.valueType != "date") {
        lVal = mkExpr`DATE(${lVal})`;
      }
      if (to.valueType != "date") {
        rVal = mkExpr`DATE(${rVal})`;
      }
    }
    return mkExpr`${diffUsing}(${rVal}, ${lVal}, ${units})`;
  }
}
