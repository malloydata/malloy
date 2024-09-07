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
import {
  Sampling,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  FieldAtomicTypeDef,
  TimeTruncExpr,
  TimeExtractExpr,
  TimeDeltaExpr,
  TypecastExpr,
  TimeLiteralNode,
  MeasureTimeExpr,
  RegexMatchExpr,
} from '../../model/malloy_types';
import {SNOWFLAKE_FUNCTIONS} from './functions';
import {DialectFunctionOverloadDef} from '../functions';
import {Dialect, DialectFieldList, QueryInfo, qtz} from '../dialect';
import {SNOWFLAKE_DIALECT_FUNCTIONS} from './functions/dialect_functions';

const extractionMap: Record<string, string> = {
  'day_of_week': 'dayofweek',
  'day_of_year': 'dayofyear',
};

const snowflakeToMalloyTypes: {[key: string]: FieldAtomicTypeDef} = {
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
  // numbers
  'number': {type: 'number', numberType: 'integer'},
  'numeric': {type: 'number', numberType: 'integer'},
  'decimal': {type: 'number', numberType: 'integer'},
  'dec': {type: 'number', numberType: 'integer'},
  'integer': {type: 'number', numberType: 'integer'},
  'int': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'integer'},
  'smallint': {type: 'number', numberType: 'integer'},
  'tinyint': {type: 'number', numberType: 'integer'},
  'byteint': {type: 'number', numberType: 'integer'},
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
  'timestamptz': {type: 'timestamp'},
  'timestamp_tz': {type: 'timestamp'},
  'timestamp with time zone': {type: 'timestamp'},
  /* timestamp_ltz is not supported in malloy snowflake dialect */
};

export class SnowflakeDialect extends Dialect {
  name = 'snowflake';
  experimental = false;
  defaultNumberType = 'NUMBER';
  defaultDecimalType = 'NUMBER';
  udfPrefix = '__udf';
  hasFinalStage = false;
  divisionIsInteger = false;
  supportsSumDistinctFunction = true;
  supportsSafeCast = true;
  supportsNesting = true;
  defaultSampling = {rows: 50000};
  globalFunctions = SNOWFLAKE_FUNCTIONS;

  // NOTE: safely setting all these to false for now
  // more many be implemented in future
  unnestWithNumbers = false;
  supportUnnestArrayAgg = false;
  supportsAggDistinct = false;
  supportsCTEinCoorelatedSubQueries = false;
  dontUnionIndex = false;
  supportsQualify = false;
  supportsPipelinesInViews = false;

  // don't mess with the table pathing.
  quoteTablePath(tablePath: string): string {
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
    orderBy: string | undefined,
    limit: number | undefined
  ): string {
    const fields = this.mapFieldsForObjectConstruct(fieldList);
    const orderByClause = orderBy ? ` WITHIN GROUP (${orderBy})` : '';
    const aggClause = `ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN OBJECT_CONSTRUCT_KEEP_NULL(${fields}) END)${orderByClause}`;
    if (limit === undefined) {
      return `COALESCE(${aggClause}, [])`;
    }
    return `COALESCE(ARRAY_SLICE(${aggClause}, 0, ${limit}), [])`;
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
    if (isArray) {
      return `,LATERAL FLATTEN(INPUT => ${source}) AS ${alias}_1, LATERAL (SELECT ${alias}_1.INDEX, object_construct('value', ${alias}_1.value) as value ) as ${alias}`;
    } else {
      // have to have a non empty row or it treats it like an inner join :barf-emoji:
      return `LEFT JOIN LATERAL FLATTEN(INPUT => ifnull(${source},[1])) AS ${alias}`;
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
    const v = `(COALESCE(${value},0)*${scale})`;

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
    alias: string,
    fieldName: string,
    fieldType: string,
    isNested: boolean,
    _isArray: boolean
  ): string {
    if (fieldName === '__row_id') {
      return `${alias}.INDEX::varchar`;
    } else if (!isNested) {
      return `${alias}."${fieldName}"`;
    } else {
      let snowflakeType = fieldType;
      if (fieldType === 'string') {
        snowflakeType = 'varchar';
      } else if (fieldType === 'struct') {
        snowflakeType = 'variant';
      }
      return `${alias}.value:"${fieldName}"::${snowflakeType}`;
    }
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
    return `"${identifier}"`;
  }

  sqlCreateTableAsSelect(tableName: string, sql: string): string {
    return `
CREATE TEMP TABLE IF NOT EXISTS \`${tableName}\`
AS (
${indent(sql)}
);
`;
  }

  sqlTruncExpr(qi: QueryInfo, te: TimeTruncExpr): string {
    const tz = qtz(qi);
    let truncThis = te.e.sql;
    if (tz && te.e.dataType === 'timestamp') {
      truncThis = `CONVERT_TIMEZONE('${tz}',${truncThis})`;
    }
    return `DATE_TRUNC('${te.units}',${truncThis})`;
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const extractUnits = extractionMap[from.units] || from.units;
    let extractFrom = from.e.sql;
    const tz = qtz(qi);

    if (tz && from.e.dataType === 'timestamp') {
      extractFrom = `CONVERT_TIMEZONE('${tz}', ${extractFrom})`;
    }
    return `EXTRACT(${extractUnits} FROM ${extractFrom})`;
  }

  sqlAlterTimeExpr(df: TimeDeltaExpr): string {
    const interval = `INTERVAL '${df.kids.delta.sql} ${df.units}'`;
    return `(${df.kids.base.sql})${df.op}${interval}`;
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
    if (cast.srcType === cast.dstType) {
      return src;
    }
    if (cast.safe && typeof cast.srcType !== 'string') {
      // safe cast is only supported for a few combinations of src -> dst types
      // so we will not support it in the general case
      // see: https://docs.snowflake.com/en/sql-reference/functions/try_cast

      throw new Error(
        `Snowflake dialect doesn't support safe cast for a few types:
        refer to: https://docs.snowflake.com/en/sql-reference/functions/try_cast`
      );
    }

    const tz = qtz(qi);
    // casting timestamps and dates
    if (cast.dstType === 'date' && cast.srcType === 'timestamp') {
      let castExpr = src;
      if (tz) {
        castExpr = `CONVERT_TIMEZONE('${tz}', ${castExpr})`;
      }
      return `TO_DATE(${castExpr})`;
    } else if (cast.dstType === 'timestamp' && cast.srcType === 'date') {
      const retExpr = `TO_TIMESTAMP(${src})`;
      return this.atTz(retExpr, tz);
    }

    const dstType =
      typeof cast.dstType === 'string'
        ? this.malloyTypeToSQLType({type: cast.dstType})
        : cast.dstType.raw;
    const castFunc = cast.safe ? 'TRY_CAST' : 'CAST';
    return `${castFunc}(${src} AS ${dstType})`;
  }

  sqlLiteralTime(qi: QueryInfo, lf: TimeLiteralNode): string {
    const tz = qtz(qi);
    // just making it explicit that timestring does not have timezone info
    let ret = `'${lf.literal}'::TIMESTAMP_NTZ`;
    // now do the hack to add timezone to a timestamp ntz
    const targetTimeZone = lf.timezone ?? tz;
    if (targetTimeZone) {
      const targetTimeZoneSuffix = `TO_CHAR(CONVERT_TIMEZONE('${targetTimeZone}', '1970-01-01 00:00:00'), 'TZHTZM')`;
      const retTimeString = `TO_CHAR(${ret}, 'YYYY-MM-DD HH24:MI:SS.FF9')`;
      ret = `${retTimeString} || ${targetTimeZoneSuffix}`;
      ret = `(${ret})::TIMESTAMP_TZ`;
    }

    switch (lf.dataType) {
      case 'date':
        return `TO_DATE(${ret})`;
      case 'timestamp': {
        return ret;
      }
    }
  }

  sqlMeasureTimeExpr(df: MeasureTimeExpr): string {
    const from = df.kids.left;
    const to = df.kids.right;
    let extractUnits = 'nanoseconds';
    if (from.dataType === 'date' || to.dataType === 'date') {
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

  getGlobalFunctionDef(name: string): DialectFunctionOverloadDef[] | undefined {
    return SNOWFLAKE_FUNCTIONS.get(name);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return SNOWFLAKE_DIALECT_FUNCTIONS;
  }

  malloyTypeToSQLType(malloyType: FieldAtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        return 'integer';
      } else {
        return 'double';
      }
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(sqlType: string): FieldAtomicTypeDef | undefined {
    // Remove trailing params
    const baseSqlType = sqlType.match(/^([\w\s]+)/)?.at(0) ?? sqlType;
    return snowflakeToMalloyTypes[baseSqlType.trim().toLowerCase()];
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
}
