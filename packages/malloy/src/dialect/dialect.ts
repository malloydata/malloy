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
  TimeExtractExpr,
  TypecastExpr,
  RegexMatchExpr,
  TimeLiteralExpr,
  RecordLiteralNode,
  ArrayLiteralNode,
  BasicAtomicTypeDef,
  OrderBy,
  TimestampUnit,
  ATimestampTypeDef,
  TimeExpr,
  TemporalFieldType,
} from '../model/malloy_types';
import {isRawCast, isBasicAtomic, TD, isDateUnit} from '../model/malloy_types';
import type {DialectFunctionOverloadDef} from './functions';

interface DialectField {
  typeDef: AtomicTypeDef;
  sqlExpression: string;
  rawName: string;
  sqlOutputName: string;
}
export type DialectFieldList = DialectField[];

/*
 * Standard integer type limits.
 * Use these in dialect integerTypeMappings definitions.
 */

// 32-bit signed integer limits (for databases with 32-bit INTEGER type)
export const MIN_INT32 = -2147483648; // -2^31
export const MAX_INT32 = 2147483647; // 2^31 - 1

// 64-bit signed integer limits
export const MIN_INT64 = BigInt('-9223372036854775808'); // -2^63
export const MAX_INT64 = BigInt('9223372036854775807'); // 2^63 - 1

// 128-bit signed integer limits (for DuckDB HUGEINT)
export const MIN_INT128 = BigInt('-170141183460469231731687303715884105728'); // -2^127
export const MAX_INT128 = BigInt('170141183460469231731687303715884105727'); // 2^127 - 1

// Decimal(38,0) limits (for Snowflake NUMBER(38,0))
export const MIN_DECIMAL38 = BigInt('-99999999999999999999999999999999999999'); // -(10^38 - 1)
export const MAX_DECIMAL38 = BigInt('99999999999999999999999999999999999999'); // 10^38 - 1

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
export type BooleanTypeSupport = 'supported' | 'simulated' | 'none';

/**
 * Maps a range of integer values to a Malloy number type.
 *
 * Dialects define an array of these mappings to describe how integer literals
 * should be typed. The array is searched in order, and the first matching
 * range determines the type.
 */
export interface IntegerTypeMapping {
  min: bigint;
  max: bigint;
  numberType: 'integer' | 'bigint';
}

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

  // Does the dialect support timestamptz (TIMESTAMP WITH TIME ZONE)?
  hasTimestamptz = false;

  // can read some version of ga_sample
  readsNestedData = true;

  // ORDER BY 1 DESC
  orderByClause: OrderByClauseType = 'ordinal';

  // null will match in a function signature
  nullMatchesFunctionSignature = true;

  // support select * replace(...)
  supportsSelectReplace = true;

  // Does the data path preserve bigint precision? False for dialects that
  // serialize results through JSON (postgres, presto, trino)
  supportsBigIntPrecision = true;

  // ability to join source with a filter on a joined source.
  supportsComplexFilteredSources = true;

  // can create temp tables
  supportsTempTables = true;

  // Maximum length of a table/view identifier. Used to truncate
  // generated temp table names. 128 is a safe default for most databases.
  maxIdentifierLength = 128;

  hasModOperator = true;

  // can LEFT JOIN UNNEST
  supportsLeftJoinUnnest = true;

  // UNNEST in LATERAL JOINs doesn't guarantee array element order.
  // When true, compiler adds ORDER BY on array ordinality columns (__row_id)
  requiresExplicitUnnestOrdering = false;

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

  /**
   * Mappings from integer value ranges to Malloy number types.
   *
   * The array is searched in order; the first matching range determines the type.
   * Default: small integers (≤32-bit) → 'integer', larger → 'bigint'.
   */
  integerTypeMappings: IntegerTypeMapping[] = [
    {min: BigInt(MIN_INT32), max: BigInt(MAX_INT32), numberType: 'integer'},
    {min: MIN_INT64, max: MAX_INT64, numberType: 'bigint'},
  ];

  /**
   * Determine the Malloy number type for a numeric literal.
   */
  literalNumberType(value: string): {
    type: 'number';
    numberType: 'integer' | 'float' | 'bigint';
  } {
    const isInteger = /^-?\d+$/.test(value);
    if (!isInteger) {
      return {type: 'number', numberType: 'float'};
    }

    const bigValue = BigInt(value);
    for (const mapping of this.integerTypeMappings) {
      if (bigValue >= mapping.min && bigValue <= mapping.max) {
        return {type: 'number', numberType: mapping.numberType};
      }
    }

    // Value exceeds all supported ranges - let SQL fail at runtime
    return {type: 'number', numberType: 'bigint'};
  }

  /**
   * Create the appropriate time literal IR node based on dialect support.
   * Static method so it can be called with undefined dialect (e.g., ConstantFieldSpace).
   */
  static makeTimeLiteralNode(
    dialect: Dialect | undefined,
    literal: string,
    timezone: string | undefined,
    units: TimestampUnit | undefined,
    typ: TemporalFieldType
  ): TimeLiteralExpr {
    // ConstantFieldSpace.dialectObj() returns undefined, so constants default to false
    const hasTimestamptz = dialect?.hasTimestamptz ?? false;

    if (typ === 'date') {
      return {
        node: 'dateLiteral',
        literal,
        typeDef: {
          type: 'date',
          timeframe:
            units !== undefined && isDateUnit(units) ? units : undefined,
        },
      };
    }

    // typ === 'timestamp'
    if (timezone && hasTimestamptz) {
      // Dialect supports timestamptz - create timestamptzLiteral
      return {
        node: 'timestamptzLiteral',
        literal,
        typeDef: {
          type: 'timestamptz',
          timeframe: units,
        },
        timezone,
      };
    }

    // Plain timestamp (either no timezone, or dialect doesn't support timestamptz)
    if (timezone) {
      return {
        node: 'timestampLiteral',
        literal,
        typeDef: {
          type: 'timestamp',
          timeframe: units,
        },
        timezone,
      };
    }

    return {
      node: 'timestampLiteral',
      literal,
      typeDef: {
        type: 'timestamp',
        timeframe: units,
      },
    };
  }

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
    orderBy: string | undefined
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
  abstract sqlTimeExtractExpr(qi: QueryInfo, xFrom: TimeExtractExpr): string;
  abstract sqlMeasureTimeExpr(e: MeasureTimeExpr): string;
  /**
   * Generate SQL for type casting expressions.
   *
   * Most casts are simple: `CAST(expr AS type)` or `TRY_CAST(expr AS type)` for safe casts.
   *
   * However, when a query timezone is set, casts between temporal types (date, timestamp, timestamptz)
   * require special handling to ensure correct timezone semantics:
   *
   * **Timezone-Aware Cast Semantics:**
   *
   * 1. **TIMESTAMP → DATE**:
   *    - TIMESTAMP represents UTC wall clock
   *    - Convert to query timezone, then extract date
   *    - Example: TIMESTAMP '2020-02-20 00:00:00' with tz 'America/Mexico_City' → '2020-02-19'
   *
   * 2. **TIMESTAMPTZ → DATE**:
   *    - TIMESTAMPTZ represents absolute instant
   *    - Convert to query timezone, then extract date
   *    - Example: TIMESTAMPTZ '2020-02-20 00:00:00 UTC' with tz 'America/Mexico_City' → '2020-02-19'
   *
   * 3. **DATE → TIMESTAMP**:
   *    - DATE represents civil date
   *    - Interpret as midnight in query timezone, return UTC wall clock
   *    - Example: DATE '2020-02-20' with tz 'America/Mexico_City' → TIMESTAMP '2020-02-20 06:00:00' (UTC)
   *
   * 4. **DATE → TIMESTAMPTZ**:
   *    - DATE represents civil date
   *    - Interpret as midnight in query timezone, create instant
   *    - Example: DATE '2020-02-20' with tz 'America/Mexico_City' → instant at 2020-02-20 06:00:00 UTC
   *
   * 5. **TIMESTAMPTZ → TIMESTAMP**:
   *    - TIMESTAMPTZ represents absolute instant
   *    - Extract wall clock in query timezone, return as TIMESTAMP
   *    - Example: TIMESTAMPTZ '2020-02-20 00:00:00 UTC' with tz 'America/Mexico_City' → TIMESTAMP '2020-02-19 18:00:00'
   *
   * 6. **TIMESTAMP → TIMESTAMPTZ**:
   *    - TIMESTAMP represents UTC wall clock
   *    - Interpret as being in query timezone
   *    - Example: TIMESTAMP '2020-02-20 00:00:00' with tz 'America/Mexico_City' → instant at 2020-02-20 06:00:00 UTC
   *
   * **Implementation Notes:**
   *
   * - Dialects without timestamptz support (MySQL, BigQuery, StandardSQL) only need cases 1-3
   * - Without query timezone, most casts are simple `CAST(expr AS type)`
   *
   * @param qi - Query info containing timezone and other context
   * @param cast - The typecast expression to generate SQL for
   * @returns SQL string for the cast operation
   */
  abstract sqlCast(qi: QueryInfo, cast: TypecastExpr): string;
  abstract sqlRegexpMatch(df: RegexMatchExpr): string;

  /**
   * Converts a Malloy timestamp to "civil time" for calendar operations in a timezone.
   *
   * Each dialect selects its own SQL type to represent civil time (e.g., plain TIMESTAMP,
   * TIMESTAMP WITH TIME ZONE, or DATETIME). The civil space is where timezone-aware
   * truncation and interval arithmetic happen. Operations like sqlTruncate and sqlOffsetTime
   * are aware of the civil space and work correctly within it.
   *
   * @param expr The SQL expression for the Malloy timestamp (plain or timestamptz)
   * @param timezone The target timezone for civil operations
   * @param typeDef The Malloy type of the input expression
   * @returns Object with SQL expression and the SQL type it evaluates to (the civil type)
   */
  abstract sqlConvertToCivilTime(
    expr: string,
    timezone: string,
    typeDef: AtomicTypeDef
  ): {sql: string; typeDef: AtomicTypeDef};

  /**
   * Converts from civil time back to a Malloy timestamp type.
   *
   * This is the inverse of sqlConvertToCivilTime. Takes a value in the dialect's
   * civil space and converts it back to either a plain timestamp (UTC) or a
   * timestamptz, depending on the destination type.
   *
   * @param expr The SQL expression in civil time
   * @param timezone The timezone of the civil time
   * @param destTypeDef The destination Malloy timestamp type (plain or timestamptz)
   * @returns SQL expression representing the Malloy timestamp
   */
  abstract sqlConvertFromCivilTime(
    expr: string,
    timezone: string,
    destTypeDef: ATimestampTypeDef
  ): string;

  /**
   * Truncates a time expression to the specified unit.
   *
   * @param expr The SQL expression to truncate
   * @param unit The unit to truncate to (year, month, day, hour, etc.)
   * @param typeDef The Malloy type of the expression (date, timestamp, etc.)
   * @param inCivilTime If true, the expression is already in civil (local) time and should not
   *                    be converted. If false, may need timezone conversion for timestamps.
   * @param timezone Optional timezone for the operation. Only provided when timezone-aware
   *                 truncation is needed but inCivilTime is false.
   * @returns SQL expression representing the truncated time
   */
  abstract sqlTruncate(
    expr: string,
    unit: TimestampUnit,
    typeDef: AtomicTypeDef,
    inCivilTime: boolean,
    timezone?: string
  ): string;

  /**
   * Adds or subtracts a time interval from a time expression.
   *
   * @param expr The SQL expression to offset
   * @param op The operation: '+' for addition, '-' for subtraction
   * @param magnitude The SQL expression for the interval magnitude (e.g., '6', '(delta_val)')
   * @param unit The interval unit (year, month, day, hour, etc.)
   * @param typeDef The Malloy type of the expression (date, timestamp, etc.)
   * @param inCivilTime If true, the expression is already in civil (local) time and should not
   *                    be converted. If false, may need timezone conversion for timestamps.
   * @param timezone Optional timezone for the operation. Only provided when timezone-aware
   *                 offset is needed but inCivilTime is false.
   * @returns SQL expression representing the offset time
   */
  abstract sqlOffsetTime(
    expr: string,
    op: '+' | '-',
    magnitude: string,
    unit: TimestampUnit,
    typeDef: AtomicTypeDef,
    inCivilTime: boolean,
    timezone?: string
  ): string;

  /**
   * Determines whether a truncation and/or offset operation needs to be performed in
   * civil (local) time, and if so, which timezone to use.
   *
   * Calendar-based operations (day, week, month, quarter, year) typically need civil time
   * computation because these units can cross DST boundaries, changing the UTC offset.
   *
   * Default implementation:
   * - Returns true for timestamps with truncation or calendar-unit offsets
   * - Uses the query timezone from QueryInfo, or 'UTC' if none specified
   * - Returns false for dates or sub-day offsets (hour, minute, second)
   *
   * Dialects can override this if they have different rules about which operations
   * require civil time computation.
   *
   * @param typeDef The Malloy type of the base expression
   * @param truncateTo The truncation unit, if any
   * @param offsetUnit The offset unit, if any
   * @param qi Query information including timezone settings
   * @returns Object with `needed` boolean and optional `tz` string
   */
  needsCivilTimeComputation(
    typeDef: AtomicTypeDef,
    truncateTo: TimestampUnit | undefined,
    offsetUnit: TimestampUnit | undefined,
    qi: QueryInfo
  ): {needed: boolean; tz: string | undefined} {
    // Calendar units that can cross DST boundaries
    const calendarUnits = ['day', 'week', 'month', 'quarter', 'year'];

    const isCalendarTruncate =
      truncateTo !== undefined && calendarUnits.includes(truncateTo);

    const isCalendarOffset =
      offsetUnit !== undefined && calendarUnits.includes(offsetUnit);

    const tz = qtz(qi);

    // Timestamps with calendar truncation/offset need civil time computation
    // BUT only if there's actually a timezone to convert to/from
    const needed =
      TD.isAnyTimestamp(typeDef) &&
      (isCalendarTruncate || isCalendarOffset) &&
      tz !== undefined;

    return {needed, tz};
  }

  /**
   * Unified function for truncation and/or offset operations. This turns out to
   * be a very common operation and one which can be optimized by doing it together.
   *
   * Much of the complexity has to do with getting timezone values set up so that
   * they will truncate/offset in the query timezone instead of UTC.
   *
   * The intention is that this implementation will work for all dialects, and all
   * the dialect peculiarities are handled with the new primitives introduced to
   * support this function:
   * - needsCivilTimeComputation: Determines if operation needs civil time
   * - sqlConvertToCivilTime/sqlConvertFromCivilTime: Timezone conversion
   * - sqlTruncate: Truncation operation
   * - sqlOffsetTime: Interval arithmetic
   *
   * OFFSET TIMESTAMP BEHAVIOR:
   * - Plain timestamps (offset=false): Always return plain TIMESTAMP in UTC
   * - Offset timestamps (offset=true):
   *   - Simple path: Operate in native embedded timezone, return TIMESTAMPTZ
   *   - Civil path: Convert to query timezone (preserving instant), operate there,
   *     return TIMESTAMPTZ in query timezone via sqlConvertFromCivilTime
   * - BigQuery/MySQL: No offset timestamp support, this logic never runs
   *
   * @param baseExpr The time expression to operate on (already compiled, with .sql populated)
   * @param qi Query information including timezone
   * @param truncateTo Optional truncation unit (year, month, day, etc.)
   * @param offset Optional offset to apply (after truncation if both present)
   */
  sqlTruncAndOffset(
    baseExpr: TimeExpr,
    qi: QueryInfo,
    truncateTo?: TimestampUnit,
    offset?: {
      op: '+' | '-';
      magnitude: string;
      unit: TimestampUnit;
    }
  ): string {
    // Determine if we need to work in civil (local) time
    if (TD.isAnyTimestamp(baseExpr.typeDef)) {
      const {needed: needsCivil, tz} = this.needsCivilTimeComputation(
        baseExpr.typeDef,
        truncateTo,
        offset?.unit,
        qi
      );

      if (needsCivil && tz) {
        // Civil time path: convert to local time, operate, convert back to UTC
        const civilResult = this.sqlConvertToCivilTime(
          baseExpr.sql!,
          tz,
          baseExpr.typeDef
        );
        let expr = civilResult.sql;
        const civilTypeDef = civilResult.typeDef;

        if (truncateTo) {
          expr = this.sqlTruncate(expr, truncateTo, civilTypeDef, true, tz);
        }

        if (offset) {
          expr = this.sqlOffsetTime(
            expr,
            offset.op,
            offset.magnitude,
            offset.unit,
            civilTypeDef,
            true,
            tz
          );
        }

        return this.sqlConvertFromCivilTime(expr, tz, baseExpr.typeDef);
      }
    }

    // Simple path: no civil time conversion needed
    let sql = baseExpr.sql!;

    if (truncateTo) {
      sql = this.sqlTruncate(sql, truncateTo, baseExpr.typeDef, false, qtz(qi));
    }

    if (offset) {
      sql = this.sqlOffsetTime(
        sql,
        offset.op,
        offset.magnitude,
        offset.unit,
        baseExpr.typeDef,
        false,
        qtz(qi)
      );
    }

    return sql;
  }

  /**
   * Generate SQL for a DATE literal.
   * @param literal - The date string in format 'YYYY-MM-DD'
   * @returns SQL that produces a DATE value
   */
  abstract sqlDateLiteral(qi: QueryInfo, literal: string): string;

  /**
   * Generate SQL for a plain TIMESTAMP literal (without timezone offset).
   * @param literal - The timestamp string in format 'YYYY-MM-DD HH:MM:SS'
   * @param timezone - Optional timezone name (e.g., 'America/Los_Angeles')
   *   - If undefined: Create plain timestamp literal from the literal string
   *   - If defined: The literal string represents a civil time in the given timezone.
   *     Convert it to a plain timestamp (typically by interpreting as timestamptz
   *     in that timezone, then casting to plain timestamp). This happens when:
   *     1. A constant with timezone is used (constants don't have dialect context)
   *     2. A literal with timezone is used in a dialect that doesn't support offset timestamps
   * @returns SQL that produces a plain TIMESTAMP value
   */
  abstract sqlTimestampLiteral(
    qi: QueryInfo,
    literal: string,
    timezone: string | undefined
  ): string;

  /**
   * Generate SQL for an offset TIMESTAMP literal (TIMESTAMP WITH TIME ZONE).
   * Only called for dialects where hasOffsetTimestamp = true.
   * @param literal - The timestamp string in format 'YYYY-MM-DD HH:MM:SS'
   * @param timezone - The timezone name (e.g., 'America/Los_Angeles')
   * @returns SQL that produces a TIMESTAMP WITH TIME ZONE value representing
   *   the civil time in the specified timezone
   */
  abstract sqlTimestamptzLiteral(
    qi: QueryInfo,
    literal: string,
    timezone: string
  ): string;
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
      case 'delta': {
        // Optimize: if delta's base is a trunc, combine them
        const base = df.kids.base;
        if (base.node === 'trunc') {
          // Combined trunc + offset - pass the base of the truncation
          return this.sqlTruncAndOffset(base.e, qi, base.units, {
            op: df.op,
            magnitude: df.kids.delta.sql!,
            unit: df.units,
          });
        }
        // Just offset, no truncation - pass the delta's base
        return this.sqlTruncAndOffset(base, qi, undefined, {
          op: df.op,
          magnitude: df.kids.delta.sql!,
          unit: df.units,
        });
      }
      case 'trunc':
        // Just truncation, no offset
        return this.sqlTruncAndOffset(df.e, qi, df.units);
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
      case 'dateLiteral':
        return this.sqlDateLiteral(qi, df.literal);
      case 'timestampLiteral':
        return this.sqlTimestampLiteral(qi, df.literal, df.timezone);
      case 'timestamptzLiteral':
        return this.sqlTimestamptzLiteral(qi, df.literal, df.timezone);
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
    dstTypeDef: AtomicTypeDef | undefined;
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
      return bv ? '(1=1)' : '(1-0)';
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
