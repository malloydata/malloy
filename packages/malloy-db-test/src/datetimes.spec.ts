/* eslint-disable no-console */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import { Result } from "@malloydata/malloy";
import { RuntimeList } from "./runtimes";

// No prebuilt shared model, each test is complete.  Makes debugging easier.

const dialects = [
  "bigquery", //
  "postgres", //
];

type DialectNames = typeof dialects[number];

const runtimes = new RuntimeList(dialects);

afterAll(async () => {
  await runtimes.closeAll();
});

const basicTypes: Record<DialectNames, string> = {
  bigquery: `
    SELECT * FROM UNNEST([STRUCT(
      CAST('2021-02-24' as DATE) as t_date,
      CAST('2021-02-24 03:05:06' as TIMESTAMP) as t_timestamp
    )])`,
  postgres: `
    SELECT
      DATE('2021-02-24') as t_date,
      '2021-02-24 03:05:06'::timestamp with time zone as t_timestamp
  `,
};

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  async function sqlEq(expr: string, result: string) {
    return await runtime
      .loadQuery(
        `
          sql: basicTypes is || ${basicTypes[databaseName]} ;;
          query:
            from_sql(basicTypes) {
              dimension:
                expect is ${result}
                got is ${expr}
            }
            -> {
              project: calc is
                pick '=' when expect = got
                else concat('${expr} != ${result}. Got: ', got::string)
            }
        `
      )
      .run();
  }

  function checkEqual(result: Result) {
    let wantEq = result.data.path(0, "calc").value;
    if (wantEq != "=") {
      wantEq = wantEq + "\nSQL: " + result.sql;
    }
    return wantEq;
  }

  test(`date in sql_block no explore- ${databaseName}`, async () => {
    const result = await sqlEq("t_date", "@2021-02-24");
    expect(checkEqual(result)).toBe("=");
  });

  test(`timestamp in sql_block no explore- ${databaseName}`, async () => {
    const result = await sqlEq("t_timestamp", "@2021-02-24 03:05:06");
    expect(checkEqual(result)).toBe("=");
  });

  test(`valid timestamp without seconds - ${databaseName}`, async () => {
    // discovered this writing tests ...
    const result = await sqlEq("year(@2000-01-01 00:00)", "2000");
    expect(checkEqual(result)).toBe("=");
  });

  describe(`time operations - ${databaseName}`, () => {
    describe(`time difference - ${databaseName}`, () => {
      test("forwards is positive", async () => {
        const result = await sqlEq("day(@2000-01-01 to @2000-01-02)", "1");
        expect(checkEqual(result)).toBe("=");
      });
      test("reverse is negative", async () => {
        const result = await sqlEq("day(@2000-01-02 to @2000-01-01)", "-1");
        expect(checkEqual(result)).toBe("=");
      });
      test("DATE to TIMESTAMP", async () => {
        const result = await sqlEq(
          "day((@1999)::date to @2000-01-01 00:00:00)",
          "365"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("TIMESTAMP to DATE", async () => {
        const result = await sqlEq("month(@2000-01-01 to (@1999)::date)", "-12");
        expect(checkEqual(result)).toBe("=");
      });
      test("seconds", async () => {
        const result = await sqlEq(
          "seconds(@2001-01-01 00:00:00 to @2001-01-01 00:00:42)",
          "42"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("many seconds", async () => {
        const result = await sqlEq(
          "seconds(@2001-01-01 00:00:00 to @2001-01-02 00:00:42)",
          "86442"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("minutes", async () => {
        const result = await sqlEq(
          "minutes(@2001-01-01 00:00:00 to @2001-01-01 00:42:00)",
          "42"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("many minutes", async () => {
        const result = await sqlEq(
          "minutes(@2001-01-01 00:00:00 to @2001-01-02 00:42:00)",
          "1482"
        );
        expect(checkEqual(result)).toBe("=");
      });

      test("hours", async () => {
        const result = await sqlEq(
          "hours(@2001-01-01 00:00:00 to @2001-01-02 18:00:00)",
          "42"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("days", async () => {
        const result = await sqlEq("days(@2001-01-01 to @2001-02-12)", "42");
        expect(checkEqual(result)).toBe("=");
      });
      test("weeks", async () => {
        const result = await sqlEq("weeks(@2001-01-01 to @2001-10-27)", "42");
        expect(checkEqual(result)).toBe("=");
      });
      test("quarters", async () => {
        const result = await sqlEq("quarters(@2001-01-01 to @2011-09-30)", "42");
        expect(checkEqual(result)).toBe("=");
      });
      test("months", async () => {
        const result = await sqlEq("months(@2000-01-01 to @2003-07-01)", "42");
        expect(checkEqual(result)).toBe("=");
      });
      test("years", async () => {
        const result = await sqlEq("year(@2000 to @2042)", "42");
        expect(checkEqual(result)).toBe("=");
      });
    });

    describe(`timestamp truncation - ${databaseName}`, () => {
      // 2021-02-24 03:05:06
      test(`trunc second - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.second", "@2021-02-24 03:05:06");
        expect(checkEqual(result)).toBe("=");
      });

      test(`trunc minute - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.minute", "@2021-02-24 03:05:00");
        expect(checkEqual(result)).toBe("=");
      });

      test(`trunc hour - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.hour", "@2021-02-24 03:00:00");
        expect(checkEqual(result)).toBe("=");
      });

      test(`trunc day - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.day", "@2021-02-24 00:00:00");
        expect(checkEqual(result)).toBe("=");
      });

      test(`trunc week - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.week", "@2021-02-21 00:00:00");
        expect(checkEqual(result)).toBe("=");
      });

      test(`trunc month - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.month", "@2021-02-01 00:00:00");
        expect(checkEqual(result)).toBe("=");
      });

      test(`trunc quarter - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.quarter", "@2021-01-01 00:00:00");
        expect(checkEqual(result)).toBe("=");
      });

      test(`trunc year - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.year", "@2021-01-01 00:00:00");
        expect(checkEqual(result)).toBe("=");
      });
    });

    describe(`timestamp extraction - ${databaseName}`, () => {
      // 2021-02-24 03:05:06
      test(`extract second - ${databaseName}`, async () => {
        const result = await sqlEq("second(t_timestamp)", "6");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract minute - ${databaseName}`, async () => {
        const result = await sqlEq("minute(t_timestamp)", "5");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract hour - ${databaseName}`, async () => {
        const result = await sqlEq("hour(t_timestamp)", "3");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract day - ${databaseName}`, async () => {
        const result = await sqlEq("day(t_timestamp)", "24");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract day_of_week - ${databaseName}`, async () => {
        const result = await sqlEq("day_of_week(t_timestamp)", "4");
        expect(checkEqual(result)).toBe("=");
      });
      test(`first week day is one  - ${databaseName}`, async () => {
        const result = await sqlEq("day_of_week(t_timestamp.week)", "1");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract day_of_year - ${databaseName}`, async () => {
        const result = await sqlEq("day_of_year(t_timestamp)", "55");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract week - ${databaseName}`, async () => {
        const result = await sqlEq("week(t_timestamp)", "8");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract month - ${databaseName}`, async () => {
        const result = await sqlEq("month(t_timestamp)", "2");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract quarter - ${databaseName}`, async () => {
        const result = await sqlEq("quarter(t_timestamp)", "1");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract year - ${databaseName}`, async () => {
        const result = await sqlEq("year(t_timestamp)", "2021");
        expect(checkEqual(result)).toBe("=");
      });
    });

    describe(`date truncation - ${databaseName}`, () => {
      test(`date trunc day - ${databaseName}`, async () => {
        const result = await sqlEq("t_date.day", "@2021-02-24");
        expect(checkEqual(result)).toBe("=");
      });

      test(`date trunc week - ${databaseName}`, async () => {
        const result = await sqlEq("t_date.week", "@2021-02-21");
        expect(checkEqual(result)).toBe("=");
      });

      test(`date trunc month - ${databaseName}`, async () => {
        const result = await sqlEq("t_date.month", "@2021-02-01");
        expect(checkEqual(result)).toBe("=");
      });

      test(`date trunc quarter - ${databaseName}`, async () => {
        const result = await sqlEq("t_date.quarter", "@2021-01-01");
        expect(checkEqual(result)).toBe("=");
      });

      test(`date trunc year - ${databaseName}`, async () => {
        const result = await sqlEq("t_date.year", "@2021");
        expect(checkEqual(result)).toBe("=");
      });
    });

    describe(`date extraction - ${databaseName}`, () => {
      test(`date extract day - ${databaseName}`, async () => {
        const result = await sqlEq("day(t_date)", "24");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date extract day_of_week - ${databaseName}`, async () => {
        const result = await sqlEq("day_of_week(t_date)", "4");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date extract day_of_year - ${databaseName}`, async () => {
        const result = await sqlEq("day_of_year(t_date)", "55");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date extract week - ${databaseName}`, async () => {
        const result = await sqlEq("week(t_date)", "8");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date extract month - ${databaseName}`, async () => {
        const result = await sqlEq("month(t_date)", "2");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date extract quarter - ${databaseName}`, async () => {
        const result = await sqlEq("quarter(t_date)", "1");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date extract year - ${databaseName}`, async () => {
        const result = await sqlEq("year(t_date)", "2021");
        expect(checkEqual(result)).toBe("=");
      });
    });
    describe(`delta - ${databaseName}`, () => {
      test(`timestamp delta second - ${databaseName}`, async () => {
        const result = await sqlEq(
          "t_timestamp + 10 seconds",
          "@2021-02-24 03:05:16"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test(`timestamp delta negative second - ${databaseName}`, async () => {
        const result = await sqlEq(
          "t_timestamp - 6 seconds",
          "@2021-02-24 03:05:00"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test(`timestamp delta minute - ${databaseName}`, async () => {
        const result = await sqlEq(
          "t_timestamp + 10 minutes",
          "@2021-02-24 03:15:06"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test(`timestamp delta hours - ${databaseName}`, async () => {
        const result = await sqlEq(
          "t_timestamp + 10 hours",
          "@2021-02-24 13:05:06"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test(`timestamp delta week - ${databaseName}`, async () => {
        const result = await sqlEq(
          "(t_timestamp - 2 weeks)::date",
          "@2021-02-10"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test(`timestamp delta month - ${databaseName}`, async () => {
        const result = await sqlEq(
          "(t_timestamp + 9 months)::date",
          "@2021-11-24"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test(`timestamp delta quarter - ${databaseName}`, async () => {
        const result = await sqlEq(
          "(t_timestamp + 2 quarters)::date",
          "@2021-08-24"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test(`timestamp delta year - ${databaseName}`, async () => {
        const result = await sqlEq(
          "(t_timestamp + 10 years)::date",
          "@2031-02-24"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test(`date delta second - ${databaseName}`, async () => {
        const result = await sqlEq(
          "t_date + 10 seconds",
          "@2021-02-24 00:00:10"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test(`date delta minute - ${databaseName}`, async () => {
        const result = await sqlEq(
          "t_date + 10 minutes",
          "@2021-02-24 00:10:00"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test(`date delta hours - ${databaseName}`, async () => {
        const result = await sqlEq("t_date + 10 hours", "@2021-02-24 10:00:00");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date delta week - ${databaseName}`, async () => {
        const result = await sqlEq("t_date - 2 weeks", "@2021-02-10");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date delta month - ${databaseName}`, async () => {
        const result = await sqlEq("t_date + 9 months", "@2021-11-24");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date delta quarter - ${databaseName}`, async () => {
        const result = await sqlEq("t_date + 2 quarters", "@2021-08-24");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date delta year - ${databaseName}`, async () => {
        const result = await sqlEq("t_date + 10 years", "@2031-02-24");
        expect(checkEqual(result)).toBe("=");
      });
    });
  });
});
