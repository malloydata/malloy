/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  ArrayLiteralNode,
  AtomicTypeDef,
  RecordLiteralNode,
  RegexMatchExpr,
  TimeExtractExpr,
  TimestampTypeDef,
  TimestampUnit,
  TypecastExpr,
} from '../model/malloy_types';
import {TD} from '../model/malloy_types';
import type {QueryInfo} from './dialect';
import {Dialect, qtz} from './dialect';

export const timeExtractMap: Record<string, string> = {
  'day_of_week': 'dow',
  'day_of_year': 'doy',
};

/**
 * Many SQL implementations started with the PostGres source, and therefore can use the
 * same implementations for the much of the SQL code generation
 */
export abstract class PostgresBase extends Dialect {
  hasOffsetTimestamp = true;

  sqlNowExpr(): string {
    return 'LOCALTIMESTAMP';
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const units = timeExtractMap[from.units] || from.units;
    let extractFrom = from.e.sql;
    if (TD.isTimestamp(from.e.typeDef)) {
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
    const {op, srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    const tz = qtz(qi);
    if (op === 'timestamp::date' && tz) {
      const tstz = `${expr}::TIMESTAMPTZ`;
      return `CAST((${tstz}) AT TIME ZONE '${tz}' AS DATE)`;
    } else if (op === 'date::timestamp' && tz) {
      return `CAST((${expr})::TIMESTAMP AT TIME ZONE '${tz}' AS TIMESTAMP)`;
    }
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

  sqlOffsetTimestampLiteral(
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

  sqlMaybeQuoteIdentifier(identifier: string): string {
    return '"' + identifier.replace(/"/g, '""') + '"';
  }

  sqlConvertToCivilTime(
    expr: string,
    timezone: string,
    typeDef: AtomicTypeDef
  ): {sql: string; typeDef: AtomicTypeDef} {
    // PostgreSQL/DuckDB: AT TIME ZONE is polymorphic
    // For offset timestamps (TIMESTAMPTZ): AT TIME ZONE converts to plain TIMESTAMP (civil in timezone)
    if (TD.isTimestamp(typeDef) && typeDef.offset) {
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
    destTypeDef: TimestampTypeDef
  ): string {
    if (destTypeDef.offset) {
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
