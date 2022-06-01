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
  DateUnit,
  ExtractUnit,
  TimeFieldType,
  TimestampUnit,
  Expr,
  TimeValue,
  mkExpr,
  TypecastFragment,
} from "../model";
import { Dialect, DialectFieldList, FunctionInfo } from "./dialect";

const castMap: Record<string, string> = {
  number: "double precision",
  string: "varchar",
};

const pgExtractionMap: Record<string, string> = {
  day_of_week: "dow",
  day_of_year: "doy",
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

const inSeconds: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 604800,
};

export class PostgresDialect extends Dialect {
  name = "postgres";
  defaultNumberType = "DOUBLE PRECISION";
  udfPrefix = "pg_temp.__udf";
  hasFinalStage = true;
  stringTypeName = "VARCHAR";
  divisionIsInteger = true;
  supportsSumDistinctFunction = false;
  unnestWithNumbers = false;

  functionInfo: Record<string, FunctionInfo> = {};

  quoteTablePath(tablePath: string): string {
    return tablePath
      .split(".")
      .map((part) => `"${part}"`)
      .join(".");
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN GENERATE_SERIES(0,${groupSetCount},1) as group_set`;
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
    const fields = this.mapFields(fieldList);
    // return `(ARRAY_AGG((SELECT __x FROM (SELECT ${fields}) as __x) ${orderBy} ) FILTER (WHERE group_set=${groupSet}))${tail}`;
    return `COALESCE(TO_JSONB((ARRAY_AGG((SELECT TO_JSONB(__x) FROM (SELECT ${fields}\n  ) as __x) ${orderBy} ) FILTER (WHERE group_set=${groupSet}))${tail}),'[]'::JSONB)`;
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
    const fields = this.mapFields(fieldList);
    return `TO_JSONB((ARRAY_AGG((SELECT __x FROM (SELECT ${fields}) as __x)) FILTER (WHERE group_set=${groupSet}))[1])`;
  }

  // UNNEST((select ARRAY((SELECT ROW(gen_random_uuid()::text, state, airport_count) FROM UNNEST(base.by_state) as by_state(state text, airport_count numeric, by_fac_type record[]))))) as by_state(__distinct_key text, state text, airport_count numeric)

  // sqlUnnestAlias(
  //   source: string,
  //   alias: string,
  //   fieldList: DialectFieldList,
  //   needDistinctKey: boolean
  // ): string {
  //   const fields = [];
  //   for (const f of fieldList) {
  //     let t = undefined;
  //     switch (f.type) {
  //       case "string":
  //         t = "text";
  //         break;
  //       case "number":
  //         t = this.defaultNumberType;
  //         break;
  //       case "struct":
  //         t = "record[]";
  //         break;
  //     }
  //     fields.push(`${f.sqlOutputName} ${t || f.type}`);
  //   }
  //   if (needDistinctKey) {
  //     return `UNNEST((select ARRAY((SELECT ROW(gen_random_uuid()::text, ${fieldList
  //       .map((f) => f.sqlOutputName)
  //       .join(", ")}) FROM UNNEST(${source}) as ${alias}(${fields.join(
  //       ", "
  //     )}))))) as ${alias}(__distinct_key text, ${fields.join(", ")})`;
  //   } else {
  //     return `UNNEST(${source}) as ${alias}(${fields.join(", ")})`;
  //   }
  // }

  sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean
  ): string {
    if (isArray) {
      if (needDistinctKey) {
        return `LEFT JOIN UNNEST(ARRAY((SELECT jsonb_build_object('__row_id', row_number() over (), 'value', v) FROM UNNEST(${source}) as v))) as ${alias} ON true`;
      } else {
        return `LEFT JOIN UNNEST(ARRAY((SELECT jsonb_build_object('value', v) FROM UNNEST(${source}) as v))) as ${alias} ON true`;
      }
    } else if (needDistinctKey) {
      // return `UNNEST(ARRAY(( SELECT AS STRUCT GENERATE_UUID() as __distinct_key, * FROM UNNEST(${source})))) as ${alias}`;
      return `LEFT JOIN UNNEST(ARRAY((SELECT jsonb_build_object('__row_number', row_number() over())|| __xx::jsonb as b FROM  JSONB_ARRAY_ELEMENTS(${source}) __xx ))) as ${alias} ON true`;
    } else {
      // return `CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(${source}) as ${alias}`;
      return `LEFT JOIN JSONB_ARRAY_ELEMENTS(${source}) as ${alias} ON true`;
    }
  }

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    return `('x' || MD5(${sqlDistinctKey}::varchar))::bit(64)::bigint::DECIMAL(65,0)  *18446744073709551616 + ('x' || SUBSTR(MD5(${sqlDistinctKey}::varchar),17))::bit(64)::bigint::DECIMAL(65,0)`;
  }

  sqlGenerateUUID(): string {
    return `GEN_RANDOM_UUID()`;
  }

  sqlFieldReference(
    alias: string,
    fieldName: string,
    fieldType: string,
    isNested: boolean,
    _isArray: boolean
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
      return `${alias}."${fieldName}"`;
    }
  }

  sqlUnnestPipelineHead(isSingleton: boolean): string {
    if (isSingleton) {
      return "UNNEST(ARRAY((SELECT $1)))";
    } else {
      return "JSONB_ARRAY_ELEMENTS($1)";
    }
  }

  sqlCreateFunction(id: string, funcText: string): string {
    return `CREATE FUNCTION ${id}(JSONB) RETURNS JSONB AS $$\n${indent(
      funcText
    )}\n$$ LANGUAGE SQL;\n`;
  }

  sqlCreateFunctionCombineLastStage(lastStageName: string): string {
    return `SELECT JSONB_AGG(__stage0) FROM ${lastStageName}\n`;
  }

  sqlFinalStage(lastStageName: string, _fields: string[]): string {
    return `SELECT row_to_json(finalStage) as row FROM ${lastStageName} AS finalStage`;
  }

  sqlSelectAliasAsStruct(alias: string): string {
    return `ROW(${alias})`;
  }
  // TODO
  sqlMaybeQuoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }

  // The simple way to do this is to add a comment on the table
  //  with the expiration time. https://www.postgresql.org/docs/current/sql-comment.html
  //  and have a reaper that read comments.
  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    throw new Error("Not implemented Yet");
  }

  sqlTrunc(sqlTime: TimeValue, units: TimestampUnit): Expr {
    // adjusting for monday/sunday weeks
    const week = units == "week";
    const truncThis = week
      ? mkExpr`${sqlTime.value}+interval'1'day`
      : sqlTime.value;
    const trunced = mkExpr`DATE_TRUNC('${units}', ${truncThis})`;
    return week ? mkExpr`(${trunced}-interval'1'day)` : trunced;
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

  sqlRegexpMatch(expr: Expr, regexp: string): Expr {
    return mkExpr`(${expr} ~ ${regexp})`;
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

  getFunctionInfo(_functionName: string): FunctionInfo | undefined {
    return undefined;
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
        : mkExpr`TRUNC(${duration}/${inSeconds[units].toString()})`;
    }
    const yearDiff = mkExpr`TRUNC(EXTRACT(YEAR FROM ${rVal}) - EXTRACT(YEAR FROM ${lVal}))`;
    if (units == "year") {
      return yearDiff;
    }
    if (units == "month") {
      const monthDiff = mkExpr`TRUNC(EXTRACT(MONTH FROM ${rVal}) - EXTRACT(MONTH FROM ${lVal}))`;
      return mkExpr`${yearDiff} * 12 + ${monthDiff}`;
    }
    if (units == "quarter") {
      const qDiff = mkExpr`TRUNC(EXTRACT(QUARTER FROM ${rVal}) - EXTRACT(QUARTER FROM ${lVal}))`;
      return mkExpr`${yearDiff} * 4 + ${qDiff}`;
    }
    throw new Error(`Unknown or unhandled postgres time unit: ${units}`);
  }

  sqlSumDistinct(key: string, value: string): string {
    // return `sum_distinct(list({key:${key}, val: ${value}}))`;
    return `(
      SELECT sum((a::json->>'f2')::DOUBLE PRECISION) as value
      FROM (
        SELECT UNNEST(array_agg(distinct row_to_json(row(${key},${value}))::text)) a
      ) a
    )`;
  }
}
