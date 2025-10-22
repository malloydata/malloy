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

  test('result data structure contains time zones for nested queries', async () => {
    const query = runtime.loadQuery(`
      run: duckdb.table('malloytest.flights') -> {
        nest: arrive_yekaterinburg is {
          timezone: 'Asia/Yekaterinburg'
          group_by: utc_time is arr_time::string, civil_time is arr_time
          limit: 5
        }
      }
    `);
    const result = await query.run();

    // Inspect the result schema to find timezone metadata
    const schema = result.resultExplore;

    // Find the nested field
    const nestedField = schema.getFieldByName('arrive_yekaterinburg');
    expect(nestedField).toBeDefined();

    if (nestedField?.isExploreField()) {
      // Check if timezone information is present in the result data structure
      const queryTimezone = nestedField.queryTimezone;

      // Verify timezone is accessible in the result structure
      expect(queryTimezone).toBe('Asia/Yekaterinburg');

      // The timezone info should be available for later serialization
      // (this is what gets turned into annotations during the to-stable process)
      expect(nestedField.queryTimezone).toBeDefined();
    }
  });
});

afterAll(async () => {
  await runtime.connection.close();
});
