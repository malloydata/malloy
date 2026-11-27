/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';

afterAll(() => testDatabase.shutdown());

describe('misc tests for regressions that have no better home', () => {
  test('result data structure contains time zones for nested queries', async () => {
    const query = testDatabase.runtime.loadQuery(`
      run: db.table('malloytest.flights') -> {
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
