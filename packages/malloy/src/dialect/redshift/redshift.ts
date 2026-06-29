/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  ArrayLiteralNode,
  AtomicTypeDef,
  MeasureTimeExpr,
  RecordLiteralNode,
  Sampling,
  TimestampUnit,
} from '../../model/malloy_types';
import {
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandOverrideMap, expandBlueprintMap} from '../functions';
import type {CompiledOrderBy, DialectFieldList} from '../dialect';
import {PostgresDialect} from '../postgres/postgres';
import {REDSHIFT_DIALECT_FUNCTIONS} from './dialect_functions';
import {REDSHIFT_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

// Redshift forks PostgreSQL 8.0.2; this overrides only the divergences below.
export class RedshiftDialect extends PostgresDialect {
  name = 'redshift';

  supportsNesting = false;
  supportsArraysInData = false;
  nestedArrays = false;
  supportUnnestArrayAgg = false;
  supportsAggDistinct = false;

  udfPrefix = '__redshift_udf_unsupported';
  hasFinalStage = false;

  maxIdentifierLength = 127;
  experimental = true;

  // Bare NUMERIC is NUMERIC(38,0) on Redshift and truncates the fraction in
  // symmetric-aggregate casts; pin a scale so sums keep their decimals.
  defaultDecimalType = 'DECIMAL(38,9)';

  private unsupported(feature: string): never {
    throw new Error(`Redshift dialect does not support ${feature}`);
  }

  // GENERATE_SERIES is leader-node-only on Redshift, so build group_set via UNION ALL.
  sqlGroupSetTable(groupSetCount: number): string {
    const rows = Array.from(
      {length: groupSetCount + 1},
      (_, i) => `SELECT ${i} AS group_set`
    ).join(' UNION ALL ');
    return `CROSS JOIN (${rows}) as group_set`;
  }

  sqlGenerateUUID(): string {
    return 'MD5(RANDOM()::VARCHAR || RANDOM()::VARCHAR)';
  }

  // DECIMAL caps at 38 digits, so a 60-bit MD5 slice stays inside DECIMAL(38,0) under SUM().
  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    return `STRTOL(SUBSTRING(MD5(${sqlDistinctKey}::VARCHAR), 1, 15), 16)::DECIMAL(38,0)`;
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        return `(SELECT * FROM ${tableSQL} ORDER BY RANDOM() LIMIT ${sample.rows})`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} WHERE RANDOM() < ${sample.percent} / 100.0)`;
      }
    }
    return tableSQL;
  }

  // No make_interval, and DATEADD has no timestamptz overload, so a non-civil
  // timestamptz round-trips through a UTC-anchored plain timestamp (session-tz invariant).
  sqlOffsetTime(
    expr: string,
    op: '+' | '-',
    magnitude: string,
    unit: TimestampUnit,
    typeDef: AtomicTypeDef,
    inCivilTime: boolean,
    _timezone?: string
  ): string {
    const signedMag = op === '-' ? `-(${magnitude})` : `(${magnitude})`;
    const isTimestamptz = !inCivilTime && typeDef.type === 'timestamptz';
    const target = isTimestamptz ? `(${expr}) AT TIME ZONE 'UTC'` : expr;
    const offset = `DATEADD(${unit}, (${signedMag})::integer, ${target})`;
    return isTimestamptz ? `(${offset}) AT TIME ZONE 'UTC'` : offset;
  }

  // Redshift's EXTRACT(EPOCH FROM ...) truncates fractional seconds, so the Postgres
  // epoch-difference measure loses sub-second precision; DATEDIFF(microsecond) keeps it.
  sqlMeasureTimeExpr(df: MeasureTimeExpr): string {
    const inSeconds: Record<string, number> = {
      'second': 1,
      'minute': 60,
      'hour': 3600,
      'day': 24 * 3600,
      'week': 7 * 24 * 3600,
    };
    const seconds = inSeconds[df.units];
    if (seconds) {
      const micros = `DATEDIFF(microsecond, ${df.kids.left.sql}, ${df.kids.right.sql})`;
      return `FLOOR((${micros})/${(seconds * 1000000).toString()}.0)`;
    }
    throw new Error(`Unknown or unhandled redshift time unit: ${df.units}`);
  }

  // PostgresBase emits E'...' strings (for newlines) that Redshift rejects; escape with backslashes.
  sqlLiteralString(literal: string): string {
    return "'" + this.escapeBackslashStyle(literal, "'") + "'";
  }

  // Redshift has no FILTER (WHERE ...) on aggregates.
  sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string {
    return `MAX(CASE WHEN group_set=${groupSet} AND ${name} IS NOT NULL THEN ${name} END) as ${sqlName}`;
  }

  // No STRING_AGG and CONCAT is binary-only, so use LISTAGG + ||. MD5-wrap the key so
  // the sentinel-strip region stays hex (REGEXP_REPLACE has no lazy quantifier).
  sqlStringAggDistinct(
    distinctKey: string,
    valueSQL: string,
    separatorSQL: string
  ) {
    const keyStart = '__STRING_AGG_KS__';
    const keyEnd = '__STRING_AGG_KE__';
    const separator = separatorSQL.length > 0 ? separatorSQL : "','";
    const distinctValueSQL = `'${keyStart}' || MD5(${distinctKey}) || '${keyEnd}' || (${valueSQL})`;
    return `REGEXP_REPLACE(
      LISTAGG(DISTINCT ${distinctValueSQL}, ${separator}),
      '${keyStart}[0-9a-fA-F]*${keyEnd}',
      ''
    )`;
  }

  sqlAggregateTurtle(
    _groupSet: number | undefined,
    _fieldList: DialectFieldList,
    _orderBy: CompiledOrderBy[] | undefined,
    _limit?: number,
    _filterSQL?: string
  ): string {
    this.unsupported('nested aggregates');
  }

  sqlCoaleseMeasuresInline(
    _groupSet: number,
    _fieldList: DialectFieldList
  ): string {
    this.unsupported('nested aggregates');
  }

  sqlUnnestAlias(
    _source: string,
    _alias: string,
    _fieldList: DialectFieldList,
    _needDistinctKey: boolean,
    _isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    this.unsupported('UNNEST of nested data');
  }

  sqlUnnestPipelineHead(
    _isSingleton: boolean,
    _sourceSQLExpression: string
  ): string {
    this.unsupported('nested pipelines');
  }

  sqlCreateFunction(_id: string, _funcText: string): string {
    this.unsupported('generated SQL UDFs');
  }

  sqlCreateFunctionCombineLastStage(_lastStageName: string): string {
    this.unsupported('generated SQL UDFs');
  }

  sqlLiteralArray(_lit: ArrayLiteralNode): string {
    this.unsupported('array literals');
  }

  sqlLiteralRecord(_lit: RecordLiteralNode): string {
    this.unsupported('record literals');
  }

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(REDSHIFT_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(REDSHIFT_DIALECT_FUNCTIONS);
  }

  // Redshift rejects the 3rd (default) arg of LAG/LEAD entirely, so the override
  // emits a 2-arg call and the default is supplied here. Caveat: COALESCE also
  // replaces a genuine in-range NULL with the default, which native 3-arg LAG would
  // not — Redshift offers no alternative.
  sqlAnalyticWindowDefault(
    windowSQL: string,
    defaultSQL: string | undefined
  ): string {
    return defaultSQL !== undefined
      ? `COALESCE(${windowSQL}, ${defaultSQL})`
      : windowSQL;
  }
}
