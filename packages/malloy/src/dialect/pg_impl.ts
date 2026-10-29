/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  ArrayLiteralNode,
  ATimestampTypeDef,
  RecordLiteralNode,
  ExtractUnit,
  RegexMatchExpr,
  TimestampUnit,
  TypecastExpr,
} from '../model/malloy_types';
import {TD} from '../model/malloy_types';
import type {CivilTime, QueryInfo} from './dialect';
import {Dialect, EscapeStyle} from './dialect';

export const timeExtractMap: Record<string, string> = {
  'day_of_week': 'dow',
  'day_of_year': 'doy',
};

/**
 * Many SQL implementations started with the PostGres source, and therefore can use the
 * same implementations for the much of the SQL code generation
 */
export abstract class PostgresBase extends Dialect {
  hasTimestamptz = true;
  // Postgres-family dialects use JSON serialization which loses bigint precision
  supportsBigIntPrecision = false;

  // All current Postgres-family dialects (Postgres, DuckDB, Trino, Presto)
  // use ANSI doubled-quote literal escaping and ANSI double-quote identifiers.
  // Subclasses may override.
  stringLiteralStyle = EscapeStyle.Doubled;
  identifierEscapeStyle = EscapeStyle.Doubled;
  identifierQuoteChar = '"';

  // A raw newline in a doubled literal is valid SQL but gets mangled by the
  // SQL indenter (indent() in model/utils.ts), so encode it. Postgres/DuckDB
  // use an E'...' escape string; Trino/Presto override with U&'...'.
  sqlLiteralString(literal: string): string {
    return literal.includes('\n')
      ? `E'${this.escapeBackslashStyle(literal, "'")}'`
      : super.sqlLiteralString(literal);
  }

  sqlNowExpr(): string {
    return 'LOCALTIMESTAMP';
  }

  sqlCivilExtract(
    expr: string,
    units: ExtractUnit,
    _civilType: CivilTime
  ): string {
    const extracted = `EXTRACT(${timeExtractMap[units] || units} FROM ${expr})`;
    return units === 'day_of_week' ? `(${extracted}+1)` : extracted;
  }

  sqlCast(_qi: QueryInfo, cast: TypecastExpr): string {
    const expr = cast.e.sql || '';
    const {srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    if (!TD.eq(srcTypeDef, dstTypeDef)) {
      const castFunc = cast.safe ? 'TRY_CAST' : 'CAST';
      return `${castFunc}(${expr} AS ${dstSQLType})`;
    }
    return expr;
  }

  sqlRegexpMatch(df: RegexMatchExpr): string {
    return `${df.kids.expr.sql} ~ ${df.kids.regex.sql}`;
  }

  sqlDateLiteral(_qi: QueryInfo, literal: string): string {
    return `DATE '${literal}'`;
  }

  sqlCivilLiteral(literal: string): string {
    return `TIMESTAMP '${literal}'`;
  }

  sqlTimestamptzLiteral(
    _qi: QueryInfo,
    literal: string,
    timezone: string
  ): string {
    return `TIMESTAMPTZ '${literal} ${this.checkedTimezoneName(timezone)}'`;
  }

  sqlLiteralRecord(_lit: RecordLiteralNode): string {
    throw new Error('Cannot create a record literal for postgres base dialect');
  }

  sqlLiteralArray(lit: ArrayLiteralNode): string {
    const array = lit.kids.values.map(val => val.sql);
    return 'ARRAY[' + array.join(',') + ']';
  }

  sqlConvertToCivilTime(
    expr: string,
    timezone: string,
    typeDef: ATimestampTypeDef
  ): string {
    const tz = this.sqlTimezoneLiteral(timezone);
    if (TD.isTimestamptz(typeDef)) {
      return `(${expr}) AT TIME ZONE ${tz}`;
    }
    return timezone === 'UTC'
      ? expr
      : `(${expr})::TIMESTAMPTZ AT TIME ZONE ${tz}`;
  }

  sqlConvertFromCivilTime(
    expr: string,
    timezone: string,
    destTypeDef: ATimestampTypeDef
  ): string {
    const tz = this.sqlTimezoneLiteral(timezone);
    if (TD.isTimestamptz(destTypeDef)) {
      return `(${expr}) AT TIME ZONE ${tz}`;
    }
    return timezone === 'UTC'
      ? expr
      : `((${expr}) AT TIME ZONE ${tz})::TIMESTAMP`;
  }

  sqlTruncate(
    expr: string,
    unit: TimestampUnit,
    _civilType: CivilTime
  ): string {
    // Weeks start on Monday here, so truncate the following day
    if (unit === 'week') {
      return `(DATE_TRUNC('${unit}', (${expr} + INTERVAL '1' DAY)) - INTERVAL '1' DAY)`;
    }
    return `DATE_TRUNC('${unit}', ${expr})`;
  }

  sqlCivilToDate(expr: string): string {
    return `CAST(${expr} AS DATE)`;
  }

  sqlDateToCivil(expr: string): string {
    return `CAST(${expr} AS TIMESTAMP)`;
  }
}
