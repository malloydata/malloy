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
  udfPrefix = "pg_temp.__udf";
  hasFinalStage = true;
  stringTypeName = "VARCHAR";
  divisionIsInteger = true;
  supportsSumDistinctFunction = true;

  functionInfo: Record<string, FunctionInfo> = {};

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
    return fieldList
      .map(
        (f) =>
          `\n  ${f.sqlExpression}${
            f.type == "number" ? `::${this.defaultNumberType}` : ""
          } as ${f.sqlOutputName}`
        //`${f.sqlExpression} ${f.type} as ${f.sqlOutputName}`
      )
      .join(", ");
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
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}))`;
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
    const fields = this.mapFields(fieldList);
    return `TO_JSONB((ARRAY_AGG((SELECT __x FROM (SELECT ${fields}) as __x)) FILTER (WHERE group_set=${groupSet}))[1])`;
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
      return `LEFT JOIN JSONB_ARRAY_ELEMENTS(${source}) as ${alias} ON true`;
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
    fieldType: string,
    isNested: boolean
  ): string {
    let ret = `${alias}->>'${fieldName}'`;
    if (isNested) {
      switch (fieldType) {
        case "string":
          break;
        case "number":
          ret = `(${ret})::double precision`;
          break;
        case "struct":
          ret = `(${ret})::jsonb`;
          break;
      }
      return ret;
    } else {
      return `${alias}.${fieldName}`;
    }
  }

  sqlUnnestPipelineHead(): string {
    return "JSONB_ARRAY_ELEMENTS($1)";
  }

  sqlCreateFunction(id: string, funcText: string): string {
    return `CREATE FUNCTION ${id}(JSONB) RETURNS JSONB AS $$\n${indent(
      funcText
    )}\n$$ LANGUAGE SQL;\n`;
  }

  sqlCreateFunctionCombineLastStage(lastStageName: string): string {
    return `SELECT JSONB_AGG(__stage0) FROM ${lastStageName}\n`;
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

  sqlSumDistinct(key: string, value: string): string {
    return `sum_distinct(list({key:${key}, val: ${value}}))`;
  }
}
