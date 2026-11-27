/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const testModel = wrapTestModel(testDatabase, '');

afterAll(() => testDatabase.shutdown());

describe('misc tests for regressions that have no better home', () => {
  test('index query piped to select compiles', async () => {
    // Regression: piping an index query into a select stage caused a
    // __distinct_key error in the compiler.
    await expect(`
      run: db.table('malloytest.flights') extend {
        join_many: carriers is db.table('malloytest.carriers') on carriers.code = carrier
        measure: total_flights is count()
      } -> {
        index:
          *
          carriers.*
        by total_flights
        sample: 5000
      } -> {
        select: *
        where: fieldValue ~ 'United%'
        order_by: weight desc
      }
    `).toMatchResult(testModel, {});
  });
});
