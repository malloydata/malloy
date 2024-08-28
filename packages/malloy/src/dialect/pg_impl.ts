/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {
  RegexMatchExpr,
  TimeExtractExpr,
  TimeLiteralNode,
  TimeTruncExpr,
  TypecastExpr,
} from '../model/malloy_types';
import {Dialect, qtz, QueryInfo} from './dialect';

const timeExtractMap: Record<string, string> = {
  'day_of_week': 'dow',
  'day_of_year': 'doy',
};

/**
 * Many SQL implementations started with the PostGres source, and therefore can use the
 * same implementations for the much of the SQL code generation
 */
export abstract class PostgresBase extends Dialect {
  sqlTruncExpr(qi: QueryInfo, df: TimeTruncExpr): string {
    // adjusting for monday/sunday weeks
    const week = df.units === 'week';
    const truncThis = week ? `${df.e.sql} + INTERVAL 1 DAY` : df.e.sql;
    if (df.e.dataType === 'timestamp') {
      const tz = qtz(qi);
      if (tz) {
        const civilSource = `(${truncThis}::TIMESTAMPTZ AT TIME ZONE '${tz}')`;
        let civilTrunc = `DATE_TRUNC('${df.units}', ${civilSource})`;
        // MTOY todo ... only need to do this if this is a date ...
        civilTrunc = `${civilTrunc}::TIMESTAMP`;
        const truncTsTz = `${civilTrunc} AT TIME ZONE '${tz}'`;
        return `(${truncTsTz})::TIMESTAMP`;
      }
    }
    let result = `DATE_TRUNC('${df.units}', ${truncThis})`;
    if (week) {
      result = `(${result} - INTERVAL 1 DAY)`;
    }
    return result;
  }

  sqlNowExpr(): string {
    return 'LOCALTIMESTAMP';
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const units = timeExtractMap[from.units] || from.units;
    let extractFrom = from.e.sql;
    if (from.e.dataType === 'timestamp') {
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
    const op = `${cast.srcType}::${cast.dstType}`;
    const tz = qtz(qi);
    if (op === 'timestamp::date' && tz) {
      const tstz = `${expr}::TIMESTAMPTZ`;
      return `CAST((${tstz}) AT TIME ZONE '${tz}' AS DATE)`;
    } else if (op === 'date::timestamp' && tz) {
      return `CAST((${expr})::TIMESTAMP AT TIME ZONE '${tz}' AS TIMESTAMP)`;
    }
    if (cast.srcType !== cast.dstType) {
      const dstType =
        typeof cast.dstType === 'string'
          ? this.malloyTypeToSQLType({type: cast.dstType})
          : cast.dstType.raw;
      const castFunc = cast.safe ? 'TRY_CAST' : 'CAST';
      return `${castFunc}(${expr} AS ${dstType})`;
    }
    return expr;
  }

  sqlRegexpMatch(df: RegexMatchExpr): string {
    return `${df.kids.expr.sql} ~ ${df.kids.regex.sql})`;
  }

  sqlLiteralTime(qi: QueryInfo, lt: TimeLiteralNode): string {
    if (lt.dataType === 'date') {
      return `DATE '${lt.literal}'`;
    }
    const tz = lt.timezone || qtz(qi);
    if (tz) {
      return `TIMESTAMPTZ '${lt.literal} ${tz}'::TIMESTAMP`;
    }
    return `TIMESTAMP '${lt.literal}'`;
  }
}
