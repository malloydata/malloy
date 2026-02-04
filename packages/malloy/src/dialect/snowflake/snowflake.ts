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

import {DateTime as LuxonDateTime} from 'luxon';
import {indent} from '../../model/utils';
import type {
  Sampling,
  AtomicTypeDef,
  TimeExtractExpr,
  TypecastExpr,
  MeasureTimeExpr,
  RegexMatchExpr,
  BasicAtomicTypeDef,
  TimestampTypeDef,
  ArrayLiteralNode,
  RecordLiteralNode,
} from '../../model/malloy_types';
import {
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  TD,
  isAtomic,
  isRepeatedRecord,
  isBasicArray,
} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandOverrideMap, expandBlueprintMap} from '../functions';
import type {
  DialectFieldList,
  FieldReferenceType,
  IntegerTypeMapping,
  QueryInfo,
} from '../dialect';
import {Dialect, qtz, MIN_DECIMAL38, MAX_DECIMAL38} from '../dialect';
import {SNOWFLAKE_DIALECT_FUNCTIONS} from './dialect_functions';
import {SNOWFLAKE_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

const extractionMap: Record<string, string> = {
  'day_of_week': 'dayofweek',
  'day_of_year': 'dayofyear',
};

const snowflakeToMalloyTypes: {[key: string]: BasicAtomicTypeDef} = {
  // string
  'varchar': {type: 'string'},
  'text': {type: 'string'},
  'string': {type: 'string'},
  'char': {type: 'string'},
  'character': {type: 'string'},
  'nvarchar': {type: 'string'},
  'nvarchar2': {type: 'string'},
  'char varying': {type: 'string'},
  'nchar varying': {type: 'string'},
  // numbers - Snowflake uses NUMBER(38,0) for all integers, which exceeds 64-bit
  // NUMBER, NUMERIC, DECIMAL, DEC are handled dynamically in sqlTypeToMalloyType
  // because they can be integers or floats depending on scale.
  'integer': {type: 'number', numberType: 'bigint'},
  'int': {type: 'number', numberType: 'bigint'},
  'bigint': {type: 'number', numberType: 'bigint'},
  'smallint': {type: 'number', numberType: 'bigint'},
  'tinyint': {type: 'number', numberType: 'bigint'},
  'byteint': {type: 'number', numberType: 'bigint'},
  'float': {type: 'number', numberType: 'float'},
  'float4': {type: 'number', numberType: 'float'},
  'float8': {type: 'number', numberType: 'float'},
  'double': {type: 'number', numberType: 'float'},
  'double precision': {type: 'number', numberType: 'float'},
  'real': {type: 'number', numberType: 'float'},
  'boolean': {type: 'boolean'},
  // time and date
  'date': {type: 'date'},
  'timestamp': {type: 'timestamp'},
  'timestampntz': {type: 'timestamp'},
  'timestamp_ntz': {type: 'timestamp'},
  'timestamp without time zone': {type: 'timestamp'},
  'timestamptz': {type: 'timestamptz'},
  'timestamp_tz': {type: 'timestamptz'},
  'timestamp with time zone': {type: 'timestamptz'},
  /* timestamp_ltz is not supported in malloy snowflake dialect */
};

export class SnowflakeDialect extends Dialect {
  name = 'snowflake';
  experimental = false;
  hasTimestamptz = true;
  defaultNumberType = 'NUMBER';
  defaultDecimalType = 'NUMBER';
  udfPrefix = '__udf';
  hasFinalStage = false;
  divisionIsInteger = false;
  supportsSumDistinctFunction = true;
  supportsSafeCast = true;
  supportsNesting = true;
  defaultSampling = {rows: 50000};
  supportsHyperLogLog = true;

  // NOTE: safely setting all these to false for now
  // more many be implemented in future
  unnestWithNumbers = false;
  supportUnnestArrayAgg = false;
  supportsAggDistinct = false;
  supportsCTEinCoorelatedSubQueries = false;
  dontUnionIndex = false;
  supportsQualify = false;
  supportsPipelinesInViews = false;
  supportsComplexFilteredSources = false;

  // Snowflake uses NUMBER(38,0) for all integers - can exceed JS Number precision
  override integerTypeMappings: IntegerTypeMapping[] = [
    {min: MIN_DECIMAL38, max: MAX_DECIMAL38, numberType: 'bigint'},
  ];

  quoteTablePath(tablePath: string): string {
    // Quote with double quotes if contains dangerous characters
    if (tablePath.match(/[;-]/)) {
      return tablePath
        .split('.')
        .map(part => `"${part}"`)
        .join('.');
    }
    return tablePath;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT index as group_set FROM TABLE(FLATTEN(ARRAY_GENERATE_RANGE(0, ${
      groupSetCount + 1
    }))))`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `(ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN ${fieldName} END) WITHIN GROUP (ORDER BY ${fieldName} ASC NULLS LAST))[0]`;
  }

  mapFields(fieldList: DialectFieldList): string {
    return fieldList
      .map(f => `\n  ${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(', ');
  }

  mapFieldsForObjectConstruct(fieldList: DialectFieldList): string {
    return fieldList
      .map(f => `'${f.rawName}', (${f.sqlExpression})`)
      .join(', ');
  }

  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined
  ): string {
    const fields = this.mapFieldsForObjectConstruct(fieldList);
    const orderByClause = orderBy ? ` WITHIN GROUP (${orderBy})` : '';
    const aggClause = `ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN OBJECT_CONSTRUCT_KEEP_NULL(${fields}) END)${orderByClause}`;
    return `COALESCE(${aggClause}, [])`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = this.mapFieldsForObjectConstruct(fieldList);
    return `(ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN OBJECT_CONSTRUCT_KEEP_NULL(${fields}) END) WITHIN GROUP (ORDER BY 1 ASC NULLS LAST))[0]`;
  }

  sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string {
    return `(ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN ${name} END) WITHIN GROUP (ORDER BY ${name} ASC NULLS LAST))[0] AS ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = this.mapFieldsForObjectConstruct(fieldList);
    const nullValues = fieldList
      .map(f => `'${f.sqlOutputName}', NULL`)
      .join(', ');
    return `COALESCE(ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN OBJECT_CONSTRUCT_KEEP_NULL(${fields}) END)[0], OBJECT_CONSTRUCT_KEEP_NULL(${nullValues}))`;
  }

  sqlUnnestAlias(
    source: string,
    alias: string,
    _fieldList: DialectFieldList,
    _needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    const as = this.sqlMaybeQuoteIdentifier(alias);
    if (isArray) {
      return `LEFT JOIN lateral flatten(input => ${source}) as ${as}`;
    } else {
      // have to have a non empty row or it treats it like an inner join :barf-emoji:
      return `LEFT JOIN LATERAL FLATTEN(INPUT => ifnull(${source},[1])) AS ${as}`;
    }
  }

  /*
  // For comparison against the equivalent function implemented in standardsql dialect
  select
    (
      to_number (
        substr (md5_hex ('hello'), 1, 15),
        repeat ('X', 15)
      ) * 4294967296 + to_number (
        substr (md5_hex ('hello'), 16, 8),
        repeat ('X', 8)
      )
    ) * 0.000000001 as hash;
  +-------------------------------+
  |                          HASH |
  |-------------------------------|
  | 1803811819465386377.040304601 |
  +-------------------------------+
  */
  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    sqlDistinctKey = `${sqlDistinctKey}::STRING`;
    const upperPart = `to_number(substr(md5_hex(${sqlDistinctKey}), 1, 15), repeat('X', 15)) * 4294967296`;
    const lowerPart = `to_number(substr(md5_hex(${sqlDistinctKey}), 16, 8), repeat('X', 8))`;
    return `(${upperPart} + ${lowerPart})`;
  }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    const hashKey = this.sqlSumDistinctHashedKey(key);
    const scale = 100000000.0;
    const v = `(CAST (COALESCE(${value},0)*${scale} as INT))`;

    const sqlSum = `(SUM(DISTINCT ${hashKey} + ${v}) - SUM(DISTINCT ${hashKey}))/${scale}`;
    if (funcName === 'SUM') {
      return sqlSum;
    } else if (funcName === 'AVG') {
      return `(${sqlSum})/NULLIF(COUNT(DISTINCT CASE WHEN ${value} IS NOT NULL THEN ${key} END),0)`;
    }
    throw new Error(`Unknown Symmetric Aggregate function ${funcName}`);
  }
  sqlGenerateUUID(): string {
    return 'UUID_STRING()';
  }

  sqlFieldReference(
    parentAlias: string,
    parentType: FieldReferenceType,
    childName: string,
    childType: string
  ): string {
    const sqlName = this.sqlMaybeQuoteIdentifier(childName);
    if (childName === '__row_id') {
      return `"${parentAlias}".INDEX::varchar`;
    } else if (parentType.startsWith('array')) {
      let arrayRef = `"${parentAlias}".value`;
      if (parentType === 'array[record]') {
        arrayRef += `:${sqlName}`;
      }
      switch (childType) {
        case 'record':
        case 'array':
          childType = 'VARIANT';
          break;
        case 'string':
          childType = 'VARCHAR';
          break;
        case 'number':
          childType = 'DOUBLE';
          break;
        case 'struct':
          throw new Error('NOT STRUCT PLEASE');
        // boolean and timestamp and date are all ok
      }
      return `${arrayRef}::${childType}`;
    } else if (parentType === 'record') {
      return `${parentAlias}:${sqlName}`;
    }
    return `${parentAlias}.${sqlName}`;
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    let p = sourceSQLExpression;
    if (isSingleton) {
      p = `[${p}]`;
    }
    return `TABLE(FLATTEN(input =>${p}))`;
  }

  sqlCreateFunction(_id: string, _funcText: string): string {
    throw new Error('not implemented yet');
  }

  sqlCreateFunctionCombineLastStage(_lastStageName: string): string {
    throw new Error('not implemented yet');
    // return `SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*)) FROM ${lastStageName}`;
  }

  sqlSelectAliasAsStruct(alias: string): string {
    return `OBJECT_CONSTRUCT_KEEP_NULL(${alias}.*)`;
  }

  sqlMaybeQuoteIdentifier(identifier: string): string {
    return '"' + identifier.replace(/"/g, '""') + '"';
  }

  sqlCreateTableAsSelect(tableName: string, sql: string): string {
    return `
CREATE TEMP TABLE IF NOT EXISTS \`${tableName}\`
AS (
${indent(sql)}
);
`;
  }

  sqlConvertToCivilTime(
    expr: string,
    timezone: string,
    typeDef: AtomicTypeDef
  ): {sql: string; typeDef: AtomicTypeDef} {
    // For timestamptz (TIMESTAMP_TZ): use 2-arg form
    // Returns TIMESTAMP_TZ with timezone preserved
    if (typeDef.type === 'timestamptz') {
      return {
        sql: `CONVERT_TIMEZONE('${timezone}', ${expr})`,
        typeDef: {type: 'timestamptz'},
      };
    }
    // For plain timestamps (TIMESTAMP_NTZ): use 3-arg form
    // Must cast to TIMESTAMP_NTZ first, returns TIMESTAMP_NTZ
    return {
      sql: `CONVERT_TIMEZONE('UTC', '${timezone}', (${expr})::TIMESTAMP_NTZ)`,
      typeDef: {type: 'timestamp'},
    };
  }

  sqlConvertFromCivilTime(
    expr: string,
    timezone: string,
    _destTypeDef: TimestampTypeDef
  ): string {
    // After civil time operations, we have a TIMESTAMP_NTZ in the target timezone
    // Convert from timezone to UTC, returning TIMESTAMP_NTZ
    return `CONVERT_TIMEZONE('${timezone}', 'UTC', (${expr})::TIMESTAMP_NTZ)`;
  }

  sqlTruncate(
    expr: string,
    unit: string,
    _typeDef: AtomicTypeDef,
    _inCivilTime: boolean,
    _timezone?: string
  ): string {
    // Snowflake session is configured with WEEK_START=7 (Sunday)
    // so DATE_TRUNC already truncates to Sunday - no adjustment needed
    // Unlike PostgreSQL/DuckDB, Snowflake's DATE_TRUNC preserves the input type
    // (TIMESTAMP_NTZ → TIMESTAMP_NTZ, TIMESTAMP_TZ → TIMESTAMP_TZ)
    return `DATE_TRUNC('${unit}', ${expr})`;
  }

  sqlOffsetTime(
    expr: string,
    op: '+' | '-',
    magnitude: string,
    unit: string,
    typeDef: AtomicTypeDef,
    _inCivilTime: boolean,
    _timezone?: string
  ): string {
    const funcName = typeDef.type === 'date' ? 'DATEADD' : 'TIMESTAMPADD';
    const n = op === '+' ? magnitude : `-(${magnitude})`;
    return `${funcName}(${unit}, ${n}, ${expr})`;
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const extractUnits = extractionMap[from.units] || from.units;
    let extractFrom = from.e.sql;
    const tz = qtz(qi);

    if (tz && TD.isAnyTimestamp(from.e.typeDef)) {
      extractFrom = `CONVERT_TIMEZONE('${tz}', ${extractFrom})`;
    }
    return `EXTRACT(${extractUnits} FROM ${extractFrom})`;
  }

  private atTz(sqlExpr: string, tz: string | undefined): string {
    if (tz !== undefined) {
      return `(
      TO_CHAR(${sqlExpr}::TIMESTAMP_NTZ, 'YYYY-MM-DD HH24:MI:SS.FF9') ||
      TO_CHAR(CONVERT_TIMEZONE('${tz}', '1970-01-01 00:00:00'), 'TZHTZM')
    )::TIMESTAMP_TZ`;
    }
    return `${sqlExpr}::TIMESTAMP_NTZ`;
  }

  sqlNowExpr(): string {
    return 'CURRENT_TIMESTAMP()';
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    const src = cast.e.sql || '';
    const {srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    if (TD.eq(srcTypeDef, dstTypeDef)) {
      return src;
    }
    if (cast.safe && !TD.isString(srcTypeDef)) {
      // safe cast is only supported for a few combinations of src -> dst types
      // so we will not support it in the general case
      // see: https://docs.snowflake.com/en/sql-reference/functions/try_cast

      throw new Error(
        `Snowflake dialect doesn't support safe cast for a few types:
        refer to: https://docs.snowflake.com/en/sql-reference/functions/try_cast`
      );
    }

    const tz = qtz(qi);

    // Timezone-aware casts when query timezone is set
    if (tz && srcTypeDef && dstTypeDef) {
      // TIMESTAMP → DATE: convert to query timezone, then to date
      if (TD.isTimestamp(srcTypeDef) && TD.isDate(dstTypeDef)) {
        return `TO_DATE(CONVERT_TIMEZONE('${tz}', ${src}))`;
      }

      // TIMESTAMPTZ → DATE: convert to query timezone, then to date
      if (TD.isTimestamptz(srcTypeDef) && TD.isDate(dstTypeDef)) {
        return `TO_DATE(CONVERT_TIMEZONE('${tz}', ${src}))`;
      }

      // DATE → TIMESTAMP: interpret date in query timezone, return UTC timestamp
      if (TD.isDate(srcTypeDef) && TD.isTimestamp(dstTypeDef)) {
        const retExpr = `TO_TIMESTAMP(${src})`;
        return this.atTz(retExpr, tz);
      }

      // DATE → TIMESTAMPTZ: interpret date in query timezone
      if (TD.isDate(srcTypeDef) && TD.isTimestamptz(dstTypeDef)) {
        const retExpr = `TO_TIMESTAMP(${src})`;
        return this.atTz(retExpr, tz);
      }

      // TIMESTAMPTZ → TIMESTAMP: convert to query timezone, get UTC wall clock
      if (TD.isTimestamptz(srcTypeDef) && TD.isTimestamp(dstTypeDef)) {
        return `CONVERT_TIMEZONE('${tz}', ${src})::TIMESTAMP_NTZ`;
      }

      // TIMESTAMP → TIMESTAMPTZ: interpret as UTC, convert to TIMESTAMPTZ
      if (TD.isTimestamp(srcTypeDef) && TD.isTimestamptz(dstTypeDef)) {
        return this.atTz(src, tz);
      }
    }

    const castFunc = cast.safe ? 'TRY_CAST' : 'CAST';
    return `${castFunc}(${src} AS ${dstSQLType})`;
  }

  sqlDateLiteral(_qi: QueryInfo, literal: string): string {
    return `TO_DATE('${literal}')`;
  }

  sqlTimestampLiteral(
    qi: QueryInfo,
    literal: string,
    timezone: string | undefined
  ): string {
    const tz = timezone || qtz(qi);
    let ret = `'${literal}'::TIMESTAMP_NTZ`;

    if (tz) {
      // Interpret the literal as being in query timezone, convert to UTC
      ret = `CONVERT_TIMEZONE('${tz}', 'UTC', ${ret})`;
    }

    return ret;
  }

  sqlTimestamptzLiteral(
    _qi: QueryInfo,
    literal: string,
    timezone: string
  ): string {
    // Use TIMESTAMP_TZ_FROM_PARTS to create timestamptz
    const dt = LuxonDateTime.fromFormat(literal, 'yyyy-LL-dd HH:mm:ss');
    if (!dt.isValid) {
      throw new Error(`Invalid timestamp literal: ${literal}`);
    }

    const year = dt.year;
    const month = dt.month;
    const day = dt.day;
    const hour = dt.hour;
    const minute = dt.minute;
    const second = dt.second;
    const nanosecond = dt.millisecond * 1000000;

    return `TIMESTAMP_TZ_FROM_PARTS(${year}, ${month}, ${day}, ${hour}, ${minute}, ${second}, ${nanosecond}, '${timezone}')`;
  }

  sqlMeasureTimeExpr(df: MeasureTimeExpr): string {
    const from = df.kids.left;
    const to = df.kids.right;
    let extractUnits = 'nanoseconds';
    if (TD.isDate(from.typeDef) || TD.isDate(to.typeDef)) {
      extractUnits = 'seconds';
    }

    return `TIMESTAMPDIFF(
      '${df.units}',
      '1970-01-01 00:00:00'::TIMESTAMP_NTZ,
      TIMESTAMPADD(
        '${extractUnits}',
        EXTRACT('epoch_${extractUnits}', ${to.sql}) - EXTRACT('epoch_${extractUnits}', ${from.sql}),
        '1970-01-01 00:00:00'::TIMESTAMP_NTZ
      )
    )`;
  }

  sqlRegexpMatch(compare: RegexMatchExpr): string {
    return `REGEXP_INSTR(${compare.kids.expr.sql}, ${compare.kids.regex.sql}) != 0`;
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        return `(SELECT * FROM ${tableSQL} TABLESAMPLE (${sample.rows} ROWS))`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} TABLESAMPLE (${sample.percent}))`;
      }
    }
    return tableSQL;
  }

  sqlOrderBy(orderTerms: string[]): string {
    return `ORDER BY ${orderTerms.map(t => `${t} NULLS LAST`).join(',')}`;
  }

  sqlLiteralString(literal: string): string {
    const noVirgule = literal.replace(/\\/g, '\\\\');
    return "'" + noVirgule.replace(/'/g, "\\'") + "'";
  }

  sqlLiteralRegexp(literal: string): string {
    const noVirgule = literal.replace(/\\/g, '\\\\');
    return "'" + noVirgule.replace(/'/g, "\\'") + "'";
  }

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(SNOWFLAKE_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(SNOWFLAKE_DIALECT_FUNCTIONS);
  }

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    if (malloyType.type === 'string') {
      return 'VARCHAR';
    } else if (malloyType.type === 'number') {
      if (
        malloyType.numberType === 'integer' ||
        malloyType.numberType === 'bigint'
      ) {
        return 'NUMBER';
      } else {
        return 'DOUBLE';
      }
    } else if (malloyType.type === 'record' || isRepeatedRecord(malloyType)) {
      const sqlFields = malloyType.fields.reduce((ret, f) => {
        if (isAtomic(f)) {
          const name = f.as ?? f.name;
          const oneSchema = `${this.sqlMaybeQuoteIdentifier(
            name
          )} ${this.malloyTypeToSQLType(f)}`;
          ret.push(oneSchema);
        }
        return ret;
      }, [] as string[]);
      const recordScehma = `OBJECT(${sqlFields.join(',')})`;
      return malloyType.type === 'record'
        ? recordScehma
        : `ARRAY(${recordScehma})`;
    } else if (isBasicArray(malloyType)) {
      return `ARRAY(${this.malloyTypeToSQLType(malloyType.elementTypeDef)})`;
    } else if (malloyType.type === 'timestamptz') {
      return 'TIMESTAMP_TZ';
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(sqlType: string): BasicAtomicTypeDef {
    // Remove trailing params
    const baseSqlType = sqlType.match(/^([\w\s]+)/)?.at(0) ?? sqlType;
    const lowerType = baseSqlType.trim().toLowerCase();
    const mapped = snowflakeToMalloyTypes[lowerType];
    if (mapped) {
      return mapped;
    }

    // Handle NUMBER/NUMERIC/DECIMAL with scale
    // If scale > 0, it's a float (decimal). If scale == 0 or omitted, it's a bigint (integer).
    if (['number', 'numeric', 'decimal', 'dec'].includes(lowerType)) {
      const match = sqlType.match(/\(\s*\d+\s*,\s*(\d+)\s*\)/);
      if (match) {
        const scale = parseInt(match[1], 10);
        if (scale > 0) {
          return {type: 'number', numberType: 'float'};
        }
      }
      // Default to bigint if scale is 0 or not specified (Snowflake defaults to NUMBER(38,0))
      return {type: 'number', numberType: 'bigint'};
    }

    return {
      type: 'sql native',
      rawType: sqlType,
    };
  }

  castToString(expression: string): string {
    return `TO_VARCHAR(${expression})`;
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

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    const rowVals: string[] = [];
    for (const f of lit.typeDef.fields) {
      const name = f.as ?? f.name;
      const propName = `'${name}'`;
      const propVal = lit.kids[name].sql ?? 'internal-error-record-literal';
      rowVals.push(`${propName},${propVal}`);
    }
    return `OBJECT_CONSTRUCT_KEEP_NULL(${rowVals.join(',')})`;
  }

  sqlLiteralArray(lit: ArrayLiteralNode): string {
    const array = lit.kids.values.map(val => val.sql);
    const arraySchema = `[${array.join(',')}]`;
    return arraySchema;
    // return lit.typeDef.elementTypeDef.type === 'record_element'
    //   ? `${arraySchema}::${this.malloyTypeToSQLType(lit.typeDef)}`
    //   : arraySchema;
  }
}
