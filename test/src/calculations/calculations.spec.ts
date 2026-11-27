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
  test('view with joined dimension and calculate compiles', async () => {
    // Regression: a view using a joined field as a dimension and
    // calculate (e.g. rank()) stopped compiling.
    await expect(`
      source: model is db.table('malloytest.flights') extend {
        join_many: carriers is db.table('malloytest.carriers') on carriers.code = carrier
        dimension: airline is carriers.name
        measure: flight_count is count()
        view: ranking is {
          group_by: airline
          aggregate: flight_count
          calculate: rank is rank()
        }
      }
      run: model -> ranking
    `).toMatchResult(testModel, {});
  });
});
