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
  AtomicFieldType as AtomicFieldTypeInner,
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

interface DialectField {
  type: string;
  sqlExpression: string;
  sqlOutputName: string;
}

/**
 * Someday this might be used to control how a function call in malloy is
 * translated into a function call in SQL. Today this is just so that
 * the expression compiler can know the output type of a function.
 */
export interface FunctionInfo {
  returnType: AtomicFieldTypeInner;
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
  protected abstract functionInfo: Record<string, FunctionInfo>;
  abstract defaultSampling: Sampling;
  abstract supportsAggDistinct: boolean;
  abstract supportUnnestArrayAgg: boolean; // won't need UDFs for nested pipelines
  abstract supportsCTEinCoorelatedSubQueries: boolean;
  abstract dontUnionIndex: boolean;
  abstract supportsQualify: boolean;

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
    isArray: boolean
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
  abstract sqlTrunc(sqlTime: TimeValue, units: TimestampUnit): Expr;
  abstract sqlExtract(sqlTime: TimeValue, units: ExtractUnit): Expr;
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

  abstract sqlCast(cast: TypecastFragment): Expr;

  abstract sqlLiteralTime(
    timeString: string,
    type: TimeFieldType,
    timezone: string
  ): string;

  abstract sqlLiteralString(literal: string): string;

  abstract sqlLiteralRegexp(literal: string): string;

  abstract sqlRegexpMatch(expr: Expr, regex: string): Expr;

  getFunctionInfo(functionName: string): FunctionInfo | undefined {
    return this.functionInfo[functionName.toLowerCase()];
  }

  dialectExpr(df: DialectFragment): Expr {
    switch (df.function) {
      case 'now':
        return this.sqlNow();
      case 'timeDiff':
        return this.sqlMeasureTime(df.left, df.right, df.units);
      case 'delta':
        return this.sqlAlterTime(df.op, df.base, df.delta, df.units);
      case 'trunc':
        return this.sqlTrunc(df.expr, df.units);
      case 'extract':
        return this.sqlExtract(df.expr, df.units);
      case 'cast':
        return this.sqlCast(df);
      case 'regexpMatch':
        return this.sqlRegexpMatch(df.expr, df.regexp);
      case 'div': {
        if (this.divisionIsInteger) {
          return mkExpr`${df.numerator}*1.0/${df.denominator}`;
        }
        return mkExpr`${df.numerator}/${df.denominator}`;
      }
      case 'timeLiteral':
        return [this.sqlLiteralTime(df.literal, df.literalType, df.timezone)];
      case 'stringLiteral':
        return [this.sqlLiteralString(df.literal)];
      case 'regexpLiteral':
        return [this.sqlLiteralRegexp(df.literal)];
    }
  }

  sqlSumDistinct(_key: string, _value: string): string {
    return "sqlSumDistinct called but not implemented";
  }

  sqlAggDistinct(
    _key: string,
    _values: string[],
    _func: (valNames: string[]) => string
  ) {
    return "sqlAggDistinct called but not implemented";
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
}
