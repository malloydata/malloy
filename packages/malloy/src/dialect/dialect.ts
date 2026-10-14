/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
  ExtractUnit,
} from '../model/malloy_types';
import {isRawCast, isBasicAtomic, TD, isDateUnit} from '../model/malloy_types';
import type {DialectFunctionOverloadDef} from './functions';
import type {ValidateTablePathResult} from './table-path';
import {validateDottedTablePath} from './table-path';

/**
 * One field of a struct, for the dialect methods which emit SQL over it.
 *
 * `typeDef` is the Malloy type, for the dialects which have to declare a SQL
 * type for the field -- the ROW and STRUCT types they build.  `sqlExpression`
 * is SQL producing the value, valid in the scope the consumer emits into.
 * `rawName` is the field's name with no quoting: a consumer needing it as an
 * identifier quotes it itself, because only the consumer knows whether it
 * wants an identifier or a string literal holding the name.
 */
interface DialectField {
  typeDef: AtomicTypeDef;
  sqlExpression: string;
  rawName: string;
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

/**
 * The two kinds of civil time: a calendar date, and a date with a time of
 * day. Neither has a zone.
 */
export const CivilTime = {
  Date: 'date',
  DateAndTime: 'date_and_time',
} as const;
export type CivilTime = (typeof CivilTime)[keyof typeof CivilTime];

/** Add or subtract `magnitude` units of time */
export interface TimeOffset {
  op: '+' | '-';
  magnitude: string;
  unit: TimestampUnit;
}

export type FieldReferenceType =
  'table' | 'nest source' | 'array[scalar]' | 'array[record]' | 'record';

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

/** The query time zone, or UTC when the query has none. */
export function queryZone(qi: QueryInfo): string {
  return qi.queryTimezone ?? 'UTC';
}

/**
 * The per-element condition for an aggregate turtle (sqlAggregateTurtle). On
 * the normal path it gates each row by its group_set (and a projection's own
 * `where:`). On the single-group-set fast path `groupSet` is `undefined` --
 * there is no group_set column, every row is in the one group -- so the
 * condition is just the `where:`, or `undefined` to include unconditionally.
 * Callers wrap the result in whatever form the dialect uses (`FILTER (WHERE
 * ...)`, `CASE WHEN ... THEN`, `IF(...)`).
 */
export function turtleGroupSetCondition(
  groupSet: number | undefined,
  filterSQL: string | undefined
): string | undefined {
  if (groupSet === undefined) {
    return filterSQL;
  }
  return filterSQL
    ? `group_set=${groupSet} AND ${filterSQL}`
    : `group_set=${groupSet}`;
}

export type OrderByClauseType = 'output_name' | 'ordinal' | 'expression';
export type GroupByClauseType = 'ordinal' | 'expression';
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

  /**
   * What the compiler consults, not `experimental` itself. The test harness
   * calls `acceptExperimental()` on the dialect under test so the shared
   * suites can run on an experimental dialect without every test enabling it.
   */
  private experimentalAccepted = false;
  isExperimental(): boolean {
    return this.experimental && !this.experimentalAccepted;
  }
  acceptExperimental(): void {
    this.experimentalAccepted = true;
  }

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

  // Can the dialect apply a `limit:` to a nested `select:` (a projection
  // nest)? A projection has no group-by keys to ROW_NUMBER-shave on, so the
  // limit is applied by limiting/slicing the aggregated array inside
  // `sqlAggregateTurtle`. Defaults false so a new dialect must consciously
  // opt in (and implement the slice) rather than silently dropping the limit;
  // the compiler rejects projection `limit:` when this is false.
  supportsNestedProjectionLimit = false;

  // Some dialects don't supporrt arrays (mysql)
  supportsArraysInData = true;

  // Does the dialect support timestamptz (TIMESTAMP WITH TIME ZONE)?
  hasTimestamptz = false;

  // can read some version of ga_sample
  readsNestedData = true;

  // ORDER BY 1 DESC
  orderByClause: OrderByClauseType = 'ordinal';

  // GROUP BY 1, or GROUP BY the dimension expressions for an engine whose
  // GROUP BY takes no ordinals
  groupByClause: GroupByClauseType = 'ordinal';

  /** The ordering and row limit which end a SELECT stage */
  sqlOrderByLimit(orderTerms: string[], limit: number | undefined): string {
    let s =
      orderTerms.length > 0 ? this.sqlOrderBy(orderTerms, 'query') + '\n' : '';
    if (limit !== undefined) {
      s += `LIMIT ${limit}\n`;
    }
    return s;
  }

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
  // Characters LIKE reads as wildcards beyond % and _, escaped like them
  likeExtraWildcards: string[] = [];

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
   * Regex matching one bare (unquoted) table-path segment for this
   * dialect, anchored at the start of the input. Drives the default
   * `sqlValidateTableName` along with `identifierQuoteChar` and
   * `identifierEscapeStyle`.
   *
   * The default is strict ANSI: `[A-Za-z_][A-Za-z0-9_]*`. Override to
   * widen the char set (Postgres allows `$`, MySQL allows digit-start
   * with caveats, BigQuery allows dashes, …). The per-dialect regexes
   * were verified by probing live engines.
   */
  tablePathBareIdentRegex: RegExp = /^[A-Za-z_][A-Za-z0-9_]*/;

  /**
   * Validate a user-supplied table-path string for this dialect. On
   * success, the canonical form is the SQL fragment that gets pasted
   * into `FROM` clauses and stored in `StructDef.tablePath`. Canonical
   * equals input verbatim except where a Malloy convenience needs
   * translating into dialect SQL (today: DuckDB's file-path branch
   * wraps the input in single quotes).
   *
   * The default implementation handles every dialect whose table-path
   * grammar is a dotted sequence of `bare | quoted` segments — every
   * dialect we ship except DuckDB. New dialects of that shape need
   * only override `tablePathBareIdentRegex`; override
   * `sqlValidateTableName` itself only if your grammar is structurally
   * different.
   */
  sqlValidateTableName(input: string): ValidateTablePathResult {
    if (
      this.identifierEscapeStyle !== EscapeStyle.Doubled &&
      this.identifierEscapeStyle !== EscapeStyle.Backslash
    ) {
      throw new Error(
        `${this.name}: sqlValidateTableName requires identifierEscapeStyle ` +
          'to be set to Doubled or Backslash (or override sqlValidateTableName).'
      );
    }
    return validateDottedTablePath(input, {
      quoteChar: this.identifierQuoteChar,
      escapeStyle: this.identifierEscapeStyle,
      bareIdentRegex: this.tablePathBareIdentRegex,
      dialectName: this.name,
    });
  }

  // returns an table that is a 0 based array of numbers
  abstract sqlGroupSetTable(groupSetCount: number): string;

  // aggregate function that return the ANY NON NULL value encountered
  abstract sqlAnyValue(groupSet: number, fieldName: string): string;

  // can array agg or any_value a struct...
  // `limit`, when set, is a projection nest's row limit applied by slicing the
  // aggregated array (a projection has no group-by keys to ROW_NUMBER-shave on).
  // `filterSQL`, when set, is a projection nest's `where:` as a boolean SQL
  // expression; it folds into the per-element group_set condition (a projection
  // rides its enclosing group_set, so a scan-level WHERE can't isolate it).
  // `groupSet` is `undefined` on the single-group-set fast path: there is no
  // group_set column to filter on (every row is in the one group), so the
  // array-agg omits its `FILTER (WHERE group_set=N)` and keeps only a
  // projection's own `where:` (filterSQL), if any.
  abstract sqlAggregateTurtle(
    groupSet: number | undefined,
    fieldList: DialectFieldList,
    orderBy: CompiledOrderBy[] | undefined,
    limit?: number,
    filterSQL?: string
  ): string;

  // Format a CompiledOrderBy[] into an ORDER BY clause string for use
  // inside an aggregate turtle expression. Dialects which support ORDER BY
  // inside aggregate functions can call this helper from sqlAggregateTurtle.
  sqlTurtleOrderByClause(orderBy: CompiledOrderBy[]): string {
    const terms = orderBy.map(o => ` ${o.field} ${o.dir.toUpperCase()}`);
    return ' ' + this.sqlOrderBy(terms, 'turtle');
  }

  // Format the ordering of the last stage of a nest's pipeline into an ORDER BY
  // clause for the aggregate which packs that stage's rows into an array. An
  // ordinal names an output field by number, counting from one; the field list
  // is a zero-based array.
  sqlCombineLastStageOrderBy(
    orderBy: OrderBy[] | undefined,
    fieldList: DialectFieldList
  ): string {
    if (orderBy === undefined || orderBy.length === 0) {
      return '';
    }
    const terms = orderBy.map(o => {
      const name =
        typeof o.field === 'string' ? o.field : fieldList[o.field - 1].rawName;
      return `${this.sqlQuoteIdentifier(name)} ${o.dir || 'asc'}`;
    });
    return ` ORDER BY ${terms.join(', ')}`;
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
   * Escape the body of a backslash-style quoted token (`EscapeStyle.Backslash`
   * dialects) — the backslash, the closing `delim`, and newline/CR/tab. The
   * newline matters: BigQuery rejects a raw one ("Unclosed string literal").
   * `\0` / U+2028 / U+2029 are passed through (no evidence they break a lexer).
   */
  protected escapeBackslashStyle(body: string, delim: string): string {
    let out = '';
    for (const ch of body) {
      switch (ch) {
        case '\\':
          out += '\\\\';
          break;
        case '\n':
          out += '\\n';
          break;
        case '\r':
          out += '\\r';
          break;
        case '\t':
          out += '\\t';
          break;
        case delim:
          out += '\\' + delim;
          break;
        default:
          out += ch;
      }
    }
    return out;
  }

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
      return q + this.escapeBackslashStyle(identifier, q) + q;
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
  abstract sqlMeasureTimeExpr(e: MeasureTimeExpr): string;
  /**
   * Generate SQL for a cast. Casts between date, timestamp and timestamptz
   * never reach here; they are made by sqlTimeCast.
   */
  abstract sqlCast(qi: QueryInfo, cast: TypecastExpr): string;
  abstract sqlRegexpMatch(df: RegexMatchExpr): string;

  /*
   * Time
   *
   * A timestamp and a timestamptz are both instants. They differ only in the
   * SQL type which holds them, so comparing them, measuring between them, or
   * casting one to the other never changes the instant.
   *
   * Reading an instant as a date and a time of day -- extracting an hour,
   * truncating to a day, adding a month, casting to a date -- needs a zone:
   * the query time zone, or UTC when the query has none. An offset of hours,
   * minutes or seconds with no truncation is instant arithmetic, which is the
   * same thing as civil time arithmetic in UTC.
   *
   * Every one of these operations has the same shape. Convert the instant to
   * civil time in the zone, operate on the civil time, and when the answer
   * is an instant, convert back from the same zone. The methods below do
   * that, and a dialect supplies the pieces, which obey the civil contract:
   *
   * - Civil time is a date, or a date and a time of day, with no zone. The
   *   dialect picks the SQL type which holds each kind of CivilTime.
   * - The operations on civil time -- sqlTruncate, sqlOffsetTime,
   *   sqlCivilExtract, sqlCivilToDate and sqlDateToCivil -- are arithmetic
   *   on its fields. They never consult a zone, so daylight saving cannot
   *   reach them: a day after 01:30 is 01:30.
   * - sqlConvertToCivilTime and sqlConvertFromCivilTime are the only places a
   *   zone is consulted. Converting from civil time is where a time of day
   *   which the zone skips or repeats gets resolved to one instant.
   * - A conversion with nothing to do returns its input unchanged. Whether
   *   there is anything to do depends on both the SQL type of the time and
   *   the zone, so the conversion decides, not its caller.
   *
   * A dialect which cannot meet the contract overrides sqlTimeExtractExpr,
   * sqlTruncAndOffset, sqlTimeCast and sqlTimestampLiteral instead, and
   * nothing calls its pieces.
   */

  /** The civil time which `timezone` shows at the instant `expr`. */
  abstract sqlConvertToCivilTime(
    expr: string,
    timezone: string,
    typeDef: ATimestampTypeDef
  ): string;

  /**
   * The instant at which `timezone` shows the civil time `expr`, as a
   * value of `destTypeDef`.
   */
  abstract sqlConvertFromCivilTime(
    expr: string,
    timezone: string,
    destTypeDef: ATimestampTypeDef
  ): string;

  /** The start of the unit containing `expr`. A week starts on Sunday. */
  abstract sqlTruncate(
    expr: string,
    unit: TimestampUnit,
    civilType: CivilTime
  ): string;

  abstract sqlOffsetTime(
    expr: string,
    op: '+' | '-',
    magnitude: string,
    unit: TimestampUnit,
    civilType: CivilTime
  ): string;

  /** One field of `expr`. A day_of_week counts from 1 on Sunday. */
  abstract sqlCivilExtract(
    expr: string,
    units: ExtractUnit,
    civilType: CivilTime
  ): string;

  /** The date part of the civil time `expr`. */
  abstract sqlCivilToDate(expr: string): string;

  /** Midnight at the start of the date `expr`, as civil time. */
  abstract sqlDateToCivil(expr: string): string;

  /** The civil time written as `literal`, 'YYYY-MM-DD HH:MM:SS'. */
  abstract sqlCivilLiteral(literal: string): string;

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const time = from.e;
    if (TD.isAnyTimestamp(time.typeDef)) {
      const civil = this.sqlConvertToCivilTime(
        time.sql!,
        queryZone(qi),
        time.typeDef
      );
      return this.sqlCivilExtract(civil, from.units, CivilTime.DateAndTime);
    }
    return this.sqlCivilExtract(time.sql!, from.units, CivilTime.Date);
  }

  /**
   * Truncation and/or offset, the offset applied after the truncation.
   * Doing both in one pass converts to and from civil time only once.
   */
  sqlTruncAndOffset(
    baseExpr: TimeExpr,
    qi: QueryInfo,
    truncateTo?: TimestampUnit,
    offset?: TimeOffset
  ): string {
    const timeType = baseExpr.typeDef;
    if (!TD.isAnyTimestamp(timeType)) {
      return this.civilTruncAndOffset(
        baseExpr.sql!,
        CivilTime.Date,
        truncateTo,
        offset
      );
    }
    const usesQueryZone =
      truncateTo !== undefined ||
      (offset !== undefined && isDateUnit(offset.unit));
    const zone = usesQueryZone ? queryZone(qi) : 'UTC';
    const civil = this.sqlConvertToCivilTime(baseExpr.sql!, zone, timeType);
    return this.sqlConvertFromCivilTime(
      this.civilTruncAndOffset(
        civil,
        CivilTime.DateAndTime,
        truncateTo,
        offset
      ),
      zone,
      timeType
    );
  }

  private civilTruncAndOffset(
    expr: string,
    civilType: CivilTime,
    truncateTo?: TimestampUnit,
    offset?: TimeOffset
  ): string {
    let sql = expr;
    if (truncateTo) {
      sql = this.sqlTruncate(sql, truncateTo, civilType);
    }
    if (offset) {
      sql = this.sqlOffsetTime(
        sql,
        offset.op,
        offset.magnitude,
        offset.unit,
        civilType
      );
    }
    return sql;
  }

  /**
   * A cast between date, timestamp and timestamptz, or undefined for any
   * other cast.
   */
  sqlTimeCast(qi: QueryInfo, cast: TypecastExpr): string | undefined {
    const {srcTypeDef, dstTypeDef} = this.sqlCastPrep(cast);
    const expr = cast.e.sql ?? '';
    if (TD.isAnyTimestamp(srcTypeDef)) {
      if (TD.isDate(dstTypeDef)) {
        return this.sqlCivilToDate(
          this.sqlConvertToCivilTime(expr, queryZone(qi), srcTypeDef)
        );
      }
      if (
        TD.isAnyTimestamp(dstTypeDef) &&
        dstTypeDef.type !== srcTypeDef.type
      ) {
        // The same instant in another SQL type. A round trip through civil
        // time in any zone keeps the instant; UTC costs the least.
        return this.sqlConvertFromCivilTime(
          this.sqlConvertToCivilTime(expr, 'UTC', srcTypeDef),
          'UTC',
          dstTypeDef
        );
      }
    }
    if (TD.isDate(srcTypeDef) && TD.isAnyTimestamp(dstTypeDef)) {
      return this.sqlConvertFromCivilTime(
        this.sqlDateToCivil(expr),
        queryZone(qi),
        dstTypeDef
      );
    }
    return undefined;
  }

  /**
   * Generate SQL for a DATE literal.
   * @param literal - The date string in format 'YYYY-MM-DD'
   * @returns SQL that produces a DATE value
   */
  abstract sqlDateLiteral(qi: QueryInfo, literal: string): string;

  /**
   * The timestamp at which `timezone`, or the query time zone when there is
   * none, shows the civil time `literal`.
   */
  sqlTimestampLiteral(
    qi: QueryInfo,
    literal: string,
    timezone: string | undefined
  ): string {
    return this.sqlConvertFromCivilTime(
      this.sqlCivilLiteral(literal),
      timezone ?? queryZone(qi),
      {type: 'timestamp'}
    );
  }

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
   * Reject characters that can break SQL literals or
   * be changed by SQL formatting. Timezone-name validity belongs to the
   * database, whose formats may include offsets and POSIX TZ strings.
   * Static so the translator can apply the same rule before dialect resolution.
   */
  static isSafeTimezoneName(timezone: string): boolean {
    return !/['"`\\\r\n]/.test(timezone);
  }

  /** Return an unquoted timezone for inclusion in a larger SQL literal. */
  protected checkedTimezoneName(timezone: string): string {
    if (!Dialect.isSafeTimezoneName(timezone)) {
      throw new Error(
        `Invalid timezone ${JSON.stringify(timezone)}: quotes, backslashes, and line breaks are not allowed`
      );
    }
    return timezone;
  }

  sqlTimezoneLiteral(timezone: string): string {
    return `'${this.checkedTimezoneName(timezone)}'`;
  }

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
      return "'" + this.escapeBackslashStyle(literal, "'") + "'";
    }
    throw new Error(
      `${this.name}: stringLiteralStyle is not set. ` +
        'Set it to EscapeStyle.Doubled or EscapeStyle.Backslash on the dialect, ' +
        'or override sqlLiteralString.'
    );
  }

  /**
   * Render a Malloy regex literal. Defaults to `sqlLiteralString`: the regex
   * engine receives whatever the SQL parser decodes, which is already correct.
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
        return this.sqlTimeCast(qi, df) ?? this.sqlCast(qi, df);
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

  // onBaseTable: the source is a table the engine can sample in place; a
  // dialect whose sampling reads the table itself ignores a sample elsewhere
  sqlSampleTable(
    tableSQL: string,
    sample: Sampling | undefined,
    _onBaseTable = true
  ): string {
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
      } else if (this.likeEscape && this.likeExtraWildcards.includes(c)) {
        escaped += '^' + c;
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
