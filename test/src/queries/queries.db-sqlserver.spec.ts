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

  describe('aggregation', () => {
    test('a group of only constants is one row', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> { group_by: x is 1, y is 'a' }
      `).toEqualResult(tm, [{x: 1, y: 'a'}]);
    });

    test('a constant dimension groups with the others', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          group_by: tag is 'facts', size is pick 'big' when airport_count > 500 else 'small'
          aggregate: n is count()
          order_by: size
        }
      `).toEqualResult(tm, [
        {tag: 'facts', size: 'big', n: 12},
        {tag: 'facts', size: 'small', n: 39},
      ]);
    });

    test('groups by a column', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: state_count is count()
          order_by: state_count desc
        }
      `).toMatchResult(tm, {popular_name: 'Isabella'});
    });

    test('groups by an expression', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          group_by: first is substr(state, 1, 1)
          aggregate: state_count is count()
          order_by: state_count desc, first
        }
      `).toMatchResult(tm, {first: 'M', state_count: 8});
    });
  });
});
