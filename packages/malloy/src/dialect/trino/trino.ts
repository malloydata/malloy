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
import {
  Expr,
  ExtractUnit,
  Sampling,
  TimeValue,
  TimestampUnit,
  TypecastFragment,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  mkExpr,
  FieldAtomicTypeDef,
  DialectFragment,
  DateUnit,
  TimeFieldType,
} from '../../model/malloy_types';
import {TRINO_FUNCTIONS} from './functions';
import {DialectFunctionOverloadDef} from '../functions';
import {
  Dialect,
  DialectFieldList,
  OrderByClauseType,
  QueryInfo,
  isDialectFieldStruct,
} from '../dialect';

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

const pgExtractionMap: Record<string, string> = {
  'day_of_week': 'dow',
  'day_of_year': 'doy',
};

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

const trinoTypeMap = {
  'string': 'VARCHAR',
  'number': 'DOUBLE',
};

export class TrinoDialect extends Dialect {
  name = 'trino';
  experimental = false;
  defaultNumberType = 'DOUBLE';
  defaultDecimalType = 'DECIMAL';
  udfPrefix = '__udf';
  hasFinalStage = false;
  divisionIsInteger = true;
  supportsSumDistinctFunction = false;
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

  quoteTablePath(tablePath: string): string {
    // TODO: look into escaping.
    //return `${tablePath.replace(/malloytest/g, 'malloy_demo.malloytest')}`;
    return tablePath;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT row_number() OVER() -1  group_set FROM UNNEST(SEQUENCE(0,${groupSetCount})))`;
  }

  dialectExpr(qi: QueryInfo, df: DialectFragment): Expr {
    switch (df.function) {
      case 'div': {
        return mkExpr`CAST(${df.numerator} AS DOUBLE)/${df.denominator}`;
      }
    }
    return super.dialectExpr(qi, df);
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${fieldName} END)`;
  }

  buildTypeExpression(fieldList: DialectFieldList): string {
    const fields: string[] = [];
    for (const f of fieldList) {
      if (isDialectFieldStruct(f)) {
        let s = `ROW(${this.buildTypeExpression(f.nestedStruct)})`;
        if (f.isArray) {
          s = `array(${s})`;
        }
        fields.push(`${f.sqlOutputName} ${s}`);
      } else {
        fields.push(`${f.sqlOutputName} ${trinoTypeMap[f.type] || f.type}`);
      }
    }
    return fields.join(', \n');
  }
  // can array agg or any_value a struct...
  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string {
    const expressions = fieldList.map(f => f.sqlExpression).join(',\n ');
    const definitions = this.buildTypeExpression(fieldList);
    let ret = `ARRAY_AGG(CAST(ROW(${expressions}) AS ROW(${definitions})) ${orderBy}) FILTER (WHERE group_set=${groupSet})`;
    if (limit !== undefined) {
      ret = `SLICE(${ret}, 1, ${limit})`;
    }
    return ret;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map(f => `\n '${f.sqlOutputName}' VALUE ${f.sqlExpression}`)
      .join(', ');
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN JSON_OBJECT(${fields}))`;
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
    fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    const fieldsNames = fieldList.map(f =>
      this.sqlMaybeQuoteIdentifier(f.sqlOutputName)
    );
    if (isArray) {
      if (needDistinctKey) {
        return `CROSS JOIN UNNEST(COALESCE(zip(${source}, SEQUENCE(1,cardinality(${source}))),ARRAY[null])) as words_0(value,__row_id_from_${alias})`;
      } else {
        return `CROSS JOIN UNNEST(COALESCE(transform(${source}, x -> ROW(x) ), ARRAY[null])) as ${alias}(value)`;
      }
    } else if (needDistinctKey) {
      return `CROSS JOIN UNNEST(COALESCE(zip_with(${source}, SEQUENCE(1,cardinality(${source})), (r,__row_id) -> (r, __row_id)),ARRAY[null])) as ${alias}_outer(${alias},__row_id_from_${alias})`;
    } else {
      return `CROSS JOIN UNNEST(COALESCE(${source}, ARRAY[null])) as ${alias}(${fieldsNames.join(
        ', '
      )})`;
    }
  }

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    sqlDistinctKey = `CAST(${sqlDistinctKey} AS VARCHAR)`;

    const upperPart = `cast(from_base(substr(to_hex(md5(to_utf8(${sqlDistinctKey}))), 1, 15),16) as DECIMAL) * DECIMAL '4294967296' `;
    const lowerPart = `cast(from_base(substr(to_hex(md5(to_utf8(${sqlDistinctKey}))), 16, 8),16) as DECIMAL) `;
    const precisionShiftMultiplier = '0.000000001';
    return `(${upperPart} + ${lowerPart}) * ${precisionShiftMultiplier}`;
  }

  sqlGenerateUUID(): string {
    return 'UUID()';
  }

  sqlFieldReference(
    alias: string,
    fieldName: string,
    _fieldType: string,
    _isNested: boolean,
    _isArray: boolean
  ): string {
    // LTNOTE: hack, in duckdb we can't have structs as tables so we kind of simulate it.
    if (fieldName === '__row_id') {
      return `__row_id_from_${alias}`;
    }
    return `${alias}.${this.sqlMaybeQuoteIdentifier(fieldName)}`;
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

  sqlMaybeQuoteIdentifier(identifier: string): string {
    return '"' + identifier + '"';
  }

  sqlNow(): Expr {
    return mkExpr`LOCALTIMESTAMP`;
  }
  sqlTrunc(qi: QueryInfo, sqlTime: TimeValue, units: TimestampUnit): Expr {
    // adjusting for monday/sunday weeks
    const week = units === 'week';
    const truncThis = week
      ? mkExpr`DATE_ADD('day', 1, ${sqlTime.value})`
      : sqlTime.value;
    if (sqlTime.valueType === 'timestamp') {
      const tz = qtz(qi);
      if (tz) {
        const civilSource = mkExpr`AT_TIMEZONE(${truncThis},'${tz}')`;
        const civilTrunc = mkExpr`DATE_TRUNC('${units}', ${civilSource})`;
        // MTOY todo ... only need to do this if this is a date ...
        return mkExpr`AT_TIMEZONE(${civilTrunc},'${tz}')`;
        // return mkExpr`CAST((${truncTsTz}),TIMESTAMP)`;
      }
    }
    let result = mkExpr`DATE_TRUNC('${units}', ${truncThis})`;
    if (week) {
      result = mkExpr`DATE_ADD('day',-1, ${result})`;
    }
    return result;
  }

  sqlExtract(qi: QueryInfo, from: TimeValue, units: ExtractUnit): Expr {
    const pgUnits = pgExtractionMap[units] || units;
    let extractFrom = from.value;
    if (from.valueType === 'timestamp') {
      const tz = qtz(qi);
      if (tz) {
        extractFrom = mkExpr`at_timezone(${extractFrom},'${tz}')`;
      }
    }
    const extracted = mkExpr`EXTRACT(${pgUnits} FROM ${extractFrom})`;
    return units === 'day_of_week' ? mkExpr`mod(${extracted}+1,7)` : extracted;
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
    if (timeframe === 'week') {
      timeframe = 'day';
      n = mkExpr`${n}*7`;
    }
    if (op === '-') {
      n = mkExpr`(${n})*-1`;
    }
    return mkExpr`DATE_ADD('${timeframe}', ${n}, ${expr.value})`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastFragment): Expr {
    const op = `${cast.srcType}=>${cast.dstType}`;
    const tz = qtz(qi);
    if (op === 'timestamp=>date' && tz) {
      const tstz = mkExpr`CAST(${cast.expr} as TIMESTAMP)`;
      return mkExpr`CAST((${tstz}) AT TIME ZONE '${tz}' AS DATE)`;
    } else if (op === 'date=>timestamp' && tz) {
      return mkExpr`CAST(CONCAT(CAST(CAST(${cast.expr} AS TIMESTAMP) AS VARCHAR), ' ${tz}') AS TIMESTAMP WITH TIME ZONE)`;
    }
    if (cast.srcType !== cast.dstType) {
      const dstType =
        typeof cast.dstType === 'string'
          ? this.malloyTypeToSQLType({type: cast.dstType})
          : cast.dstType.raw;
      const castFunc = cast.safe ? 'TRY_CAST' : 'CAST';
      return mkExpr`${castFunc}(${cast.expr} AS ${dstType})`;
    }
    return cast.expr;
  }

  sqlRegexpMatch(expr: Expr, regexp: Expr): Expr {
    return mkExpr`REGEXP_LIKE(${expr}, ${regexp})`;
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
      return `TIMESTAMP '${timeString} ${tz}'`;
    }
    return `TIMESTAMP '${timeString}'`;
  }

  sqlMeasureTime(from: TimeValue, to: TimeValue, units: string): Expr {
    const measureMap: Record<string, TimeMeasure> = {
      'microsecond': {use: 'microsecond', ratio: 1},
      'millisecond': {use: 'microsecond', ratio: 1000},
      'second': {use: 'millisecond', ratio: 1000},
      'minute': {use: 'second', ratio: 60},
      'hour': {use: 'minute', ratio: 60},
      'day': {use: 'hour', ratio: 24},
      'week': {use: 'day', ratio: 7},
    };
    let lVal = from.value;
    let rVal = to.value;
    if (measureMap[units]) {
      const {use: measureIn, ratio} = measureMap[units];
      if (!timestampMeasureable(measureIn)) {
        throw new Error(`Measure in '${measureIn} not implemented`);
      }
      if (from.valueType !== to.valueType) {
        throw new Error("Can't measure difference between different types");
      }
      if (from.valueType === 'date') {
        lVal = mkExpr`CAST(${lVal} AS TIMESTAMP)`;
        rVal = mkExpr`CAST(${rVal} AS TIMESTAMP)`;
      }
      let measured = mkExpr`DATE_DIFF('${measureIn}',${lVal},${rVal})`;
      if (ratio !== 1) {
        measured = mkExpr`FLOOR(CAST(${measured} AS DOUBLE)/${ratio.toString()}.0)`;
      }
      return measured;
    }
    throw new Error(`Measure '${units} not implemented`);
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

  getGlobalFunctionDef(name: string): DialectFunctionOverloadDef[] | undefined {
    // TODO: implement
    return TRINO_FUNCTIONS.get(name);
  }

  malloyTypeToSQLType(malloyType: FieldAtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        return 'BIGINT';
      } else {
        return 'DOUBLE';
      }
    } else if (malloyType.type === 'string') {
      return 'VARCHAR';
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(_sqlType: string): FieldAtomicTypeDef | undefined {
    // TODO(figutierrez): unimplemented.
    return undefined;
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
}

export class PrestoDialect extends TrinoDialect {
  name = 'presto';
  supportsPipelinesInViews = false; // what a drag...

  sqlGenerateUUID(): string {
    return 'CAST(UUID() AS VARCHAR)';
  }
}
