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
    test('a limit of zero is no limit', async () => {
      // FETCH NEXT 0 ROWS is a parse error; the compiler writes no limit at all
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          select: state
          limit: 0
        } -> { aggregate: n is count() }
      `).toEqualResult(tm, [{n: 51}]);
    });

    test('orders and limits', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          select: state
          order_by: state desc
          limit: 2
        }
      `).toEqualResult(tm, [{state: 'WY'}, {state: 'WV'}]);
    });

    test('limits a stage that feeds another', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          select: state
          order_by: state desc
          limit: 3
        } -> {
          select: state
          order_by: state asc
        }
      `).toEqualResult(tm, [{state: 'WI'}, {state: 'WV'}, {state: 'WY'}]);
    });
  });

  describe('aggregation', () => {
    test('orders and limits a grouped result', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: state_count is count()
          order_by: state_count desc, popular_name
          limit: 2
        }
      `).toEqualResult(tm, [
        {popular_name: 'Isabella', state_count: 24},
        {popular_name: 'Sophia', state_count: 11},
      ]);
    });

    test('orders a query used as a source', async () => {
      await expect(`
        source: by_name is db.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: state_count is count()
          order_by: state_count desc
        }
        run: by_name -> {
          select: popular_name
          where: state_count > 10
          order_by: popular_name
        }
      `).toEqualResult(tm, [
        {popular_name: 'Isabella'},
        {popular_name: 'Sophia'},
      ]);
    });

    test('orders the last stage of a pipeline', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: state_count is count()
        } -> {
          select: popular_name, state_count
          order_by: state_count asc, popular_name desc
          limit: 2
        }
      `).toEqualResult(tm, [
        {popular_name: 'Madison', state_count: 3},
        {popular_name: 'Ava', state_count: 3},
      ]);
    });
  });
});
