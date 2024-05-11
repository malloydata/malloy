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
import {REDSHIFT_FUNCTIONS} from './functions';
import {DialectFunctionOverloadDef} from '../functions';
import {Dialect, DialectFieldList, QueryInfo, qtz} from '../dialect';
import invariant from 'tiny-invariant';
import _ from 'lodash/core';

const extractionMap: Record<string, string> = {
  'day_of_week': 'dow',
  'day_of_year': 'doy',
};

const intervalMap: Record<string, string> = {
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

/*
TIME, TIME WITHOUT TIME ZONE	Time of day
TIMETZ,	TIME WITH TIME ZONE	Time of day with time zone
VARBYTE, VARBINARY, BINARY VARYING	Variable-length binary value
*/

const redshiftToMalloyTypes: {[key: string]: FieldAtomicTypeDef} = {
  'smallint': {type: 'number', numberType: 'integer'},
  'integer': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'integer'},
  'int': {type: 'number', numberType: 'integer'},
  'int2': {type: 'number', numberType: 'integer'},
  'int4': {type: 'number', numberType: 'integer'},
  'int8': {type: 'number', numberType: 'integer'},
  'numeric': {type: 'number', numberType: 'float'},
  'decimal': {type: 'number', numberType: 'float'},
  'real': {type: 'number', numberType: 'float'},
  'double precision': {type: 'number', numberType: 'float'},
  'float': {type: 'number', numberType: 'float'},
  'float4': {type: 'number', numberType: 'float'},
  'float8': {type: 'number', numberType: 'float'},
  'char': {type: 'string'},
  'character': {type: 'string'},
  'nchar': {type: 'string'},
  'bpchar': {type: 'string'},
  'varchar': {type: 'string'},
  'text': {type: 'string'},
  'character varying': {type: 'string'},
  'nvarchar': {type: 'string'},
  'bool': {type: 'boolean'},
  'boolean': {type: 'boolean'},
  'date': {type: 'date'},
  'timestamp': {type: 'timestamp'},
  'timestamp without time zone': {type: 'timestamp'},
  'timestamptz': {type: 'timestamp'},
  'timestamp with time zone': {type: 'timestamp'},
  'interval': {type: 'string'},
};

export class RedshiftDialect extends Dialect {
  name = 'redshift';
  defaultNumberType = 'DOUBLE PRECISION';
  defaultDecimalType = 'NUMERIC';
  udfPrefix = 'redshift_temp.__udf';
  hasFinalStage = false;
  divisionIsInteger = true;
  supportsSumDistinctFunction = false;
  unnestWithNumbers = false;
  defaultSampling = {rows: 50000};
  supportUnnestArrayAgg = false;
  supportsAggDistinct = false;
  supportsCTEinCoorelatedSubQueries = false;
  supportsSafeCast = false;
  dontUnionIndex = false;
  supportsQualify = false;
  globalFunctions = REDSHIFT_FUNCTIONS;
  supportsNesting = false;
  readsNestedData = false;

  quoteTablePath(tablePath: string): string {
    return tablePath
      .split('.')
      .map(part => `"${part}"`)
      .join('.');
  }

  // note: required for aggregations across joins
  sqlGroupSetTable(groupSetCount: number): string {
    // NOTE this gives error: cannot use scalar function in FROM clause when the query references non-catalog tables
    return `, json_parse(${JSON.stringify(_.range(0, groupSetCount, 1))}) group_set`;
  }

  sqlAnyValue(_groupSet: number, fieldName: string): string {
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

  // NOTE: needed for nesting output
  // for all classic array_agg not supported we could use listagg but then we lose typing
  // and would need to overlay typing in last stage like postgres?
  sqlAggregateTurtle(
    _groupSet: number,
    _fieldList: DialectFieldList,
    _orderBy: string | undefined,
    _limit: number | undefined
  ): string {
    throw new Error('ARRAY_AGG not supported in redshift');
  }

  // NOTE: needed for nesting output
  sqlAnyValueTurtle(_groupSet: number, _fieldList: DialectFieldList): string {
    throw new Error('ARRAY_AGG not supported in redshift');
  }

  // NOTE: needed for nesting output
  sqlAnyValueLastTurtle(
    _name: string,
    _groupSet: number,
    _sqlName: string
  ): string {
    throw new Error('ARRAY_AGG not supported in redshift');
  }

  // NOTE: needed for nesting output
  sqlCoaleseMeasuresInline(
    _groupSet: number,
    _fieldList: DialectFieldList
  ): string {
    throw new Error('ARRAY_AGG not supported in redshift');
  }

  // NOTE: also nesting related but for reading from view / table
  sqlUnnestAlias(
    _source: string,
    _alias: string,
    _fieldList: DialectFieldList,
    _needDistinctKey: boolean,
    _isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    throw new Error('not implemented yet');
  }

  /*
  // For comparison against the equivalent function implemented in standardsql dialect
  select
    (
      strtol(
        substring(md5('hello'), 1, 15), 16
      )::DECIMAL(38, 0) * 4294967296 +
      strtol(
        substring(md5('hello'), 16, 8), 16
      )::DECIMAL(38, 0)
    ) * 0.000000001 as hash;
  +-------------------------------+
  |                          HASH |
  |-------------------------------|
  | 1803811819465386377.040304601 |
  +-------------------------------+
  */
  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    sqlDistinctKey = `${sqlDistinctKey}::VARCHAR`;
    const upperPart = `strtol(substring(md5(${sqlDistinctKey}), 1, 15), 16)::DECIMAL(38, 0) * 4294967296`;
    const lowerPart = `strtol(substring(md5(${sqlDistinctKey}), 16, 8), 16)::DECIMAL(38, 0)`;
    const precisionShiftMultiplier = '0.000000001';
    return `(${upperPart} + ${lowerPart})::DECIMAL(38, 9) * ${precisionShiftMultiplier}`;
  }

  sqlGenerateUUID(): string {
    throw new Error('may need a custom function to generate UUID in redshift');
  }

  sqlFieldReference(
    alias: string,
    fieldName: string,
    fieldType: string,
    isNested: boolean,
    _isArray: boolean
  ): string {
    invariant(!isNested, 'nesting is not supported');
    return `${alias}."${fieldName}"`;
  }

  sqlUnnestPipelineHead(
    _isSingleton: boolean,
    _sourceSQLExpression: string
  ): string {
    throw new Error('not needed since no last stage');
  }

  sqlCreateFunction(_id: string, _funcText: string): string {
    throw new Error('not implemented yet');
  }

  sqlCreateFunctionCombineLastStage(_lastStageName: string): string {
    throw new Error('not implemented yet');
  }

  sqlSelectAliasAsStruct(_alias: string): string {
    throw new Error('not supported in redshift; no structs');
  }

  sqlMaybeQuoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }

  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    throw new Error('not implemented Yet');
  }

  sqlNow(): Expr {
    return mkExpr`CURRENT_TIMESTAMP`;
  }

  // FIXME: must be fixed, https://docs.aws.amazon.com/redshift/latest/dg/r_interval_data_types.html
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
    const timeUnits = extractionMap[units] || units;
    let extractFrom = from.value;
    if (from.valueType === 'timestamp') {
      const tz = qtz(qi);
      if (tz) {
        extractFrom = mkExpr`(${extractFrom}::TIMESTAMPTZ AT TIME ZONE '${tz}')`;
      }
    }
    const extracted = mkExpr`EXTRACT(${timeUnits} FROM ${extractFrom})`;
    return units === 'day_of_week' ? mkExpr`(${extracted}+1)` : extracted;
  }

  // FIXME: must be fixed: https://docs.aws.amazon.com/redshift/latest/dg/r_interval_data_types.html
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
    const interval = mkExpr`make_interval(${intervalMap[timeframe]}=>${n})`;
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
        throw new Error("Redshift dialect doesn't support Safe Cast");
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
    throw new Error(`Unknown or unhandled redshift time unit: ${units}`);
  }

  sqlAggDistinct(
    _key: string,
    _values: string[],
    _func: (valNames: string[]) => string
  ): string {
    throw new Error('ARRAY_AGG not supported in redshift');
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        return `(SELECT * FROM ${tableSQL} ORDER BY RANDOM() LIMIT ${sample.rows})`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} tbl QUALIFY percent_rank() OVER(ORDER BY RANDOM()) <= ${sample.percent})`;
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
    return REDSHIFT_FUNCTIONS.get(name);
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
    return redshiftToMalloyTypes[baseSqlType.trim().toLowerCase()];
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
