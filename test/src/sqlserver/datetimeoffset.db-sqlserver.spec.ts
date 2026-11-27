/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {testDatabase} from '../test_database';

/*
 * The dialect is built up here in the order a query grows: a literal, a
 * table, a filter, an ordering, a grouping, a join. Each block is what the
 * next one stands on, and what the cross-dialect suite in ../all assumes.
 */
describe('SQL Server', () => {
  // A test runtime enables experimental dialects; no compiler flag is needed
  const tm = wrapTestModel(testDatabase, '');

  afterAll(() => testDatabase.shutdown());

  describe('a datetimeoffset', () => {
    // 12:34:56 at -05:00 is 17:34:56 UTC; 22:34:56 at -05:00 is 03:34:56 UTC the next day
    const noon = "CAST('2024-03-20 12:34:56 -05:00' AS DATETIMEOFFSET)";
    const night = "CAST('2024-03-20 22:34:56 -05:00' AS DATETIMEOFFSET)";

    test('is an instant', async () => {
      await expect(`
        run: db.sql("SELECT ${noon} AS t") -> {
          select: t, utc is t::timestamp
        }
      `).toMatchResult(tm, {
        t: new Date('2024-03-20T17:34:56Z'),
        utc: new Date('2024-03-20T17:34:56Z'),
      });
    });

    test('reads its clock at UTC without a query time zone', async () => {
      await expect(`
        run: db.sql("SELECT ${night} AS t") -> {
          select: h is hour(t), d is t.day, dt is t::date
        }
      `).toMatchResult(tm, {
        h: 3,
        d: new Date('2024-03-21T00:00:00Z'),
        dt: '2024-03-21',
      });
    });

    test('compares as an instant', async () => {
      await expect(`
        run: db.sql("SELECT ${noon} AS t") -> {
          where: t > @2024-03-20 15:00:00
          aggregate: n is count()
        }
      `).toMatchResult(tm, {n: 1});
    });

    test('offsets by a calendar unit at UTC', async () => {
      await expect(`
        run: db.sql("SELECT CAST('2024-01-30 22:34:56 -05:00' AS DATETIMEOFFSET) AS t") -> {
          select: next is t + 1 month
        }
      `).toMatchResult(tm, {next: new Date('2024-02-29T03:34:56Z')});
    });

    test('measures between two offsets as instants', async () => {
      await expect(`
        run: db.sql("""
          SELECT CAST('2024-03-20 12:00:00 +00:00' AS DATETIMEOFFSET) AS a,
                 CAST('2024-03-20 12:00:00 -05:00' AS DATETIMEOFFSET) AS b
        """) -> { select: h is hours(a to b) }
      `).toMatchResult(tm, {h: 5});
    });
  });
});
