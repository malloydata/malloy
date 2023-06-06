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
  DialectFragment,
  Expr,
  ExtractUnit,
  Sampling,
  StructDef,
  TimeFieldType,
  TimeValue,
  TimestampUnit,
  TypecastFragment,
  mkExpr,
} from '../model/malloy_types';
import {DialectFunctionOverloadDef} from './functions';

interface DialectField {
  type: string;
  sqlExpression: string;
  sqlOutputName: string;
}

/**
 * Data which dialect methods need in order to correctly generate SQL.
 * Initially this is just timezone related, but I made this an interface
 * so it would be extensible with other useful information which might not be
 * available until runtime (e.g. version number of db)
 * mtoy TODO rename this interface to something other than "QueryInfo"
 */
export interface QueryInfo {
  queryTimezone?: string;
  systemTimezone?: string;
}

const allUnits = [
  'microsecond',
  'millisecond',
  'second',
  'minute',
  'hour',
  'day',
  'week',
  'month',
  'quarter',
  'year',
];
export const dayIndex = allUnits.indexOf('day');

export function inDays(units: string): boolean {
  return allUnits.indexOf(units) >= dayIndex;
}

// Return the active query timezone, if it different than the
// "native" timezone for timestamps.
export function qtz(qi: QueryInfo): string | undefined {
  const tz = qi.queryTimezone;
  if (tz === undefined || tz === qi.systemTimezone) {
    return undefined;
  }
  return tz;
}

export type DialectFieldList = DialectField[];

export abstract class Dialect {
  abstract name: string;
  abstract defaultNumberType: string;
  abstract udfPrefix: string;
  abstract hasFinalStage: boolean;
  abstract stringTypeName: string;
  abstract divisionIsInteger: boolean;
  abstract supportsSumDistinctFunction: boolean;
  abstract unnestWithNumbers: boolean;
  abstract defaultSampling: Sampling;
  abstract supportsAggDistinct: boolean;
  abstract supportUnnestArrayAgg: boolean; // won't need UDFs for nested pipelines
  abstract supportsCTEinCoorelatedSubQueries: boolean;
  abstract dontUnionIndex: boolean;
  abstract supportsQualify: boolean;
  // In `OVER (ORDER_BY x)`, whether `x` needs to be in the GROUP BY.
  abstract requiresWindowOrderByToBeGrouped: boolean;

  // return the definition of a function with the given name
  abstract getGlobalFunctionDef(
    name: string
  ): DialectFunctionOverloadDef[] | undefined;

  // return a quoted string for use as a table path.
  abstract quoteTablePath(tablePath: string): string;

  // returns an table that is a 0 based array of numbers
  abstract sqlGroupSetTable(groupSetCount: number): string;

  // aggregate function that return the ANY NON NULL value encountered
  abstract sqlAnyValue(groupSet: number, fieldName: string): string;

  // can array agg or any_value a struct...
  abstract sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string;

  abstract sqlAnyValueTurtle(
    groupSet: number,
    fieldList: DialectFieldList
  ): string;

  abstract sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string;

  abstract sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string;

  abstract sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean,
    isInNestedPipeline: boolean
  ): string;

  abstract sqlSumDistinctHashedKey(sqlDistinctKey: string): string;

  abstract sqlGenerateUUID(): string;

  abstract sqlFieldReference(
    alias: string,
    fieldName: string,
    fieldType: string,
    isNested: boolean,
    isArray: boolean
  ): string;

  abstract sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string;

  abstract sqlCreateFunction(id: string, funcText: string): string;

  abstract sqlCreateFunctionCombineLastStage(
    lastStageName: string,
    structDef: StructDef
  ): string;
  abstract sqlCreateTableAsSelect(tableName: string, sql: string): string;

  abstract sqlSelectAliasAsStruct(
    alias: string,
    physicalFieldNames: string[]
  ): string;

  sqlFinalStage(_lastStageName: string, _fields: string[]): string {
    throw new Error('Dialect has no final Stage but called Anyway');
  }

  // default implementation will probably work most of the time
  sqlDateToString(sqlDateExp: string): string {
    return `CAST(DATE(${sqlDateExp}) AS ${this.stringTypeName} )`;
  }
  abstract sqlMaybeQuoteIdentifier(identifier: string): string;

  abstract sqlNow(): Expr;
  abstract sqlTrunc(
    qi: QueryInfo,
    sqlTime: TimeValue,
    units: TimestampUnit
  ): Expr;
  abstract sqlExtract(
    qi: QueryInfo,
    sqlTime: TimeValue,
    units: ExtractUnit
  ): Expr;
  abstract sqlMeasureTime(
    from: TimeValue,
    to: TimeValue,
    units: TimestampUnit
  ): Expr;

  abstract sqlAlterTime(
    op: '+' | '-',
    expr: TimeValue,
    n: Expr,
    timeframe: TimestampUnit
  ): Expr;

  // BigQuery has some fieldNames that are Pseudo Fields and shouldn't be
  //  included in projections.
  ignoreInProject(_fieldName: string): boolean {
    return false;
  }

  abstract sqlCast(qi: QueryInfo, cast: TypecastFragment): Expr;

  abstract sqlLiteralTime(
    qi: QueryInfo,
    timeString: string,
    type: TimeFieldType,
    timezone?: string
  ): string;

  abstract sqlLiteralString(literal: string): string;

  abstract sqlLiteralRegexp(literal: string): string;

  abstract sqlRegexpMatch(expr: Expr, regex: Expr): Expr;

  sqlLiteralNumber(literal: string): string {
    return literal;
  }

  dialectExpr(qi: QueryInfo, df: DialectFragment): Expr {
    switch (df.function) {
      case 'now':
        return this.sqlNow();
      case 'timeDiff':
        return this.sqlMeasureTime(df.left, df.right, df.units);
      case 'delta':
        return this.sqlAlterTime(df.op, df.base, df.delta, df.units);
      case 'trunc':
        return this.sqlTrunc(qi, df.expr, df.units);
      case 'extract':
        return this.sqlExtract(qi, df.expr, df.units);
      case 'cast':
        return this.sqlCast(qi, df);
      case 'regexpMatch':
        return this.sqlRegexpMatch(df.expr, df.regexp);
      case 'div': {
        if (this.divisionIsInteger) {
          return mkExpr`${df.numerator}*1.0/${df.denominator}`;
        }
        return mkExpr`${df.numerator}/${df.denominator}`;
      }
      case 'timeLiteral': {
        return [
          this.sqlLiteralTime(qi, df.literal, df.literalType, df.timezone),
        ];
      }
      case 'stringLiteral':
        return [this.sqlLiteralString(df.literal)];
      case 'numberLiteral':
        return [this.sqlLiteralNumber(df.literal)];
      case 'regexpLiteral':
        return [this.sqlLiteralRegexp(df.literal)];
    }
  }

  sqlSumDistinct(_key: string, _value: string, _funcName: string): string {
    return 'sqlSumDistinct called but not implemented';
  }

  // Like sqlSumDistinct, but for an arbitrary aggregate expression
  sqlAggDistinct(
    _key: string,
    _values: string[],
    // A function which takes the value names used internally and produces the SQL operation using those
    // value names.
    // TODO maybe this should be flipped around and the SQL should be passed in directly along with the
    // value names used?
    _func: (valNames: string[]) => string
  ) {
    return 'sqlAggDistinct called but not implemented';
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      throw new Error(`Sampling is not supported on dialect ${this.name}.`);
    }
    return tableSQL;
  }

  sqlOrderBy(orderTerms: string[]): string {
    return `ORDER BY ${orderTerms.join(',')}`;
  }

  sqlTzStr(qi: QueryInfo): string {
    return `"${qi.queryTimezone}"`;
  }
}
