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
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,p
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {indent} from '../../model/utils';
import type {
  Expr,
  Sampling,
  AtomicTypeDef,
  ATimestampTypeDef,
  TypecastExpr,
  RegexMatchExpr,
  MeasureTimeExpr,
  TimeExtractExpr,
  BasicAtomicTypeDef,
  RecordLiteralNode,
} from '../../model/malloy_types';
import {
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  TD,
  isAtomic,
  isRepeatedRecord,
} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandOverrideMap, expandBlueprintMap} from '../functions';
import type {DialectFieldList, OrderByClauseType, QueryInfo} from '../dialect';
import {PostgresBase, timeExtractMap} from '../pg_impl';
import {
  PRESTO_DIALECT_FUNCTIONS,
  TRINO_DIALECT_FUNCTIONS,
} from './dialect_functions';
import {TRINO_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

// These are the units that "TIMESTAMP_ADD" "TIMESTAMP_DIFF" accept
function timestampMeasureable(units: string): boolean {
  return [
    'microsecond',
    'millisecond',
    'second',
    'minute',
    'hour',
    'day',
  ].includes(units);
}

/**
 * Return a non UTC timezone, if one was specificed.
 */
function qtz(qi: QueryInfo): string | undefined {
  const tz = qi.queryTimezone;
  if (tz && tz !== 'UTC') {
    return tz;
  }
}

declare interface TimeMeasure {
  use: string;
  ratio: number;
}

const trinoToMalloyTypes: {[key: string]: BasicAtomicTypeDef} = {
  'varchar': {type: 'string'},
  'integer': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'bigint'},
  'smallint': {type: 'number', numberType: 'integer'},
  'tinyint': {type: 'number', numberType: 'integer'},
  'double': {type: 'number', numberType: 'float'},
  'decimal': {type: 'number', numberType: 'float'},
  'string': {type: 'string'},
  'date': {type: 'date'},
  'timestamp': {type: 'timestamp'},
  'boolean': {type: 'boolean'},

  // TODO(figutierrez0): cleanup.
  /* 'INT64': {type: 'number', numberType: 'integer'},
  'FLOAT': {type: 'number', numberType: 'float'},
  'FLOAT64': {type: 'number', numberType: 'float'},
  'NUMERIC': {type: 'number', numberType: 'float'},
  'BIGNUMERIC': {type: 'number', numberType: 'float'},
  'JSON': {type: 'json'},*/
  // TODO (https://cloud.google.com/bigquery/docs/reference/rest/v2/tables#tablefieldschema):
  // BYTES
  // DATETIME
  // TIME
  // GEOGRAPHY
};

export class TrinoDialect extends PostgresBase {
  name = 'trino';
  experimental = false;
  defaultNumberType = 'DOUBLE';
  defaultDecimalType = 'DECIMAL';
  udfPrefix = '__udf';
  hasFinalStage = false;
  divisionIsInteger = true;
  supportsSumDistinctFunction = true;
  unnestWithNumbers = false;
  defaultSampling = {enable: false};
  supportUnnestArrayAgg = false;
  supportsAggDistinct = false;
  supportsCTEinCoorelatedSubQueries = false;
  dontUnionIndex = true; // bigquery can't use a sample table more than once in a query.
  supportsQualify = true;
  supportsSafeCast = true;
  supportsNesting = true;
  cantPartitionWindowFunctionsOnExpressions = false;
  orderByClause: OrderByClauseType = 'output_name';
  nullMatchesFunctionSignature = false;
  supportsSelectReplace = false;
  supportsComplexFilteredSources = false;
  supportsTempTables = false;
  supportsCountApprox = true;
  supportsHyperLogLog = true;

  quoteTablePath(tablePath: string): string {
    // Quote with double quotes if contains dangerous characters
    if (tablePath.match(/[;-]/)) {
      return tablePath
        .split('.')
        .map(part => `"${part}"`)
        .join('.');
    }
    return tablePath;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT row_number() OVER() -1  group_set FROM UNNEST(SEQUENCE(0,${groupSetCount})))`;
  }

  exprToSQL(qi: QueryInfo, df: Expr): string | undefined {
    switch (df.node) {
      case '/':
        return `CAST(${df.kids.left.sql} AS DOUBLE)/${df.kids.right.sql}`;
    }
    return super.exprToSQL(qi, df);
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${fieldName} END)`;
  }

  buildTypeExpression(fieldList: DialectFieldList): string {
    return fieldList
      .map(
        dlf => `${dlf.sqlOutputName} ${this.malloyTypeToSQLType(dlf.typeDef)}`
      )
      .join(', \n');
  }
  // can array agg or any_value a struct...
  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined
  ): string {
    const expressions = fieldList.map(f => f.sqlExpression).join(',\n ');
    const definitions = this.buildTypeExpression(fieldList);
    return `ARRAY_AGG(CAST(ROW(${expressions}) AS ROW(${definitions})) ${orderBy}) FILTER (WHERE group_set=${groupSet})`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const expressions = fieldList.map(f => f.sqlExpression).join(',\n ');
    const definitions = this.buildTypeExpression(fieldList);
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN CAST(ROW(${expressions}) AS ROW(${definitions})) END)`;
  }

  sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string {
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${name} END) as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = fieldList.map(f => f.sqlExpression).join(', ');
    const nullValues = fieldList.map(_f => 'NULL').join(', ');
    const definitions = this.buildTypeExpression(fieldList);
    return `COALESCE(ANY_VALUE(CASE WHEN group_set=${groupSet} THEN CAST(ROW(${fields}) AS ROW(${definitions})) END), CAST(ROW(${nullValues}) AS ROW(${definitions})))`;
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
    _fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    if (isArray) {
      if (needDistinctKey) {
        // return `LEFT JOIN UNNEST(transform(${source}, x -> ROW(x) )) WITH ORDINALIITY as words_0(value,__row_id_from_${alias}) ON TRUE`;
        return `LEFT JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore))) WITH ORDINALITY as ${alias}(value, ignore,__row_id_from_${alias}) ON TRUE`;
      } else {
        return `LEFT JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore))) as ${alias}(value, ignore) ON TRUE`;
      }
    } else if (needDistinctKey) {
      return `LEFT JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore))) WITH ORDINALITY as ${alias}_outer(${alias}, ignore,__row_id_from_${alias}) ON TRUE`;
    } else {
      return `LEFT JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore)))as ${alias}_outer(${alias},ignore) ON TRUE`;
    }
  }
  static dtype = 'DECIMAL(38,0)';

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    sqlDistinctKey = `CAST(${sqlDistinctKey} AS VARCHAR)`;

    const upperPart = `cast(from_base(substr(to_hex(md5(to_utf8(${sqlDistinctKey}))), 1, 15),16) as ${TrinoDialect.dtype}) * CAST('4294967296' AS ${TrinoDialect.dtype}) `;
    const lowerPart = `cast(from_base(substr(to_hex(md5(to_utf8(${sqlDistinctKey}))), 16, 8),16) as ${TrinoDialect.dtype}) `;
    return `(${upperPart} + ${lowerPart})`;
  }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    const hashKey = this.sqlSumDistinctHashedKey(key);
    const scale = 100000000;
    const v = `CAST(COALESCE(${value},0)*${scale} as ${TrinoDialect.dtype})`;

    const sqlSum = `CAST(SUM(DISTINCT ${hashKey} + ${v}) - SUM(DISTINCT ${hashKey}) AS DOUBLE)/${scale}`;
    if (funcName === 'SUM') {
      return sqlSum;
    } else if (funcName === 'AVG') {
      return `(${sqlSum})/NULLIF(COUNT(DISTINCT CASE WHEN ${value} IS NOT NULL THEN ${key} END),0)`;
    }
    throw new Error(`Unknown Symmetric Aggregate function ${funcName}`);
  }

  sqlGenerateUUID(): string {
    return 'UUID()';
  }

  sqlFieldReference(
    parentAlias: string,
    _parentType: unknown,
    childName: string,
    _childType: string
  ): string {
    // LTNOTE: hack, in duckdb we can't have structs as tables so we kind of simulate it.
    if (childName === '__row_id') {
      return `__row_id_from_${parentAlias}`;
    }
    return `${parentAlias}.${this.sqlMaybeQuoteIdentifier(childName)}`;
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    let p = sourceSQLExpression;
    if (isSingleton) {
      p = `ARRAY[${p}]`;
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

  sqlCreateFunctionCombineLastStage(
    lastStageName: string,
    fieldList: DialectFieldList
  ): string {
    const fields = fieldList.map(f => f.sqlExpression).join(', ');
    const definitions = this.buildTypeExpression(fieldList);
    return `SELECT ARRAY_AGG(CAST(ROW(${fields}) as ROW(${definitions}))) FROM ${lastStageName}\n`;
  }

  sqlSelectAliasAsStruct(alias: string, fieldList): string {
    const fields = fieldList.map(f => f.sqlExpression).join(', ');
    const definitions = this.buildTypeExpression(fieldList);
    return `CAST(ROW(${fields}) as ROW(${definitions})`;
  }

  // TODO(figutierrez): update.
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

  sqlConvertToCivilTime(
    expr: string,
    timezone: string,
    typeDef: AtomicTypeDef
  ): {sql: string; typeDef: AtomicTypeDef} {
    // Trino civil time = TIMESTAMPTZ with query timezone as stored timezone
    // Operations (extract, truncate, etc.) happen in the stored timezone
    if (typeDef.type === 'timestamp') {
      // TIMESTAMP (UTC wall clock) → TIMESTAMPTZ in query timezone
      return {
        sql: `at_timezone(with_timezone(${expr}, 'UTC'), '${timezone}')`,
        typeDef: {type: 'timestamptz'},
      };
    }
    // TIMESTAMPTZ → TIMESTAMPTZ in query timezone (same instant, different stored tz)
    return {
      sql: `at_timezone(${expr}, '${timezone}')`,
      typeDef: {type: 'timestamptz'},
    };
  }

  sqlConvertFromCivilTime(
    expr: string,
    _timezone: string,
    destTypeDef: ATimestampTypeDef
  ): string {
    // From civil TIMESTAMPTZ (in query timezone) to destination type
    if (destTypeDef.type === 'timestamptz') {
      // Already TIMESTAMPTZ, keep as-is
      return expr;
    }
    // To TIMESTAMP: convert to UTC and cast to plain TIMESTAMP
    return `CAST(at_timezone(${expr}, 'UTC') AS TIMESTAMP)`;
  }

  sqlTruncate(
    expr: string,
    unit: string,
    _typeDef: AtomicTypeDef,
    _inCivilTime: boolean,
    _timezone?: string
  ): string {
    // Trino starts weeks on Monday, Malloy wants Sunday
    // Add 1 day before truncating, subtract 1 day after
    if (unit === 'week') {
      return `(DATE_TRUNC('${unit}', (${expr} + INTERVAL '1' DAY)) - INTERVAL '1' DAY)`;
    }
    return `DATE_TRUNC('${unit}', ${expr})`;
  }

  sqlOffsetTime(
    expr: string,
    op: '+' | '-',
    magnitude: string,
    unit: string,
    _typeDef: AtomicTypeDef,
    _inCivilTime: boolean,
    _timezone?: string
  ): string {
    // Convert quarter/week to supported units
    let offsetUnit = unit;
    let offsetMag = magnitude;
    if (unit === 'quarter') {
      offsetUnit = 'month';
      offsetMag = `${magnitude}*3`;
    } else if (unit === 'week') {
      offsetUnit = 'day';
      offsetMag = `${magnitude}*7`;
    }

    // Handle subtraction by negating
    const n = op === '-' ? `(${offsetMag})*-1` : offsetMag;
    return `DATE_ADD('${offsetUnit}', ${n}, ${expr})`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    const {srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    const tz = qtz(qi);
    const expr = cast.e.sql || '';

    // Timezone-aware casts when query timezone is set
    if (tz && srcTypeDef && dstTypeDef) {
      // TIMESTAMP → DATE: interpret as UTC, convert to query timezone
      if (TD.isTimestamp(srcTypeDef) && TD.isDate(dstTypeDef)) {
        return `CAST(at_timezone(with_timezone(${expr}, 'UTC'), '${tz}') AS DATE)`;
      }

      // TIMESTAMPTZ → DATE: convert to query timezone
      if (TD.isTimestamptz(srcTypeDef) && TD.isDate(dstTypeDef)) {
        return `CAST(at_timezone(${expr}, '${tz}') AS DATE)`;
      }

      // DATE → TIMESTAMP: interpret date in query timezone, return UTC wall clock
      if (TD.isDate(srcTypeDef) && TD.isTimestamp(dstTypeDef)) {
        return `CAST(at_timezone(with_timezone(CAST(${expr} AS TIMESTAMP), '${tz}'), 'UTC') AS TIMESTAMP)`;
      }

      // DATE → TIMESTAMPTZ: interpret date in query timezone
      if (TD.isDate(srcTypeDef) && TD.isTimestamptz(dstTypeDef)) {
        return `with_timezone(CAST(${expr} AS TIMESTAMP), '${tz}')`;
      }

      // TIMESTAMPTZ → TIMESTAMP: convert to query timezone wall clock
      if (TD.isTimestamptz(srcTypeDef) && TD.isTimestamp(dstTypeDef)) {
        return `CAST(at_timezone(${expr}, '${tz}') AS TIMESTAMP)`;
      }

      // TIMESTAMP → TIMESTAMPTZ: interpret TIMESTAMP as being in query timezone
      if (TD.isTimestamp(srcTypeDef) && TD.isTimestamptz(dstTypeDef)) {
        return `with_timezone(${expr}, '${tz}')`;
      }
    }

    // No special handling needed, or no query timezone
    if (!TD.eq(srcTypeDef, dstTypeDef)) {
      const castFunc = cast.safe ? 'TRY_CAST' : 'CAST';
      return `${castFunc}(${expr} AS ${dstSQLType})`;
    }
    return expr;
  }

  sqlRegexpMatch(reCmp: RegexMatchExpr): string {
    return `REGEXP_LIKE(${reCmp.kids.expr.sql}, ${reCmp.kids.regex.sql})`;
  }

  sqlMeasureTimeExpr(mf: MeasureTimeExpr): string {
    const measureMap: Record<string, TimeMeasure> = {
      'microsecond': {use: 'microsecond', ratio: 1},
      'millisecond': {use: 'microsecond', ratio: 1000},
      'second': {use: 'millisecond', ratio: 1000},
      'minute': {use: 'second', ratio: 60},
      'hour': {use: 'minute', ratio: 60},
      'day': {use: 'hour', ratio: 24},
      'week': {use: 'day', ratio: 7},
    };
    const from = mf.kids.left;
    const to = mf.kids.right;
    let lVal = from.sql;
    let rVal = to.sql;
    if (measureMap[mf.units]) {
      const {use: measureIn, ratio} = measureMap[mf.units];
      if (!timestampMeasureable(measureIn)) {
        throw new Error(`Measure in '${measureIn} not implemented`);
      }
      if (!TD.eq(from.typeDef, to.typeDef)) {
        throw new Error("Can't measure difference between different types");
      }
      if (TD.isDate(from.typeDef)) {
        lVal = `CAST(${lVal} AS TIMESTAMP)`;
        rVal = `CAST(${rVal} AS TIMESTAMP)`;
      }
      let measured = `DATE_DIFF('${measureIn}',${lVal},${rVal})`;
      if (ratio !== 1) {
        measured = `FLOOR(CAST(${measured} AS DOUBLE)/${ratio.toString()}.0)`;
      }
      return measured;
    }
    throw new Error(`Measure '${mf.units} not implemented`);
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        throw new Error("Trino doesn't support sampling by rows only percent");
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL}  TABLESAMPLE SYSTEM (${sample.percent}))`;
      }
    }
    return tableSQL;
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
    return expandOverrideMap(TRINO_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(TRINO_DIALECT_FUNCTIONS);
  }

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    switch (malloyType.type) {
      case 'number':
        if (malloyType.numberType === 'integer') {
          return 'INTEGER';
        } else if (malloyType.numberType === 'bigint') {
          return 'BIGINT';
        } else {
          return 'DOUBLE';
        }
      case 'string':
        return 'VARCHAR';
      case 'timestamptz':
        return 'TIMESTAMP WITH TIME ZONE';
      case 'record': {
        const typeSpec: string[] = [];
        for (const f of malloyType.fields) {
          if (isAtomic(f)) {
            typeSpec.push(
              `${this.sqlMaybeQuoteIdentifier(
                f.name
              )} ${this.malloyTypeToSQLType(f)}`
            );
          }
        }
        return `ROW(${typeSpec.join(',')})`;
      }
      case 'sql native':
        return malloyType.rawType || 'UNKNOWN-NATIVE';
      case 'array': {
        if (isRepeatedRecord(malloyType)) {
          const typeSpec: string[] = [];
          for (const f of malloyType.fields) {
            if (isAtomic(f)) {
              typeSpec.push(
                `${this.sqlMaybeQuoteIdentifier(
                  f.name
                )} ${this.malloyTypeToSQLType(f)}`
              );
            }
          }
          return `ARRAY<ROW(${typeSpec.join(',')})>`;
        }
        return `ARRAY<${this.malloyTypeToSQLType(malloyType.elementTypeDef)}>`;
      }
      default:
        return malloyType.type.toUpperCase();
    }
  }

  sqlTypeToMalloyType(sqlType: string): BasicAtomicTypeDef {
    const matchType = sqlType.toLowerCase();
    if (matchType.startsWith('timestamp with time zone')) {
      return {type: 'timestamptz'};
    }
    const baseSqlType = matchType.match(/^\w+/)?.at(0) ?? matchType;
    return (
      trinoToMalloyTypes[baseSqlType] ?? {
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

  sqlMakeUnnestKey(key: string, rowKey: string) {
    return `CAST(${key} as VARCHAR) || 'x' || CAST(${rowKey} as VARCHAR)`;
  }

  sqlStringAggDistinct(
    distinctKey: string,
    valueSQL: string,
    separatorSQL: string
  ) {
    return `
    ARRAY_JOIN(TRANSFORM(ARRAY_AGG(DISTINCT ARRAY[CAST(${valueSQL} AS VARCHAR),CAST(${distinctKey} as VARCHAR)]), x -> x[1]),${
      separatorSQL.length > 0 ? separatorSQL : "','"
    })`;
  }

  validateTypeName(sqlType: string): boolean {
    // Letters:              BIGINT
    // Numbers:              INT8
    // Spaces,
    // Parentheses, Commas:  NUMERIC(5, 2)
    // Angle Brackets:       ARRAY<INT64>
    return sqlType.match(/^[A-Za-z\s(),<>0-9]*$/) !== null;
  }

  sqlDateLiteral(_qi: QueryInfo, literal: string): string {
    return `DATE '${literal}'`;
  }

  sqlTimestampLiteral(
    qi: QueryInfo,
    literal: string,
    timezone: string | undefined
  ): string {
    const tz = timezone || qtz(qi);
    if (tz) {
      // Interpret wall clock time in timezone, convert to UTC wall clock, cast to TIMESTAMP
      return `CAST(at_timezone(with_timezone(TIMESTAMP '${literal}', '${tz}'), 'UTC') AS TIMESTAMP)`;
    }
    return `TIMESTAMP '${literal}'`;
  }

  sqlTimestamptzLiteral(
    _qi: QueryInfo,
    literal: string,
    timezone: string
  ): string {
    // Use with_timezone to create a TIMESTAMP WITH TIME ZONE
    return `with_timezone(TIMESTAMP '${literal}', '${timezone}')`;
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const pgUnits = timeExtractMap[from.units] || from.units;
    let extractFrom = from.e.sql || '';

    if (TD.isAnyTimestamp(from.e.typeDef)) {
      const tz = qtz(qi);
      if (tz) {
        // Convert both TIMESTAMP and TIMESTAMPTZ to query timezone for extraction
        if (from.e.typeDef.type === 'timestamp') {
          // TIMESTAMP: interpret as UTC, convert to query timezone
          extractFrom = `at_timezone(with_timezone(${extractFrom}, 'UTC'), '${tz}')`;
        } else {
          // TIMESTAMPTZ: convert to query timezone
          extractFrom = `at_timezone(${extractFrom}, '${tz}')`;
        }
      }
    }

    const extracted = `EXTRACT(${pgUnits} FROM ${extractFrom})`;
    return from.units === 'day_of_week' ? `mod(${extracted}+1,7)` : extracted;
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    const rowVals: string[] = [];
    const rowTypes: string[] = [];
    for (const f of lit.typeDef.fields) {
      if (isAtomic(f)) {
        const name = f.as ?? f.name;
        rowVals.push(lit.kids[name].sql ?? 'internal-error-record-literal');
        const elType = this.malloyTypeToSQLType(f);
        rowTypes.push(`${this.sqlMaybeQuoteIdentifier(name)} ${elType}`);
      }
    }
    return `CAST(ROW(${rowVals.join(',')}) AS ROW(${rowTypes.join(',')}))`;
  }
}

export class PrestoDialect extends TrinoDialect {
  name = 'presto';
  supportsPipelinesInViews = false; // what a drag...
  supportsLeftJoinUnnest = false; // we need to fix this....

  sqlGenerateUUID(): string {
    return 'CAST(UUID() AS VARCHAR)';
  }

  sqlDateLiteral(_qi: QueryInfo, literal: string): string {
    return `DATE '${literal}'`;
  }

  sqlTimestampLiteral(
    qi: QueryInfo,
    literal: string,
    timezone: string | undefined
  ): string {
    const tz = timezone || qtz(qi);
    if (tz) {
      return `CAST(TIMESTAMP '${literal} ${tz}' AT TIME ZONE 'UTC' AS TIMESTAMP)`;
    }
    return `TIMESTAMP '${literal}'`;
  }

  sqlTimestamptzLiteral(
    _qi: QueryInfo,
    literal: string,
    timezone: string
  ): string {
    return `TIMESTAMP '${literal} ${timezone}'`;
  }

  sqlConvertToCivilTime(
    expr: string,
    timezone: string,
    _typeDef: AtomicTypeDef
  ): {sql: string; typeDef: AtomicTypeDef} {
    // Presto's AT TIME ZONE operator (not function) produces TIMESTAMPTZ
    // Reinterprets the instant in the target timezone
    return {
      sql: `${expr} AT TIME ZONE '${timezone}'`,
      typeDef: {type: 'timestamptz'},
    };
  }

  sqlConvertFromCivilTime(
    expr: string,
    _timezone: string,
    destTypeDef: ATimestampTypeDef
  ): string {
    if (destTypeDef.type === 'timestamptz') {
      return expr;
    }
    return `CAST(${expr} AT TIME ZONE 'UTC' AS TIMESTAMP)`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    const {srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    const tz = qtz(qi);
    const expr = cast.e.sql || '';

    // Timezone-aware casts when query timezone is set
    // Presto uses AT TIME ZONE operator instead of Trino's with_timezone/at_timezone functions
    if (tz && srcTypeDef && dstTypeDef) {
      // TIMESTAMP → DATE: interpret as UTC, convert to query timezone
      if (TD.isTimestamp(srcTypeDef) && TD.isDate(dstTypeDef)) {
        return `CAST((${expr} AT TIME ZONE 'UTC') AT TIME ZONE '${tz}' AS DATE)`;
      }

      // TIMESTAMPTZ → DATE: convert to query timezone
      if (TD.isTimestamptz(srcTypeDef) && TD.isDate(dstTypeDef)) {
        return `CAST(${expr} AT TIME ZONE '${tz}' AS DATE)`;
      }

      // DATE → TIMESTAMP: interpret date in query timezone, return UTC wall clock
      // Presto doesn't have a way to interpret TIMESTAMP in a non-UTC timezone,
      // so we build a TIMESTAMPTZ literal string and cast it
      if (TD.isDate(srcTypeDef) && TD.isTimestamp(dstTypeDef)) {
        const tstzLiteral = `CAST(CAST(${expr} AS VARCHAR) || ' 00:00:00 ${tz}' AS TIMESTAMP WITH TIME ZONE)`;
        return `CAST(${tstzLiteral} AS TIMESTAMP)`;
      }

      // DATE → TIMESTAMPTZ: interpret date in query timezone
      if (TD.isDate(srcTypeDef) && TD.isTimestamptz(dstTypeDef)) {
        return `CAST(CAST(${expr} AS VARCHAR) || ' 00:00:00 ${tz}' AS TIMESTAMP WITH TIME ZONE)`;
      }

      // TIMESTAMPTZ → TIMESTAMP: convert to query timezone wall clock
      if (TD.isTimestamptz(srcTypeDef) && TD.isTimestamp(dstTypeDef)) {
        return `CAST(${expr} AT TIME ZONE '${tz}' AS TIMESTAMP)`;
      }

      // TIMESTAMP → TIMESTAMPTZ: interpret TIMESTAMP as UTC
      if (TD.isTimestamp(srcTypeDef) && TD.isTimestamptz(dstTypeDef)) {
        return `${expr} AT TIME ZONE 'UTC'`;
      }
    }

    // No special handling needed, or no query timezone
    if (!TD.eq(srcTypeDef, dstTypeDef)) {
      const castFunc = cast.safe ? 'TRY_CAST' : 'CAST';
      return `${castFunc}(${expr} AS ${dstSQLType})`;
    }
    return expr;
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const pgUnits = timeExtractMap[from.units] || from.units;
    let extractFrom = from.e.sql || '';

    if (TD.isAnyTimestamp(from.e.typeDef)) {
      const tz = qtz(qi);
      if (tz) {
        // Convert both TIMESTAMP and TIMESTAMPTZ to query timezone for extraction
        if (from.e.typeDef.type === 'timestamp') {
          // TIMESTAMP: interpret as UTC, convert to query timezone
          // Presto uses AT TIME ZONE operator
          extractFrom = `(${extractFrom} AT TIME ZONE 'UTC') AT TIME ZONE '${tz}'`;
        } else {
          // TIMESTAMPTZ: convert to query timezone
          extractFrom = `${extractFrom} AT TIME ZONE '${tz}'`;
        }
      }
    }

    const extracted = `EXTRACT(${pgUnits} FROM ${extractFrom})`;
    return from.units === 'day_of_week' ? `mod(${extracted}+1,7)` : extracted;
  }

  sqlUnnestAlias(
    source: string,
    alias: string,
    _fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    if (isArray) {
      if (needDistinctKey) {
        // return `LEFT JOIN UNNEST(transform(${source}, x -> CAST(ROW(x) as ROW(value) )) WITH ORDINALIITY as words_0(value,__row_id_from_${alias}) ON TRUE`;
        return (
          '-- Simulate a left join\n' +
          `CROSS JOIN  UNNEST(COALESCE(${source},ARRAY[NULL])) WITH ORDINALITY as ${alias}(value, __row_id_almost_${alias})\n` +
          `CROSS JOIN UNNEST(ARRAY[CASE WHEN ${source} IS NOT NULL THEN __row_id_almost_${alias} END]) as ${alias}_ignore(__row_id_from_${alias})`
        );
      } else {
        // return `CROSS JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore))) as ${alias}(value, ignore)`;
        return `CROSS JOIN  UNNEST(COALESCE(${source}, ARRAY[NULL])) as ${alias}(value) `;
      }
    } else if (needDistinctKey) {
      // return `CROSS JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore))) WITH ORDINALITY as ${alias}_outer(${alias}, ignore,__row_id_from_${alias})`;
      return (
        '-- Simulate a left join\n' +
        `CROSS JOIN UNNEST(COALESCE(${source}, ARRAY[NULL])) WITH ORDINALITY as ${alias}_outer(${alias}, __row_id_almost_${alias})\n` +
        `CROSS JOIN UNNEST(ARRAY[CASE WHEN ${source} IS NOT NULL THEN __row_id_almost_${alias} END]) as ${alias}_ignore(__row_id_from_${alias})`
      );
    } else {
      // return `CROSS JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore)))as ${alias}_outer(${alias},ignore)`;
      return `CROSS JOIN  UNNEST(COALESCE(${source}, ARRAY[NULL])) as ${alias}_outer(${alias})`;
    }
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(PRESTO_DIALECT_FUNCTIONS);
  }
}
