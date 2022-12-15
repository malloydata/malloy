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
  DateUnit,
  Expr,
  ExtractUnit,
  getIdentifier,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  mkExpr,
  Sampling,
  StructDef,
  TimeFieldType,
  TimestampUnit,
  TimeValue,
  TypecastFragment,
} from "../model";
import { indent } from "../model/utils";
import { Dialect, DialectFieldList, FunctionInfo } from "./dialect";

// need to refactor runSQL to take a SQLBlock instead of just a sql string.
const hackSplitComment = "-- hack: split on this";

const keywords = `
ALL
ANALYSE
ANALYZE
AND
ANY
ARRAY
AS
ASC_P
ASYMMETRIC
BOTH
CASE
CAST
CHECK_P
COLLATE
COLUMN
CONSTRAINT
CREATE_P
CURRENT_CATALOG
CURRENT_DATE
CURRENT_ROLE
CURRENT_TIME
CURRENT_TIMESTAMP
CURRENT_USER
DEFAULT
DEFERRABLE
DESC_P
DISTINCT
DO
ELSE
END_P
EXCEPT
FALSE_P
FETCH
FOR
FOREIGN
FROM
GRANT
GROUP_P
HAVING
IN_P
INITIALLY
INTERSECT
INTO
LATERAL_P
LEADING
LIMIT
LOCALTIME
LOCALTIMESTAMP
NOT
NULL_P
OFFSET
ON
ONLY
OR
ORDER
PLACING
PRIMARY
REFERENCES
RETURNING
SELECT
SESSION_USER
SOME
SYMMETRIC
TABLE
THEN
TO
TRAILING
TRUE_P
UNION
UNIQUE
USER
USING
VARIADIC
WHEN
WHERE
WINDOW
WITH
`.split(/\s/);

const castMap: Record<string, string> = {
  number: "double precision",
  string: "varchar",
};

const pgExtractionMap: Record<string, string> = {
  day_of_week: "dow",
  day_of_year: "doy",
};

const inSeconds: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
};

export class DuckDBDialect extends Dialect {
  name = "duckdb";
  defaultNumberType = "DOUBLE";
  hasFinalStage = false;
  stringTypeName = "VARCHAR";
  divisionIsInteger = true;
  supportsSumDistinctFunction = true;
  unnestWithNumbers = false;
  defaultSampling = { rows: 50000 };
  supportUnnestArrayAgg = true;
  supportsCTEinCoorelatedSubQueries = true;
  dontUnionIndex = false;

  functionInfo: Record<string, FunctionInfo> = {
    concat: { returnType: "string" },
  };

  // hack until they support temporary macros.
  get udfPrefix(): string {
    return `__udf${Math.floor(Math.random() * 100000)}`;
  }

  quoteTablePath(tableName: string): string {
    return tableName.match(/\//) ? `'${tableName}'` : tableName;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT UNNEST(GENERATE_SERIES(0,${groupSetCount},1)) as group_set  ) as group_set`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `FIRST(${fieldName}) FILTER (WHERE ${fieldName} IS NOT NULL)`;
  }

  mapFields(fieldList: DialectFieldList): string {
    return fieldList.join(", ");
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
      .map((f) => `\n  ${f.sqlOutputName}: ${f.sqlExpression}`)
      .join(", ");
    return `COALESCE(LIST({${fields}} ${orderBy}) FILTER (WHERE group_set=${groupSet})${tail},[])`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map((f) => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(", ");
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ROW(${fields}))`;
  }

  sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string {
    return `MAX(CASE WHEN group_set=${groupSet} THEN ${name}__${groupSet} END) as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = fieldList
      .map((f) => `${f.sqlOutputName}: ${f.sqlExpression} `)
      .join(", ");
    const nullValues = fieldList
      .map((f) => `${f.sqlOutputName}: NULL`)
      .join(", ");

    return `COALESCE(FIRST({${fields}}) FILTER(WHERE group_set=${groupSet}), {${nullValues}})`;
  }

  // sqlUnnestAlias(
  //   source: string,
  //   alias: string,
  //   _fieldList: DialectFieldList,
  //   _needDistinctKey: boolean
  // ): string {
  //   return `LEFT JOIN (select UNNEST(generate_series(1,
  //       100000, --
  //       -- (SELECT genres_length FROM movies limit 1),
  //       1)) as __row_id) as ${alias} ON  ${alias}.__row_id <= array_length(${source})`;
  //   // When DuckDB supports lateral joins...
  //   //return `,(select UNNEST(generate_series(1, length(${source}),1))) as ${alias}(__row_id)`;
  // }

  sqlUnnestAlias(
    source: string,
    alias: string,
    _fieldList: DialectFieldList,
    needDistinctKey: boolean
  ): string {
    // Simulate left joins by guarenteeing there is at least one row.
    if (!needDistinctKey) {
      //return `, (SELECT GEN_RANDOM_UUID() as __row_id, ${alias}_outer.${alias} FROM (SELECT UNNEST(coalesce(${source},[null]))) as ${alias}_outer(${alias})) as ${alias}_outer`;
      return `, (SELECT UNNEST(CASE WHEN length(${source}) = 0  OR ${source} IS NULL THEN [null] ELSE ${source} END)) as ${alias}_outer(${alias})`;
    } else {
      return `, (SELECT UNNEST(GENERATE_SERIES(1,CASE WHEN COALESCE(length(${source}),0)=0 THEN 1 ELSE length(${source}) END,1)) as __row_id, UNNEST(CASE WHEN length(${source}) = 0 OR ${source} IS NULL THEN [null] ELSE ${source} END)) as ${alias}_outer(__row_id, ${alias})`;
    }
  }

  sqlSumDistinctHashedKey(_sqlDistinctKey: string): string {
    return "uses sumDistinctFunction, should not be called";
  }

  sqlGenerateUUID(): string {
    return `GEN_RANDOM_UUID()`;
  }

  sqlDateToString(sqlDateExp: string): string {
    return `(${sqlDateExp})::date::varchar`;
  }

  sqlFieldReference(
    alias: string,
    fieldName: string,
    _fieldType: string,
    _isNested: boolean,
    isArray: boolean
  ): string {
    // LTNOTE: hack, in duckdb we can't have structs as tables so we kind of simulate it.
    if (fieldName === "__row_id") {
      return `${alias}_outer.__row_id`;
    } else if (isArray) {
      return alias;
    } else {
      return `${alias}.${this.sqlMaybeQuoteIdentifier(fieldName)}`;
    }
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    let p = sourceSQLExpression;
    if (isSingleton) {
      p = `[${p}]`;
    }
    return `(SELECT UNNEST(${p}) as base)`;
  }

  sqlCreateFunction(id: string, funcText: string): string {
    return `DROP MACRO IF EXISTS ${id}; \n${hackSplitComment}\n CREATE MACRO ${id}(_param) AS (\n${indent(
      funcText
    )}\n);\n${hackSplitComment}\n`;
  }

  sqlCreateFunctionCombineLastStage(
    lastStageName: string,
    structDef: StructDef
  ): string {
    return `SELECT LIST(ROW(${structDef.fields
      .map((fieldDef) => this.sqlMaybeQuoteIdentifier(getIdentifier(fieldDef)))
      .join(",")})) FROM ${lastStageName}\n`;
  }

  sqlSelectAliasAsStruct(alias: string, physicalFieldNames: string[]): string {
    return `ROW(${physicalFieldNames
      .map((name) => `${alias}.${name}`)
      .join(", ")})`;
  }
  // TODO
  // sqlMaybeQuoteIdentifier(identifier: string): string {
  //   return keywords.indexOf(identifier.toUpperCase()) > 0 ||
  //     identifier.match(/[a-zA-Z][a-zA-Z0-9]*/) === null || true
  //     ? '"' + identifier + '"'
  //     : identifier;
  // }

  sqlMaybeQuoteIdentifier(identifier: string): string {
    return '"' + identifier + '"';
  }

  // The simple way to do this is to add a comment on the table
  //  with the expiration time. https://www.postgresql.org/docs/current/sql-comment.html
  //  and have a reaper that read comments.
  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    throw new Error("Not implemented Yet");
  }

  getFunctionInfo(functionName: string): FunctionInfo | undefined {
    return this.functionInfo[functionName];
  }

  sqlMeasureTime(from: TimeValue, to: TimeValue, units: string): Expr {
    let lVal = from.value;
    let rVal = to.value;
    if (inSeconds[units]) {
      lVal = mkExpr`EXTRACT(EPOCH FROM ${lVal})`;
      rVal = mkExpr`EXTRACT(EPOCH FROM ${rVal})`;
      const duration = mkExpr`(${rVal} - ${lVal})`;
      return units == "second"
        ? duration
        : mkExpr`FLOOR(${duration}/${inSeconds[units].toString()})`;
    }
    if (from.valueType != "date") {
      lVal = mkExpr`CAST((${lVal}) AS DATE)`;
    }
    if (to.valueType != "date") {
      rVal = mkExpr`CAST((${rVal}) AS DATE)`;
    }
    if (units == "week") {
      // DuckDB's weeks start on Monday, but Malloy's weeks start on Sunday
      lVal = mkExpr`(${lVal} + INTERVAL 1 DAY)`;
      rVal = mkExpr`(${rVal} + INTERVAL 1 DAY)`;
    }
    return mkExpr`DATE_DIFF('${units}', ${lVal}, ${rVal})`;
  }

  sqlNow(): Expr {
    return mkExpr`CURRENT_TIMESTAMP::TIMESTAMP`;
  }

  sqlTrunc(sqlTime: TimeValue, units: TimestampUnit): Expr {
    // adjusting for monday/sunday weeks
    const week = units == "week";
    const truncThis = week
      ? mkExpr`${sqlTime.value} + INTERVAL 1 DAY`
      : sqlTime.value;
    const trunced = mkExpr`DATE_TRUNC('${units}', ${truncThis})`;
    return week ? mkExpr`(${trunced} - INTERVAL 1 DAY)` : trunced;
  }

  sqlExtract(from: TimeValue, units: ExtractUnit): Expr {
    const pgUnits = pgExtractionMap[units] || units;
    const extracted = mkExpr`EXTRACT(${pgUnits} FROM ${from.value})`;
    return units == "day_of_week" ? mkExpr`(${extracted}+1)` : extracted;
  }

  sqlAlterTime(
    op: "+" | "-",
    expr: TimeValue,
    n: Expr,
    timeframe: DateUnit
  ): Expr {
    if (timeframe == "quarter") {
      timeframe = "month";
      n = mkExpr`${n}*3`;
    }
    if (timeframe == "week") {
      timeframe = "day";
      n = mkExpr`${n}*7`;
    }
    const interval = mkExpr`INTERVAL (${n}) ${timeframe}`;
    return mkExpr`((${expr.value})) ${op} ${interval}`;
  }

  sqlCast(cast: TypecastFragment): Expr {
    if (cast.dstType !== cast.srcType) {
      const castTo = castMap[cast.dstType] || cast.dstType;
      return mkExpr`cast(${cast.expr} as ${castTo})`;
    }
    return cast.expr;
  }

  sqlRegexpMatch(expr: Expr, regexp: string): Expr {
    return mkExpr`REGEXP_MATCHES(${expr}, ${regexp})`;
  }

  sqlLiteralTime(
    timeString: string,
    type: TimeFieldType,
    _timezone: string
  ): string {
    if (type == "date") {
      return `DATE '${timeString}'`;
    } else if (type == "timestamp") {
      return `TIMESTAMP '${timeString}'`;
    } else {
      throw new Error(`Unknown Literal time format ${type}`);
    }
  }

  sqlSumDistinct(key: string, value: string): string {
    // return `sum_distinct(list({key:${key}, val: ${value}}))`;
    return `(
      SELECT sum(a.val) as value
      FROM (
        SELECT UNNEST(list(distinct {key:${key}, val: ${value}})) a
      )
    )`;
  }
  // sqlSumDistinct(key: string, value: string): string {
  //   const _factor = 32;
  //   const precision = 0.000001;
  //   const keySQL = `md5_number_lower(${key}::varchar)::int128`;
  //   return `
  //   (SUM(DISTINCT ${keySQL} + FLOOR(IFNULL(${value},0)/${precision})::int128) -  SUM(DISTINCT ${keySQL}))*${precision}
  //   `;
  // }

  // default duckdb to sampling 50K rows.
  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        return `(SELECT * FROM ${tableSQL} USING SAMPLE ${sample.rows})`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} USING SAMPLE ${sample.percent} PERCENT (bernoulli))`;
      }
    }
    return tableSQL;
  }

  sqlOrderBy(orderTerms: string[]): string {
    return `ORDER BY ${orderTerms.map((t) => `${t} NULLS LAST`).join(",")}`;
  }

  sqlLiteralString(literal: string): string {
    return "'" + literal.replace(/'/g, "''") + "'";
  }
}
