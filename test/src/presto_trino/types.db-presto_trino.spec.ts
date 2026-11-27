/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {testDatabase} from '../test_database';

afterAll(() => testDatabase.shutdown());

const testModel = wrapTestModel(testDatabase, '');
test.when(testDatabase.name === 'presto')(
  'schema parser does not throw on compound types',
  async () => {
    const abrec = 'CAST(ROW(0,1) AS ROW(a DOUBLE,b DOUBLE))';
    await expect(`
          run: db.sql("""
            SELECT
              ${abrec} as "abrec",
              ARRAY['c', 'd'] as str_array,
              array[1,2,3] as int_array,
              ARRAY[${abrec}] as array_of_abrec
          """)
      `).toMatchResult(testModel, {});
  }
);

it('can read a map data type from an sql schema', async () => {
  await expect(`run: db.sql("""
          SELECT MAP(ARRAY['key1', 'key2', 'key3' ], ARRAY['v1', 'v2', 'v3']) as KEY_TO_V
        """) -> { aggregate: n is count() }
      `).toMatchResult(testModel, {n: 1});
});
