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
    test('carries a newline in a string literal', async () => {
      await expect(`
        run: db.sql("SELECT 1 AS n") -> { select: s is 'a\\nb' }
      `).toMatchResult(tm, {s: 'a\nb'});
    });

    test('quotes a field named like a keyword', async () => {
      await expect(`
        run: db.sql('SELECT 1 AS "select"') -> {
          select: \`select\`, \`create\` is \`select\` + 1
        }
      `).toMatchResult(tm, {select: 1, create: 2});
    });
  });
});
