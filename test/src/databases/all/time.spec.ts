/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import '@malloydata/malloy/test/matchers';
import {mkTestModel, TV, wrapTestModel} from '@malloydata/malloy/test';
import '../../util/db-jest-matchers'; // For isSqlEq matcher used with sqlEq helper
import {
  brokenIn,
  databasesFromEnvironmentOr,
  mkSqlEqWith,
  runQuery,
} from '../../util';
import {DateTime as LuxonDateTime} from 'luxon';
import {API} from '@malloydata/malloy';
import {TestSelect} from '../../test-select';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

// MTOY todo look at this list for timezone problems, I know there are some
describe.each(runtimes.runtimeList)('%s date and time', (dbName, runtime) => {
  const testModel = wrapTestModel(runtime, '');
  const ts = new TestSelect(runtime.dialect);
  const timestamptz = runtime.dialect.hasTimestamptz;
  const timeSchema = {
    t_date: ts.mk_date('2021-02-24'),
    t_timestamp: ts.mk_timestamp('2021-02-24 03:05:06'),
  };
  if (timestamptz) {
    timeSchema['t_timestamptz'] = ts.mk_timestamptz(
      '2021-02-24 03:05:06 [UTC]'
    );
  }
  const timeSQL = ts.generate(timeSchema);
  const sqlEq = mkSqlEqWith(runtime, dbName, {sql: timeSQL});

  describe('interval measurement', () => {
    test('forwards is positive', async () => {
      const eq = sqlEq('day(@2000-01-01 to @2000-01-02)', '1');
      expect(await eq).isSqlEq();
    });
    test('reverse is negative', async () => {
      const eq = sqlEq('day(@2000-01-02 to @2000-01-01)', '-1');
      expect(await eq).isSqlEq();
    });

    test('seconds', async () => {
      expect(await sqlEq('seconds(now to now + 1 second)', 1)).isSqlEq();
      expect(await sqlEq('seconds(now to now)', 0)).isSqlEq();
      expect(await sqlEq('seconds(now to now + 2 seconds)', 2)).isSqlEq();
      expect(await sqlEq('seconds(now to now - 2 seconds)', -2)).isSqlEq();
      const a = '@2001-01-01 00:00:00';
      const b = '@2001-01-01 00:00:00.999';
      expect(await sqlEq(`seconds(${a} to ${b})`, 0)).isSqlEq();
      expect(await sqlEq(`seconds(${b} to @2001-01-01 00:00:01)`, 0)).isSqlEq();
    });

    test('minutes', async () => {
      expect(
        await sqlEq('minutes(@2022-10-03 10:23:08 to @2022-10-03 10:24:07)', 0)
      ).isSqlEq();

      expect(await sqlEq('minutes(now to now + 1 minute)', 1)).isSqlEq();
      expect(await sqlEq('minutes(now to now + 59 seconds)', 0)).isSqlEq();
      expect(await sqlEq('minutes(now to now + 2 minutes)', 2)).isSqlEq();
      expect(await sqlEq('minutes(now to now - 2 minutes)', -2)).isSqlEq();
    });

    test('hours', async () => {
      expect(
        await sqlEq('hours(@2022-10-03 10:23:00 to @2022-10-03 11:22:00)', 0)
      ).isSqlEq();
      expect(await sqlEq('hours(now to now + 1 hour)', 1)).isSqlEq();
      expect(await sqlEq('hours(now to now + 59 minutes)', 0)).isSqlEq();
      expect(await sqlEq('hours(now to now + 120 minutes)', 2)).isSqlEq();
      expect(await sqlEq('hours(now to now - 2 hours)', -2)).isSqlEq();
    });

    test('days', async () => {
      expect(await sqlEq('days(now.day to now.day + 1 day)', 1)).isSqlEq();
      expect(await sqlEq('days(now.day to now.day + 23 hours)', 0)).isSqlEq();
      expect(await sqlEq('days(now.day to now.day + 48 hours)', 2)).isSqlEq();
      expect(await sqlEq('days(now.day to now.day - 48 hours)', -2)).isSqlEq();
      expect(
        await sqlEq('days(@2022-10-03 10:23:00 to @2022-10-04 09:23:00)', 0)
      ).isSqlEq();
    });

    test.when(!brokenIn('snowflake', dbName))(
      'timeDiff passed to a function preserves rhs',
      async () => {
        await expect(`
        run: ${dbName}.sql("SELECT 1")
        -> { select: yd is floor(days(@2001 to @2002)) }
      `).toMatchResult(testModel, {yd: 365});
      }
    );
  });

  // Measuring a range in a calendar unit (week/month/quarter/year) is defined
  // only for date-to-date ranges; timestamp ranges still error. The unit is
  // whole units *completed*, truncated toward zero — a crossed calendar
  // boundary is not a completed unit. The partial and reverse-partial cases are
  // what separate this from boundary-crossing; the exact cases guard the other
  // direction. Every case here runs on all dialects, so any dialect that counts
  // boundaries instead of completed units fails.
  describe('date interval measurement', () => {
    test('weeks', async () => {
      // exact: 7 days is one completed week
      expect(await sqlEq('weeks(@2022-10-01 to @2022-10-08)', 1)).isSqlEq();
      // 6 days: crosses a week boundary but no week is completed
      expect(await sqlEq('weeks(@2022-10-01 to @2022-10-07)', 0)).isSqlEq();
      // reverse of the partial: 0, not -1
      expect(await sqlEq('weeks(@2022-10-07 to @2022-10-01)', 0)).isSqlEq();
      // exact negative: 14 days
      expect(await sqlEq('weeks(@2022-10-15 to @2022-10-01)', -2)).isSqlEq();
      // 365 days is 52 completed weeks (52 * 7 = 364)
      expect(await sqlEq('weeks(@2022-10-02 to @2023-10-02)', 52)).isSqlEq();
    });

    test('months', async () => {
      // exact
      expect(await sqlEq('months(@2001-01-01 to @2001-02-01)', 1)).isSqlEq();
      // Jan 31 + 1 month = Feb 28 > Feb 15: boundary crossed, month not completed
      expect(await sqlEq('months(@2001-01-31 to @2001-02-15)', 0)).isSqlEq();
      // reverse of the partial: 0, not -1
      expect(await sqlEq('months(@2001-02-15 to @2001-01-31)', 0)).isSqlEq();
      // exact, spanning a year boundary
      expect(await sqlEq('months(@2001-01-01 to @2002-02-01)', 13)).isSqlEq();
      // a 28-day February is still one whole month
      expect(await sqlEq('months(@2021-02-01 to @2021-03-01)', 1)).isSqlEq();
    });

    // Recorded, not resolved. What "+1 month" means off the 31st is undecided
    // in Malloy, and the engines split on it. Measured 2026-07-10:
    //   months(@2020-01-31 to @2020-02-29)
    //     => 1 on duckdb, bigquery, snowflake  (Jan 31 + 1 month clamps to
    //        Feb 29, which is reached, so one whole month has elapsed)
    //     => 0 on mysql, postgres, databricks  (day-of-month 31 is never
    //        reached in February, so no whole month has elapsed)
    // Both readings are defensible. Pick a convention, then un-skip and set the
    // expected value; until then this range has no cross-dialect answer.
    test.skip('end-of-month month arithmetic is undecided', async () => {
      expect(await sqlEq('months(@2020-01-31 to @2020-02-29)', 1)).isSqlEq();
    });

    test('quarters', async () => {
      // exact
      expect(await sqlEq('quarters(@2022-01-01 to @2022-04-01)', 1)).isSqlEq();
      // Jan 15 + 1 quarter = Apr 15 > Apr 1: boundary crossed, quarter not completed
      expect(await sqlEq('quarters(@2022-01-15 to @2022-04-01)', 0)).isSqlEq();
      // reverse of the partial: 0, not -1
      expect(await sqlEq('quarters(@2022-04-01 to @2022-01-15)', 0)).isSqlEq();
      // exact
      expect(await sqlEq('quarters(@2022-01-01 to @2022-07-01)', 2)).isSqlEq();
      // exact negative
      expect(await sqlEq('quarters(@2022-07-01 to @2022-01-01)', -2)).isSqlEq();
    });

    test('years', async () => {
      // exact
      expect(await sqlEq('years(@2022-01-01 to @2023-01-01)', 1)).isSqlEq();
      // Jun 1 + 1 year = Jun 1 2023 > Jan 1 2023: boundary crossed, year not completed
      expect(await sqlEq('years(@2022-06-01 to @2023-01-01)', 0)).isSqlEq();
      // reverse of the partial: 0, not -1
      expect(await sqlEq('years(@2023-01-01 to @2022-06-01)', 0)).isSqlEq();
      // almost a year, but no boundary crossed and none completed
      expect(await sqlEq('years(@2022-01-01 to @2022-12-31)', 0)).isSqlEq();
      // exact
      expect(await sqlEq('years(@2022-01-01 to @2024-01-01)', 2)).isSqlEq();
      // exact negative
      expect(await sqlEq('years(@2024-01-01 to @2022-01-01)', -2)).isSqlEq();
    });
  });

  describe('timestamp truncation', () => {
    // 2021-02-24 03:05:06
    test('trunc second', async () => {
      const eq = sqlEq('t_timestamp.second', '@2021-02-24 03:05:06');
      expect(await eq).isSqlEq();
    });

    test('trunc minute', async () => {
      const eq = sqlEq('t_timestamp.minute', '@2021-02-24 03:05:00');
      expect(await eq).isSqlEq();
    });

    test('trunc hour', async () => {
      const eq = sqlEq('t_timestamp.hour', '@2021-02-24 03:00:00');
      expect(await eq).isSqlEq();
    });

    test('trunc day', async () => {
      const eq = sqlEq('t_timestamp.day', '@2021-02-24 00:00:00');
      expect(await eq).isSqlEq();
    });

    test.when(timestamptz)('trunc timestamptz day', async () => {
      await expect(`
          run: ${dbName}.sql("""${timeSQL}""") -> {
            select: result is t_timestamptz.day
          }
        `).toMatchResult(testModel, {result: '2021-02-24T00:00:00.000Z'});
    });

    test('trunc week', async () => {
      const eq = sqlEq('t_timestamp.week', '@2021-02-21 00:00:00');
      expect(await eq).isSqlEq();
    });

    test('trunc month', async () => {
      const eq = sqlEq('t_timestamp.month', '@2021-02-01 00:00:00');
      expect(await eq).isSqlEq();
    });

    test('trunc quarter', async () => {
      const eq = sqlEq('t_timestamp.quarter', '@2021-01-01 00:00:00');
      expect(await eq).isSqlEq();
    });

    test('trunc year', async () => {
      const eq = sqlEq('t_timestamp.year', '@2021-01-01 00:00:00');
      expect(await eq).isSqlEq();
    });
  });

  describe('timestamp extraction', () => {
    // 2021-02-24 03:05:06
    test('extract second', async () => {
      const eq = sqlEq('second(t_timestamp)', '6');
      expect(await eq).isSqlEq();
    });
    test('extract minute', async () => {
      const eq = sqlEq('minute(t_timestamp)', '5');
      expect(await eq).isSqlEq();
    });
    test('extract hour', async () => {
      const eq = sqlEq('hour(t_timestamp)', '3');
      expect(await eq).isSqlEq();
    });
    test('extract day', async () => {
      const eq = sqlEq('day(t_timestamp)', '24');
      expect(await eq).isSqlEq();
    });
    test('extract day_of_week', async () => {
      const eq = sqlEq('day_of_week(t_timestamp)', '4');
      expect(await eq).isSqlEq();
    });
    test('first week day is one ', async () => {
      const eq = sqlEq('day_of_week(t_timestamp.week)', '1');
      expect(await eq).isSqlEq();
    });
    test('extract day_of_year', async () => {
      const eq = sqlEq('day_of_year(t_timestamp)', '55');
      expect(await eq).isSqlEq();
    });
    test('extract week', async () => {
      const eq = sqlEq('week(t_timestamp)', '8');
      expect(await eq).isSqlEq();
    });
    test('extract month', async () => {
      const eq = sqlEq('month(t_timestamp)', '2');
      expect(await eq).isSqlEq();
    });
    test('extract quarter', async () => {
      const eq = sqlEq('quarter(t_timestamp)', '1');
      expect(await eq).isSqlEq();
    });
    test('extract year', async () => {
      const eq = sqlEq('year(t_timestamp)', '2021');
      expect(await eq).isSqlEq();
    });
  });

  test.when(timestamptz)(
    'extract from timestamptz without query timezone',
    async () => {
      // TIMESTAMPTZ representing midnight UTC
      // Without query timezone, extract should happen in UTC
      // Expected: hour = 0, day = 20
      await expect(
        `run: ${dbName}.sql("SELECT 1 as x") -> {
          extend: { dimension: utc_tstz is @2020-02-20 00:00:00[UTC]::timestamptz }
          select:
            utc_hour is hour(utc_tstz)
            utc_day is day(utc_tstz)
        }`
      ).toMatchResult(testModel, {utc_hour: 0, utc_day: 20});
    }
  );

  // 20:00 on the 30th in Mexico City is 02:00 on the 31st in UTC. With no
  // query time zone the value is read in UTC, not in the zone it was written in.
  describe('timestamptz written in another zone', () => {
    const tzModel = () =>
      mkTestModel(runtime, {
        tzdata: [
          {
            tstz: TV.timestamptz('2020-01-30 20:00:00[America/Mexico_City]'),
            same_instant: TV.timestamp('2020-01-31 02:00:00'),
            same_digits: TV.timestamp('2020-01-30 20:00:00'),
          },
        ],
      });

    test.when(timestamptz)('extract', async () => {
      await expect(
        'run: tzdata -> { select: h is hour(tstz), d is day(tstz) }'
      ).toMatchResult(tzModel(), {h: 2, d: 31});
    });

    test.when(timestamptz)('truncate', async () => {
      await expect('run: tzdata -> { select: d is tstz.day }').toMatchResult(
        tzModel(),
        {d: '2020-01-31T00:00:00.000Z'}
      );
    });

    test.when(timestamptz)('add a month', async () => {
      // Jan 31 + 1 month is Feb 29; Jan 30 + 1 month in Mexico City is Mar 1 UTC
      await expect(
        'run: tzdata -> { select: next is tstz + 1 month }'
      ).toMatchResult(tzModel(), {next: '2020-02-29T02:00:00.000Z'});
    });

    test.when(timestamptz)('cast to date', async () => {
      await expect('run: tzdata -> { select: d is tstz::date }').toMatchResult(
        tzModel(),
        {d: '2020-01-31'}
      );
    });

    test.when(timestamptz)('cast keeps the instant', async () => {
      await expect(`
        run: tzdata -> {
          select:
            ts is tstz::timestamp
            same is pick 'yes' when tstz::timestamp = tstz else 'no'
            back is pick 'yes' when same_instant::timestamptz = tstz else 'no'
        }
      `).toMatchResult(tzModel(), {
        ts: '2020-01-31T02:00:00.000Z',
        same: 'yes',
        back: 'yes',
      });
    });

    test.when(timestamptz)('compare to timestamp', async () => {
      await expect(`
        run: tzdata -> {
          select:
            eq_instant is pick 'yes' when tstz = same_instant else 'no'
            eq_digits is pick 'yes' when tstz = same_digits else 'no'
            gt_digits is pick 'yes' when tstz > same_digits else 'no'
            lt_digits is pick 'yes' when same_digits < tstz else 'no'
        }
      `).toMatchResult(tzModel(), {
        eq_instant: 'yes',
        eq_digits: 'no',
        gt_digits: 'yes',
        lt_digits: 'yes',
      });
    });
  });

  describe('date truncation', () => {
    test('date trunc day', async () => {
      const eq = sqlEq('t_date.day', '@2021-02-24');
      expect(await eq).isSqlEq();
    });

    test('date trunc week', async () => {
      const eq = sqlEq('t_date.week', '@2021-02-21');
      expect(await eq).isSqlEq();
    });

    test('date trunc month', async () => {
      const eq = sqlEq('t_date.month', '@2021-02-01');
      expect(await eq).isSqlEq();
    });

    test('date trunc quarter', async () => {
      const eq = sqlEq('t_date.quarter', '@2021-01-01');
      expect(await eq).isSqlEq();
    });

    test('date trunc year', async () => {
      const eq = sqlEq('t_date.year', '@2021');
      expect(await eq).isSqlEq();
    });
  });

  describe('date extraction', () => {
    test('date extract day', async () => {
      const eq = sqlEq('day(t_date)', '24');
      expect(await eq).isSqlEq();
    });
    test('date extract day_of_week', async () => {
      const eq = sqlEq('day_of_week(t_date)', '4');
      expect(await eq).isSqlEq();
    });
    test('date extract day_of_year', async () => {
      const eq = sqlEq('day_of_year(t_date)', '55');
      expect(await eq).isSqlEq();
    });
    test('date extract week', async () => {
      const eq = sqlEq('week(t_date)', '8');
      expect(await eq).isSqlEq();
    });
    test('date extract month', async () => {
      const eq = sqlEq('month(t_date)', '2');
      expect(await eq).isSqlEq();
    });
    test('date extract quarter', async () => {
      const eq = sqlEq('quarter(t_date)', '1');
      expect(await eq).isSqlEq();
    });
    test('date extract year', async () => {
      const eq = sqlEq('year(t_date)', '2021');
      expect(await eq).isSqlEq();
    });
  });

  describe('delta computations', () => {
    test('timestamp delta second', async () => {
      const eq = sqlEq('t_timestamp + 10 seconds', '@2021-02-24 03:05:16');
      expect(await eq).isSqlEq();
    });
    test('timestamp delta negative second', async () => {
      const eq = sqlEq('t_timestamp - 6 seconds', '@2021-02-24 03:05:00');
      expect(await eq).isSqlEq();
    });
    test('timestamp delta minute', async () => {
      const eq = sqlEq('t_timestamp + 10 minutes', '@2021-02-24 03:15:06');
      expect(await eq).isSqlEq();
    });
    test('timestamp delta hours', async () => {
      const eq = await sqlEq('t_timestamp + 10 hours', '@2021-02-24 13:05:06');
      expect(eq).isSqlEq();
    });
    test('timestamp delta week', async () => {
      const eq = sqlEq('(t_timestamp - 2 weeks)::date', '@2021-02-10');
      expect(await eq).isSqlEq();
    });
    test('timestamp delta month', async () => {
      const eq = sqlEq('(t_timestamp + 9 months)::date', '@2021-11-24');
      expect(await eq).isSqlEq();
    });
    test('timestamp delta quarter', async () => {
      const eq = sqlEq('(t_timestamp + 2 quarters)::date', '@2021-08-24');
      expect(await eq).isSqlEq();
    });
    test('timestamp delta year', async () => {
      const eq = sqlEq('(t_timestamp + 10 years)::date', '@2031-02-24');
      expect(await eq).isSqlEq();
    });
    test('date delta week', async () => {
      const eq = sqlEq('t_date - 2 weeks', '@2021-02-10');
      expect(await eq).isSqlEq();
    });
    test('date delta month', async () => {
      const eq = sqlEq('t_date + 9 months', '@2021-11-24');
      expect(await eq).isSqlEq();
    });
    test('date delta quarter', async () => {
      const eq = sqlEq('t_date + 2 quarters', '@2021-08-24');
      expect(await eq).isSqlEq();
    });
    test('date delta year', async () => {
      const eq = sqlEq('t_date + 10 years', '@2031-02-24');
      expect(await eq).isSqlEq();
    });
  });

  describe('for range edge tests', () => {
    describe('date', () => {
      test('before for-range is outside', async () => {
        const eq = sqlEq('t_date ? @2021-02-25 for 1 day', false);
        expect(await eq).isSqlEq();
      });
      test('first for-range is inside', async () => {
        const eq = sqlEq('t_date ? @2021-02-24 for 1 day', true);
        expect(await eq).isSqlEq();
      });
      test('last for-range is outside', async () => {
        const eq = sqlEq('t_date ? @2021-02-23 for 1 day', false);
        expect(await eq).isSqlEq();
      });
    });
    describe('timestamp', () => {
      test('before for-range is outside', async () => {
        const eq = sqlEq('t_timestamp ? @2021-02-25 00:00:00 for 1 day', false);
        expect(await eq).isSqlEq();
      });
      test('first for-range is inside', async () => {
        const eq = sqlEq('t_timestamp ? @2021-02-24 03:04:05 for 1 day', true);
        expect(await eq).isSqlEq();
      });
      test('last for-range is outside', async () => {
        const eq = sqlEq('t_timestamp ? @2021-02-23 03:05:06 for 1 day', false);
        expect(await eq).isSqlEq();
      });
    });
  });

  describe('to range edge tests', () => {
    describe('date', () => {
      test('before to is outside', async () => {
        const eq = sqlEq('t_date ? @2021-02-25 to @2021-03-01', false);
        expect(await eq).isSqlEq();
      });
      test('first to is inside', async () => {
        const eq = sqlEq('t_date ? @2021-02-24 to @2021-03-01', true);
        expect(await eq).isSqlEq();
      });
      test('last to is outside', async () => {
        const eq = sqlEq('t_date ? @2021-02-01 to @2021-02-24', false);
        expect(await eq).isSqlEq();
      });
    });
    describe('timestamp', () => {
      test('before to is outside', async () => {
        const eq = sqlEq(
          't_timestamp ? @2021-02-25 00:00:00 to @2021-02-26 00:00:00',
          false
        );
        expect(await eq).isSqlEq();
      });
      test('first to is inside', async () => {
        const eq = sqlEq(
          't_timestamp ? @2021-02-24 03:04:05 to @2021-02-26 00:00:00',
          true
        );
        expect(await eq).isSqlEq();
      });
      test('last to is outside', async () => {
        const eq = sqlEq(
          't_timestamp ? @2021-02-24 00:00:00 to @2021-02-24 03:05:06',
          false
        );
        expect(await eq).isSqlEq();
      });
    });
  });

  test('date in sql_block no explore', async () => {
    const eq = sqlEq('t_date', '@2021-02-24');
    expect(await eq).isSqlEq();
  });

  test('timestamp in sql_block no explore', async () => {
    const eq = sqlEq('t_timestamp', '@2021-02-24 03:05:06');
    expect(await eq).isSqlEq();
  });

  test('valid timestamp without seconds', async () => {
    // discovered this writing tests ...
    const eq = sqlEq('year(@2000-01-01 00:00)', '2000');
    expect(await eq).isSqlEq();
  });

  describe('granular time range checks', () => {
    const tsMoment = '@2021-02-24 03:05:06';
    test('minute implied truncated range', async () => {
      const tsBefore = '@2021-03-24 03:04:59';
      expect(await sqlEq(`${tsMoment} ? t_timestamp.minute`, true)).isSqlEq();
      expect(await sqlEq(`${tsBefore} ? t_timestamp.minute`, false)).isSqlEq();
    });
    test('day implied truncated range', async () => {
      expect(await sqlEq(`${tsMoment} ? t_timestamp.day`, true)).isSqlEq();
    });
    test('year implied truncated range', async () => {
      expect(await sqlEq(`${tsMoment} ? t_timestamp.year`, true)).isSqlEq();
    });
    test('timestamp in literal minute', async () => {});
    test('timestamp in literal day', async () => {
      expect(await sqlEq('t_timestamp ? @2021-02-24', true)).isSqlEq();
    });
    test('date in literal month', async () => {
      expect(await sqlEq('t_date ? @2021-02', true)).isSqlEq();
    });
    test('timestamp in literal month', async () => {
      expect(await sqlEq('t_timestamp ? @2021-02', true)).isSqlEq();
    });
    test('timestamp in literal year', async () => {
      expect(await sqlEq('t_timestamp ? @2021', true)).isSqlEq();
    });
    test('check all four edges of a range', async () => {
      const tm = mkTestModel(runtime, {
        fourTimes: [
          {
            tbefore: TV.timestamp('2025-12-31 23:59:59'),
            tfirst: TV.timestamp('2026-01-01 00:00:00'),
            tlast: TV.timestamp('2026-01-01 23:59:59'),
            tafter: TV.timestamp('2026-01-02 00:00:00'),
          },
        ],
      });
      await expect(`
        run: fourTimes -> { select:
          isBefore is pick 'in' when tbefore ? @2026-01-01 else 'out'
          isFirst is pick 'in' when tfirst ? @2026-01-01 else 'out'
          isLast is pick 'in' when tlast ? @2026-01-01 else 'out'
          isAfter is pick 'in' when tafter ? @2026-01-01 else 'out'
        }
      `).toMatchResult(tm, {
        isBefore: 'out',
        isFirst: 'in',
        isLast: 'in',
        isAfter: 'out',
      });
    });
  });

  test('dependant join dialect fragments', async () => {
    await expect(`
      source: timeData is ${dbName}.sql("""${timeSQL}""")
      run: timeData -> {
        extend: {join_one: joined is timeData on t_date = joined.t_date}
        group_by: t_month is joined.t_timestamp.month
      }
    `).toMatchResult(testModel, {t_month: new Date('2021-02-01')});
  });

  describe('timezone set correctly', () => {
    test('timezone set in source used by query', async () => {
      expect(
        (
          await runQuery(
            runtime,
            `run: ${dbName}.sql("SELECT 1 as one") extend {
              timezone: 'America/Los_Angeles'
              dimension: la_time is @2021-02-24 03:05:06
            } -> {
              group_by: la_time
            }`
          )
        ).resultExplore.queryTimezone
      ).toBe('America/Los_Angeles');
    });

    // TODO don't need to run this on all connections, so onlyIf not needed
    test.when(runtime.supportsNesting)(
      'timezone set in view inside source',
      async () => {
        expect(
          (
            await runQuery(
              runtime,
              `run: ${dbName}.sql("SELECT 1 as one") extend {
                dimension: default_time is @2021-02-24 03:05:06
                view: la_query is {
                  timezone: 'America/Los_Angeles'
                  select: la_time is @2021-02-24 03:05:06
                }
              } -> {
                group_by: default_time
                nest: la_query
              }`
            )
          ).resultExplore.structDef
        ).toMatchObject({
          fields: [
            {},
            {name: 'la_query', queryTimezone: 'America/Los_Angeles'},
          ],
        });
      }
    );

    // TODO don't need to run this on all connections, so .when() not needed
    test.when(runtime.supportsNesting)(
      'timezone set in query using source',
      async () => {
        expect(
          (
            await runQuery(
              runtime,
              `run: ${dbName}.sql("SELECT 1 as one") extend {
                dimension: default_time is @2021-02-24 03:05:06
                view: undef_query is {
                  select: undef_time is @2021-02-24 03:05:06
                }
              } -> {
                timezone: 'America/Los_Angeles'
                group_by: default_time
                nest: undef_query
              }`
            )
          ).resultExplore.queryTimezone
        ).toBe('America/Los_Angeles');
      }
    );

    test.when(runtime.supportsNesting)('multiple timezones', async () => {
      const theQuery = await runQuery(
        runtime,
        `run: ${dbName}.sql('SELECT 1 as one') extend {
            timezone: 'America/New_York'
            dimension: ny_time is @2021-02-24 03:05:06
            view: la_query is {
              timezone: 'America/Los_Angeles'
              select: la_time is @2021-02-24 03:05:06
            }
            view: mex_query is {
              timezone: 'America/Mexico_City'
              select: mex_time is @2021-02-24 03:05:06
            }
          } -> {
          group_by: ny_time
          nest: la_query, mex_query
          }`
      );
      expect(theQuery.resultExplore.structDef).toMatchObject({
        queryTimezone: 'America/New_York',
        fields: [
          {},
          {name: 'la_query', queryTimezone: 'America/Los_Angeles'},
          {name: 'mex_query', queryTimezone: 'America/Mexico_City'},
        ],
      });
    });
  });
});

/*
  not entirely sure what to test here so i am going to free-wheel a bit

  1) All of the extraction and truncation functions need to work
      in the query timezone.
  2) All rendering needs to happen in the query time zone
  3) If we feed rendered data back into a query, it needs to retain
      offsets on all timestamps. Worried that rendering it in the query
      time zone would somehow confuse bigquery which is always in UTC
  4)  when we filter on a binned time, that we generate a filter between
      the edges of the bin, instead of computing the bin and use '='
  5) connection, model, and query time zone setting
  6) piping a query in one time zone into a query in another
  7) graphs neeed to respect query time zone
*/

const zone = 'America/Mexico_City'; // -06:00 no DST
const zone_2020 = LuxonDateTime.fromObject(
  {
    year: 2020,
    month: 2,
    day: 20,
    hour: 0,
    minute: 0,
    second: 0,
  },
  {
    zone,
  }
);
const utc_2020 = LuxonDateTime.fromObject(
  {
    year: 2020,
    month: 2,
    day: 20,
    hour: 0,
    minute: 0,
    second: 0,
  },
  {
    zone: 'UTC',
  }
);

describe.each(runtimes.runtimeList)('%s: tz literals', (dbName, runtime) => {
  test(`${dbName} - default timezone is UTC`, async () => {
    // this makes sure that the tests which use the test timezome are actually
    // testing something ... file this under "abundance of caution". It
    // really tests nothing, but I feel calmer with this here.
    const query = runtime.loadQuery(
      `
        run: ${dbName}.sql("SELECT 1 as one") -> {
          group_by: literal_time is @2020-02-20 00:00:00
        }
`
    );
    const result = await query.run();
    const literal = result.data.path(0, 'literal_time').value as Date;
    const have = LuxonDateTime.fromJSDate(literal);
    expect(have.valueOf()).toEqual(utc_2020.valueOf());
  });

  test('literal with zone name', async () => {
    const query = runtime.loadQuery(
      `
        run: ${dbName}.sql("SELECT 1 as one") -> {
          group_by: literal_time is @2020-02-20 00:00:00[America/Mexico_City]
        }
`
    );
    const result = await query.run();
    const literal = result.data.path(0, 'literal_time').value as Date;
    const have = LuxonDateTime.fromJSDate(literal);
    expect(have.valueOf()).toEqual(zone_2020.valueOf());
  });
});

describe.each(runtimes.runtimeList)('%s: query tz', (dbName, runtime) => {
  const testModel = wrapTestModel(runtime, '');
  const timestamptz = runtime.dialect.hasTimestamptz;
  const ts = new TestSelect(runtime.dialect);
  const selectMidnight = `"""${ts.generate({
    utc_midnight_ts: ts.mk_timestamp('2020-02-20 00:00:00'),
    date_2020: ts.mk_date('2020-02-20'),
  })}"""`;
  test('literal timestamps', async () => {
    const query = runtime.loadQuery(
      `
        run: ${dbName}.sql("SELECT 1 as one") -> {
          timezone: '${zone}'
          group_by: literal_time is @2020-02-20 00:00:00
        }
      `
    );
    const result = await query.run();
    const literal = result.data.path(0, 'literal_time').value as Date;
    const have = LuxonDateTime.fromJSDate(literal);
    expect(have.valueOf()).toEqual(zone_2020.valueOf());
  });

  test('extract', async () => {
    await expect(
      `run: ${dbName}.sql("SELECT 1 as one") -> {
        timezone: '${zone}'
        extend: { dimension: utc_midnight is @2020-02-20 00:00:00[UTC] }
        select:
          mex_midnight is hour(utc_midnight)
          mex_day is day(utc_midnight)
      }`
    ).toMatchResult(testModel, {mex_midnight: 18, mex_day: 19});
  });

  test.when(timestamptz)(
    'extract from timestamptz with query timezone',
    async () => {
      // TIMESTAMPTZ representing midnight UTC
      // With query timezone America/Mexico_City (-06:00), midnight UTC = 6pm Feb 19
      // Expected: hour = 18, day = 19
      await expect(
        `run: ${dbName}.sql("SELECT 1 as x") -> {
          timezone: '${zone}'
          extend: { dimension: utc_tstz is @2020-02-20 00:00:00[UTC]::timestamptz }
          select:
            mex_hour is hour(utc_tstz)
            mex_day is day(utc_tstz)
        }`
      ).toMatchResult(testModel, {mex_hour: 18, mex_day: 19});
    }
  );

  test('truncate day', async () => {
    // At midnight in london it the 19th in Mexico, so that truncates to
    // midnight on the 19th
    const mex_19 = LuxonDateTime.fromISO('2020-02-19T00:00:00', {zone});
    await expect(
      `run: ${dbName}.sql(${selectMidnight}) -> {
        timezone: '${zone}'
        select: mex_day is utc_midnight_ts.day
      }`
    ).toMatchResult(testModel, {mex_day: mex_19.toJSDate()});
  });

  test('truncate hour in a zone a half hour off UTC', async () => {
    // 02:10 in Kolkata is 20:40 UTC, and the Kolkata hour starts at 20:30
    await expect(
      `run: ${dbName}.sql("SELECT 1 as x") -> {
        timezone: 'Asia/Kolkata'
        select: kol_hour is @2020-01-31 02:10:00.hour
      }`
    ).toMatchResult(testModel, {kol_hour: '2020-01-30T20:30:00.000Z'});
  });

  test('truncate week', async () => {
    // the 19th in mexico is a wednesday, so trunc to the 15th
    const mex_19 = LuxonDateTime.fromISO('2020-02-19T00:00:00', {zone});
    // Find the sunday before then
    const mex_sunday = mex_19.minus({days: mex_19.weekday % 7});
    await expect(
      `run: ${dbName}.sql("SELECT 1 as x") -> {
        timezone: '${zone}'
        extend: { dimension: utc_midnight is @2020-02-20 00:00:00[UTC] }
        select: mex_week is utc_midnight.week
      }`
    ).toMatchResult(testModel, {mex_week: mex_sunday.toJSDate()});
  });

  test('cast timestamp to date', async () => {
    await expect(
      `run: ${dbName}.sql(${selectMidnight}) -> {
        timezone: '${zone}'
        select: mex_date is utc_midnight_ts::date
      }`
    ).toMatchResult(testModel, {mex_date: '2020-02-19'});
  });
  test.when(timestamptz)('cast timestamptz to date', async () => {
    await expect(
      `run: ${dbName}.sql("SELECT 1 as x") -> {
          timezone: '${zone}'
          extend: { dimension: utc_tstz is @2020-02-20 00:00:00[UTC]::timestamptz }
          select: mex_date is utc_tstz::date
        }`
    ).toMatchResult(testModel, {mex_date: '2020-02-19'});
  });
  test('cast date to timestamp', async () => {
    await expect(
      `run: ${dbName}.sql(${selectMidnight}) -> {
        timezone: '${zone}'
        select: mex_date is date_2020::timestamp
      }`
    ).toMatchResult(testModel, {mex_date: zone_2020.toJSDate()});
  });
  test('return date 2020-02-20', async () => {
    await expect(
      `run: ${dbName}.sql(${selectMidnight}) -> {
        timezone: '${zone}'
        select: d2020 is date_2020
      }`
    ).toMatchResult(testModel, {d2020: '2020-02-20'});
  });
  test.when(timestamptz)('cast date to timestamptz', async () => {
    await expect(
      `run: ${dbName}.sql(${selectMidnight}) -> {
          timezone: '${zone}'
          select: mex_date is date_2020::timestamptz
        }`
    ).toMatchResult(testModel, {mex_date: zone_2020.toJSDate()});
  });

  test.when(timestamptz)('compare timestamptz to range', async () => {
    const tzModel = mkTestModel(runtime, {
      tzdata: [
        {updated: TV.timestamptz('2020-01-15 00:00:00[America/Mexico_City]')},
      ],
    });
    await expect(
      "run: tzdata -> { select: cmp is pick 'in' when updated ? @2020-01 else 'out' }"
    ).toMatchResult(tzModel, {cmp: 'in'});
  });

  // 11:00 on the 31st in Tokyo is 20:00 on the 30th in Mexico City. With a
  // query time zone the value is read there, not in the zone it was written in.
  describe('timestamptz written in another zone', () => {
    const tzModel = () =>
      mkTestModel(runtime, {
        tzdata: [
          {
            tstz: TV.timestamptz('2020-01-31 11:00:00[Asia/Tokyo]'),
            same_instant: TV.timestamp('2020-01-31 02:00:00'),
          },
        ],
      });

    test.when(timestamptz)('extract', async () => {
      await expect(`
        run: tzdata -> {
          timezone: '${zone}'
          select: h is hour(tstz), d is day(tstz)
        }
      `).toMatchResult(tzModel(), {h: 20, d: 30});
    });

    test.when(timestamptz)('truncate', async () => {
      const mex_30 = LuxonDateTime.fromISO('2020-01-30T00:00:00', {zone});
      await expect(`
        run: tzdata -> {
          timezone: '${zone}'
          select: d is tstz.day
        }
      `).toMatchResult(tzModel(), {d: mex_30.toJSDate()});
    });

    test.when(timestamptz)('add a month', async () => {
      // Jan 30 + 1 month is Feb 29 in Mexico City; Jan 31 + 1 month in Tokyo
      // or UTC is a day earlier
      const mex_29 = LuxonDateTime.fromISO('2020-02-29T20:00:00', {zone});
      await expect(`
        run: tzdata -> {
          timezone: '${zone}'
          select: next is tstz + 1 month
        }
      `).toMatchResult(tzModel(), {next: mex_29.toJSDate()});
    });

    test.when(timestamptz)('cast to date', async () => {
      await expect(`
        run: tzdata -> {
          timezone: '${zone}'
          select: d is tstz::date
        }
      `).toMatchResult(tzModel(), {d: '2020-01-30'});
    });

    test.when(timestamptz)('cast keeps the instant', async () => {
      await expect(`
        run: tzdata -> {
          timezone: '${zone}'
          select:
            ts is tstz::timestamp
            same is pick 'yes' when tstz::timestamp = tstz else 'no'
            back is pick 'yes' when same_instant::timestamptz = tstz else 'no'
        }
      `).toMatchResult(tzModel(), {
        ts: '2020-01-31T02:00:00.000Z',
        same: 'yes',
        back: 'yes',
      });
    });
  });

  // Test for timezone rendering issue with nested queries
  test.when(runtime.supportsNesting)(
    'nested queries preserve timezone in rendering',
    async () => {
      const result = await runQuery(
        runtime,
        `run: ${dbName}.table('malloytest.flights') extend {
        view: arrivals is {
          group_by: arr_time.hour
          order_by: arr_time desc
          limit: 1
        }
      } -> {
        nest: arrive_utc is arrivals
        nest: arrive_yekaterinburg is arrivals + { timezone: 'Asia/Yekaterinburg' }
      }`
      );

      // First, check that the raw result has the correct timezone metadata
      const rawFields = result.resultExplore.structDef.fields;
      const rawArriveUtc = rawFields.find(f => f.name === 'arrive_utc');
      const rawArriveYek = rawFields.find(
        f => f.name === 'arrive_yekaterinburg'
      );

      expect(rawArriveUtc).toBeDefined();
      expect(rawArriveYek).toBeDefined();

      // Check timezone properties on raw array/record fields
      expect(rawArriveUtc!['queryTimezone']).toBeUndefined(); // Should be undefined for UTC
      expect(rawArriveYek!['queryTimezone']).toBe('Asia/Yekaterinburg');

      // Now check that the wrapped result also preserves timezone metadata
      const wrappedResult = API.util.wrapResult(result);
      const wrappedFields = wrappedResult.schema.fields;
      const wrappedArriveUtc = wrappedFields.find(f => f.name === 'arrive_utc');
      const wrappedArriveYek = wrappedFields.find(
        f => f.name === 'arrive_yekaterinburg'
      );

      expect(wrappedArriveUtc).toBeDefined();
      expect(wrappedArriveYek).toBeDefined();

      // Check timezone properties in the wrapped result
      // For nested views, the timezone should be in the annotations
      const arriveUtcAnnotations = wrappedArriveUtc?.annotations;
      const arriveYekAnnotations = wrappedArriveYek?.annotations;

      // Check if timezone info is present in annotations
      const utcTimezoneAnnotation = arriveUtcAnnotations?.find(ann =>
        ann.value.includes('query_timezone')
      );
      const yekTimezoneAnnotation = arriveYekAnnotations?.find(ann =>
        ann.value.includes('query_timezone')
      );

      expect(utcTimezoneAnnotation).toBeUndefined(); // UTC should have no timezone annotation
      expect(yekTimezoneAnnotation?.value).toContain('Asia/Yekaterinburg');
    }
  );

  test('intervals are evalutated in query timezone', async () => {
    await expect(
      `source: onerow is ${dbName}.sql("SELECT 1 as rownum") extend {
        dimension:
          // Dublin is UTC+1 in June and UTC in November
          november is @2024-11-01 00:00:00[Europe/Dublin]
          june1_correct is @2024-06-01 00:00:00[Europe/Dublin],
          august1_correct is @2024-08-01 00:00:00[Europe/Dublin],
          by_month is november - 5 months,
          by_day is november - 153 days,
          by_hour is november - 3673 hours, // 153 days * 24 hours + 1 hour fall back
          by_quarter is november - 1 quarter, // 3 months back crosses DST boundary
      }
      run: onerow -> {
        timezone: 'Europe/Dublin'
        select:
          june1_correct,
          month_ok is pick 'yes' when by_month = june1_correct else 'no', by_month
          day_ok is pick 'yes' when by_day = june1_correct else 'no', by_day
          hour_ok is pick 'yes' when by_hour = june1_correct else 'no', by_hour
          quarter_ok is pick 'yes' when by_quarter = august1_correct else 'no', by_quarter
      }`
    ).toMatchResult(testModel, {
      month_ok: 'yes',
      day_ok: 'yes',
      hour_ok: 'yes',
      quarter_ok: 'yes',
    });
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
