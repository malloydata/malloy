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

  describe('time zones', () => {
    test('converts a query time zone through its Windows name', async () => {
      await expect(`
        run: db.sql("SELECT CAST('2020-02-20 00:00:00' AS DATETIME2) AS t") -> {
          timezone: 'America/Mexico_City'
          select: mex_day is t.day, mex_hour is hour(t)
        }
      `).toMatchResult(tm, {
        mex_day: new Date('2020-02-19T06:00:00Z'),
        mex_hour: 18,
      });
    });

    test('a zone is known by its current IANA name as well as its old one', async () => {
      await expect(`
        run: db.sql("SELECT CAST('2021-02-24 03:05:06' AS DATETIME2) AS t") -> {
          timezone: 'Asia/Kolkata'
          select: h is hour(t)
        }
      `).toEqualResult(tm, [{h: 8}]);
      await expect(`
        run: db.sql("SELECT CAST('2021-02-24 03:05:06' AS DATETIME2) AS t") -> {
          timezone: 'Europe/Kyiv'
          select: h is hour(t)
        }
      `).toEqualResult(tm, [{h: 5}]);
    });

    test('a literal written in a zone is that instant', async () => {
      await expect(`
        run: db.sql("SELECT 1 AS n") -> {
          select: t is @2020-02-20 00:00:00[America/Mexico_City]
        }
      `).toMatchResult(tm, {t: new Date('2020-02-20T06:00:00Z')});
    });
  });
});
