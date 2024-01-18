/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {indent} from '../../model/utils';
import {
  DateUnit,
  Expr,
  ExtractUnit,
  Sampling,
  TimeFieldType,
  TimeValue,
  TimestampUnit,
  TypecastFragment,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  mkExpr,
  FieldAtomicTypeDef,
} from '../../model/malloy_types';
import {POSTGRES_FUNCTIONS} from './functions';
import {DialectFunctionOverloadDef} from '../functions';
import {Dialect, DialectFieldList, QueryInfo, qtz} from '../dialect';

const pgExtractionMap: Record<string, string> = {
  'day_of_week': 'dow',
  'day_of_year': 'doy',
};

const pgMakeIntervalMap: Record<string, string> = {
  'year': 'years',
  'month': 'months',
  'week': 'weeks',
  'day': 'days',
  'hour': 'hours',
  'minute': 'mins',
  'second': 'secs',
};

const inSeconds: Record<string, number> = {
  'second': 1,
  'minute': 60,
  'hour': 3600,
  'day': 24 * 3600,
  'week': 7 * 24 * 3600,
};

const postgresToMalloyTypes: {[key: string]: FieldAtomicTypeDef} = {
  'character varying': {type: 'string'},
  'name': {type: 'string'},
  'text': {type: 'string'},
  'date': {type: 'date'},
  'integer': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'integer'},
  'double precision': {type: 'number', numberType: 'float'},
  'timestamp without time zone': {type: 'timestamp'}, // maybe not
  'oid': {type: 'string'},
  'boolean': {type: 'boolean'},
  // ARRAY: "string",
  'timestamp': {type: 'timestamp'},
  '"char"': {type: 'string'},
  'character': {type: 'string'},
  'smallint': {type: 'number', numberType: 'integer'},
  'xid': {type: 'string'},
  'real': {type: 'number', numberType: 'float'},
  'interval': {type: 'string'},
  'inet': {type: 'string'},
  'regtype': {type: 'string'},
  'numeric': {type: 'number', numberType: 'float'},
  'bytea': {type: 'string'},
  'pg_ndistinct': {type: 'number', numberType: 'integer'},
  'varchar': {type: 'string'},
};

export class PostgresDialect extends Dialect {
  name = 'postgres';
  defaultNumberType = 'DOUBLE PRECISION';
  defaultDecimalType = 'NUMERIC';
  udfPrefix = 'pg_temp.__udf';
  hasFinalStage = true;
  divisionIsInteger = true;
  supportsSumDistinctFunction = false;
  unnestWithNumbers = false;
  defaultSampling = {rows: 50000};
  supportUnnestArrayAgg = true;
  supportsAggDistinct = true;
  supportsCTEinCoorelatedSubQueries = true;
  supportsSafeCast = false;
  dontUnionIndex = false;
  supportsQualify = false;
  globalFunctions = POSTGRES_FUNCTIONS;
  supportsNesting = true;

  quoteTablePath(tablePath: string): string {
    return tablePath
      .split('.')
      .map(part => `"${part}"`)
      .join('.');
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
        f =>
          `\n  ${f.sqlExpression}${
            f.type === 'number' ? `::${this.defaultNumberType}` : ''
          } as ${f.sqlOutputName}`
        //`${f.sqlExpression} ${f.type} as ${f.sqlOutputName}`
      )
      .join(', ');
  }

  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string {
    let tail = '';
    if (limit !== undefined) {
      tail += `[1:${limit}]`;
    }
    const fields = this.mapFields(fieldList);
    // return `(ARRAY_AGG((SELECT __x FROM (SELECT ${fields}) as __x) ${orderBy} ) FILTER (WHERE group_set=${groupSet}))${tail}`;
    return `COALESCE(TO_JSONB((ARRAY_AGG((SELECT TO_JSONB(__x) FROM (SELECT ${fields}\n  ) as __x) ${orderBy} ) FILTER (WHERE group_set=${groupSet}))${tail}),'[]'::JSONB)`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map(f => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(', ');
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}))`;
  }

  sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string {
    return `(ARRAY_AGG(${name}) FILTER (WHERE group_set=${groupSet} AND ${name} IS NOT NULL))[1] as ${sqlName}`;
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
    isArray: boolean,
    _isInNestedPipeline: boolean
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
    return 'GEN_RANDOM_UUID()';
  }

  sqlFieldReference(
    alias: string,
    fieldName: string,
    fieldType: string,
    isNested: boolean,
    _isArray: boolean
  ): string {
    let ret = `(${alias}->>'${fieldName}')`;
    if (isNested) {
      switch (fieldType) {
        case 'string':
          break;
        case 'number':
          ret = `${ret}::double precision`;
          break;
        case 'struct':
          ret = `${ret}::jsonb`;
          break;
      }
      return ret;
    } else {
      return `${alias}."${fieldName}"`;
    }
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    if (isSingleton) {
      return `UNNEST(ARRAY((SELECT ${sourceSQLExpression})))`;
    } else {
      return `JSONB_ARRAY_ELEMENTS(${sourceSQLExpression})`;
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
    throw new Error('Not implemented Yet');
  }

  sqlNow(): Expr {
    return mkExpr`LOCALTIMESTAMP`;
  }

  sqlTrunc(qi: QueryInfo, sqlTime: TimeValue, units: TimestampUnit): Expr {
    // adjusting for monday/sunday weeks
    const week = units === 'week';
    const truncThis = week
      ? mkExpr`${sqlTime.value} + INTERVAL '1' DAY`
      : sqlTime.value;
    if (sqlTime.valueType === 'timestamp') {
      const tz = qtz(qi);
      if (tz) {
        const civilSource = mkExpr`(${truncThis}::TIMESTAMPTZ AT TIME ZONE '${tz}')`;
        let civilTrunc = mkExpr`DATE_TRUNC('${units}', ${civilSource})`;
        // MTOY todo ... only need to do this if this is a date ...
        civilTrunc = mkExpr`${civilTrunc}::TIMESTAMP`;
        const truncTsTz = mkExpr`${civilTrunc} AT TIME ZONE '${tz}'`;
        return mkExpr`(${truncTsTz})::TIMESTAMP`;
      }
    }
    let result = mkExpr`DATE_TRUNC('${units}', ${truncThis})`;
    if (week) {
      result = mkExpr`(${result} - INTERVAL '1' DAY)`;
    }
    return result;
  }

  sqlExtract(qi: QueryInfo, from: TimeValue, units: ExtractUnit): Expr {
    const pgUnits = pgExtractionMap[units] || units;
    let extractFrom = from.value;
    if (from.valueType === 'timestamp') {
      const tz = qtz(qi);
      if (tz) {
        extractFrom = mkExpr`(${extractFrom}::TIMESTAMPTZ AT TIME ZONE '${tz}')`;
      }
    }
    const extracted = mkExpr`EXTRACT(${pgUnits} FROM ${extractFrom})`;
    return units === 'day_of_week' ? mkExpr`(${extracted}+1)` : extracted;
  }

  sqlAlterTime(
    op: '+' | '-',
    expr: TimeValue,
    n: Expr,
    timeframe: DateUnit
  ): Expr {
    if (timeframe === 'quarter') {
      timeframe = 'month';
      n = mkExpr`${n}*3`;
    }
    const interval = mkExpr`make_interval(${pgMakeIntervalMap[timeframe]}=>${n})`;
    return mkExpr`((${expr.value})${op}${interval})`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastFragment): Expr {
    const op = `${cast.srcType}::${cast.dstType}`;
    const tz = qtz(qi);
    if (op === 'timestamp::date' && tz) {
      const tstz = mkExpr`${cast.expr}::TIMESTAMPTZ`;
      return mkExpr`CAST((${tstz}) AT TIME ZONE '${tz}' AS DATE)`;
    } else if (op === 'date::timestamp' && tz) {
      return mkExpr`CAST((${cast.expr})::TIMESTAMP AT TIME ZONE '${tz}' AS TIMESTAMP)`;
    }
    if (cast.srcType !== cast.dstType) {
      const dstType =
        typeof cast.dstType === 'string'
          ? this.malloyTypeToSQLType({type: cast.dstType})
          : cast.dstType.raw;
      if (cast.safe) {
        throw new Error("Postgres dialect doesn't support Safe Cast");
      }
      const castFunc = 'CAST';
      return mkExpr`${castFunc}(${cast.expr} AS ${dstType})`;
    }
    return cast.expr;
  }

  sqlRegexpMatch(expr: Expr, regexp: Expr): Expr {
    return mkExpr`(${expr} ~ ${regexp})`;
  }

  sqlLiteralTime(
    qi: QueryInfo,
    timeString: string,
    type: TimeFieldType,
    timezone: string | undefined
  ): string {
    if (type === 'date') {
      return `DATE '${timeString}'`;
    }
    const tz = timezone || qtz(qi);
    if (tz) {
      return `TIMESTAMPTZ '${timeString} ${tz}'::TIMESTAMP`;
    }
    return `TIMESTAMP '${timeString}'`;
  }

  sqlMeasureTime(from: TimeValue, to: TimeValue, units: string): Expr {
    let lVal = from.value;
    let rVal = to.value;
    if (inSeconds[units]) {
      lVal = mkExpr`EXTRACT(EPOCH FROM ${lVal})`;
      rVal = mkExpr`EXTRACT(EPOCH FROM ${rVal})`;
      const duration = mkExpr`${rVal}-${lVal}`;
      return units === 'second'
        ? mkExpr`FLOOR(${duration})`
        : mkExpr`FLOOR((${duration})/${inSeconds[units].toString()}.0)`;
    }
    throw new Error(`Unknown or unhandled postgres time unit: ${units}`);
  }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    // return `sum_distinct(list({key:${key}, val: ${value}}))`;
    return `(
      SELECT ${funcName}((a::json->>'f2')::DOUBLE PRECISION) as value
      FROM (
        SELECT UNNEST(array_agg(distinct row_to_json(row(${key},${value}))::text)) a
      ) a
    )`;
  }

  // TODO this does not preserve the types of the arguments, meaning we have to hack
  // around this in the definitions of functions that use this to cast back to the correct
  // type (from text). See the postgres implementation of stddev.
  sqlAggDistinct(
    key: string,
    values: string[],
    func: (valNames: string[]) => string
  ): string {
    return `(
      SELECT ${func(values.map((v, i) => `(a::json->>'f${i + 2}')`))} as value
      FROM (
        SELECT UNNEST(array_agg(distinct row_to_json(row(${key},${values.join(
          ','
        )}))::text)) a
      ) a
    )`;
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        return `(SELECT * FROM ${tableSQL} TABLESAMPLE SYSTEM_ROWS(${sample.rows}))`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} TABLESAMPLE SYSTEM (${sample.percent}))`;
      }
    }
    return tableSQL;
  }

  sqlOrderBy(orderTerms: string[]): string {
    return `ORDER BY ${orderTerms.map(t => `${t} NULLS LAST`).join(',')}`;
  }

  sqlLiteralString(literal: string): string {
    return "'" + literal.replace(/'/g, "''") + "'";
  }

  sqlLiteralRegexp(literal: string): string {
    return "'" + literal.replace(/'/g, "''") + "'";
  }

  getGlobalFunctionDef(name: string): DialectFunctionOverloadDef[] | undefined {
    return POSTGRES_FUNCTIONS.get(name);
  }

  malloyTypeToSQLType(malloyType: FieldAtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        return 'integer';
      } else {
        return 'double precision';
      }
    } else if (malloyType.type === 'string') {
      return 'varchar';
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(sqlType: string): FieldAtomicTypeDef | undefined {
    // Remove trailing params
    const baseSqlType = sqlType.match(/^([\w\s]+)/)?.at(0) ?? sqlType;
    return postgresToMalloyTypes[baseSqlType.trim().toLowerCase()];
  }

  castToString(expression: string): string {
    return `CAST(${expression} as VARCHAR)`;
  }

  concat(...values: string[]): string {
    return values.join(' || ');
  }

  validateTypeName(sqlType: string): boolean {
    // Letters:              BIGINT
    // Numbers:              INT8
    // Spaces:               TIMESTAMP WITH TIME ZONE
    // Parentheses, Commas:  NUMERIC(5, 2)
    // Square Brackets:      INT64[]
    return sqlType.match(/^[A-Za-z\s(),[\]0-9]*$/) !== null;
  }
}
