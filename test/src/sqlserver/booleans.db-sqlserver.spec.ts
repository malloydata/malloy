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
    test('a boolean literal is a condition', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          where: true
          aggregate: n is count(), none is count() { where: false }
        }
      `).toEqualResult(tm, [{n: 51, none: 0}]);
    });

    test('a bit column is an integer', async () => {
      await expect(`
        run: db.table('malloytest.alltypes') -> {
          select: t_bool_true, t_bool_false, t_bool_null
        }
      `).toEqualResult(tm, [
        {t_bool_true: 1, t_bool_false: 0, t_bool_null: null},
      ]);
    });

    test('a declared boolean in a result column is refused, naming the value to write', async () => {
      await expect(
        testDatabase.runtime
          .loadQuery(
            `run: db.table('malloytest.state_facts') extend {
              dimension: big is airport_count > 500
            } -> { group_by: big; aggregate: n is count() }`
          )
          .run()
      ).rejects.toThrow(
        "'sqlserver' does not support a boolean as a result column; write the value, pick 'yes' when big else 'no'"
      );
    });

    test('a declared boolean is a condition in where: and having:', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') extend {
          dimension: big is airport_count > 500
          measure: n is count()
        } -> {
          where: big
          aggregate: n
          having: n > 1
        }
      `).toEqualResult(tm, [{n: 12}]);
    });

    test('not, and a comparison true on NULL, follow Malloy rather than SQL', async () => {
      await expect(`
        run: db.sql('SELECT CAST(NULL AS INT) AS n, 1 AS one') -> {
          select:
            not_null is pick 'yes' when not (n = 1) else 'no'
            ne_null is pick 'yes' when n != 1 else 'no'
            not_one is pick 'yes' when not (one = 1) else 'no'
            ne_one is pick 'yes' when one != 1 else 'no'
        }
      `).toEqualResult(tm, [
        {not_null: 'yes', ne_null: 'yes', not_one: 'no', ne_one: 'no'},
      ]);
    });

    test('a comparison picks', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          group_by: size is pick 'big' when airport_count > 500 else 'small'
          aggregate: n is count()
          order_by: size
        }
      `).toEqualResult(tm, [
        {size: 'big', n: 12},
        {size: 'small', n: 39},
      ]);
    });

    test('a boolean function is a condition', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          where: starts_with(state, 'C') and not ends_with(state, 'A')
          select: state
          order_by: state
        }
      `).toEqualResult(tm, [{state: 'CO'}, {state: 'CT'}]);
    });

    test('sql_boolean is a condition', async () => {
      await expect(`
        ##! experimental { sql_functions }
        run: db.table('malloytest.state_facts') extend {
          dimension: big is sql_boolean("\${airport_count} > 500")
        } -> {
          where: big
          aggregate: n is count()
        }
      `).toEqualResult(tm, [{n: 12}]);
    });

    test('a cast to boolean is refused', async () => {
      await expect(
        testDatabase.runtime
          .loadQuery(
            `run: db.table('malloytest.state_facts') -> {
              select: b is airport_count::boolean
            }`
          )
          .run()
      ).rejects.toThrow(/boolean/);
    });

    test('starts_with, ends_with and is_nan filter an aggregate', async () => {
      await expect(`
        run: db.table('malloytest.state_facts') -> {
          aggregate:
            c_states is count() { where: starts_with(state, 'C') }
            a_states is count() { where: ends_with(state, 'A') }
            nan_counts is count() { where: is_nan(airport_count) }
        }
      `).toEqualResult(tm, [{c_states: 3, a_states: 8, nan_counts: 0}]);
    });
  });
});
