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
import '../../util/is-sql-eq';
import {mkSqlEqWith} from '../../util';
import {DateTime as LuxonDateTime} from 'luxon';

// MTOY todo really test all databases
const runtimes = new RuntimeList(['duckdb', 'bigquery'] || allDatabases);

// MTOY todo look at this list for timezone problems, I know there are some
describe.each(runtimes.runtimeList)(
  '%s: interval extraction',
  (_db, runtime) => {
    const sqlEq = mkSqlEqWith(runtime);

    // MTOY todo when there is query time zone, check that literals
    // NOT in the query time zone bin in the query time zone.

    // MTOY todo tests for the moprhing literal ranges to timestamp
    // or date, depending on LHS of the apply.

    test('seconds', async () => {
      expect(await sqlEq('seconds(now to now + 1 second)', 1)).isSqlEq();
      expect(await sqlEq('seconds(now to now)', 0)).isSqlEq();
      expect(await sqlEq('seconds(now to now + 2 seconds)', 2)).isSqlEq();
      expect(await sqlEq('seconds(now to now - 2 seconds)', -2)).isSqlEq();
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
        await sqlEq('days(@2022-10-03 10:23:00 to @2022-10-04 09:23:00)', 1)
      ).isSqlEq();
    });

    test('weeks', async () => {
      expect(await sqlEq('weeks(now.week to now.week + 1 week)', 1)).isSqlEq();
      expect(await sqlEq('weeks(now.week to now.week + 6 days)', 0)).isSqlEq();
      expect(await sqlEq('weeks(now.week to now.week + 14 days)', 2)).isSqlEq();
      expect(
        await sqlEq('weeks(now.week to now.week - 14 days)', -2)
      ).isSqlEq();
      expect(await sqlEq('weeks(@2022-10-03 to @2022-10-10)', 1)).isSqlEq();
      expect(await sqlEq('weeks(@2022-10-03 to @2022-10-09)', 1)).isSqlEq();
      expect(await sqlEq('weeks(@2022-10-02 to @2022-10-08)', 0)).isSqlEq();
      expect(await sqlEq('weeks(@2022-10-02 to @2023-10-02)', 52)).isSqlEq();

      expect(
        await sqlEq('weeks(@2022-10-02 10:00 to @2023-10-02 10:00)', 52)
      ).isSqlEq();
    });

    test('months', async () => {
      expect(await sqlEq('months(now to now + 1 month)', 1)).isSqlEq();
      expect(
        await sqlEq('months(now.month to now.month + 27 days)', 0)
      ).isSqlEq();
      expect(await sqlEq('months(now to now + 2 months)', 2)).isSqlEq();
      expect(await sqlEq('months(now to now - 2 months)', -2)).isSqlEq();

      expect(
        await sqlEq('months(@2022-10-02 10:00 to @2022-11-02 09:00)', 1)
      ).isSqlEq();
    });

    test('quarters', async () => {
      expect(await sqlEq('quarters(@2022-03-31 to @2022-04-01)', 1)).isSqlEq();
      expect(await sqlEq('quarters(now to now + 1 quarter)', 1)).isSqlEq();
      expect(
        await sqlEq('quarters(now.quarter to now.quarter + 27 days)', 0)
      ).isSqlEq();
      expect(await sqlEq('quarters(now to now + 2 quarters)', 2)).isSqlEq();
      expect(await sqlEq('quarters(now to now - 2 quarters)', -2)).isSqlEq();

      expect(
        await sqlEq('quarters(@2022-10-02 10:00 to @2023-04-02 09:00)', 2)
      ).isSqlEq();
    });

    test('years', async () => {
      expect(await sqlEq('years(@2022 to @2023)', 1)).isSqlEq();
      expect(await sqlEq('years(@2022-01-01 to @2022-12-31)', 0)).isSqlEq();
      expect(await sqlEq('years(@2022 to @2024)', 2)).isSqlEq();
      expect(await sqlEq('years(@2024 to @2022)', -2)).isSqlEq();
      expect(
        await sqlEq('years(@2022-01-01 10:00 to @2024-01-01 09:00)', 2)
      ).isSqlEq();
    });
  }
);

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
*/

describe.each(runtimes.runtimeList)('%s: time zones', (dbName, runtime) => {
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

  test(`${dbName} NOT in tz ${zone} by default`, async () => {
    // this makes sure that the tests which use the test timezome
    // are actually testing something ... file this under
    // "abundance of caution"
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
    expect(zone_2020.valueOf()).not.toBeNaN();
    expect(have.valueOf()).not.toEqual(zone_2020.valueOf());
  });

  test('literal with offset timezone', async () => {
    const query = runtime.loadQuery(
      `
        sql: tzTest is { connection: "${dbName}" select: """SELECT 1 as one""" }
        query: from_sql(tzTest) -> {
          group_by: literalTime is @2020-02-20 00:00:00-06:00
        }
`
    );
    const result = await query.run();
    const literal = result.data.path(0, 'literalTime').value as Date;
    const have = LuxonDateTime.fromJSDate(literal);
    expect(have.valueOf()).toEqual(zone_2020.valueOf());
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

  // skipped because we don't implement query time zone yet ...
  test.skip('partial literal timestamps are in query time zone', async () => {
    const query = runtime.loadQuery(
      `
        //timezone: ${zone}
        sql: tzTest is { connection: "${dbName}" select: """SELECT 1 as one""" }
        query: from_sql(tzTest) -> {
          group_by: literalTime is @2020-02-20 00:00:00
        }
`
    );
    const result = await query.run();
    const literal = result.data.path(0, 'literalTime').value as Date;
    const have = LuxonDateTime.fromJSDate(literal);
    expect(have.valueOf()).toEqual(zone_2020.valueOf());
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
