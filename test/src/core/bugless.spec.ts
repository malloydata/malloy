/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';
import '../util/db-jest-matchers';

const runtime = runtimeFor('duckdb');

describe('misc tests for regressions that have no better home', () => {
  test('rename a field in a join', async () => {
    // Previously the rename would cause an error in the prepare step, so any result is good
    await expect(`
      source: carriers is duckdb.table('malloytest.carriers') extend { rename: airline is name }
      run: duckdb.table('malloytest.flights') extend {
        join_one: carriers on carrier = carriers.code
      } -> { group_by: carriers.airline; limit: 1 }
    `).malloyResultMatches(runtime, [{}]);
  });
});
