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
import type {
  Sampling,
  AtomicTypeDef,
  TypecastExpr,
  MeasureTimeExpr,
  BasicAtomicTypeDef,
  RecordLiteralNode,
  ArrayLiteralNode,
  TimeExtractExpr,
  TimestampUnit,
} from '../../model/malloy_types';
import {
  isRepeatedRecord,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  TD,
} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandOverrideMap, expandBlueprintMap} from '../functions';
import {
  qtz,
  type DialectFieldList,
  type FieldReferenceType,
  type QueryInfo,
} from '../dialect';
import {PostgresBase, timeExtractMap} from '../pg_impl';
import {POSTGRES_DIALECT_FUNCTIONS} from './dialect_functions';
import {POSTGRES_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

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

// TODO there needs be an audit of this data structure
const postgresToMalloyTypes: {[key: string]: BasicAtomicTypeDef} = {
  'character varying': {type: 'string'},
  'name': {type: 'string'},
  'text': {type: 'string'},
  'date': {type: 'date'},
  'integer': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'bigint'},
  'double precision': {type: 'number', numberType: 'float'},
  'timestamp without time zone': {type: 'timestamp'},
  'timestamp with time zone': {type: 'timestamptz'},
  'oid': {type: 'string'},
  'boolean': {type: 'boolean'},
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

export class PostgresDialect extends PostgresBase {
  name = 'postgres';
  defaultNumberType = 'DOUBLE PRECISION';
  defaultDecimalType = 'NUMERIC';
  udfPrefix = 'pg_temp.__udf';
  hasFinalStage = true;
  divisionIsInteger = true;
  supportsSumDistinctFunction = true;
  unnestWithNumbers = false;
  defaultSampling = {rows: 50000};
  supportUnnestArrayAgg = true;
  supportsAggDistinct = true;
  supportsCTEinCoorelatedSubQueries = true;
  supportsSafeCast = false;
  dontUnionIndex = false;
  supportsQualify = false;
  supportsNesting = true;
  experimental = false;
  readsNestedData = false;
  supportsComplexFilteredSources = false;
  compoundObjectInSchema = false;
  likeEscape = false;
  maxIdentifierLength = 63;

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
            f.typeDef.type === 'number' ? `::${this.defaultNumberType}` : ''
          } as ${f.sqlOutputName}`
      )
      .join(', ');
  }

  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined
  ): string {
    const fields = this.mapFields(fieldList);
    return `COALESCE(TO_JSONB((ARRAY_AGG((SELECT TO_JSONB(__x) FROM (SELECT ${fields}\n  ) as __x) ${orderBy} ) FILTER (WHERE group_set=${groupSet}))),'[]'::JSONB)`;
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
        return `LEFT JOIN UNNEST(ARRAY((SELECT jsonb_build_object('__row_id', row_number() over (), 'value', v) FROM JSONB_ARRAY_ELEMENTS(TO_JSONB(${source})) as v))) as ${alias} ON true`;
      } else {
        return `LEFT JOIN UNNEST(ARRAY((SELECT jsonb_build_object('value', v) FROM JSONB_ARRAY_ELEMENTS(TO_JSONB(${source})) as v))) as ${alias} ON true`;
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
    parentAlias: string,
    parentType: FieldReferenceType,
    childName: string,
    childType: string
  ): string {
    if (childName === '__row_id') {
      return `(${parentAlias}->>'__row_id')`;
    }
    if (parentType !== 'table') {
      let ret = `JSONB_EXTRACT_PATH_TEXT(${parentAlias},'${childName}')`;
      switch (childType) {
        case 'string':
          break;
        case 'number':
          ret = `${ret}::double precision`;
          break;
        case 'struct':
        case 'array':
        case 'record':
        case 'array[record]':
        case 'sql native':
          ret = `JSONB_EXTRACT_PATH(${parentAlias},'${childName}')`;
          break;
      }
      return ret;
    } else {
      const child = this.sqlMaybeQuoteIdentifier(childName);
      return `${parentAlias}.${child}`;
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

  //
  sqlCreateFunctionCombineLastStage(lastStageName: string): string {
    return `SELECT JSONB_AGG(${lastStageName}) FROM ${lastStageName}\n`;
  }

  sqlFinalStage(lastStageName: string, _fields: string[]): string {
    return `SELECT row_to_json(finalStage) as row FROM ${lastStageName} AS finalStage`;
  }

  sqlSelectAliasAsStruct(alias: string): string {
    return `ROW(${alias})`;
  }

  // The simple way to do this is to add a comment on the table
  //  with the expiration time. https://www.postgresql.org/docs/current/sql-comment.html
  //  and have a reaper that read comments.
  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    throw new Error('Not implemented Yet');
  }

  sqlOffsetTime(
    expr: string,
    op: '+' | '-',
    magnitude: string,
    unit: TimestampUnit,
    _typeDef: AtomicTypeDef,
    _inCivilTime: boolean,
    _timezone?: string
  ): string {
    // Convert quarter/week to supported units
    let offsetUnit = unit;
    let offsetMag = magnitude;
    if (unit === 'quarter') {
      offsetUnit = 'month';
      offsetMag = `(${magnitude})*3`;
    } else if (unit === 'week') {
      offsetUnit = 'day';
      offsetMag = `(${magnitude})*7`;
    }

    // Map to make_interval parameter name
    const intervalParam = pgMakeIntervalMap[offsetUnit];
    const interval = `make_interval(${intervalParam}=>(${offsetMag})::integer)`;
    return `(${expr} ${op} ${interval})`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    if (cast.safe) {
      throw new Error("Postgres dialect doesn't support Safe Cast");
    }
    return super.sqlCast(qi, cast);
  }

  sqlMeasureTimeExpr(df: MeasureTimeExpr): string {
    const from = df.kids.left;
    const to = df.kids.right;
    let lVal = from.sql;
    let rVal = to.sql;
    if (inSeconds[df.units]) {
      lVal = `EXTRACT(EPOCH FROM ${lVal})`;
      rVal = `EXTRACT(EPOCH FROM ${rVal})`;
      const duration = `${rVal}-${lVal}`;
      return df.units === 'second'
        ? `FLOOR(${duration})`
        : `FLOOR((${duration})/${inSeconds[df.units].toString()}.0)`;
    }
    throw new Error(`Unknown or unhandled postgres time unit: ${df.units}`);
  }

  // This looks like a partial implementation of a method similar to how DuckDB
  // does symmetric aggregates, which was abandoned. Leaving it in here for now
  // in case the original author wants to pick it up again.
  // sqlSumDistinct(key: string, value: string, funcName: string): string {
  //   // return `sum_distinct(list({key:${key}, val: ${value}}))`;
  //   return `(
  //     SELECT ${funcName}((a::json->>'f2')::DOUBLE PRECISION) as value
  //     FROM (
  //       SELECT UNNEST(array_agg(distinct row_to_json(row(${key},${value}))::text)) a
  //     ) a
  //   )`;
  // }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    const hashKey = this.sqlSumDistinctHashedKey(key);

    // PostgreSQL requires CAST to NUMERIC before ROUND, which is different
    // than the generic implementation of sqlSumDistinct, but is OK in
    // PostgreSQL because NUMERIC has arbitrary precision.
    const roundedValue = `ROUND(CAST(COALESCE(${value}, 0) AS NUMERIC), 9)`;
    const sumSQL = `SUM(DISTINCT ${roundedValue} + ${hashKey}) - SUM(DISTINCT ${hashKey})`;
    const ret = `CAST(${sumSQL} AS DOUBLE PRECISION)`;

    if (funcName === 'SUM') {
      return ret;
    } else if (funcName === 'AVG') {
      return `(${ret})/NULLIF(COUNT(DISTINCT CASE WHEN ${value} IS NOT NULL THEN ${key} END), 0)`;
    }
    throw new Error(`Unknown Symmetric Aggregate function ${funcName}`);
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

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(POSTGRES_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(POSTGRES_DIALECT_FUNCTIONS);
  }

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        return 'integer';
      } else if (malloyType.numberType === 'bigint') {
        return 'bigint';
      } else {
        return 'double precision';
      }
    } else if (malloyType.type === 'string') {
      return 'varchar';
    } else if (malloyType.type === 'record') {
      throw new Error('PostgreSQL does not support CAST to record type');
    } else if (malloyType.type === 'array') {
      if (isRepeatedRecord(malloyType)) {
        throw new Error('PostgreSQL does not support CAST to array of records');
      }
      return `${this.malloyTypeToSQLType(malloyType.elementTypeDef)}[]`;
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(rawSqlType: string): BasicAtomicTypeDef {
    const sqlType = rawSqlType.toLowerCase();
    // Remove trailing params
    const baseSqlType = sqlType.match(/^([\w\s]+)/)?.at(0) ?? sqlType;
    return (
      postgresToMalloyTypes[baseSqlType.trim().toLowerCase()] ?? {
        type: 'sql native',
        rawType: sqlType,
      }
    );
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

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    const props: string[] = [];
    for (const [kName, kVal] of Object.entries(lit.kids)) {
      props.push(`'${kName}',${kVal.sql}`);
    }
    return `JSONB_BUILD_OBJECT(${props.join(', ')})`;
  }

  sqlLiteralArray(lit: ArrayLiteralNode): string {
    const array = lit.kids.values.map(val => val.sql);
    return 'JSONB_BUILD_ARRAY(' + array.join(',') + ')';
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const units = timeExtractMap[from.units] || from.units;
    let extractFrom = from.e.sql;
    if (TD.isAnyTimestamp(from.e.typeDef)) {
      const tz = qtz(qi);
      if (tz) {
        extractFrom = `(${extractFrom}::TIMESTAMPTZ AT TIME ZONE '${tz}')`;
      }
    }

    // PostgreSQL before 14 returns a double precision for EXTRACT, cast to integer
    // since it is common to pass an extraction to mod ( like in fitler expressions )
    const extracted = `EXTRACT(${units} FROM ${extractFrom})::integer`;

    return from.units === 'day_of_week' ? `(${extracted}+1)` : `(${extracted})`;
  }
}
