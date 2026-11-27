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

  describe('a SQL block', () => {
    test('carries string, date and timestamp values', async () => {
      await expect(`
        run: db.sql("""
          SELECT N'héllo' AS s,
                 CAST('2021-02-24' AS DATE) AS d,
                 CAST('2021-02-24 03:05:06' AS DATETIME2) AS t
        """) -> { select: s, d, t }
      `).toMatchResult(tm, {
        s: 'héllo',
        d: new Date('2021-02-24T00:00:00Z'),
        t: new Date('2021-02-24T03:05:06Z'),
      });
    });
  });
});
