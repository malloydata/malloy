/* eslint-disable no-console */
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

import {RuntimeList, allDatabases} from '../../runtimes';
import '../../util/db-jest-matchers';
import {mkSqlEqWith, runQuery, testIf} from '../../util';
import {DateTime as LuxonDateTime} from 'luxon';

export const timeSharedTests = (
  runtimes: RuntimeList,
  _splitFunction?: (column: string, splitChar: string) => string
) => {
  const timeSQL =
    "SELECT DATE '2021-02-24' as t_date, TIMESTAMP '2021-02-24 03:05:06' as t_timestamp";

  // MTOY todo look at this list for timezone problems, I know there are some
  describe.each(runtimes.runtimeList)('%s date and time', (dbName, runtime) => {
    const sqlEq = mkSqlEqWith(runtime, {sql: timeSQL});

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
        expect(
          await sqlEq(`seconds(${b} to @2001-01-01 00:00:01)`, 0)
        ).isSqlEq();
      });

      test('minutes', async () => {
        expect(
          await sqlEq(
            'minutes(@2022-10-03 10:23:08 to @2022-10-03 10:24:07)',
            0
          )
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
        expect(
          await sqlEq('days(now.day to now.day - 48 hours)', -2)
        ).isSqlEq();
        expect(
          await sqlEq('days(@2022-10-03 10:23:00 to @2022-10-04 09:23:00)', 0)
        ).isSqlEq();
      });

      // MTOY TODO remove or implment
      // These all are complicated by civul time issues, skipping for now
      // test.skip('weeks', async () => {
      //   expect(await sqlEq('week(now.week to now.week + 6 days)', 0)).isSqlEq();
      //   expect(await sqlEq('week(now.week to now.week + 7 days)', 1)).isSqlEq();
      //   expect(
      //     await sqlEq('week(now.week to now.week + 7 days - 1 second)', 0)
      //   ).isSqlEq();
      //   expect(await sqlEq('weeks(@2022-10-01 to @2022-10-07)', 0)).isSqlEq();
      //   expect(await sqlEq('weeks(@2022-10-01 to @2022-10-08)', 1)).isSqlEq();
      //   expect(await sqlEq('weeks(@2022-10-15 to @2022-10-01)', -2)).isSqlEq();
      //   expect(await sqlEq('weeks(@2022-10-02 to @2023-10-02)', 52)).isSqlEq();
      //   expect(
      //     await sqlEq('weeks(@2022-10-01 12:00 to @2022-10-08 11:59)', 0)
      //   ).isSqlEq();
      // });

      // test.skip('months', async () => {
      //   expect(await sqlEq('months(now to now)', 0)).isSqlEq();
      //   expect(await sqlEq('months(@2001-01-01 to @2001-02-01)', 1)).isSqlEq();
      //   expect(await sqlEq('months(@2001-01-01 to @2001-03-01)', 2)).isSqlEq();
      //   expect(await sqlEq('months(@2001-01-01 to @2002-02-01)', 13)).isSqlEq();
      //   expect(
      //     await sqlEq('months(@2022-10-02 12:00 to @2022-11-02 11:59)', 0)
      //   ).isSqlEq();
      // });

      // test.skip('quarters', async () => {
      //   expect(await sqlEq('quarters(now to now + 1 quarter)', 1)).isSqlEq();
      //   expect(
      //     await sqlEq('quarters(now.quarter to now.quarter + 27 days)', 0)
      //   ).isSqlEq();
      //   expect(await sqlEq('quarters(now to now + 2 quarters)', 2)).isSqlEq();
      //   expect(await sqlEq('quarters(now to now - 2 quarters)', -2)).isSqlEq();
      //   expect(
      //     await sqlEq('quarters(@2022-01-01 12:00 to @2022-04-01 12:00)', 1)
      //   ).isSqlEq();
      //   expect(
      //     await sqlEq('quarters(@2022-01-01 12:00 to @2022-04-01 11:59)', 0)
      //   ).isSqlEq();
      // });

      // test.skip('years', async () => {
      //   expect(await sqlEq('years(@2022 to @2023)', 1)).isSqlEq();
      //   expect(await sqlEq('years(@2022-01-01 to @2022-12-31)', 0)).isSqlEq();
      //   expect(await sqlEq('years(@2022 to @2024)', 2)).isSqlEq();
      //   expect(await sqlEq('years(@2024 to @2022)', -2)).isSqlEq();
      //   expect(
      //     await sqlEq('years(@2022-01-01 12:00 to @2024-01-01 11:59)', 1)
      //   ).isSqlEq();
      // });
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
        const eq = await sqlEq(
          't_timestamp + 10 hours',
          '@2021-02-24 13:05:06'
        );
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
          const eq = sqlEq(
            't_timestamp ? @2021-02-25 00:00:00 for 1 day',
            false
          );
          expect(await eq).isSqlEq();
        });
        test('first for-range is inside', async () => {
          const eq = sqlEq(
            't_timestamp ? @2021-02-24 03:04:05 for 1 day',
            true
          );
          expect(await eq).isSqlEq();
        });
        test('last for-range is outside', async () => {
          const eq = sqlEq(
            't_timestamp ? @2021-02-23 03:05:06 for 1 day',
            false
          );
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
        expect(
          await sqlEq(`${tsBefore} ? t_timestamp.minute`, false)
        ).isSqlEq();
      });
      test('day implied truncated range', async () => {
        expect(await sqlEq(`${tsMoment} ? t_timestamp.day`, true)).isSqlEq();
      });
      test('year implied truncated range', async () => {
        expect(await sqlEq(`${tsMoment} ? t_timestamp.year`, true)).isSqlEq();
      });
      test('timestamp in literal minute', async () => {
        expect(await sqlEq('t_timestamp ? @2021-02-24 03:05', true)).isSqlEq();
      });
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
    });

    test('dependant join dialect fragments', async () => {
      await expect(runtime).queryMatches(
        `
        sql: timeData is { connection: "${dbName}" select: """${timeSQL}""" }
        query: from_sql(timeData) -> {
          join_one: joined is from_sql(timeData) on t_date = joined.t_date
          group_by: t_month is joined.t_timestamp.month
        }
    `,
        {t_month: new Date('2021-02-01')}
      );
    });

    describe('timezone set correctly', () => {
      test('timezone set in source used by query', async () => {
        expect(
          (
            await runQuery(
              runtime,
              `sql: timeData is { connection: "${dbName}"  select: """SELECT 1"""}
        source: timezone is from_sql(timeData) + {
          timezone: 'America/Los_Angeles'
          dimension: la_time is @2021-02-24 03:05:06
        }
        query: timezone -> {
          group_by: la_time
        }
        `
            )
          ).resultExplore.queryTimezone
        ).toBe('America/Los_Angeles');
      });

      testIf(runtime.supportsNesting)(
        'timezone set in query inside source',
        async () => {
          expect(
            (
              await runQuery(
                runtime,
                `sql: timeData is { connection: "${dbName}"  select: """SELECT 1"""}
        source: timezone is from_sql(timeData) + {
          dimension: default_time is @2021-02-24 03:05:06
          query: la_query is {
            timezone: 'America/Los_Angeles'
            project: la_time is @2021-02-24 03:05:06
          }
        }

        query: timezone -> {
           group_by: default_time
           nest: la_query
        }
        `
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

      testIf(runtime.supportsNesting)(
        'timezone set in query using source',
        async () => {
          expect(
            (
              await runQuery(
                runtime,
                `sql: timeData is { connection: "${dbName}"  select: """SELECT 1"""}
        source: timezone is from_sql(timeData) + {
          dimension: default_time is @2021-02-24 03:05:06
          query: undef_query is {
            project: undef_time is @2021-02-24 03:05:06
          }
        }

        query: timezone -> {
           timezone: 'America/Los_Angeles'
           group_by: default_time
           nest: undef_query
        }
        `
              )
            ).resultExplore.queryTimezone
          ).toBe('America/Los_Angeles');
        }
      );

      testIf(runtime.supportsNesting)('multiple timezones', async () => {
        expect(
          (
            await runQuery(
              runtime,
              `sql: timeData is { connection: "${dbName}"  select: """SELECT 1"""}
        source: timezone is from_sql(timeData) + {
          timezone: 'America/New_York'
          dimension: ny_time is @2021-02-24 03:05:06
          query: la_query is {
            timezone: 'America/Los_Angeles'
            project: la_time is @2021-02-24 03:05:06
          }
          query: mex_query is {
            timezone: 'America/Mexico_City'
            project: mex_time is @2021-02-24 03:05:06
          }
        }

        query: timezone -> {
           group_by: ny_time
           nest: la_query, mex_query
        }
        `
            )
          ).resultExplore.structDef
        ).toMatchObject({
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
  const zone_2020 = LuxonDateTime.fromObject({
    year: 2020,
    month: 2,
    day: 20,
    hour: 0,
    minute: 0,
    second: 0,
    zone,
  });
  const utc_2020 = LuxonDateTime.fromObject({
    year: 2020,
    month: 2,
    day: 20,
    hour: 0,
    minute: 0,
    second: 0,
    zone: 'UTC',
  });

  describe.each(runtimes.runtimeList)('%s: tz literals', (dbName, runtime) => {
    test(`${dbName} - default timezone is UTC`, async () => {
      // this makes sure that the tests which use the test timezome are actually
      // testing something ... file this under "abundance of caution". It
      // really tests nothing, but I feel calmer with this here.
      const query = runtime.loadQuery(
        `
        sql: tzTest is { connection: "${dbName}" select: """SELECT 1 as one""" }
        query: from_sql(tzTest) -> {
          group_by: literalTime is @2020-02-20 00:00:00
        }
`
      );
      const result = await query.run();
      const literal = result.data.path(0, 'literalTime').value as Date;
      const have = LuxonDateTime.fromJSDate(literal);
      expect(have.valueOf()).toEqual(utc_2020.valueOf());
    });

    test('literal with zone name', async () => {
      const query = runtime.loadQuery(
        `
        sql: tzTest is { connection: "${dbName}" select: """SELECT 1 as one""" }
        query: from_sql(tzTest) -> {
          group_by: literalTime is @2020-02-20 00:00:00[America/Mexico_City]
        }
`
      );
      const result = await query.run();
      const literal = result.data.path(0, 'literalTime').value as Date;
      const have = LuxonDateTime.fromJSDate(literal);
      expect(have.valueOf()).toEqual(zone_2020.valueOf());
    });
  });

  describe.each(runtimes.runtimeList)('%s: query tz', (dbName, runtime) => {
    test('literal timestamps', async () => {
      const query = runtime.loadQuery(
        `
        sql: tzTest is { connection: "${dbName}" select: """SELECT 1 as one""" }
        query: from_sql(tzTest) -> {
          timezone: '${zone}'
          group_by: literalTime is @2020-02-20 00:00:00
        }
`
      );
      const result = await query.run();
      const literal = result.data.path(0, 'literalTime').value as Date;
      const have = LuxonDateTime.fromJSDate(literal);
      expect(have.valueOf()).toEqual(zone_2020.valueOf());
    });

    test('extract', async () => {
      await expect(runtime).queryMatches(
        `sql: tzTest is { connection: "${dbName}" select: """SELECT 1 as one""" }
      query: from_sql(tzTest) -> {
        timezone: '${zone}'
        declare: utc_midnight is @2020-02-20 00:00:00[UTC]
        project:
          mex_midnight is hour(utc_midnight)
          mex_day is day(utc_midnight)
      }`,
        {mex_midnight: 18, mex_day: 19}
      );
    });

    test('truncate day', async () => {
      // At midnight in london it the 19th in Mexico, so that truncates to
      // midnight on the 19th
      const mex_19 = LuxonDateTime.fromISO('2020-02-19T00:00:00', {zone});
      await expect(runtime).queryMatches(
        `sql: tzTest is { connection: "${dbName}" select: """SELECT 1 as one""" }
      query: from_sql(tzTest) -> {
        timezone: '${zone}'
        declare: utc_midnight is @2020-02-20 00:00:00[UTC]
        project:
          mex_day is utc_midnight.day
      }`,
        {mex_day: mex_19.toJSDate()}
      );
    });

    test('cast timestamp to date', async () => {
      // At midnight in london it the 19th in Mexico, so when we cast that
      // to a date, it should be the 19th.
      await expect(runtime).queryMatches(
        `sql: tzTest is { connection: "${dbName}" select: """SELECT 1 as one""" }
      query: from_sql(tzTest) -> {
        timezone: '${zone}'
        declare: utc_midnight is @2020-02-20 00:00:00[UTC]
        project: mex_day is day(utc_midnight::date)
      }`,
        {mex_day: 19}
      );
    });

    test('cast date to timestamp', async () => {
      await expect(runtime).queryMatches(
        `sql: tzTest is { connection: "${dbName}" select: """
          SELECT DATE '2020-02-20'  AS mex_20
      """ }
      query: from_sql(tzTest) -> {
        timezone: '${zone}'
        project: mex_ts is mex_20::timestamp
      }`,
        {mex_ts: zone_2020.toJSDate()}
      );
    });
  });

  afterAll(async () => {
    await runtimes.closeAll();
  });
};

const runtimes = new RuntimeList(allDatabases);
/*
 * This test file reuses common tests definitions.
 * For actual test development please go to: test/src/databases/shared/time.spec.ts
 */
timeSharedTests(runtimes);
