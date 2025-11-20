/* eslint-disable no-console */
/*
 * Copyright 2023 Google LLC
 * Copyright (c) Meta Platforms, Inc. and affiliates.
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
import {databasesFromEnvironmentOr} from '../../util';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

describe.each(runtimes.runtimeList)('%s week_start', (dbName, runtime) => {
  test('default week start (Sunday)', async () => {
    const result = await runtime
      .loadModel(
        `
        source: test_dates is ${dbName}.sql("""
          SELECT TIMESTAMP '2024-01-15 12:00:00' as test_date
        """) extend {}
      `
      )
      .loadQuery(
        `
        run: test_dates -> {
          select:
            test_date
            week_start is test_date.week
        }
      `
      )
      .run();

    const weekStart = result.data.path(0, 'week_start').value as Date;
    expect(weekStart.toISOString()).toContain('2024-01-14'); // Sunday before Jan 15, 2024
  });

  test('source-level week_start: monday', async () => {
    const result = await runtime
      .loadModel(
        `
        source: test_dates is ${dbName}.sql("""
          SELECT TIMESTAMP '2024-01-15 12:00:00' as test_date
        """) extend {
          week_start: monday
        }
      `
      )
      .loadQuery(
        `
        run: test_dates -> {
          select:
            test_date
            week_start is test_date.week
        }
      `
      )
      .run();

    const weekStart = result.data.path(0, 'week_start').value as Date;
    expect(weekStart.toISOString()).toContain('2024-01-15'); // Monday Jan 15, 2024
  });

  test('query-level week_start: tuesday', async () => {
    const result = await runtime
      .loadModel(
        `
        source: test_dates is ${dbName}.sql("""
          SELECT TIMESTAMP '2024-01-17 12:00:00' as test_date
        """) extend {}
      `
      )
      .loadQuery(
        `
        run: test_dates -> {
          week_start: tuesday
          select:
            test_date
            week_start is test_date.week
        }
      `
      )
      .run();

    const weekStart = result.data.path(0, 'week_start').value as Date;
    expect(weekStart.toISOString()).toContain('2024-01-16'); // Tuesday before Jan 17, 2024
  });

  test('query-level overrides source-level', async () => {
    const result = await runtime
      .loadModel(
        `
        source: test_dates is ${dbName}.sql("""
          SELECT TIMESTAMP '2024-01-15 12:00:00' as test_date
        """) extend {
          week_start: monday
        }
      `
      )
      .loadQuery(
        `
        run: test_dates -> {
          week_start: saturday
          select:
            test_date
            week_start is test_date.week
        }
      `
      )
      .run();

    const weekStart = result.data.path(0, 'week_start').value as Date;
    expect(weekStart.toISOString()).toContain('2024-01-13'); // Saturday before Jan 15, 2024
  });

  test('week grouping with wednesday start', async () => {
    const result = await runtime
      .loadModel(
        `
        source: test_dates is ${dbName}.sql("""
          SELECT TIMESTAMP '2024-01-11 12:00:00' as test_date
          UNION ALL SELECT TIMESTAMP '2024-01-15 12:00:00'
          UNION ALL SELECT TIMESTAMP '2024-01-24 12:00:00'
        """) extend {
          week_start: wednesday
        }
      `
      )
      .loadQuery(
        `
        run: test_dates -> {
          group_by: week_value is test_date.week
          aggregate: count_dates is count()
        }
      `
      )
      .run();

    expect(result.data.toObject()).toHaveLength(2);
    // Jan 11 (Thu) and Jan 15 (Mon) are in the same week (starting Wed Jan 10)
    // Jan 24 (Wed) is in a different week (starting Wed Jan 24)
  });

  test('week filtering with thursday start', async () => {
    const result = await runtime
      .loadModel(
        `
        source: test_dates is ${dbName}.sql("""
          SELECT TIMESTAMP '2024-01-15 12:00:00' as test_date
          UNION ALL SELECT TIMESTAMP '2024-01-22 12:00:00'
        """) extend {
          week_start: thursday
        }
      `
      )
      .loadQuery(
        `
        run: test_dates -> {
          where: test_date.week = @2024-01-11
          select: test_date
        }
      `
      )
      .run();

    expect(result.data.toObject()).toHaveLength(1);
    const testDate = result.data.path(0, 'test_date').value as Date;
    expect(testDate.toISOString()).toContain('2024-01-15');
  });

  test('all seven days as week start', async () => {
    const days = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const testDate = '2024-01-17'; // Wednesday

    for (const day of days) {
      const result = await runtime
        .loadModel(
          `
          source: test_dates is ${dbName}.sql("""
            SELECT TIMESTAMP '${testDate} 12:00:00' as test_date
          """) extend {
            week_start: ${day}
          }
        `
        )
        .loadQuery(
          `
          run: test_dates -> {
            select: week_start is test_date.week
          }
        `
        )
        .run();

      const weekStart = result.data.path(0, 'week_start').value as Date;
      expect(weekStart).toBeDefined();
      // Just verify it returns a date in ISO format without error
      expect(weekStart.toISOString()).toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  test('week start with timezone interaction', async () => {
    const result = await runtime
      .loadModel(
        `
        source: test_dates is ${dbName}.sql("""
          SELECT TIMESTAMP '2024-01-15 12:00:00' as test_date
        """) extend {
          timezone: 'America/Los_Angeles'
          week_start: monday
        }
      `
      )
      .loadQuery(
        `
        run: test_dates -> {
          select:
            test_date
            week_start is test_date.week
        }
      `
      )
      .run();

    expect(result.data.path(0, 'week_start').value).toBeDefined();
  });
});

describe('week_start error handling', () => {
  const dbName = runtimes.runtimeList[0][0];
  const runtime = runtimes.runtimeList[0][1];

  test('rejects invalid week start day', async () => {
    await expect(
      runtime
        .loadModel(
          `
          source: test_dates is ${dbName}.sql("""
            SELECT TIMESTAMP '2024-01-15 12:00:00' as test_date
          """) extend {
            week_start: funday
          }
        `
        )
        .getModel()
    ).rejects.toThrow(/Invalid week start day.*funday/);
  });
});
