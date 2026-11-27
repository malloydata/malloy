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
    test('counts without a group', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          aggregate: state_count is count()
        }
      `).toMatchResult(tm, {state_count: 51});
    });
  });

  describe('joins', () => {
    test('sums each side of a fan-out once', async () => {
      await expect(`
        source: facts is db.table('malloytest.state_facts')
        run: facts extend { join_cross: other is facts on other.state = 'CA' | 'NY' } -> {
          aggregate:
            row_count is count(concat(state, other.state))
            left_sum is airport_count.sum()
            right_sum is other.airport_count.sum()
        }
      `).toMatchResult(tm, {row_count: 102, left_sum: 19701, right_sum: 1560});
    });

    test('joins and aggregates symmetrically', async () => {
      await expect(`
        source: carriers is db.table('malloytest.carriers') extend {
          primary_key: code
        }
        source: flights is db.table('malloytest.flights') extend {
          join_one: carriers with carrier
        }
        run: flights -> {
          group_by: carriers.nickname
          aggregate: flight_count is count(), carrier_count is carriers.count()
          order_by: flight_count desc
        }
      `).toMatchResult(tm, {nickname: 'Southwest', carrier_count: 1});
    });
  });
});
