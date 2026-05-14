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

import {indent} from '../../model/utils';
import type {
  Sampling,
  AtomicTypeDef,
  TimeExtractExpr,
  TypecastExpr,
  RegexMatchExpr,
  MeasureTimeExpr,
  BasicAtomicTypeDef,
  RecordLiteralNode,
  ArrayLiteralNode,
  TimestampUnit,
  TimestampTypeDef,
} from '../../model/malloy_types';
import {
  isAtomic,
  isRepeatedRecord,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  TD,
} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandOverrideMap, expandBlueprintMap} from '../functions';
import type {
  CompiledOrderBy,
  DialectFieldList,
  IntegerTypeMapping,
  OrderByRequest,
  QueryInfo,
} from '../dialect';
import {
  Dialect,
  EscapeStyle,
  MIN_INT64,
  MAX_INT64,
  type LateralJoinExpression,
} from '../dialect';
import {STANDARDSQL_DIALECT_FUNCTIONS} from './dialect_functions';
import {STANDARDSQL_MALLOY_STANDARD_OVERLOADS} from './function_overrides';
import {parseDottedTablePath} from '../table-path';

// BigQuery's bare-dotted form. Each segment matches
// `[A-Za-z_][A-Za-z0-9_*-]*`:
//   - Dashes are allowed in segments (live engine accepts `proj-foo`
//     without backticks even though docs sometimes suggest otherwise).
//   - `*` is allowed as BigQuery's wildcard-table suffix (e.g.
//     `dataset.events_*` matches all tables starting with `events_`).
//     BigQuery's parser does NOT accept a bare `*` — wildcard tables
//     must be backtick-quoted (`` `dataset.events_*` ``). The validator
//     accepts the bare form for back-compat and wraps it in backticks
//     at canonical time (see `sqlValidateTableName`).
// Note that no segment-level quoting exists in this form — BigQuery's
// quote shape is whole-path, handled separately in `sqlValidateTableName`.
const BIGQUERY_BARE_TOKENS: Record<string, RegExp> = {
  bare: /^[A-Za-z_][A-Za-z0-9_*-]*/,
  dot: /^\./,
};

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

const extractMap: Record<string, string> = {
  'day_of_week': 'dayofweek',
  'day_of_year': 'dayofyear',
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

const bqToMalloyTypes: {[key: string]: BasicAtomicTypeDef} = {
  'DATE': {type: 'date'},
  'STRING': {type: 'string'},
  'INTEGER': {type: 'number', numberType: 'bigint'},
  'INT64': {type: 'number', numberType: 'bigint'},
  'FLOAT': {type: 'number', numberType: 'float'},
  'FLOAT64': {type: 'number', numberType: 'float'},
  'NUMERIC': {type: 'number', numberType: 'float'},
  'BIGNUMERIC': {type: 'number', numberType: 'float'},
  'TIMESTAMP': {type: 'timestamp'},
  'BOOLEAN': {type: 'boolean'},
  'BOOL': {type: 'boolean'},
  'JSON': {type: 'json'},
  // TODO (https://cloud.google.com/bigquery/docs/reference/rest/v2/tables#tablefieldschema):
  // BYTES
  // DATETIME
  // TIME
  // GEOGRAPHY
};

export class StandardSQLDialect extends Dialect {
  name = 'standardsql';
  stringLiteralStyle = EscapeStyle.Backslash;
  identifierEscapeStyle = EscapeStyle.Backslash;
  identifierQuoteChar = '`';
  experimental = false;
  defaultNumberType = 'FLOAT64';
  defaultDecimalType = 'NUMERIC';
  udfPrefix = '__udf';
  hasFinalStage = false;
  divisionIsInteger = false;
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
  cantPartitionWindowFunctionsOnExpressions = true;
  hasModOperator = false;

  sqlLateralJoinBag(expressions: LateralJoinExpression[]): string {
    const fields = expressions.map(e => `${e.sql} as ${e.name}`);
    return `LEFT JOIN UNNEST([STRUCT(${fields.join(',\n')})]) as __lateral_join_bag\n`;
  }
  nestedArrays = false; // Can't have an array of arrays for some reason
  supportsHyperLogLog = true;
  likeEscape = false; // Uses \ instead of ESCAPE 'X' in like clauses

  // BigQuery only has INT64 - all integers can exceed JS Number precision
  override integerTypeMappings: IntegerTypeMapping[] = [
    {min: MIN_INT64, max: MAX_INT64, numberType: 'bigint'},
  ];

  // BigQuery's parser accepts `\`` as a backtick escape inside quoted
  // identifiers, but BigQuery's schema layer rejects field/table names
  // containing a literal backtick. Refuse here so the error names the
  // dialect; the rest of the escape (backslash-doubling) is handled by
  // the base via identifierEscapeStyle.
  // Reference: https://cloud.google.com/bigquery/docs/reference/standard-sql/lexical
  private bqRejectBacktick(name: string, kind: string): void {
    if (name.includes('`')) {
      throw new Error(
        `BigQuery ${kind} cannot contain a backtick: ${JSON.stringify(name)}`
      );
    }
  }

  sqlQuoteIdentifier(identifier: string): string {
    this.bqRejectBacktick(identifier, 'identifier');
    return super.sqlQuoteIdentifier(identifier);
  }

  // BigQuery table paths come in two shapes:
  //   1. Dotted bare-identifier path: `project.dataset.table`. Per
  //      BigQuery's lexical rules, dashes are allowed in segments
  //      (specifically, the first segment in FROM/TABLE position can
  //      contain dashes; dataset names cannot, but we accept dashes
  //      anywhere and let BigQuery surface the position-specific
  //      error at bind time).
  //   2. Whole-path inside backticks: `` `project.dataset.table` ``,
  //      with the backslash escape sequences BigQuery defines for
  //      quoted identifiers. An unescaped backtick in the body would
  //      close the literal, so we reject.
  // Anything else (string-literal form, function calls, dashes in a
  // position BigQuery cannot parse, embedded whitespace, etc.) → reject.
  // Canonical form is the input verbatim.
  override sqlValidateTableName(
    input: string
  ): {ok: true; canonical: string} | {ok: false; error: string} {
    if (input.length === 0) {
      return {ok: false, error: 'BigQuery table path is empty'};
    }
    if (input[0] === '`') {
      // Whole-path backtick form. Body must not contain an unescaped
      // backtick; `\X` is a two-char escape sequence we skip past.
      if (input.length < 2 || input[input.length - 1] !== '`') {
        return {
          ok: false,
          error: `BigQuery table path: unmatched backtick in ${JSON.stringify(input)}`,
        };
      }
      const body = input.slice(1, -1);
      let i = 0;
      while (i < body.length) {
        if (body[i] === '\\' && i + 1 < body.length) {
          i += 2;
        } else if (body[i] === '`') {
          return {
            ok: false,
            error: `BigQuery table path: unescaped backtick inside backticks: ${JSON.stringify(input)}`,
          };
        } else {
          i++;
        }
      }
      return {ok: true, canonical: input};
    }
    // Bare dotted path with dashes (and `*` for wildcard tables) allowed.
    const bareResult = parseDottedTablePath(
      input,
      BIGQUERY_BARE_TOKENS,
      'BigQuery'
    );
    if (!bareResult.ok) return bareResult;
    // Wildcard tables aren't legal in BigQuery's bare-FROM grammar; they
    // must be backtick-quoted. We accept the bare form for back-compat
    // and wrap it at canonical time, the same shape as DuckDB's
    // file-path convenience.
    if (input.includes('*')) {
      return {ok: true, canonical: `\`${input}\``};
    }
    return bareResult;
  }

  needsCivilTimeComputation(
    typeDef: AtomicTypeDef,
    truncateTo: TimestampUnit | undefined,
    offsetUnit: TimestampUnit | undefined,
    qi: QueryInfo
  ): {needed: boolean; tz: string | undefined} {
    // In addition to using "civil" space for units where a query time zone is
    // set, BigQuery also uses civil space for unit operations not supported
    // by the TIMESTAMP functions.
    const calendarUnits = ['day', 'week', 'month', 'quarter', 'year'];

    const isCalendarTruncate =
      truncateTo !== undefined && calendarUnits.includes(truncateTo);

    const isCalendarOffset =
      offsetUnit !== undefined && calendarUnits.includes(offsetUnit);

    const needed =
      TD.isAnyTimestamp(typeDef) && (isCalendarTruncate || isCalendarOffset);

    const tz = needed ? qtz(qi) || 'UTC' : undefined;

    return {needed, tz};
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT row_number() OVER() -1  group_set FROM UNNEST(GENERATE_ARRAY(0,${groupSetCount},1)))`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${fieldName} END)`;
  }

  sqlOrderBy(orderTerms: string[], obr?: OrderByRequest): string {
    if (obr === 'analytical' || obr === 'turtle') {
      return `ORDER BY ${orderTerms.join(',')}`;
    }
    return `ORDER BY ${orderTerms.map(t => `${t} NULLS LAST`).join(',')}`;
  }

  // can array agg or any_value a struct...
  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: CompiledOrderBy[] | undefined
  ): string {
    const fields = fieldList
      .map(f => `\n  ${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(', ');
    const orderByClause = orderBy ? this.sqlTurtleOrderByClause(orderBy) : '';
    return `ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}\n  ) END IGNORE NULLS ${orderByClause})`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map(f => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(', ');
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}) END)`;
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
    const fields = fieldList
      .map(f => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(', ');
    const nullValues = fieldList
      .map(f => `NULL as ${f.sqlOutputName}`)
      .join(', ');

    return `COALESCE(ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}) END), STRUCT(${nullValues}))`;
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
    if (isArray) {
      if (needDistinctKey) {
        return `LEFT JOIN UNNEST(ARRAY(( SELECT AS STRUCT row_number() over() as __row_id, value FROM UNNEST(${source}) value))) as ${alias}`;
      } else {
        return `LEFT JOIN UNNEST(ARRAY((SELECT AS STRUCT value FROM unnest(${source}) value))) as ${alias}`;
      }
    } else if (needDistinctKey) {
      return `LEFT JOIN UNNEST(ARRAY(( SELECT AS STRUCT row_number() over() as __row_id, * FROM UNNEST(${source})))) as ${alias}`;
    } else {
      return `LEFT JOIN UNNEST(${source}) as ${alias}`;
    }
  }

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    sqlDistinctKey = `CAST(${sqlDistinctKey} AS STRING)`;
    const upperPart = `cast(cast(concat('0x', substr(to_hex(md5(${sqlDistinctKey})), 1, 15)) as int64) as numeric) * 4294967296`;
    const lowerPart = `cast(cast(concat('0x', substr(to_hex(md5(${sqlDistinctKey})), 16, 8)) as int64) as numeric)`;
    // See the comment below on `sql_sum_distinct` for why we multiply by this decimal
    const precisionShiftMultiplier = '0.000000001';
    return `(${upperPart} + ${lowerPart}) * ${precisionShiftMultiplier}`;
  }

  sqlGenerateUUID(): string {
    return 'GENERATE_UUID()';
  }

  sqlFieldReference(
    parentAlias: string,
    _parentType: unknown,
    childName: string,
    _childType: string
  ): string {
    const child = this.sqlQuoteIdentifier(childName);
    return `${parentAlias}.${child}`;
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    let p = sourceSQLExpression;
    if (isSingleton) {
      p = `[${p}]`;
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

  sqlCreateFunctionCombineLastStage(lastStageName: string): string {
    return `SELECT ARRAY((SELECT AS STRUCT * FROM ${lastStageName}))\n`;
  }

  sqlSelectAliasAsStruct(alias: string): string {
    return `(SELECT AS STRUCT ${alias}.*)`;
  }

  sqlNowExpr(): string {
    return 'CURRENT_TIMESTAMP()';
  }

  sqlTimeExtractExpr(qi: QueryInfo, te: TimeExtractExpr): string {
    const extractTo = extractMap[te.units] || te.units;
    const tz = TD.isAnyTimestamp(te.e.typeDef) && qtz(qi);
    const tzAdd = tz ? ` AT TIME ZONE '${tz}'` : '';
    return `EXTRACT(${extractTo} FROM ${te.e.sql}${tzAdd})`;
  }

  sqlConvertToCivilTime(
    expr: string,
    timezone: string,
    _typeDef: AtomicTypeDef
  ): {sql: string; typeDef: AtomicTypeDef} {
    // BigQuery has no timestamptz type, so typeDef.timestamptz will never be true
    return {
      sql: `DATETIME(${expr}, '${timezone}')`,
      typeDef: {type: 'timestamp'},
    };
  }

  sqlConvertFromCivilTime(
    expr: string,
    timezone: string,
    _destTypeDef: TimestampTypeDef
  ): string {
    return `TIMESTAMP(${expr}, '${timezone}')`;
  }

  sqlTruncate(
    expr: string,
    unit: TimestampUnit,
    typeDef: AtomicTypeDef,
    inCivilTime: boolean,
    timezone?: string
  ): string {
    if (inCivilTime) {
      // Operating on DATETIME (civil time)
      return `DATETIME_TRUNC(${expr}, ${unit})`;
    }

    // Operating on DATE or TIMESTAMP
    if (TD.isDate(typeDef)) {
      return `DATE_TRUNC(${expr}, ${unit})`;
    }

    // TIMESTAMP truncation with optional timezone
    const tzParam = timezone ? `, '${timezone}'` : '';
    return `TIMESTAMP_TRUNC(${expr}, ${unit}${tzParam})`;
  }

  sqlOffsetTime(
    expr: string,
    op: '+' | '-',
    magnitude: string,
    unit: TimestampUnit,
    typeDef: AtomicTypeDef,
    inCivilTime: boolean,
    _timezone?: string
  ): string {
    if (inCivilTime) {
      // Operating on DATETIME (civil time)
      const funcName = op === '+' ? 'DATETIME_ADD' : 'DATETIME_SUB';
      return `${funcName}(${expr}, INTERVAL ${magnitude} ${unit})`;
    }

    // Operating on DATE or TIMESTAMP
    const baseType = typeDef.type;
    if (baseType === 'date') {
      const funcName = op === '+' ? 'DATE_ADD' : 'DATE_SUB';
      return `${funcName}(${expr}, INTERVAL ${magnitude} ${unit})`;
    }

    // TIMESTAMP with sub-day units only (calendar units go through civil time)
    const funcName = op === '+' ? 'TIMESTAMP_ADD' : 'TIMESTAMP_SUB';
    return `${funcName}(${expr}, INTERVAL ${magnitude} ${unit})`;
  }

  ignoreInProject(fieldName: string): boolean {
    return fieldName === '_PARTITIONTIME';
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    const {op, srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    const tz = qtz(qi);
    const src = cast.e.sql || '';
    if (op === 'timestamp::date' && tz) {
      return `DATE(${src},'${tz}')`;
    }
    if (op === 'date::timestamp' && tz) {
      return `TIMESTAMP(${src}, '${tz}')`;
    }
    if (!TD.eq(srcTypeDef, dstTypeDef)) {
      const castFunc = cast.safe ? 'SAFE_CAST' : 'CAST';
      return `${castFunc}(${src} AS ${dstSQLType})`;
    }
    return src;
  }

  sqlRegexpMatch(match: RegexMatchExpr): string {
    return `REGEXP_CONTAINS(${match.kids.expr.sql},${match.kids.regex.sql})`;
  }

  sqlDateLiteral(_qi: QueryInfo, literal: string): string {
    return `DATE('${literal}')`;
  }

  sqlTimestampLiteral(
    qi: QueryInfo,
    literal: string,
    timezone: string | undefined
  ): string {
    let timestampArgs = `'${literal}'`;
    const tz = timezone || qtz(qi);
    if (tz && tz !== 'UTC') {
      timestampArgs += `,'${tz}'`;
    }
    return `TIMESTAMP(${timestampArgs})`;
  }

  sqlTimestamptzLiteral(
    _qi: QueryInfo,
    _literal: string,
    _timezone: string
  ): string {
    throw new Error('BigQuery does not support timestamptz');
  }

  sqlMeasureTimeExpr(measure: MeasureTimeExpr): string {
    const measureMap: Record<string, TimeMeasure> = {
      'microsecond': {use: 'microsecond', ratio: 1},
      'millisecond': {use: 'microsecond', ratio: 1000},
      'second': {use: 'millisecond', ratio: 1000},
      'minute': {use: 'second', ratio: 60},
      'hour': {use: 'minute', ratio: 60},
      'day': {use: 'hour', ratio: 24},
      'week': {use: 'day', ratio: 7},
    };
    const from = measure.kids.left;
    const to = measure.kids.right;
    let lVal = from.sql;
    let rVal = to.sql;
    if (measureMap[measure.units]) {
      const {use: measureIn, ratio} = measureMap[measure.units];
      if (!timestampMeasureable(measureIn)) {
        throw new Error(`Measure in '${measureIn} not implemented`);
      }
      if (!TD.eq(from.typeDef, to.typeDef)) {
        throw new Error("Can't measure difference between different types");
      }
      if (TD.isDate(from.typeDef)) {
        lVal = `TIMESTAMP(${lVal})`;
        rVal = `TIMESTAMP(${rVal})`;
      }
      let measured = `TIMESTAMP_DIFF(${rVal},${lVal},${measureIn})`;
      if (ratio !== 1) {
        measured = `FLOOR(${measured}/${ratio.toString()}.0)`;
      }
      return measured;
    }
    throw new Error(`Measure '${measure.units} not implemented`);
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        throw new Error(
          "StandardSQL doesn't support sampling by rows only percent"
        );
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL}  TABLESAMPLE SYSTEM (${sample.percent} PERCENT))`;
      }
    }
    return tableSQL;
  }

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(STANDARDSQL_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(STANDARDSQL_DIALECT_FUNCTIONS);
  }

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (
        malloyType.numberType === 'integer' ||
        malloyType.numberType === 'bigint'
      ) {
        return 'INT64';
      } else {
        return 'FLOAT64';
      }
    } else if (malloyType.type === 'record') {
      const typeSpec: string[] = [];
      for (const f of malloyType.fields) {
        if (isAtomic(f)) {
          typeSpec.push(`${f.name} ${this.malloyTypeToSQLType(f)}`);
        }
      }
      return `STRUCT<${typeSpec.join(', ')}>`;
    } else if (malloyType.type === 'array') {
      if (isRepeatedRecord(malloyType)) {
        const typeSpec: string[] = [];
        for (const f of malloyType.fields) {
          if (isAtomic(f)) {
            typeSpec.push(`${f.name} ${this.malloyTypeToSQLType(f)}`);
          }
        }
        return `ARRAY<STRUCT<${typeSpec.join(', ')}>>`;
      }
      return `ARRAY<${this.malloyTypeToSQLType(malloyType.elementTypeDef)}>`;
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(sqlType: string): BasicAtomicTypeDef {
    // Remove trailing params
    const baseSqlType = sqlType.match(/^(\w+)/)?.at(0) ?? sqlType;
    return (
      bqToMalloyTypes[baseSqlType.toUpperCase()] ?? {
        type: 'sql native',
        rawType: sqlType.toLowerCase(),
      }
    );
  }

  castToString(expression: string): string {
    return `CAST(${expression} as STRING)`;
  }

  concat(...values: string[]): string {
    return values.join(' || ');
  }

  validateTypeName(sqlType: string): boolean {
    // Letters:              BIGINT
    // Numbers:              INT8
    // Spaces,
    // Parentheses, Commas:  NUMERIC(5, 2)
    // Angle Brackets:       ARRAY<INT64>
    return sqlType.match(/^[A-Za-z\s(),<>0-9]*$/) !== null;
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    const ents: string[] = [];
    for (const [name, val] of Object.entries(lit.kids)) {
      const expr = val.sql || 'internal-error-literal-record';
      ents.push(`${expr} AS ${this.sqlQuoteIdentifier(name)}`);
    }
    return `STRUCT(${ents.join(',')})`;
  }

  sqlLiteralArray(lit: ArrayLiteralNode): string {
    const array = lit.kids.values.map(val => val.sql);
    return '[' + array.join(',') + ']';
  }
}
