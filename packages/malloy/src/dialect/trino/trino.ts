/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
  OrderBy,
  TimestampUnit,
  ExtractUnit,
  TimeExpr,
} from '../../model/malloy_types';
import {
  activeName,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  TD,
  isAtomic,
  isRepeatedRecord,
  safeRecordGet,
  isDateUnit,
} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandOverrideMap, expandBlueprintMap} from '../functions';
import type {
  CivilTime,
  CompiledOrderBy,
  DialectFieldList,
  OrderByClauseType,
  QueryInfo,
  TimeOffset,
} from '../dialect';
import {queryZone, turtleGroupSetCondition} from '../dialect';
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

function trinoTrunc(expr: string, unit: TimestampUnit): string {
  // Weeks start on Monday here, so truncate the following day
  if (unit === 'week') {
    return `(DATE_TRUNC('${unit}', (${expr} + INTERVAL '1' DAY)) - INTERVAL '1' DAY)`;
  }
  return `DATE_TRUNC('${unit}', ${expr})`;
}

function trinoDateAdd(
  expr: string,
  op: '+' | '-',
  magnitude: string,
  unit: TimestampUnit
): string {
  // DATE_ADD has no quarter or week
  let offsetUnit: string = unit;
  let offsetMag = magnitude;
  if (unit === 'quarter') {
    offsetUnit = 'month';
    offsetMag = `${magnitude}*3`;
  } else if (unit === 'week') {
    offsetUnit = 'day';
    offsetMag = `${magnitude}*7`;
  }
  const n = op === '-' ? `(${offsetMag})*-1` : offsetMag;
  return `DATE_ADD('${offsetUnit}', ${n}, ${expr})`;
}

function trinoExtract(expr: string, units: ExtractUnit): string {
  const extracted = `EXTRACT(${timeExtractMap[units] || units} FROM ${expr})`;
  // Trino counts the days of a week from 1 on Monday
  return units === 'day_of_week' ? `mod(${extracted}+1,7)` : extracted;
}

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
  supportsNestedProjectionLimit = true;
  cantPartitionWindowFunctionsOnExpressions = false;
  orderByClause: OrderByClauseType = 'output_name';
  nullMatchesFunctionSignature = false;
  supportsSelectReplace = false;
  supportsComplexFilteredSources = true;
  supportsTempTables = false;
  supportsCountApprox = true;
  supportsHyperLogLog = true;

  // Trino bare identifier is strict ANSI, matching the Dialect default.

  // Trino/Presto have no E'...' escape string, so encode a newline-bearing
  // literal as U&'...'. Inside it the quote doubles (''), the backslash
  // escape-introducer doubles (\\), and a control char becomes \XXXX.
  sqlLiteralString(literal: string): string {
    if (!literal.includes('\n')) {
      return super.sqlLiteralString(literal);
    }
    const body = literal.replace(/['\\\n\r\t]/g, ch => {
      switch (ch) {
        case "'":
          return "''";
        case '\\':
          return '\\\\';
        case '\n':
          return '\\000A';
        case '\r':
          return '\\000D';
        default: // '\t'
          return '\\0009';
      }
    });
    return `U&'${body}'`;
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
        dlf =>
          `${this.sqlQuoteIdentifier(dlf.rawName)} ` +
          this.malloyTypeToSQLType(dlf.typeDef)
      )
      .join(', \n');
  }
  // can array agg or any_value a struct...
  sqlAggregateTurtle(
    groupSet: number | undefined,
    fieldList: DialectFieldList,
    orderBy: CompiledOrderBy[] | undefined,
    limit?: number,
    filterSQL?: string
  ): string {
    const expressions = fieldList.map(f => f.sqlExpression).join(',\n ');
    const definitions = this.buildTypeExpression(fieldList);
    const orderByClause = orderBy ? this.sqlTurtleOrderByClause(orderBy) : '';
    const cond = turtleGroupSetCondition(groupSet, filterSQL);
    const filterClause = cond ? ` FILTER (WHERE ${cond})` : '';
    const arrayAgg = `ARRAY_AGG(CAST(ROW(${expressions}) AS ROW(${definitions})) ${orderByClause})${filterClause}`;
    // SLICE(array, start, length) is 1-based; length n keeps the first n.
    return limit !== undefined ? `SLICE(${arrayAgg}, 1, ${limit})` : arrayAgg;
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
    return `${parentAlias}.${this.sqlQuoteIdentifier(childName)}`;
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
    fieldList: DialectFieldList,
    orderBy: OrderBy[] | undefined
  ): string {
    const fields = fieldList.map(f => f.sqlExpression).join(', ');
    const definitions = this.buildTypeExpression(fieldList);
    const o = this.sqlCombineLastStageOrderBy(orderBy, fieldList);
    return `SELECT ARRAY_AGG(CAST(ROW(${fields}) as ROW(${definitions}))${o}) FROM ${lastStageName}\n`;
  }

  sqlSelectAliasAsStruct(alias: string, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map(f => `${alias}.${this.sqlQuoteIdentifier(f.rawName)}`)
      .join(', ');
    const definitions = this.buildTypeExpression(fieldList);
    return `CAST(ROW(${fields}) as ROW(${definitions}))`;
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

  // Civil time is a TIMESTAMP, which Trino keeps without a zone
  sqlConvertToCivilTime(
    expr: string,
    timezone: string,
    typeDef: ATimestampTypeDef
  ): string {
    const tz = this.sqlTimezoneLiteral(timezone);
    if (TD.isTimestamptz(typeDef)) {
      return `CAST(at_timezone(${expr}, ${tz}) AS TIMESTAMP)`;
    }
    return timezone === 'UTC'
      ? expr
      : `CAST(at_timezone(with_timezone(${expr}, 'UTC'), ${tz}) AS TIMESTAMP)`;
  }

  sqlConvertFromCivilTime(
    expr: string,
    timezone: string,
    destTypeDef: ATimestampTypeDef
  ): string {
    const tz = this.sqlTimezoneLiteral(timezone);
    if (TD.isTimestamptz(destTypeDef)) {
      return `with_timezone(${expr}, ${tz})`;
    }
    return timezone === 'UTC'
      ? expr
      : `CAST(at_timezone(with_timezone(${expr}, ${tz}), 'UTC') AS TIMESTAMP)`;
  }

  sqlTruncate(
    expr: string,
    unit: TimestampUnit,
    _civilType: CivilTime
  ): string {
    return trinoTrunc(expr, unit);
  }

  sqlOffsetTime(
    expr: string,
    op: '+' | '-',
    magnitude: string,
    unit: TimestampUnit,
    _civilType: CivilTime
  ): string {
    return trinoDateAdd(expr, op, magnitude, unit);
  }

  sqlCast(_qi: QueryInfo, cast: TypecastExpr): string {
    const {srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    const expr = cast.e.sql || '';
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
    if (
      TD.isDate(from.typeDef) &&
      TD.isDate(to.typeDef) &&
      ['week', 'month', 'quarter', 'year'].includes(mf.units)
    ) {
      return `DATE_DIFF('${mf.units}',${lVal},${rVal})`;
    }
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
              `${this.sqlQuoteIdentifier(
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
                `${this.sqlQuoteIdentifier(
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

  sqlTimestamptzLiteral(
    _qi: QueryInfo,
    literal: string,
    timezone: string
  ): string {
    // Use with_timezone to create a TIMESTAMP WITH TIME ZONE
    return `with_timezone(TIMESTAMP '${literal}', ${this.sqlTimezoneLiteral(timezone)})`;
  }

  sqlCivilExtract(
    expr: string,
    units: ExtractUnit,
    _civilType: CivilTime
  ): string {
    return trinoExtract(expr, units);
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    const rowVals: string[] = [];
    const rowTypes: string[] = [];
    for (const f of lit.typeDef.fields) {
      if (isAtomic(f)) {
        const name = activeName(f);
        rowVals.push(
          safeRecordGet(lit.kids, name)?.sql ?? 'internal-error-record-literal'
        );
        const elType = this.malloyTypeToSQLType(f);
        rowTypes.push(`${this.sqlQuoteIdentifier(name)} ${elType}`);
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
    const tz = timezone ?? queryZone(qi);
    if (tz === 'UTC') {
      return `TIMESTAMP '${literal}'`;
    }
    return `CAST(TIMESTAMP '${literal} ${this.checkedTimezoneName(tz)}' AS TIMESTAMP)`;
  }

  sqlTimestamptzLiteral(
    _qi: QueryInfo,
    literal: string,
    timezone: string
  ): string {
    return `TIMESTAMP '${literal} ${this.checkedTimezoneName(timezone)}'`;
  }

  /*
   * Presto cannot meet the civil contract: its only way to read a date and
   * time of day as an instant in a zone is to parse a string, which fails
   * on a time the zone skips. So Presto never converts to civil time. It
   * places an instant in the zone as a TIMESTAMP WITH TIME ZONE, whose
   * functions read the clock in that zone and resolve any skipped or
   * repeated time themselves. A Presto TIMESTAMP is an instant shown in the
   * session zone, which is UTC.
   */

  sqlConvertToCivilTime(): string {
    throw new Error('Presto has no civil time');
  }

  sqlConvertFromCivilTime(): string {
    throw new Error('Presto has no civil time');
  }

  /** The instant `expr`, showing the clock of `timezone` */
  private inZone(
    expr: string,
    typeDef: ATimestampTypeDef,
    timezone: string
  ): string {
    if (TD.isTimestamp(typeDef) && timezone === 'UTC') {
      return expr;
    }
    return `(${expr}) AT TIME ZONE ${this.sqlTimezoneLiteral(timezone)}`;
  }

  /** An instant from inZone, as a value of `typeDef` */
  private fromZone(
    expr: string,
    typeDef: ATimestampTypeDef,
    timezone: string
  ): string {
    if (TD.isTimestamp(typeDef) && timezone !== 'UTC') {
      return `CAST(${expr} AS TIMESTAMP)`;
    }
    return expr;
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const time = from.e;
    const expr = TD.isAnyTimestamp(time.typeDef)
      ? this.inZone(time.sql!, time.typeDef, queryZone(qi))
      : time.sql!;
    return trinoExtract(expr, from.units);
  }

  sqlTruncAndOffset(
    baseExpr: TimeExpr,
    qi: QueryInfo,
    truncateTo?: TimestampUnit,
    offset?: TimeOffset
  ): string {
    const timeType = baseExpr.typeDef;
    // Adding hours, minutes or seconds to an instant needs no zone
    const usesQueryZone =
      TD.isAnyTimestamp(timeType) &&
      (truncateTo !== undefined ||
        (offset !== undefined && isDateUnit(offset.unit)));
    const zone = queryZone(qi);
    let sql = usesQueryZone
      ? this.inZone(baseExpr.sql!, timeType, zone)
      : baseExpr.sql!;
    if (truncateTo) {
      sql = trinoTrunc(sql, truncateTo);
    }
    if (offset) {
      sql = trinoDateAdd(sql, offset.op, offset.magnitude, offset.unit);
    }
    return usesQueryZone ? this.fromZone(sql, timeType, zone) : sql;
  }

  sqlTimeCast(qi: QueryInfo, cast: TypecastExpr): string | undefined {
    const {srcTypeDef, dstTypeDef} = this.sqlCastPrep(cast);
    const expr = cast.e.sql ?? '';
    const zone = queryZone(qi);
    if (TD.isAnyTimestamp(srcTypeDef)) {
      if (TD.isDate(dstTypeDef)) {
        return `CAST(${this.inZone(expr, srcTypeDef, zone)} AS DATE)`;
      }
      if (TD.isTimestamp(dstTypeDef) && TD.isTimestamptz(srcTypeDef)) {
        return `CAST(${expr} AS TIMESTAMP)`;
      }
      if (TD.isTimestamptz(dstTypeDef) && TD.isTimestamp(srcTypeDef)) {
        return `(${expr}) AT TIME ZONE 'UTC'`;
      }
    }
    if (TD.isDate(srcTypeDef) && TD.isAnyTimestamp(dstTypeDef)) {
      if (zone === 'UTC') {
        const midnight = `CAST(${expr} AS TIMESTAMP)`;
        return TD.isTimestamp(dstTypeDef)
          ? midnight
          : `(${midnight}) AT TIME ZONE 'UTC'`;
      }
      // Fails in a zone which skips the midnight starting the date
      const midnight = `CAST(CAST(${expr} AS VARCHAR) || ' 00:00:00 ${this.checkedTimezoneName(zone)}' AS TIMESTAMP WITH TIME ZONE)`;
      return this.fromZone(midnight, dstTypeDef, zone);
    }
    return undefined;
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
