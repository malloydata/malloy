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
    test('reads a bracket-quoted path', async () => {
      await expect(`
        run: db.table('[malloytest].[state_facts]') -> {
          select: state
          where: state = 'CA'
        }
      `).toEqualResult(tm, [{state: 'CA'}]);
    });

    test('reads a database-qualified path', async () => {
      await expect(`
        run: db.table('malloytest.malloytest.state_facts') -> {
          aggregate: n is count()
        }
      `).toMatchResult(tm, {n: 51});
    });
  });
});
