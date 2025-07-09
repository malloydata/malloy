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

import type {
  Expr,
  Sampling,
  AtomicTypeDef,
  MeasureTimeExpr,
  TimeTruncExpr,
  TimeExtractExpr,
  TimeDeltaExpr,
  TypecastExpr,
  RegexMatchExpr,
  TimeLiteralNode,
  RecordLiteralNode,
  ArrayLiteralNode,
  BasicAtomicTypeDef,
  OrderBy,
} from '../model/malloy_types';
import {isRawCast, isBasicAtomic} from '../model/malloy_types';
import type {DialectFunctionOverloadDef} from './functions';

interface DialectField {
  typeDef: AtomicTypeDef;
  sqlExpression: string;
  rawName: string;
  sqlOutputName: string;
}
export type DialectFieldList = DialectField[];

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

export type FieldReferenceType =
  | 'table'
  | 'nest source'
  | 'array[scalar]'
  | 'array[record]'
  | 'record';

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

export type OrderByClauseType = 'output_name' | 'ordinal' | 'expression';
export type OrderByRequest = 'query' | 'turtle' | 'analytical';
export type GroupByClauseType = 'ordinal' | 'expression';
export type LimitingClause = 'limit' | 'top';
export type BooleanTypeSupport = 'supported' | 'simulated' | 'none';

export abstract class Dialect {
  abstract name: string;
  abstract defaultNumberType: string;
  abstract defaultDecimalType: string;
  abstract udfPrefix: string;
  abstract hasFinalStage: boolean;
  abstract divisionIsInteger: boolean;
  abstract supportsSumDistinctFunction: boolean;
  abstract unnestWithNumbers: boolean;
  abstract defaultSampling: Sampling;
  abstract supportsAggDistinct: boolean;
  abstract supportUnnestArrayAgg: boolean; // won't need UDFs for nested pipelines
  abstract supportsCTEinCoorelatedSubQueries: boolean;
  abstract dontUnionIndex: boolean;
  abstract supportsQualify: boolean;
  abstract supportsSafeCast: boolean;
  abstract supportsNesting: boolean;
  abstract experimental: boolean; // requires ##! experimental.dialect.NAME

  // -- we should add flags with default values from now on so as to not break
  // dialects outside our repository
  //

  // StandardSQL dialects can't partition on expression in window functions
  cantPartitionWindowFunctionsOnExpressions = false;

  // Snowflake can't yet support pipelines in nested views.
  supportsPipelinesInViews = true;

  // Some dialects don't supporrt arrays (mysql)
  supportsArraysInData = true;

  // can read some version of ga_sample
  readsNestedData = true;

  // ORDER BY 1 DESC
  orderByClause: OrderByClauseType = 'ordinal';

  groupByClause: GroupByClauseType = 'ordinal';

  limitClause: LimitingClause = 'limit';

  // null will match in a function signature
  nullMatchesFunctionSignature = true;

  // support select * replace(...)
  supportsSelectReplace = true;

  // ability to join source with a filter on a joined source.
  supportsComplexFilteredSources = true;

  // can create temp tables
  supportsTempTables = true;

  hasModOperator = true;

  // can LEFT JOIN UNNEST
  supportsLeftJoinUnnest = true;

  supportsCountApprox = false;

  supportsHyperLogLog = false;

  // MYSQL doesn't have full join, maybe others.
  supportsFullJoin = true;

  // Can have arrays of arrays
  nestedArrays = true;
  // An array or record will reveal type of contents on schema read
  compoundObjectInSchema = true;

  booleanType: BooleanTypeSupport = 'supported';

  // Like characters are escaped with ESCAPE clause
  likeEscape = true;

  abstract getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  };

  abstract getDialectFunctions(): {
    [name: string]: DialectFunctionOverloadDef[];
  };

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
    parentAlias: string,
    parentType: FieldReferenceType,
    childName: string,
    childType: string
  ): string;

  abstract sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string,
    fieldList?: DialectFieldList
  ): string;

  abstract sqlCreateFunction(id: string, funcText: string): string;

  abstract sqlCreateFunctionCombineLastStage(
    lastStageName: string,
    fieldList: DialectFieldList,
    orderBy: OrderBy[] | undefined
  ): string;
  abstract sqlCreateTableAsSelect(tableName: string, sql: string): string;

  abstract sqlSelectAliasAsStruct(
    alias: string,
    fieldList: DialectFieldList
  ): string;

  sqlFinalStage(_lastStageName: string, _fields: string[]): string {
    throw new Error('Dialect has no final Stage but called Anyway');
  }

  // default implementation will probably work most of the time
  sqlDateToString(sqlDateExp: string): string {
    return this.castToString(`DATE(${sqlDateExp})`);
  }
  abstract sqlMaybeQuoteIdentifier(identifier: string): string;

  abstract castToString(expression: string): string;

  abstract concat(...values: string[]): string;

  sqlLiteralNumber(literal: string): string {
    return literal;
  }

  // BigQuery has some fieldNames that are Pseudo Fields and shouldn't be
  //  included in projections.
  ignoreInProject(_fieldName: string): boolean {
    return false;
  }

  abstract sqlNowExpr(): string;
  abstract sqlTruncExpr(qi: QueryInfo, toTrunc: TimeTruncExpr): string;
  abstract sqlTimeExtractExpr(qi: QueryInfo, xFrom: TimeExtractExpr): string;
  abstract sqlMeasureTimeExpr(e: MeasureTimeExpr): string;
  abstract sqlAlterTimeExpr(df: TimeDeltaExpr): string;
  abstract sqlCast(qi: QueryInfo, cast: TypecastExpr): string;
  abstract sqlRegexpMatch(df: RegexMatchExpr): string;

  abstract sqlLiteralTime(qi: QueryInfo, df: TimeLiteralNode): string;
  abstract sqlLiteralString(literal: string): string;
  abstract sqlLiteralRegexp(literal: string): string;
  abstract sqlLiteralArray(lit: ArrayLiteralNode): string;
  abstract sqlLiteralRecord(lit: RecordLiteralNode): string;

  /**
   * The dialect has a chance to over-ride how expressions are translated. If
   * "undefined" is returned then the translation is left to the query translator.
   *
   * Any child nodes of the expression will already have been translated, and
   * the translated value will be in the ".sql" fields for those nodes
   * @param qi Info from the query containing this expression
   * @param df The expression being translated
   * @returns The SQL translation of the expression, or undefined
   */
  exprToSQL(qi: QueryInfo, df: Expr): string | undefined {
    switch (df.node) {
      case 'now':
        return this.sqlNowExpr();
      case 'timeDiff':
        return this.sqlMeasureTimeExpr(df);
      case 'delta':
        return this.sqlAlterTimeExpr(df);
      case 'trunc':
        return this.sqlTruncExpr(qi, df);
      case 'extract':
        return this.sqlTimeExtractExpr(qi, df);
      case 'cast':
        return this.sqlCast(qi, df);
      case 'regexpMatch':
        return this.sqlRegexpMatch(df);
      case '/': {
        if (this.divisionIsInteger) {
          return `${df.kids.left.sql}*1.0/${df.kids.right.sql}`;
        }
        return;
      }
      case '%': {
        if (!this.hasModOperator) {
          return `MOD(${df.kids.left.sql},${df.kids.right.sql})`;
        }
        return;
      }
      case 'timeLiteral':
        return this.sqlLiteralTime(qi, df);
      case 'stringLiteral':
        return this.sqlLiteralString(df.literal);
      case 'numberLiteral':
        return this.sqlLiteralNumber(df.literal);
      case 'regexpLiteral':
        return this.sqlLiteralRegexp(df.literal);
      case 'recordLiteral':
        return this.sqlLiteralRecord(df);
      case 'arrayLiteral':
        return this.sqlLiteralArray(df);
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

  /**
   * MySQL is NULLs first, all other dialects have a way to make NULLs last.
   * isBaseOrdering is a hack to allow the MySQL dialect to partially implement
   * NULLs last, but should go away once MySQL fully implements NULLs last.
   */
  sqlOrderBy(orderTerms: string[], _orderFor?: OrderByRequest): string {
    return `ORDER BY ${orderTerms.join(',')}`;
  }

  sqlTzStr(qi: QueryInfo): string {
    return `"${qi.queryTimezone}"`;
  }

  sqlMakeUnnestKey(key: string, rowKey: string) {
    return this.concat(key, "'x'", rowKey);
  }

  // default implementation
  sqlStringAggDistinct(
    distinctKey: string,
    valueSQL: string,
    separatorSQL: string
  ) {
    const keyStart = '__STRING_AGG_KS__';
    const keyEnd = '__STRING_AGG_KE__';
    const distinctValueSQL = `concat('${keyStart}', ${distinctKey}, '${keyEnd}', ${valueSQL})`;
    return `REGEXP_REPLACE(
      STRING_AGG(DISTINCT ${distinctValueSQL}${
        separatorSQL.length > 0 ? ',' + separatorSQL : ''
      }),
      '${keyStart}.*?${keyEnd}',
      ''
    )`;
  }

  abstract sqlTypeToMalloyType(sqlType: string): BasicAtomicTypeDef;
  abstract malloyTypeToSQLType(malloyType: AtomicTypeDef): string;

  abstract validateTypeName(sqlType: string): boolean;

  /**
   * Helper function for sql cast implementations. Handles the
   * wrangling of the raw type and also inferring the source
   * type if it was not provided.
   */
  sqlCastPrep(cast: TypecastExpr): {
    op: string;
    srcTypeDef: BasicAtomicTypeDef | undefined;
    dstTypeDef: BasicAtomicTypeDef | undefined;
    dstSQLType: string;
  } {
    let srcTypeDef = cast.srcType || cast.e.typeDef;
    const src = srcTypeDef?.type || 'unknown';
    if (srcTypeDef && !isBasicAtomic(srcTypeDef)) {
      srcTypeDef = undefined;
    }
    if (isRawCast(cast)) {
      return {
        op: `${src}::'${cast.dstSQLType}'`,
        srcTypeDef,
        dstTypeDef: undefined,
        dstSQLType: cast.dstSQLType,
      };
    }
    return {
      op: `${src}::${cast.dstType.type}`,
      srcTypeDef,
      dstTypeDef: cast.dstType,
      dstSQLType: this.malloyTypeToSQLType(cast.dstType),
    };
  }

  /**
   * Write a LIKE expression. Malloy like strings are escaped with \\% and \\_
   * but some SQL dialects use an ESCAPE clause.
   */
  sqlLike(likeOp: 'LIKE' | 'NOT LIKE', left: string, likeStr: string): string {
    let escaped = '';
    let escapeActive = false;
    let escapeClause = false;
    for (const c of likeStr) {
      if (c === '\\' && !escapeActive) {
        escapeActive = true;
      } else if (this.likeEscape && c === '^') {
        escaped += '^^';
        escapeActive = false;
        escapeClause = true;
      } else {
        if (escapeActive) {
          if (this.likeEscape) {
            if (c === '%' || c === '_') {
              escaped += '^';
              escapeClause = true;
            }
          } else {
            if (c === '%' || c === '_' || c === '\\') {
              escaped += '\\';
            }
          }
        }
        escaped += c;
        escapeActive = false;
      }
    }
    const compare = `${left} ${likeOp} ${this.sqlLiteralString(escaped)}`;
    return escapeClause ? `${compare} ESCAPE '^'` : compare;
  }

  /**
   * SQL to generate to get a boolean value for a boolean expression
   */
  sqlBoolean(bv: boolean): string {
    if (this.booleanType === 'none') {
      return bv ? '(1=1)' : '(1=0)';
    }
    return bv ? 'true' : 'false';
  }

  /**
   * What a boolean value looks like in a query result
   */
  resultBoolean(bv: boolean) {
    if (this.booleanType !== 'supported') {
      return bv ? 1 : 0;
    }
    return bv ? true : false;
  }
}
