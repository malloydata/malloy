/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Sampling,
  AtomicTypeDef,
  ATimestampTypeDef,
  TypecastExpr,
  MeasureTimeExpr,
  BasicAtomicTypeDef,
  RegexMatchExpr,
  TimeExtractExpr,
  TimestampUnit,
  OrderBy,
} from '../../model/malloy_types';
import {
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  TD,
} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandOverrideMap, expandBlueprintMap} from '../functions';
import type {
  BooleanTypeSupport,
  DialectFieldList,
  FieldReferenceType,
  GroupByClauseType,
  LimitClauseType,
  QueryInfo,
} from '../dialect';
import {Dialect, EscapeStyle, qtz} from '../dialect';
import type {ValidateTablePathResult} from '../table-path';
import {SQLSERVER_DIALECT_FUNCTIONS} from './dialect_functions';
import {SQLSERVER_MALLOY_STANDARD_OVERLOADS} from './function_overrides';
import {WINDOWS_TIME_ZONES} from './windows_zones';

/** DATEPART / DATEADD / DATEDIFF spellings of Malloy's units */
const datePartMap: Record<string, string> = {
  second: 'second',
  minute: 'minute',
  hour: 'hour',
  day: 'day',
  week: 'week',
  month: 'month',
  quarter: 'quarter',
  year: 'year',
  day_of_year: 'dayofyear',
};

const inSeconds: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 24 * 3600,
  week: 7 * 24 * 3600,
};

// Type names as sys.types and sys.dm_exec_describe_first_result_set report
// them. DECIMAL and NUMERIC are decided by their parameters.
const sqlServerToMalloyTypes: {[key: string]: BasicAtomicTypeDef} = {
  'bit': {type: 'boolean'},
  'tinyint': {type: 'number', numberType: 'integer'},
  'smallint': {type: 'number', numberType: 'integer'},
  'int': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'bigint'},
  'real': {type: 'number', numberType: 'float'},
  'float': {type: 'number', numberType: 'float'},
  'money': {type: 'number', numberType: 'float'},
  'smallmoney': {type: 'number', numberType: 'float'},
  'char': {type: 'string'},
  'varchar': {type: 'string'},
  'nchar': {type: 'string'},
  'nvarchar': {type: 'string'},
  // text and ntext take no GROUP BY, MAX or comparison, so they stay native
  // uniqueidentifier stays native: a GUID is neither text nor a number to Malloy
  'date': {type: 'date'},
  'datetime': {type: 'timestamp'},
  'datetime2': {type: 'timestamp'},
  'smalldatetime': {type: 'timestamp'},
};

function parseSQLServerType(sqlType: string): {base: string; params: number[]} {
  const text = sqlType.trim().toLowerCase();
  const base = text.match(/^\w+/)?.[0] ?? text;
  const params = text.match(/^\w+\s*\((\d+(?:\s*,\s*\d+)*)\)/);
  return {
    base,
    params: params ? params[1].split(',').map(p => parseInt(p, 10)) : [],
  };
}

/**
 * SQL Server 2017 and later, and Azure SQL Database. A Malloy timestamp is a
 * UTC wall clock, so a `datetime2` is read as UTC and `now` is
 * `SYSUTCDATETIME()`.
 */
export class SQLServerDialect extends Dialect {
  name = 'sqlserver';
  experimental = true;

  // QUOTED_IDENTIFIER is on for every driver connection, so "name" is an
  // identifier and 'text' a literal, each escaped by doubling.
  stringLiteralStyle = EscapeStyle.Doubled;
  identifierEscapeStyle = EscapeStyle.Doubled;
  identifierQuoteChar = '"';

  defaultNumberType = 'FLOAT(53)';
  defaultDecimalType = 'DECIMAL(38, 9)';
  udfPrefix = '__udf';
  hasFinalStage = false;
  divisionIsInteger = true;
  supportsSumDistinctFunction = true;
  unnestWithNumbers = false;
  defaultSampling = {rows: 50000};
  supportUnnestArrayAgg = false;
  supportsAggDistinct = false;
  // A CTE is a statement prefix and cannot appear inside a subquery.
  supportsCTEinCoorelatedSubQueries = false;
  dontUnionIndex = false;
  supportsQualify = false;
  supportsSafeCast = true;
  supportsNesting = false;
  supportsPipelinesInViews = false;
  supportsFullJoin = true;
  readsNestedData = false;
  supportsComplexFilteredSources = false;
  supportsArraysInData = false;
  compoundObjectInSchema = false;
  supportsSelectReplace = false;
  supportsTempTables = false;
  // A comparison is legal only where a condition is expected; a `bit` only
  // where a value is.
  booleanType: BooleanTypeSupport = 'none';
  hasTimestamptz = false;
  // A bigint arrives from the driver as text and is read as a JavaScript number
  supportsBigIntPrecision = false;
  maxIdentifierLength = 128;
  likeEscape = true;
  likeExtraWildcards = ['['];
  groupByClause: GroupByClauseType = 'expression';
  limitClause: LimitClauseType = 'top';
  subqueryOrderByRequiresLimit = true;

  // A leading `#` or `@` names a temp table or a variable, not a table.
  override tablePathBareIdentRegex = /^[A-Za-z_][A-Za-z0-9_$#@]*/;

  /**
   * `[schema].[table]` is read as the ANSI-quoted path it stands for (`]]`
   * escapes `]`), and the canonical form is the ANSI spelling.
   */
  sqlValidateTableName(input: string): ValidateTablePathResult {
    let ansi = '';
    let i = 0;
    while (i < input.length) {
      const c = input[i];
      if (c === '"') {
        let j = i + 1;
        while (j < input.length) {
          if (input[j] === '"') {
            if (input[j + 1] === '"') {
              j += 2;
              continue;
            }
            break;
          }
          j++;
        }
        ansi += input.slice(i, j + 1);
        i = j + 1;
      } else if (c === '[') {
        let body = '';
        let j = i + 1;
        let closed = false;
        while (j < input.length) {
          if (input[j] === ']') {
            if (input[j + 1] === ']') {
              body += ']';
              j += 2;
              continue;
            }
            closed = true;
            break;
          }
          body += input[j];
          j++;
        }
        if (!closed) {
          return {
            ok: false,
            error: `Invalid ${this.name} table path: ${JSON.stringify(input)} — unterminated bracketed segment`,
          };
        }
        ansi += this.sqlQuoteIdentifier(body);
        i = j + 1;
      } else {
        ansi += c;
        i++;
      }
    }
    return super.sqlValidateTableName(ansi);
  }

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    switch (malloyType.type) {
      case 'number':
        if (malloyType.numberType === 'integer') {
          return 'INT';
        } else if (malloyType.numberType === 'bigint') {
          return 'BIGINT';
        }
        return this.defaultNumberType;
      case 'string':
        return 'NVARCHAR(MAX)';
      case 'boolean':
        return 'BIT';
      case 'date':
        return 'DATE';
      case 'timestamp':
        return 'DATETIME2';
      case 'record':
      case 'array':
        return 'NVARCHAR(MAX)';
      default:
        return malloyType.type;
    }
  }

  sqlTypeToMalloyType(sqlType: string): BasicAtomicTypeDef {
    const {base, params} = parseSQLServerType(sqlType);
    if (base === 'decimal' || base === 'numeric') {
      // Scale decides float vs exact; precision decides whether an exact
      // value survives a JS double. A bare DECIMAL is (18, 0).
      const [precision, scale] = [params[0] ?? 18, params[1] ?? 0];
      if (scale > 0) {
        return {type: 'number', numberType: 'float'};
      }
      return {
        type: 'number',
        numberType: precision <= 15 ? 'integer' : 'bigint',
      };
    }
    return (
      sqlServerToMalloyTypes[base] ?? {
        type: 'sql native',
        rawType: base,
      }
    );
  }

  validateTypeName(sqlType: string): boolean {
    // Letters:              BIGINT
    // Numbers:              FLOAT(53)
    // Spaces,
    // Parentheses, Commas:  DECIMAL(5, 2)
    return sqlType.match(/^[A-Za-z\s(),0-9]*$/) !== null;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    const rows = Array.from({length: groupSetCount + 1}, (_, i) => `(${i})`);
    return `CROSS JOIN (VALUES ${rows.join(',')}) AS group_set(group_set)`;
  }

  sqlAnyValue(_groupSet: number, fieldName: string): string {
    return `MAX(${fieldName})`;
  }

  // Nests, arrays and records are not supported: supportsNesting,
  // supportsArraysInData and compoundObjectInSchema are false. A call here
  // comes from a literal, a source the translator let through, or an
  // ungrouped aggregate (all(), exclude()), which shares the nest machinery.
  sqlAggregateTurtle(): string {
    return this.unsupported('nesting');
  }

  sqlAnyValueTurtle(): string {
    return this.unsupported('nesting');
  }

  sqlAnyValueLastTurtle(): string {
    return this.unsupported('nesting');
  }

  sqlCoaleseMeasuresInline(): string {
    return this.unsupported('nesting');
  }

  sqlUnnestAlias(): string {
    return this.unsupported('arrays');
  }

  sqlSelectAliasAsStruct(): string {
    return this.unsupported('records');
  }

  sqlLiteralRecord(): string {
    return this.unsupported('record literals');
  }

  sqlLiteralArray(): string {
    return this.unsupported('array literals');
  }

  sqlFieldReference(
    parentAlias: string,
    _parentType: FieldReferenceType,
    childName: string,
    _childType: string
  ): string {
    return `${parentAlias}.${this.sqlQuoteIdentifier(childName)}`;
  }

  private unsupported(what: string): never {
    throw new Error(`SQL Server dialect does not support ${what}`);
  }

  sqlUnnestPipelineHead(
    _isSingleton: boolean,
    _sourceSQLExpression: string,
    _fieldList?: DialectFieldList
  ): string {
    return this.unsupported('a nested pipeline');
  }

  sqlCreateFunction(_id: string, _funcText: string): string {
    return this.unsupported('a nested pipeline');
  }

  sqlCreateFunctionCombineLastStage(
    _lastStageName: string,
    _fieldList: DialectFieldList,
    _orderBy: OrderBy[] | undefined
  ): string {
    return this.unsupported('a nested pipeline');
  }

  sqlCreateTableAsSelect(tableName: string, sql: string): string {
    return `SELECT * INTO ${tableName} FROM (\n${sql}\n) AS __malloy_ctas`;
  }

  // The row key a symmetric aggregate is keyed on: NEWID() is evaluated again
  // for every joined row and double-counts, a row number is one per source row
  sqlGenerateUUID(): string {
    return 'ROW_NUMBER() OVER (ORDER BY (SELECT NULL))';
  }

  // A stage's SQL is indented when it becomes a CTE, which would indent the
  // text of a literal spanning lines.
  sqlLiteralString(literal: string): string {
    // N'...' is Unicode; a bare '...' is read in the database's code page
    if (!/[\r\n]/.test(literal)) {
      return `N${super.sqlLiteralString(literal)}`;
    }
    const parts = literal
      .split(/(\r|\n)/)
      .filter(p => p !== '')
      .map(p =>
        p === '\r'
          ? 'CHAR(13)'
          : p === '\n'
            ? 'CHAR(10)'
            : `N${super.sqlLiteralString(p)}`
      );
    return `(${parts.join(' + ')})`;
  }

  // The MD5 of the key as a 64-bit integer, widened so that hash + value is
  // exact at the value's scale.
  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    return `CAST(CAST(HASHBYTES('MD5', CAST(${sqlDistinctKey} AS NVARCHAR(MAX))) AS BIGINT) AS ${this.defaultDecimalType})`;
  }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    const hashKey = this.sqlSumDistinctHashedKey(key);
    const v = `CAST(COALESCE(${value}, 0) AS ${this.defaultDecimalType})`;
    const sqlSum = `CAST((SUM(DISTINCT ${hashKey} + ${v}) - SUM(DISTINCT ${hashKey})) AS ${this.defaultNumberType})`;
    if (funcName === 'SUM') {
      return sqlSum;
    } else if (funcName === 'AVG') {
      return `(${sqlSum})/NULLIF(COUNT(DISTINCT CASE WHEN ${value} IS NOT NULL THEN ${key} END), 0)`;
    }
    throw new Error(`Unknown Symmetric Aggregate function ${funcName}`);
  }

  sqlAggDistinct(
    _key: string,
    _values: string[],
    _func: (valNames: string[]) => string
  ): string {
    return this.unsupported('distinct aggregates');
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      // The first n rows, not a random sample: TABLESAMPLE ROWS returns whole
      // pages, not the number of rows asked for
      if (isSamplingRows(sample)) {
        return `(SELECT TOP ${sample.rows} * FROM ${tableSQL})`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} TABLESAMPLE (${sample.percent} PERCENT))`;
      }
    }
    return tableSQL;
  }

  castToString(expression: string): string {
    return `CAST(${expression} AS NVARCHAR(MAX))`;
  }

  concat(...values: string[]): string {
    return `CONCAT(${values.join(', ')})`;
  }

  sqlDateToString(sqlDateExp: string): string {
    return `CONVERT(NVARCHAR(10), ${sqlDateExp}, 23)`;
  }

  sqlNowExpr(): string {
    return 'SYSUTCDATETIME()';
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    let extractFrom = from.e.sql;
    if (TD.isAnyTimestamp(from.e.typeDef)) {
      const tz = qtz(qi);
      if (tz) {
        extractFrom = this.sqlConvertToCivilTime(
          extractFrom ?? '',
          tz,
          from.e.typeDef
        ).sql;
      }
    }
    if (from.units === 'day_of_week') {
      // Days since a Sunday, so the answer does not follow DATEFIRST
      return `((DATEDIFF(day, '19000107', ${extractFrom}) % 7 + 7) % 7 + 1)`;
    }
    // Malloy's week of the year is the ISO week; DATEPART(week) counts from
    // January 1st and follows DATEFIRST
    const part = from.units === 'week' ? 'iso_week' : datePartMap[from.units];
    if (part === undefined) {
      throw new Error(`Unknown SQL Server date part '${from.units}'`);
    }
    return `DATEPART(${part}, ${extractFrom})`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    const expr = cast.e.sql || '';
    const {srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    const tz = qtz(qi);
    if (tz && srcTypeDef && dstTypeDef) {
      if (TD.isTimestamp(srcTypeDef) && TD.isDate(dstTypeDef)) {
        const civil = this.sqlConvertToCivilTime(expr, tz, srcTypeDef).sql;
        return `CAST(${civil} AS DATE)`;
      }
      if (TD.isDate(srcTypeDef) && TD.isTimestamp(dstTypeDef)) {
        return this.sqlConvertFromCivilTime(
          `CAST(${expr} AS DATETIME2)`,
          tz,
          dstTypeDef
        );
      }
    }
    if (!TD.eq(srcTypeDef, dstTypeDef)) {
      const castFunc = cast.safe ? 'TRY_CAST' : 'CAST';
      return `${castFunc}(${expr} AS ${dstSQLType})`;
    }
    return expr;
  }

  sqlRegexpMatch(_df: RegexMatchExpr): string {
    return this.unsupported('regular expressions before SQL Server 2025');
  }

  sqlDateLiteral(_qi: QueryInfo, literal: string): string {
    return `CAST('${literal}' AS DATE)`;
  }

  sqlTimestampLiteral(
    qi: QueryInfo,
    literal: string,
    timezone: string | undefined
  ): string {
    const tz = timezone || qtz(qi);
    const ts = `CAST('${literal}' AS DATETIME2)`;
    if (tz) {
      return this.sqlConvertFromCivilTime(ts, tz, {type: 'timestamp'});
    }
    return ts;
  }

  sqlTimestamptzLiteral(
    _qi: QueryInfo,
    _literal: string,
    _timezone: string
  ): string {
    throw new Error('SQL Server dialect does not support timestamptz');
  }

  // AT TIME ZONE takes a Windows time zone name
  sqlTimezoneLiteral(timezone: string): string {
    const windowsName = WINDOWS_TIME_ZONES[timezone];
    if (windowsName === undefined) {
      throw new Error(
        `SQL Server dialect has no Windows time zone for '${timezone}'`
      );
    }
    return this.sqlLiteralString(windowsName);
  }

  sqlConvertToCivilTime(
    expr: string,
    timezone: string,
    _typeDef: AtomicTypeDef
  ): {sql: string; typeDef: AtomicTypeDef} {
    if (timezone === 'UTC') {
      return {sql: expr, typeDef: {type: 'timestamp'}};
    }
    const tz = this.sqlTimezoneLiteral(timezone);
    return {
      sql: `CAST((${expr} AT TIME ZONE 'UTC') AT TIME ZONE ${tz} AS DATETIME2)`,
      typeDef: {type: 'timestamp'},
    };
  }

  sqlConvertFromCivilTime(
    expr: string,
    timezone: string,
    _destTypeDef: ATimestampTypeDef
  ): string {
    if (timezone === 'UTC') {
      return expr;
    }
    const tz = this.sqlTimezoneLiteral(timezone);
    return `CAST((${expr} AT TIME ZONE ${tz}) AT TIME ZONE 'UTC' AS DATETIME2)`;
  }

  sqlTruncate(
    expr: string,
    unit: TimestampUnit,
    typeDef: AtomicTypeDef,
    _inCivilTime: boolean,
    _timezone?: string
  ): string {
    // Truncation is DATEADD of the whole units since an anchor: 1900-01-01
    // for a calendar unit, the value's own midnight for a clock unit, so the
    // count fits an int. SQL Server 2017 has no DATETRUNC.
    const midnight = `CAST(CAST(${expr} AS DATE) AS DATETIME2)`;
    if (unit === 'week') {
      // Malloy weeks start on Sunday whatever DATEFIRST says, so count days
      // from a known Sunday.
      const day = TD.isDate(typeDef) ? expr : midnight;
      return `DATEADD(day, -((DATEDIFF(day, '19000107', ${expr}) % 7 + 7) % 7), ${day})`;
    }
    const part = datePartMap[unit];
    if (part === undefined) {
      throw new Error(`Unknown SQL Server date part '${unit}'`);
    }
    if (unit === 'day' && !TD.isDate(typeDef)) {
      return midnight;
    }
    if (unit === 'hour' || unit === 'minute' || unit === 'second') {
      return `DATEADD(${part}, DATEDIFF(${part}, ${midnight}, ${expr}), ${midnight})`;
    }
    const truncated = `DATEADD(${part}, DATEDIFF(${part}, '19000101', ${expr}), '19000101')`;
    return TD.isDate(typeDef)
      ? `CAST(${truncated} AS DATE)`
      : `CAST(${truncated} AS DATETIME2)`;
  }

  sqlOffsetTime(
    expr: string,
    op: '+' | '-',
    magnitude: string,
    unit: TimestampUnit,
    _typeDef: AtomicTypeDef,
    _inCivilTime: boolean,
    _timezone?: string
  ): string {
    const part = datePartMap[unit];
    if (part === undefined) {
      throw new Error(`Unknown SQL Server date part '${unit}'`);
    }
    const n = op === '-' ? `-(${magnitude})` : `(${magnitude})`;
    return `DATEADD(${part}, ${n}, ${expr})`;
  }

  // Malloy measures a range in whole units completed, truncated toward zero;
  // DATEDIFF counts boundaries crossed.
  sqlMeasureTimeExpr(df: MeasureTimeExpr): string {
    const from = df.kids.left;
    const to = df.kids.right;
    const lVal = from.sql;
    const rVal = to.sql;
    if (
      TD.isDate(from.typeDef) &&
      TD.isDate(to.typeDef) &&
      ['week', 'month', 'quarter', 'year'].includes(df.units)
    ) {
      // Integer division truncates toward zero, as Malloy measures
      if (df.units === 'week') {
        return `(DATEDIFF(day, ${lVal}, ${rVal}) / 7)`;
      }
      const earlier = `(CASE WHEN ${rVal} >= ${lVal} THEN ${lVal} ELSE ${rVal} END)`;
      const later = `(CASE WHEN ${rVal} >= ${lVal} THEN ${rVal} ELSE ${lVal} END)`;
      const months = `(DATEDIFF(month, ${earlier}, ${later}) - CASE WHEN DAY(${later}) < DAY(${earlier}) THEN 1 ELSE 0 END)`;
      const measured =
        df.units === 'month'
          ? months
          : df.units === 'quarter'
            ? `(${months} / 3)`
            : `(${months} / 12)`;
      return `CASE
        WHEN ${lVal} IS NULL OR ${rVal} IS NULL THEN NULL
        WHEN ${rVal} >= ${lVal} THEN ${measured}
        ELSE -(${measured})
      END`;
    }
    if (inSeconds[df.units]) {
      const ms = `DATEDIFF_BIG(millisecond, ${lVal}, ${rVal})`;
      const divisor = inSeconds[df.units] * 1000;
      return `CAST(${ms} / ${divisor} AS BIGINT)`;
    }
    throw new Error(`Unknown or unhandled SQL Server time unit: ${df.units}`);
  }

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(SQLSERVER_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(SQLSERVER_DIALECT_FUNCTIONS);
  }
}
