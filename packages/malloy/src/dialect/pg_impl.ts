/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  ArrayLiteralNode,
  AtomicTypeDef,
  ATimestampTypeDef,
  RecordLiteralNode,
  RegexMatchExpr,
  TimeExtractExpr,
  TimestampUnit,
  TypecastExpr,
} from '../model/malloy_types';
import {TD} from '../model/malloy_types';
import type {QueryInfo} from './dialect';
import {Dialect, EscapeStyle, qtz} from './dialect';

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

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const units = timeExtractMap[from.units] || from.units;
    let extractFrom = from.e.sql;
    if (TD.isAnyTimestamp(from.e.typeDef)) {
      const tz = qtz(qi);
      if (tz) {
        extractFrom = `(${extractFrom}::TIMESTAMPTZ AT TIME ZONE '${tz}')`;
      }
    }
    const extracted = `EXTRACT(${units} FROM ${extractFrom})`;
    return from.units === 'day_of_week' ? `(${extracted}+1)` : extracted;
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    const expr = cast.e.sql || '';
    const {srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    const tz = qtz(qi);

    // Timezone-aware casts when query timezone is set
    if (tz && srcTypeDef && dstTypeDef) {
      // TIMESTAMP → DATE: convert via TIMESTAMPTZ to query timezone
      if (TD.isTimestamp(srcTypeDef) && TD.isDate(dstTypeDef)) {
        return `CAST((${expr}::TIMESTAMPTZ) AT TIME ZONE '${tz}' AS DATE)`;
      }

      // TIMESTAMPTZ → DATE: convert to query timezone
      if (TD.isTimestamptz(srcTypeDef) && TD.isDate(dstTypeDef)) {
        return `CAST((${expr}) AT TIME ZONE '${tz}' AS DATE)`;
      }

      // DATE → TIMESTAMP: interpret date in query timezone, return UTC timestamp
      if (TD.isDate(srcTypeDef) && TD.isTimestamp(dstTypeDef)) {
        return `CAST((${expr})::TIMESTAMP AT TIME ZONE '${tz}' AS TIMESTAMP)`;
      }

      // DATE → TIMESTAMPTZ: interpret date in query timezone
      if (TD.isDate(srcTypeDef) && TD.isTimestamptz(dstTypeDef)) {
        return `(${expr})::TIMESTAMP AT TIME ZONE '${tz}'`;
      }

      // TIMESTAMPTZ → TIMESTAMP: convert to query timezone (returns TIMESTAMP)
      if (TD.isTimestamptz(srcTypeDef) && TD.isTimestamp(dstTypeDef)) {
        return `(${expr}) AT TIME ZONE '${tz}'`;
      }
    }

    // No special handling needed, or no query timezone
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

  sqlTimestampLiteral(
    qi: QueryInfo,
    literal: string,
    timezone: string | undefined
  ): string {
    const tz = timezone || qtz(qi);
    if (tz) {
      return `TIMESTAMPTZ '${literal} ${tz}'::TIMESTAMP`;
    }
    return `TIMESTAMP '${literal}'`;
  }

  sqlTimestamptzLiteral(
    _qi: QueryInfo,
    literal: string,
    timezone: string
  ): string {
    return `TIMESTAMPTZ '${literal} ${timezone}'`;
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
    typeDef: AtomicTypeDef
  ): {sql: string; typeDef: AtomicTypeDef} {
    // PostgreSQL/DuckDB: AT TIME ZONE is polymorphic
    // For timestamptz (TIMESTAMPTZ): AT TIME ZONE converts to plain TIMESTAMP (civil in timezone)
    if (typeDef.type === 'timestamptz') {
      return {
        sql: `(${expr}) AT TIME ZONE '${timezone}'`,
        typeDef: {type: 'timestamp'},
      };
    }
    // For plain timestamps: cast to TIMESTAMPTZ (interprets as UTC)
    // Then AT TIME ZONE converts to plain TIMESTAMP (civil in timezone)
    return {
      sql: `(${expr})::TIMESTAMPTZ AT TIME ZONE '${timezone}'`,
      typeDef: {type: 'timestamp'},
    };
  }

  sqlConvertFromCivilTime(
    expr: string,
    timezone: string,
    destTypeDef: ATimestampTypeDef
  ): string {
    if (destTypeDef.type === 'timestamptz') {
      return `(${expr}) AT TIME ZONE '${timezone}'`;
    }
    return `((${expr}) AT TIME ZONE '${timezone}')::TIMESTAMP`;
  }

  sqlTruncate(
    expr: string,
    unit: TimestampUnit,
    _typeDef: AtomicTypeDef,
    inCivilTime: boolean,
    _timezone?: string
  ): string {
    // PostgreSQL/DuckDB starts weeks on Monday, Malloy wants Sunday
    // Add 1 day before truncating, subtract 1 day after
    let truncated: string;
    if (unit === 'week') {
      truncated = `(DATE_TRUNC('${unit}', (${expr} + INTERVAL '1' DAY)) - INTERVAL '1' DAY)`;
    } else {
      truncated = `DATE_TRUNC('${unit}', ${expr})`;
    }

    // DATE_TRUNC returns DATE for calendar units (day/week/month/quarter/year)
    // When in civil time (plain TIMESTAMP), cast DATE back to TIMESTAMP to continue operations
    const calendarUnits = ['day', 'week', 'month', 'quarter', 'year'];
    if (inCivilTime && calendarUnits.includes(unit)) {
      return `(${truncated})::TIMESTAMP`;
    }

    return truncated;
  }
}
