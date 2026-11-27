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

  describe('functions', () => {
    test('pow computes in floating point', async () => {
      await expect(`
        run: db.sql("SELECT 1 AS n") -> {
          select: root is round(pow(2, 0.5), 6), hundredth is pow(10, -2)
        }
      `).toEqualResult(tm, [{root: 1.414214, hundredth: 0.01}]);
    });

    test('length counts trailing spaces', async () => {
      await expect(`
        run: db.sql("SELECT 1 AS n") -> {
          select:
            padded is length('abc  ')
            back is substr('abc ', -2)
        }
      `).toEqualResult(tm, [{padded: 5, back: 'c '}]);
    });
  });
});
