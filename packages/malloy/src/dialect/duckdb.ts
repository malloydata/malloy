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

import { DateTimeframe, TimestampTimeframe } from "..";
import {
  DateUnit,
  Expr,
  ExtractUnit,
  isDateUnit,
  mkExpr,
  TimeFieldType,
  TimestampUnit,
  TimeValue,
  TypecastFragment,
} from "../model";
import { indent } from "../model/utils";
import { Dialect, DialectFieldList, FunctionInfo } from "./dialect";

// need to refactor runSQL to take a SQLBlock instead of just a sql string.
const hackSplitComment = "-- hack: split on this";

/* We could do JOIN UNNEST this way...

  WITH data as (
    SELECT UNNEST([
      {'who':'lloyd'
        , bikes: [
          {'bike':'masi', weight: 10},
          {'bike':'vado', weight: 20},
          {'bike':'superdelite', weight: 20}
        ],
        bags: [
          {'bag':'paper', weight: 10},
          {'bag':'plastic', weight: 20},
          {'bag':'rubber', weight: 20}
        ]
      }
    ]) d
  )
  SELECT
    d.who,
    d.bikes[bike_index.a].bike,
    d.bags[bag_index.a].bag,
    m.a
    from data
  CROSS JOIN (select max(array_length(d.bikes)) as a FROM data) as m
  CROSS JOIN (SELECT UNNEST(generate_series(1,10000,1)) as a) as bike_index
  CROSS JOIN (SELECT UNNEST(generate_series(1,10000,1)) as a) as bag_index
  WHERE
    bike_index.a <= array_length(d.bikes)
    AND bag_index.a <= array_length(d.bags)
    ;

 */

const castMap: Record<string, string> = {
  number: "double precision",
  string: "varchar",
};

const extractMap: Record<string, string> = {
  day_of_week: "dayofweek",
  day_of_year: "dayofyear",
};

const pgMakeIntervalMap: Record<string, string> = {
  year: "years",
  month: "months",
  week: "weeks",
  day: "days",
  hour: "hours",
  minute: "mins",
  second: "secs",
};

export class DuckDBDialect extends Dialect {
  name = "duckdb";
  defaultNumberType = "DOUBLE";
  hasFinalStage = true;
  stringTypeName = "VARCHAR";
  divisionIsInteger = true;
  supportsSumDistinctFunction = true;
  unnestWithNumbers = true;

  functionInfo: Record<string, FunctionInfo> = {};

  // hack until they support temporary macros.
  get udfPrefix(): string {
    return `__udf${Math.floor(Math.random() * 100000)}`;
  }

  quoteTablePath(tableName: string): string {
    return `${tableName}`;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT UNNEST(GENERATE_SERIES(0,${groupSetCount},1)) as group_set  ) as group_set`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `MAX(${fieldName})`;
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
    return `LIST({${fields}} ${orderBy}) FILTER (WHERE group_set=${groupSet})${tail}`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map((f) => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(", ");
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ROW(${fields}))`;
  }

  sqlAnyValueLastTurtle(name: string, sqlName: string): string {
    return `(LIST(${name}__0) FILTER (WHERE group_set=0 AND ${name}__0 IS NOT NULL))[1] as ${sqlName}`;
  }

  // we should remov this code when https://github.com/duckdb/duckdb/issues/3544 is fixed.
  sqlFinalStage(lastStageName: string, fields: string[]): string {
    return `SELECT to_json(list(row(${fields.join(
      ", "
    )})))::VARCHAR as results FROM ${lastStageName} AS finalStage`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = fieldList
      .map((f) => `${f.sqlOutputName}: ${f.sqlExpression} `)
      .join(", ");
    const _nullValues = fieldList
      .map((f) => `NULL as ${f.sqlOutputName}`)
      .join(", ");

    // return `COALESCE(ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}) END), STRUCT(${nullValues}))`;
    return `{${fields}}`;
  }

  sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    needDistinctKey: boolean
  ): string {
    if (needDistinctKey) {
      // return `UNNEST(ARRAY(( SELECT AS STRUCT GENERATE_UUID() as __distinct_key, * FROM UNNEST(${source})))) as ${alias}`;
      return `LEFT JOIN UNNEST(ARRAY((SELECT jsonb_build_object('__distinct_key', gen_random_uuid()::text)|| __xx::jsonb as b FROM  JSONB_ARRAY_ELEMENTS(${source}) __xx ))) as ${alias} ON true`;
    } else {
      // return `CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(${source}) as ${alias}`;
      // return `LEFT JOIN JSONB_ARRAY_ELEMENTS(${source}) as ${alias} ON true`;
      return `LEFT JOIN (select UNNEST(generate_series(1,
        1000000, --
        -- (SELECT genres_length FROM movies limit 1),
        1)) as i) as ${alias} ON  ${alias}.i <= array_length(${source})`
    }
  }

  sqlSumDistinctHashedKey(_sqlDistinctKey: string): string {
    return "uses sumDistinctFunction, should not be called";
  }

  sqlGenerateUUID(): string {
    return `GEN_RANDOM_UUID()`;
  }

  sqlFieldReference(
    alias: string,
    fieldName: string,
    _fieldType: string,
    _isNested: boolean,
    isArray: boolean
  ): string {
    if (isArray) {
      return alias;
    } else {
      return `${alias}.${fieldName}`;
    }
  }

  sqlUnnestPipelineHead(): string {
    return "(SELECT UNNEST(_param) as base)";
  }

  sqlCreateFunction(_id: string, _funcText: string): string {
    return "FORCE FAIL";
    //return `DROP MACRO ${id}; \n${hackSplitComment}\n CREATE MACRO ${id}(_param) AS (\n${indent(
    //   funcText
    // )}\n);\n${hackSplitComment}\n`;
  }

  sqlCreateFunctionCombineLastStage(lastStageName: string): string {
    return `SELECT * FROM ${lastStageName}\n`;
  }

  sqlSelectAliasAsStruct(alias: string): string {
    return `ROW(${alias})`;
  }
  // TODO
  sqlMaybeQuoteIdentifier(identifier: string): string {
    return identifier;
  }

  // The simple way to do this is to add a comment on the table
  //  with the expiration time. https://www.postgresql.org/docs/current/sql-comment.html
  //  and have a reaper that read comments.
  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    throw new Error("Not implemented Yet");
  }

  getFunctionInfo(_functionName: string): FunctionInfo | undefined {
    return undefined;
  }

  sqlExtract(expr: TimeValue, units: ExtractUnit): Expr {
    const extractTo = extractMap[units] || units;
    return mkExpr`EXTRACT(${extractTo} FROM ${expr.value})`;
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

  sqlTrunc(sqlTime: TimeValue, units: TimestampUnit): Expr {
    if (sqlTime.valueType == "date") {
      if (isDateUnit(units)) {
        return mkExpr`DATE_TRUNC(${sqlTime.value},${units})`;
      }
      return mkExpr`TIMESTAMP(${sqlTime.value})`;
    }
    return mkExpr`TIMESTAMP_TRUNC(${sqlTime.value},${units})`;
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
    const interval = mkExpr`make_interval(${pgMakeIntervalMap[timeframe]}=>${n})`;
    return mkExpr`((${expr.value})${op}${interval})`;
  }

  sqlCast(cast: TypecastFragment): Expr {
    if (cast.dstType !== cast.srcType) {
      const castTo = castMap[cast.dstType] || cast.dstType;
      return mkExpr`cast(${cast.expr} as ${castTo})`;
    }
    return cast.expr;
  }

  sqlLiteralTime(
    timeString: string,
    type: TimeFieldType,
    _timezone: string
  ): string {
    if (type == "date") {
      return `DATE('${timeString}')`;
    } else if (type == "timestamp") {
      return `TIMESTAMP '${timeString}'`;
    } else {
      throw new Error(`Unknown Literal time format ${type}`);
    }
  }

  // sqlSumDistinct(key: string, value: string): string {
  //   // return `sum_distinct(list({key:${key}, val: ${value}}))`;
  //   return `(
  //     fail -- force the query for fail until the bug is fixed.
  //     SELECT sum(a.val) as value
  //     FROM (
  //       SELECT UNNEST(list(distinct {key:${key}, val: ${value}})) a
  //     )
  //   )`;
  // }
  sqlSumDistinct(key: string, value: string): string {
    const factor = "10000000000000000";
    const precision = 0.000001;
    return `
    (SUM(DISTINCT md5_number(${key}::varchar)/${factor} + FLOOR(${value}/${precision})::int128) -  SUM(DISTINCT md5_number(${key}::varchar)/${factor}))*${precision}
    `;
  }
}
