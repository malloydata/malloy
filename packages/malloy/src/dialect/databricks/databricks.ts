/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Sampling,
  MeasureTimeExpr,
  RegexMatchExpr,
  TimeExtractExpr,
  TypecastExpr,
  BasicAtomicTypeDef,
  AtomicTypeDef,
  ArrayLiteralNode,
  RecordLiteralNode,
} from '../../model/malloy_types';
import {
  isAtomic,
  isRepeatedRecord,
  isSamplingEnable,
  isSamplingRows,
  isSamplingPercent,
  TD,
} from '../../model/malloy_types';
import {indent} from '../../model/utils';
import type {
  BooleanTypeSupport,
  CompiledOrderBy,
  DialectFieldList,
  FieldReferenceType,
  LateralJoinExpression,
  OrderByClauseType,
  OrderByRequest,
  QueryInfo,
} from '../dialect';
import {Dialect, qtz} from '../dialect';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandBlueprintMap, expandOverrideMap} from '../functions';
import {DATABRICKS_DIALECT_FUNCTIONS} from './dialect_functions';
import {DATABRICKS_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

const extractionMap: Record<string, string> = {
  day_of_week: 'DAYOFWEEK',
  day_of_year: 'DAYOFYEAR',
};

const inSeconds: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 24 * 3600,
  week: 7 * 24 * 3600,
};

const databricksToMalloyTypes: {[key: string]: BasicAtomicTypeDef} = {
  'tinyint': {type: 'number', numberType: 'integer'},
  'smallint': {type: 'number', numberType: 'integer'},
  'int': {type: 'number', numberType: 'integer'},
  'integer': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'bigint'},
  'float': {type: 'number', numberType: 'float'},
  'double': {type: 'number', numberType: 'float'},
  'decimal': {type: 'number', numberType: 'float'},
  'string': {type: 'string'},
  'varchar': {type: 'string'},
  'char': {type: 'string'},
  'binary': {type: 'string'},
  'boolean': {type: 'boolean'},
  'date': {type: 'date'},
  'timestamp': {type: 'timestamp'},
};

export class DatabricksDialect extends Dialect {
  name = 'databricks';
  defaultNumberType = 'DOUBLE';
  defaultDecimalType = 'DECIMAL';
  udfPrefix = '__udf';
  hasFinalStage = false;
  stringTypeName = 'STRING';
  divisionIsInteger = false;
  supportsSumDistinctFunction = true;
  unnestWithNumbers = false;
  defaultSampling = {rows: 50000};
  supportUnnestArrayAgg = true;
  supportsAggDistinct = true;
  supportsCTEinCoorelatedSubQueries = true;
  supportsSafeCast = true;
  dontUnionIndex = false;
  supportsQualify = false;
  supportsNesting = true;
  hasLateralColumnAliasInSelect = true;
  cantPartitionWindowFunctionsOnExpressions = true;
  experimental = false;
  supportsFullJoin = true;
  supportsPipelinesInViews = false;
  readsNestedData = false;
  supportsComplexFilteredSources = false;
  supportsArraysInData = false;
  compoundObjectInSchema = false;
  booleanType: BooleanTypeSupport = 'supported';
  likeEscape = false;
  orderByClause: OrderByClauseType = 'ordinal';
  hasTimestamptz = false;
  supportsBigIntPrecision = false;
  maxIdentifierLength = 255;

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    switch (malloyType.type) {
      case 'number':
        if (malloyType.numberType === 'integer') {
          return 'INT';
        } else if (malloyType.numberType === 'bigint') {
          return 'BIGINT';
        } else {
          return 'DOUBLE';
        }
      case 'string':
        return 'STRING';
      case 'boolean':
        return 'BOOLEAN';
      case 'record': {
        const fields: string[] = [];
        for (const f of malloyType.fields) {
          if (isAtomic(f)) {
            fields.push(
              `${this.sqlMaybeQuoteIdentifier(f.name)}: ${this.malloyTypeToSQLType(f)}`
            );
          }
        }
        return `STRUCT<${fields.join(', ')}>`;
      }
      case 'array': {
        if (isRepeatedRecord(malloyType)) {
          const fields: string[] = [];
          for (const f of malloyType.fields) {
            if (isAtomic(f)) {
              fields.push(
                `${this.sqlMaybeQuoteIdentifier(f.name)}: ${this.malloyTypeToSQLType(f)}`
              );
            }
          }
          return `ARRAY<STRUCT<${fields.join(', ')}>>`;
        }
        return `ARRAY<${this.malloyTypeToSQLType(malloyType.elementTypeDef)}>`;
      }
      case 'timestamp':
        return 'TIMESTAMP';
      case 'sql native':
        return malloyType.rawType || 'STRING';
      default:
        return malloyType.type.toUpperCase();
    }
  }

  sqlTypeToMalloyType(sqlType: string): BasicAtomicTypeDef {
    const baseSqlType = sqlType.match(/^(\w+)/)?.at(0) ?? sqlType;
    return (
      databricksToMalloyTypes[baseSqlType.toLowerCase()] || {
        type: 'sql native',
        rawType: baseSqlType,
      }
    );
  }

  quoteTablePath(tablePath: string): string {
    return tablePath
      .split('.')
      .map(part => (/^[a-zA-Z_]\w*$/.test(part) ? part : `\`${part}\``))
      .join('.');
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `LATERAL VIEW EXPLODE(SEQUENCE(0, ${groupSetCount})) group_set AS group_set`;
  }

  sqlLateralJoinBag(expressions: LateralJoinExpression[]): string {
    // Use LATERAL VIEW INLINE to produce a single-row lateral join with named
    // columns. This must be LATERAL VIEW (not LEFT JOIN LATERAL) because
    // Databricks requires all LATERAL VIEWs to come after regular JOINs,
    // and group_set uses LATERAL VIEW EXPLODE.
    const structArgs = expressions
      .map(e => `'${e.name.replace(/`/g, '')}', ${e.sql}`)
      .join(', ');
    const aliases = expressions.map(e => e.name).join(', ');
    return `LATERAL VIEW INLINE(ARRAY(named_struct(${structArgs}))) __lateral_join_bag AS ${aliases}\n`;
  }

  sqlOrderBy(orderTerms: string[], obr?: OrderByRequest): string {
    if (obr === 'analytical' || obr === 'turtle') {
      return `ORDER BY ${orderTerms.join(',')}`;
    }
    return `ORDER BY ${orderTerms.map(t => `${t} NULLS LAST`).join(',')}`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `FIRST(CASE WHEN group_set=${groupSet} THEN ${fieldName} END) IGNORE NULLS`;
  }

  // Build a named_struct expression that creates struct fields with the
  // correct output names. This avoids CAST(STRUCT(...) AS STRUCT<...>) which
  // can lose nested complex type information (e.g. inner array-of-struct
  // field names) in Databricks.
  private buildNamedStructExpression(fieldList: DialectFieldList): string {
    return (
      'named_struct(' +
      fieldList.map(f => `'${f.rawName}', ${f.sqlExpression}`).join(', ') +
      ')'
    );
  }

  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: CompiledOrderBy[] | undefined
  ): string {
    const namedStruct = this.buildNamedStructExpression(fieldList);
    const collectExpr = `COLLECT_LIST(${namedStruct}) FILTER (WHERE group_set=${groupSet})`;
    if (!orderBy || orderBy.length === 0) {
      return collectExpr;
    }
    return `ARRAY_SORT(${collectExpr}, (l, r) -> ${this.buildArraySortComparator(orderBy)})`;
  }

  // Build a lambda comparator for ARRAY_SORT that handles multi-field
  // mixed-direction ordering. Each field comparison returns -1/0/1;
  // fields are chained so that ties on earlier fields fall through to
  // later fields.
  private buildArraySortComparator(orderBy: CompiledOrderBy[]): string {
    const result = orderBy.reduceRight((fallthrough, ob) => {
      const asc = ob.dir === 'asc';
      const lt = asc ? -1 : 1;
      const gt = asc ? 1 : -1;
      const f = ob.structField;
      return [
        'CASE',
        `  WHEN l.${f} IS NULL AND r.${f} IS NULL THEN ${fallthrough}`,
        `  WHEN l.${f} IS NULL THEN 1`,
        `  WHEN r.${f} IS NULL THEN -1`,
        `  WHEN l.${f} < r.${f} THEN ${lt}`,
        `  WHEN l.${f} > r.${f} THEN ${gt}`,
        `  ELSE ${fallthrough}`,
        'END',
      ].join('\n');
    }, '0');
    return result;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const namedStruct = this.buildNamedStructExpression(fieldList);
    return `FIRST(CASE WHEN group_set=${groupSet} THEN ${namedStruct} END) IGNORE NULLS`;
  }

  sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string {
    return `FIRST(CASE WHEN group_set=${groupSet} THEN ${name} END) IGNORE NULLS as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const namedStruct = this.buildNamedStructExpression(fieldList);
    const nullStruct =
      'named_struct(' +
      fieldList.map(f => `'${f.rawName}', NULL`).join(', ') +
      ')';
    return `COALESCE(FIRST(CASE WHEN group_set=${groupSet} THEN ${namedStruct} END) IGNORE NULLS, ${nullStruct})`;
  }

  // Use LATERAL VIEW EXPLODE instead of LEFT JOIN LATERAL EXPLODE.
  // LEFT JOIN LATERAL EXPLODE has a Databricks bug where struct field
  // access on the exploded column returns null.
  sqlUnnestAlias(
    source: string,
    alias: string,
    _fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    if (isArray) {
      if (needDistinctKey) {
        return `LATERAL VIEW OUTER POSEXPLODE(${source}) ${alias} AS __row_id_from_${alias}, value`;
      }
      return `LATERAL VIEW OUTER EXPLODE(${source}) ${alias} AS value`;
    }
    if (needDistinctKey) {
      return `LATERAL VIEW OUTER POSEXPLODE(${source}) ${alias}_outer AS __row_id_from_${alias}, ${alias}`;
    }
    return `LATERAL VIEW OUTER EXPLODE(${source}) ${alias}_outer AS ${alias}`;
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string,
    _fieldList?: DialectFieldList
  ): string {
    let p = sourceSQLExpression;
    if (isSingleton) {
      p = `ARRAY(${p})`;
    }
    return `EXPLODE(${p})`;
  }

  // Two-chunk MD5 hash: upper 15 hex chars * 4294967296 + lower 8 hex chars
  // gives ~88 bits of entropy, matching the pattern used by Snowflake/Trino.
  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    const castKey = `CAST(${sqlDistinctKey} AS STRING)`;
    const upper = `CAST(CONV(SUBSTRING(MD5(${castKey}), 1, 15), 16, 10) AS DECIMAL(38,0)) * 4294967296`;
    const lower = `CAST(CONV(SUBSTRING(MD5(${castKey}), 16, 8), 16, 10) AS DECIMAL(38,0))`;
    return `(${upper} + ${lower})`;
  }

  // Scale the value to integer before adding to hash, then divide after
  // subtraction. This keeps all arithmetic in integer space and avoids
  // DECIMAL precision/overflow issues (Databricks max is DECIMAL(38,x)).
  sqlSumDistinct(key: string, value: string, funcName: string): string {
    const hashKey = this.sqlSumDistinctHashedKey(key);
    const scale = 100000000.0;
    const v = `CAST(COALESCE(${value},0)*${scale} AS DECIMAL(38,0))`;
    const sqlSum = `(SUM(DISTINCT ${hashKey} + ${v}) - SUM(DISTINCT ${hashKey}))/${scale}`;
    if (funcName === 'SUM') {
      return sqlSum;
    } else if (funcName === 'AVG') {
      return `(${sqlSum})/NULLIF(COUNT(DISTINCT CASE WHEN ${value} IS NOT NULL THEN ${key} END),0)`;
    }
    throw new Error(`Unknown Symmetric Aggregate function ${funcName}`);
  }

  sqlGenerateUUID(): string {
    return 'UUID()';
  }

  sqlFieldReference(
    parentAlias: string,
    _parentType: FieldReferenceType,
    childName: string,
    _childType: string
  ): string {
    if (childName === '__row_id') {
      return `__row_id_from_${parentAlias}`;
    }
    return `${parentAlias}.${this.sqlMaybeQuoteIdentifier(childName)}`;
  }

  sqlCreateFunction(id: string, funcText: string): string {
    return `CREATE TEMPORARY FUNCTION ${id}(param STRING) RETURNS STRING RETURN (\n${indent(
      funcText
    )}\n);\n`;
  }

  sqlCreateFunctionCombineLastStage(
    lastStageName: string,
    fieldList: DialectFieldList
  ): string {
    const namedStruct = this.buildNamedStructExpression(fieldList);
    return `SELECT COLLECT_LIST(${namedStruct}) FROM ${lastStageName}\n`;
  }

  sqlSelectAliasAsStruct(alias: string, fieldList: DialectFieldList) {
    const fields = fieldList
      .map(f => `${alias}.${this.sqlMaybeQuoteIdentifier(f.rawName)}`)
      .join(', ');
    return `STRUCT(${fields})`;
  }

  sqlMaybeQuoteIdentifier(identifier: string): string {
    return '`' + identifier.replace(/`/g, '``') + '`';
  }

  sqlCreateTableAsSelect(tableName: string, sql: string): string {
    return `CREATE TABLE ${tableName} AS ${sql}`;
  }

  sqlNowExpr(): string {
    return 'CURRENT_TIMESTAMP()';
  }

  sqlConvertToCivilTime(
    expr: string,
    timezone: string,
    _typeDef: AtomicTypeDef
  ): {sql: string; typeDef: AtomicTypeDef} {
    // Databricks has no timestamptz type; timestamps are stored as UTC
    // Convert from UTC to local timezone for civil time operations
    return {
      sql: `FROM_UTC_TIMESTAMP(${expr}, '${timezone}')`,
      typeDef: {type: 'timestamp'},
    };
  }

  sqlConvertFromCivilTime(
    expr: string,
    timezone: string,
    _destTypeDef: AtomicTypeDef
  ): string {
    // Convert from local timezone back to UTC
    return `TO_UTC_TIMESTAMP(${expr}, '${timezone}')`;
  }

  sqlTruncate(
    expr: string,
    unit: string,
    _typeDef: AtomicTypeDef,
    _inCivilTime: boolean,
    _timezone?: string
  ): string {
    // Databricks DATE_TRUNC starts weeks on Monday; Malloy wants Sunday.
    // Add 1 day before truncating, subtract 1 day after.
    if (unit === 'week') {
      return `(DATE_TRUNC('${unit}', ${expr} + INTERVAL 1 DAY) - INTERVAL 1 DAY)`;
    }
    return `DATE_TRUNC('${unit}', ${expr})`;
  }

  sqlOffsetTime(
    expr: string,
    op: '+' | '-',
    magnitude: string,
    unit: string,
    _typeDef: AtomicTypeDef,
    _inCivilTime: boolean,
    _timezone?: string
  ): string {
    // Use TIMESTAMPADD which accepts expressions for magnitude,
    // unlike INTERVAL which only accepts literals in Databricks.
    let offsetUnit = unit.toUpperCase();
    let offsetMag = magnitude;
    if (unit === 'quarter') {
      offsetUnit = 'MONTH';
      offsetMag = `(${magnitude})*3`;
    } else if (unit === 'week') {
      offsetUnit = 'DAY';
      offsetMag = `(${magnitude})*7`;
    }
    const n = op === '+' ? offsetMag : `-(${offsetMag})`;
    return `TIMESTAMPADD(${offsetUnit}, ${n}, ${expr})`;
  }

  sqlTimeExtractExpr(qi: QueryInfo, te: TimeExtractExpr): string {
    const units = extractionMap[te.units] || te.units;
    let extractFrom = te.e.sql;
    if (TD.isTimestamp(te.e.typeDef)) {
      const tz = qtz(qi);
      if (tz) {
        extractFrom = `FROM_UTC_TIMESTAMP(${extractFrom}, '${tz}')`;
      }
    }
    if (extractionMap[te.units]) {
      // DAYOFWEEK, DAYOFYEAR are functions
      return `${units}(${extractFrom})`;
    }
    return `EXTRACT(${units} FROM ${extractFrom})`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    const srcSQL = cast.e.sql || 'internal-error-in-sql-generation';
    const {op, srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    const tz = qtz(qi);

    if (op === 'timestamp::date' && tz) {
      return `CAST(FROM_UTC_TIMESTAMP(${srcSQL}, '${tz}') AS DATE)`;
    } else if (op === 'date::timestamp' && tz) {
      return `TO_UTC_TIMESTAMP(CAST(${srcSQL} AS TIMESTAMP_NTZ), '${tz}')`;
    }
    if (!TD.eq(srcTypeDef, dstTypeDef)) {
      if (cast.safe) {
        return `TRY_CAST(${srcSQL} AS ${dstSQLType})`;
      }
      if (TD.isString(dstTypeDef)) {
        return `CAST(${srcSQL} AS STRING)`;
      }
      return `CAST(${srcSQL} AS ${dstSQLType})`;
    }
    return srcSQL;
  }

  sqlRegexpMatch(df: RegexMatchExpr): string {
    return `REGEXP_LIKE(${df.kids.expr.sql}, ${df.kids.regex.sql})`;
  }

  sqlDateLiteral(_qi: QueryInfo, literal: string): string {
    return `DATE '${literal}'`;
  }

  sqlTimestampLiteral(
    qi: QueryInfo,
    literal: string,
    timezone: string | undefined
  ): string {
    const tz = timezone || qtz(qi);
    if (tz) {
      return `TO_UTC_TIMESTAMP(TIMESTAMP_NTZ '${literal}', '${tz}')`;
    }
    return `TIMESTAMP '${literal}'`;
  }

  sqlTimestamptzLiteral(
    _qi: QueryInfo,
    _literal: string,
    _timezone: string
  ): string {
    throw new Error('Databricks does not support timestamptz');
  }

  sqlMeasureTimeExpr(df: MeasureTimeExpr): string {
    let lVal = df.kids.left.sql;
    let rVal = df.kids.right.sql;
    if (inSeconds[df.units]) {
      lVal = `UNIX_MICROS(${lVal})`;
      rVal = `UNIX_MICROS(${rVal})`;
      const duration = `(${rVal}-${lVal})`;
      const divisor = inSeconds[df.units] * 1000000;
      return `FLOOR(${duration}/${divisor}.0)`;
    }
    throw new Error(`Unknown or unhandled Databricks time unit: ${df.units}`);
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        return `(SELECT * FROM ${tableSQL} LIMIT ${sample.rows})`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} TABLESAMPLE (${sample.percent} PERCENT))`;
      }
    }
    return tableSQL;
  }

  sqlLiteralString(literal: string): string {
    const noVirgule = literal.replace(/\\/g, '\\\\');
    return "'" + noVirgule.replace(/'/g, "\\'") + "'";
  }

  sqlLiteralRegexp(literal: string): string {
    return "'" + literal.replace(/'/g, "''") + "'";
  }

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(DATABRICKS_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(DATABRICKS_DIALECT_FUNCTIONS);
  }

  castToString(expression: string): string {
    return `CAST(${expression} AS STRING)`;
  }

  concat(...values: string[]): string {
    return `CONCAT(${values.join(',')})`;
  }

  validateTypeName(sqlType: string): boolean {
    return sqlType.match(/^[A-Za-z\s(),0-9_]*$/) !== null;
  }

  sqlLiteralArray(lit: ArrayLiteralNode): string {
    const array = lit.kids.values.map(val => val.sql);
    return `ARRAY(${array.join(',')})`;
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    const pairs = Object.entries(lit.kids).map(
      ([propName, propVal]) =>
        `${this.sqlLiteralString(propName)}, ${propVal.sql}`
    );
    return `NAMED_STRUCT(${pairs.join(', ')})`;
  }
}
