/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';

afterAll(() => testDatabase.shutdown());

describe('unsupported type tests', () => {
  it('can read unsupported types in schema', async () => {
    const result = await testDatabase.runtime
      .loadQuery(
        `run:
          db.sql("SELECT ST_GEOGFROMTEXT('LINESTRING(1 2, 3 4)') as geo")
          -> { select: geo }
      `
      )
      .run();
    expect(result.data.value[0]['geo']).toBeDefined();
  });
});
