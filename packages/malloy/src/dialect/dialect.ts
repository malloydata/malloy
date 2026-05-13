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

/**
 * Order-by entry with field references resolved to SQL expressions
 * and direction defaulted. Used by sqlAggregateTurtle so each dialect
 * can format ordering in its own syntax.
 */
export interface CompiledOrderBy {
  /** SQL expression for the ordering column (e.g. the group_set-suffixed CTE column name) */
  field: string;
  /** The struct output field name, for dialects that sort via struct field reference */
  structField: string;
  dir: 'asc' | 'desc';
}

/**
 * A named expression for the lateral join bag. The expression will be
 * available as `__lateral_join_bag.name` in the query.
 */
export interface LateralJoinExpression {
  sql: string;
  name: string; // already quoted by sqlQuoteIdentifier
}

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
 * Allowed values for `Dialect.stringLiteralStyle` and
 * `Dialect.identifierEscapeStyle`. Subclasses set their style with
 * e.g. `stringLiteralStyle = EscapeStyle.Backslash`; the `as const`
 * is centralized here so dialect files stay free of it.
 */
export const EscapeStyle = {
  Doubled: 'doubled',
  Backslash: 'backslash',
  Unset: 'unset',
} as const;
export type EscapeStyleValue = (typeof EscapeStyle)[keyof typeof EscapeStyle];

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

/**
 * Recognize a dotted identifier path where each segment is either a
 * bare SQL identifier (`[A-Za-z_][A-Za-z0-9_]*`) or a `q`-delimited
 * quoted identifier with doubled-quote escape (`qq` inside the body
 * represents one literal `q`). Segments are joined by `.`.
 *
 * Returns true if the entire input is a valid path; false otherwise.
 * No information about the parsed structure is returned — this is the
 * validator for dialects whose canonical form is the user's input
 * verbatim. Dialects with richer grammars (BigQuery, DuckDB) override
 * `sqlValidateTableName` directly.
 */
export function parseDottedIdentPathDoubled(
  input: string,
  quoteChar: string
): boolean {
  if (input.length === 0) return false;
  let i = 0;
  while (i < input.length) {
    // Parse one segment.
    if (input[i] === quoteChar) {
      i++;
      let closed = false;
      while (i < input.length) {
        if (input[i] === quoteChar) {
          if (input[i + 1] === quoteChar) {
            i += 2; // doubled-quote escape
          } else {
            i++; // closing quote
            closed = true;
            break;
          }
        } else {
          i++;
        }
      }
      if (!closed) return false;
    } else if (/[A-Za-z_]/.test(input[i])) {
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
        i++;
      }
    } else {
      return false;
    }
    // After a segment, either end-of-input or a dot-then-another-segment.
    if (i === input.length) return true;
    if (input[i] !== '.') return false;
    i++;
    if (i === input.length) return false; // trailing dot
  }
  return true;
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

  // StandardSQL dialects can't partition on expression in window functions.
  // When true, dimension expressions used in PARTITION BY are moved to a
  // lateral join bag so the PARTITION BY can reference a column name instead
  // of a raw expression. See sqlLateralJoinBag for dialect-specific syntax.
  cantPartitionWindowFunctionsOnExpressions = false;

  // Generate the lateral join bag clause for window function partitioning.
  // The expressions are dimension fields that need to be referenced by name
  // in PARTITION BY clauses. Must be overridden by any dialect that sets
  // cantPartitionWindowFunctionsOnExpressions = true.
  sqlLateralJoinBag(_expressions: LateralJoinExpression[]): string {
    if (this.cantPartitionWindowFunctionsOnExpressions) {
      throw new Error(
        `Dialect '${this.name}' sets cantPartitionWindowFunctionsOnExpressions but does not implement sqlLateralJoinBag`
      );
    }
    throw new Error(
      'Internal error: sqlLateralJoinBag called but cantPartitionWindowFunctionsOnExpressions is false'
    );
  }

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

  // In most SQL dialects, column aliases defined in a SELECT clause are not
  // visible to other expressions in the same SELECT. However, some dialects
  // (e.g. Databricks/Spark) support "lateral column aliases", where an alias
  // can be referenced by later expressions in the same SELECT. This causes
  // problems when the compiler remaps the `group_set` column in a combine-
  // turtles stage: the alias shadows the input column, so CASE WHEN
  // group_set=N checks in aggregate expressions see the remapped value
  // instead of the original. When true, the compiler splits the group_set
  // remapping into a separate CTE to avoid shadowing.
  hasLateralColumnAliasInSelect = false;

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

  /**
   * Validate a user-supplied table-path string against this dialect's
   * table-path grammar. On success, returns the canonical SQL form that
   * should be embedded in `FROM` clauses (and stored in
   * `StructDef.tablePath`). On failure, returns an error message.
   *
   * # When implementing this for a new dialect
   *
   * **Don't override unless you have to.** The base implementation in
   * `Dialect` accepts a dotted identifier path where each segment is a
   * bare SQL identifier or a `q`-delimited quoted segment with `qq`
   * doubled-quote escape (where `q` is the dialect's
   * `identifierQuoteChar`). That's the right answer for every
   * dialect whose grammar matches the ANSI shape: Postgres, MySQL,
   * Snowflake, Trino, Databricks. Just set `identifierQuoteChar`,
   * `identifierEscapeStyle = Doubled`, and let the base do its thing.
   *
   * Override only when your dialect's table-path grammar is
   * genuinely different:
   *   - **BigQuery**: whole-path inside one set of backticks, with
   *     backslash-style escape and rejection of embedded backticks.
   *   - **DuckDB**: accepts arbitrary string-literal table names and
   *     file-path conveniences (globs, URLs). Uses a real peggy parser.
   *     **Do not look at DuckDB's implementation as a reference for
   *     a normal SQL dialect** — its grammar is intentionally richer
   *     than what ANSI SQL allows.
   *
   * # Contract
   *
   * Two callers:
   *  1. `ImportsAndTablesStep` calls this after connection dialects
   *     are resolved. Invalid paths are silently skipped (no
   *     schemaZone register, no needs-request); valid paths are
   *     registered under their canonical key. No error logging here
   *     — the source range ImportsAndTablesStep has is the whole
   *     `connection.table(...)` expression, not the path string
   *     itself.
   *  2. The AST step's `TableMethodSource.getSourceDef` calls this
   *     before looking up the schema. Invalid → log error at the
   *     path-string's source range (precise squiggle), return
   *     `ErrorFactory.structDef`. Valid → look up canonical key in
   *     `schemaZone`.
   *
   * The function MUST be deterministic — both callers compute the
   * same canonical form for the same input, so their schemaZone keys
   * agree without any shared state.
   *
   * The canonical form should be exactly the SQL fragment that gets
   * pasted into `FROM` (and `DESCRIBE` for schema fetch). For most
   * dialects this is identical to the user's input; the only reason
   * to differ is when the input is syntactic sugar for SQL that
   * looks different (e.g. DuckDB's file-path convenience wraps the
   * input in single quotes).
   */
  sqlValidateTableName(
    input: string
  ): {ok: true; canonical: string} | {ok: false; error: string} {
    if (this.identifierEscapeStyle !== EscapeStyle.Doubled) {
      throw new Error(
        `${this.name}: sqlValidateTableName base implementation only ` +
          `supports doubled-quote identifier escape. Override for other styles.`
      );
    }
    if (parseDottedIdentPathDoubled(input, this.identifierQuoteChar)) {
      return {ok: true, canonical: input};
    }
    return {
      ok: false,
      error:
        `Invalid ${this.name} table path: ${JSON.stringify(input)} — expected ` +
        `a dotted identifier path (each segment a bare identifier or ` +
        `${this.identifierQuoteChar}quoted${this.identifierQuoteChar}, ` +
        `with ${this.identifierQuoteChar}${this.identifierQuoteChar} to escape ` +
        `the quote character).`,
    };
  }

  // returns an table that is a 0 based array of numbers
  abstract sqlGroupSetTable(groupSetCount: number): string;

  // aggregate function that return the ANY NON NULL value encountered
  abstract sqlAnyValue(groupSet: number, fieldName: string): string;

  // can array agg or any_value a struct...
  abstract sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: CompiledOrderBy[] | undefined
  ): string;

  // Format a CompiledOrderBy[] into an ORDER BY clause string for use
  // inside an aggregate turtle expression. Dialects which support ORDER BY
  // inside aggregate functions can call this helper from sqlAggregateTurtle.
  sqlTurtleOrderByClause(orderBy: CompiledOrderBy[]): string {
    const terms = orderBy.map(o => ` ${o.field} ${o.dir.toUpperCase()}`);
    return ' ' + this.sqlOrderBy(terms, 'turtle');
  }

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
  /**
   * The character the dialect uses to quote identifiers. Most dialects
   * use ANSI double-quote `"`; MySQL, BigQuery and Databricks use the
   * backtick `` ` ``. The dialect must escape this character by doubling
   * inside a quoted identifier.
   *
   * Defaults to the empty string sentinel — concrete dialects must set
   * a real value (or override `sqlQuoteIdentifier`), otherwise the
   * base method throws to surface the omission immediately.
   */
  identifierQuoteChar = '';

  /**
   * How the dialect escapes the closing quote inside a string literal.
   * Set via `EscapeStyle` from this module:
   *
   * - `EscapeStyle.Doubled`: `''` escapes `'`. Backslash is a literal
   *   character. (ANSI standard; Postgres, DuckDB, Trino, Presto.)
   * - `EscapeStyle.Backslash`: `\'` escapes `'`, `\\` escapes `\`.
   *   (BigQuery, Snowflake, MySQL default mode, Databricks.)
   * - `EscapeStyle.Unset` (default): base methods throw if reached. A
   *   new dialect must set this (or override the literal methods).
   *
   * `sqlLiteralString` and `sqlLiteralRegexp` share this style — the
   * regex engine receives whatever the SQL parser decodes, and the two
   * must agree or regex patterns containing backslashes silently break.
   */
  stringLiteralStyle: EscapeStyleValue = EscapeStyle.Unset;

  /**
   * How the dialect escapes the quote character inside a quoted
   * identifier. Mirrors `stringLiteralStyle`:
   *
   * - `EscapeStyle.Doubled`: doubling the quote char escapes it (ANSI
   *   standard; most dialects).
   * - `EscapeStyle.Backslash`: backslash-style escape, with `\\` for
   *   backslash and `\<quote>` for the quote char. (BigQuery — quoted
   *   identifiers use string-literal escape sequences.)
   * - `EscapeStyle.Unset` (default): base method throws if reached.
   */
  identifierEscapeStyle: EscapeStyleValue = EscapeStyle.Unset;

  /**
   * Wrap an identifier in the dialect's quote character, escaping any
   * embedded quote characters per the dialect's `identifierEscapeStyle`.
   * This is the only safe way to render a user-controlled identifier
   * in SQL.
   */
  sqlQuoteIdentifier(identifier: string): string {
    const q = this.identifierQuoteChar;
    if (!q) {
      throw new Error(
        `${this.name}: identifierQuoteChar is not set. ` +
          'Set it on the dialect (e.g. \'"\' or "`"), ' +
          'or override sqlQuoteIdentifier.'
      );
    }
    if (this.identifierEscapeStyle === EscapeStyle.Doubled) {
      return q + identifier.split(q).join(q + q) + q;
    }
    if (this.identifierEscapeStyle === EscapeStyle.Backslash) {
      const escaped = identifier
        .replace(/\\/g, '\\\\')
        .split(q)
        .join('\\' + q);
      return q + escaped + q;
    }
    throw new Error(
      `${this.name}: identifierEscapeStyle is not set. ` +
        'Set it to EscapeStyle.Doubled or EscapeStyle.Backslash on the dialect, ' +
        'or override sqlQuoteIdentifier.'
    );
  }

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
  /**
   * Render a Malloy string as a SQL string literal. The escape style is
   * driven by `stringLiteralStyle`; dialects normally do not override
   * this method.
   */
  sqlLiteralString(literal: string): string {
    if (this.stringLiteralStyle === 'doubled') {
      return "'" + literal.split("'").join("''") + "'";
    }
    if (this.stringLiteralStyle === 'backslash') {
      const escaped = literal.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return "'" + escaped + "'";
    }
    throw new Error(
      `${this.name}: stringLiteralStyle is not set. ` +
        'Set it to EscapeStyle.Doubled or EscapeStyle.Backslash on the dialect, ' +
        'or override sqlLiteralString.'
    );
  }

  /**
   * Render a Malloy regex literal as a SQL string literal. Defaults to
   * `sqlLiteralString` — the regex engine receives whatever bytes the
   * SQL parser decodes, and `sqlLiteralString` already produces a
   * correctly decoding literal for both escape styles.
   */
  sqlLiteralRegexp(literal: string): string {
    return this.sqlLiteralString(literal);
  }
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
