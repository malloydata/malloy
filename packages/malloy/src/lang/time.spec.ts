/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import "./jestery";
import { compressExpr, ExpressionDef } from "./ast";
import { FieldSpace } from "./field-space";
import { TestTranslator, pretty } from "./jest-factories";

const dnow = "DATE(CURRENT_TIMESTAMP())";
const now = "CURRENT_TIMESTAMP()";
function dtrunc(d: string, unit: string): string {
  return `DATE_TRUNC(${d},${unit.toUpperCase()})`;
}
function tstrunc(ts: string, unit: string): string {
  return `TIMESTAMP_TRUNC(${ts},${unit.toUpperCase()})`;
}
function tsop(op: string, ts: string, n: number, unit: string) {
  return `TIMESTAMP_${op.toUpperCase()}(${ts},INTERVAL ${n} ${unit.toUpperCase()})`;
}
function dop(op: string, ts: string, n: number, unit: string) {
  return `DATE_${op.toUpperCase()}(${ts},INTERVAL ${n} ${unit.toUpperCase()})`;
}
function dtop(op: string, ts: string, n: number, unit: string) {
  return `TIMESTAMP(DATETIME_${op.toUpperCase()}(DATETIME(${ts}),INTERVAL ${n} ${unit.toUpperCase()}))`;
}

function between(when: string, st: string, en: string) {
  return `(${when}>=${st})and(${when}<${en})`;
}

function nowBetween(st: string, en: string) {
  return between(now, st, en);
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      makesSQL(result: string): R;
    }
  }
}

const fs = new FieldSpace({
  type: "struct",
  name: "empty",
  dialect: "standardsql",
  structSource: { type: "table" },
  structRelationship: { type: "basetable", connectionName: "test" },
  fields: [],
});

expect.extend({
  makesSQL(src: string, sql: string) {
    const trans = new TestTranslator(src, "fieldExpr");
    expect(trans).toBeValidMalloy();
    const fieldExpr = trans.ast();
    expect(fieldExpr).toBeDefined();
    if (fieldExpr instanceof ExpressionDef) {
      const result = compressExpr(fieldExpr.getExpression(fs).value);
      expect(result[0]).toBe(sql);
      return {
        message: () => `${src}  => ${sql}`,
        pass: true,
      };
    }
    return {
      message: () => `${src} => ${pretty(fieldExpr)}`,
      pass: false,
    };
  },
});

describe("time literals", () => {
  test("now", () => {
    expect("now").makesSQL(now);
  });

  test("literal year as moment", () => {
    expect("IFNULL(now,@1960)").makesSQL(`IFNULL(${now},'1960-01-01')`);
  });

  test("literal year as range", () => {
    expect("now:@1960").makesSQL(nowBetween("'1960-01-01'", "'1961-01-01'"));
  });

  test("literal Q1", () => {
    expect("now: @1960-Q1").makesSQL(
      nowBetween("'1960-01-01'", "'1960-04-01'")
    );
  });

  test("literal Q4", () => {
    expect("now: @1960-Q4").makesSQL(
      nowBetween("'1960-10-01'", "'1961-01-01'")
    );
  });

  test("literal week", () => {
    expect("now : @WK1960-06-26").makesSQL(
      nowBetween("'1960-06-26'", "'1960-07-03'")
    );
  });

  test("literal week midweek date", () => {
    expect("now : @WK1960-06-30").makesSQL(
      nowBetween("'1960-06-26'", "'1960-07-03'")
    );
  });

  test("literal month", () => {
    expect("now : @1960-06").makesSQL(
      nowBetween("'1960-06-01'", "'1960-07-01'")
    );
  });

  test("literal day", () => {
    expect("now : @1960-06-30").makesSQL(
      nowBetween("'1960-06-30'", "'1960-07-01'")
    );
  });

  test("in partials", () => {
    expect("now: > @1960").makesSQL(`${now}>='1961-01-01'`);
  });

  test("in alternations", () => {
    const yr = "'1960-01-01'";
    const nyr = "'1961-01-01'";
    const nnyr = "'1962-01-01'";
    const y1960 = nowBetween(yr, nyr);
    const y1961 = nowBetween(nyr, nnyr);
    expect("now: @1960 | @1961").makesSQL(`(${y1960})or(${y1961})`);
  });
});

describe("timestamp arithmetic", () => {
  test("plus one day", () => {
    expect("now + 1 day").makesSQL(tsop("add", now, 1, "day"));
  });

  test("plus (one day)", () => {
    expect("now + (1 day)").makesSQL(tsop("add", now, 1, "day"));
  });

  test("minus one week", () => {
    expect("now - 1 week").makesSQL(dtop("sub", now, 1, "week"));
  });

  test("plus one month", () => {
    expect("now + 1 month").makesSQL(dtop("add", now, 1, "month"));
  });

  test("minus one quarter", () => {
    expect("now - 1 quarter").makesSQL(dtop("sub", now, 1, "quarter"));
  });

  test("plus one year", () => {
    expect("now + 1 year").makesSQL(dtop("add", now, 1, "year"));
  });

  test("delta assumes granularity of rhs when lhs has none", () => {
    const t0 = tsop("add", now, 1, "day");
    const t1 = tsop("add", t0, 1, "day");
    expect("now = now + 1 day").makesSQL(nowBetween(`${t0}`, `${t1}`));
  });

  test("delta defaults to granularity of lhs", () => {
    expect("now.year + 1").makesSQL(
      dtop("add", tstrunc(now, "year"), 1, "year")
    );
  });

  test("parens preserve granularity", () => {
    expect("(now.year) + 1").makesSQL(
      dtop("add", `(${tstrunc(now, "year")})`, 1, "year")
    );
  });

  test("delta chained granularity", () => {
    const t0 = tstrunc(now, "quarter");
    const t1 = tsop("add", t0, 1, "second");
    const t2 = dtop("add", t1, 1, "month");
    expect("now.quarter + 1 second + 1 month").makesSQL(t2);
  });

  test("truncation as value is start of trucnation", () => {
    expect("IFNULL(now.day,true)").makesSQL(
      `IFNULL(${tstrunc(now, "day")},true)`
    );
  });

  test("truncation with partial is a range", () => {
    const t0 = tstrunc(now, "hour");
    const t1 = tsop("add", t0, 1, "hour");
    expect("now : > now.hour").makesSQL(`${now}>=${t1}`);
  });
});

describe("truncation", () => {
  for (const unit of [
    "second",
    "minute",
    "hour",
    "day",
    "week",
    "month",
    "quarter",
    "year",
  ]) {
    test(unit, () => {
      expect(`now.${unit}`).makesSQL(tstrunc(now, unit));
    });
  }

  test("uses timestamp for hour delta", () => {
    expect("now.hour + 1").makesSQL(
      tsop("add", tstrunc(now, "hour"), 1, "hour")
    );
  });

  test("uses datetime for week delta", () => {
    expect("now.week + 1").makesSQL(
      dtop("add", tstrunc(now, "week"), 1, "week")
    );
  });
});

describe("date cast", () => {
  test("cast date compares as granular", () => {
    const t0 = dnow;
    const t1 = dop("add", dnow, 1, "day");
    expect("now : now::date").makesSQL(between(dnow, t0, t1));
  });
});

describe("for-ranges", () => {
  test("timestamp for 5 seconds", () => {
    const t0 = now;
    const t1 = tsop("add", now, 5, "second");
    expect("now:now for 5 seconds").makesSQL(nowBetween(`${t0}`, `${t1}`));
  });

  test("truncation for 5 days", () => {
    const t0 = now;
    const t1 = tsop("add", now, 5, "day");
    expect("now.day:now for 5 day").makesSQL(
      between(tstrunc(now, "day"), `${t0}`, `${t1}`)
    );
  });

  test("date for non date duration", () => {
    const t0 = `TIMESTAMP(${dnow})`;
    expect("now : now::date for 10 seconds").makesSQL(
      nowBetween(t0, tsop("add", t0, 10, "second"))
    );
  });

  test("literal for 5 hours", () => {
    const t0 = "'2060-01-01'";
    const t1 = tsop("add", t0, 5, "hour");
    expect("now:@2060 for 5 hours").makesSQL(nowBetween(`${t0}`, `${t1}`));
  });
});

describe("to-ranges", () => {
  test("literal to expression", () => {
    const t0 = "'1960-01-01'";
    const t1 = now;
    expect("now:@1960 to now").makesSQL(nowBetween(t0, t1));
  });

  test("expression to literal", () => {
    const t0 = now;
    const t1 = "'2031-01-01'";
    expect("now:now to @2031").makesSQL(nowBetween(t0, t1));
  });

  test("literal to literal", () => {
    const t0 = "'1960-01-01'";
    const t1 = "'1961-01-01'";
    expect("now:@1960 to @1961").makesSQL(nowBetween(t0, t1));
  });
});

describe("operations on date types", () => {
  const dateParts = ["year", "quarter", "month", "week", "day"];
  for (const part of dateParts) {
    test(`truncate ${part}`, () => {
      expect(`now::date.${part}`).makesSQL(dtrunc(dnow, part));
    });

    test(`date plus ${part}`, () => {
      expect(`now::date + 1 ${part}`).makesSQL(dop("add", dnow, 1, part));
    });
  }

  test("date compare literal", () => {
    expect("now::date > @1960").makesSQL(`${dnow}>='1961-01-01'`);
  });

  test("date match date to range", () => {
    const t0 = dop("sub", dnow, 1, "day");
    const t1 = dop("add", dnow, 1, "day");
    expect("now::date : (now::date-1) to (now::date+1)").makesSQL(
      between(dnow, t0, t1)
    );
  });

  test("date match date for range", () => {
    const t0 = dnow;
    const t1 = dop("add", dnow, 2, "day");
    expect("now::date : now::date for 2 days").makesSQL(between(dnow, t0, t1));
  });

  test("date match truncated date", () => {
    const t0 = dtrunc(dnow, "day");
    const t1 = dop("add", t0, 1, "day");
    expect("now::date : now::date.day").makesSQL(between(dnow, t0, t1));
  });

  test("date match literal", () => {
    const t0 = "'1960-01-01'";
    const t1 = "'1961-01-01'";
    expect("now::date : @1960").makesSQL(between(dnow, `${t0}`, `${t1}`));
  });

  test("date match timestamp for range", () => {
    const tdnow = `TIMESTAMP(${dnow})`;
    const t1 = dtop("add", now, 1, "year");
    expect("now::date : now for 1 year").makesSQL(between(tdnow, now, t1));
  });

  test("date in for date duration not date", () => {
    const t0 = `TIMESTAMP(${dnow})`;
    const t1 = tsop("add", t0, 1, "hour");
    expect("now::date : now::date for 1 hour").makesSQL(between(t0, t0, t1));
  });

  test("date compare timestamp", () => {
    expect("now::date > now").makesSQL(`${dnow}>${dnow}`);
  });

  test("date partial compare timestamp", () => {
    expect("now::date : >now").makesSQL(`${dnow}>${dnow}`);
  });

  test("date match timestamp to range", () => {
    const t0 = dnow;
    const t1 = `DATE(${dtop("add", now, 1, "year")})`;
    expect("now::date : now to (now + 1 year)").makesSQL(between(dnow, t0, t1));
  });

  test("timestamp match date to range", () => {
    const t0 = dnow;
    const t1 = dop("add", dnow, 1, "year");
    expect("now : now::date to (now::date + 1 year)").makesSQL(
      between(dnow, t0, t1)
    );
  });

  test("timestamp in date for range", () => {
    const t0 = `TIMESTAMP(${dnow})`;
    const t1 = dtop("add", t0, 1, "year");
    expect("now : now::date for 1 year").makesSQL(nowBetween(t0, t1));
  });

  test("timestamp match truncated date", () => {
    const t0 = dtrunc(dnow, "month");
    const t1 = dop("add", t0, 1, "month");
    expect("now : now::date.month").makesSQL(between(dnow, t0, t1));
  });
});

describe("extraction", () => {
  for (const partName of [
    "day_of_week",
    "day",
    "day_of_year",
    "week",
    "month",
    "quarter",
    "year",
    "hour",
    "minute",
    "second",
  ]) {
    test(partName, () => {
      const fn = partName.toUpperCase().replace(/_/g, "");
      expect(`${partName}(now)`).makesSQL(
        `EXTRACT(${fn} FROM CURRENT_TIMESTAMP())`
      );
    });
  }
});
