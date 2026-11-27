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

  describe('a table', () => {
    test('escapes a bracket in a LIKE pattern', async () => {
      await expect(`
        run: db.sql("""
          SELECT s FROM (VALUES (N'a[b'), (N'ab'), (N'axb')) v(s)
        """) -> { select: s; where: s ~ 'a[%' }
      `).toEqualResult(tm, [{s: 'a[b'}]);
    });
  });

  describe('aggregation', () => {
    test('divides as a float', async () => {
      await expect(`
        run: db.sql("SELECT 7 AS a, 2 AS b") -> {
          select: q is a / b
        }
      `).toMatchResult(tm, {q: 3.5});
    });
  });
});
