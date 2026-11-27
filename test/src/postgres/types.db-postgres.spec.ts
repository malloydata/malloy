/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

import {testDatabase} from '../test_database';

describe('Postgres tests', () => {
  const testModel = wrapTestModel(testDatabase, '');

  afterAll(() => testDatabase.shutdown());

  it('passes unsupported data', async () => {
    const result = await testDatabase.runtime
      .loadQuery('run: db.sql("SELECT int4range(10, 20) as ranger")')
      .run();
    expect(result.data.value[0]['ranger']).toBeDefined();
  });

  it('supports varchars with parameters', async () => {
    await expect(
      "run: db.sql(\"SELECT 'a'::VARCHAR as abc, 'a3'::VARCHAR(3) as abc3\")"
    ).toMatchResult(testModel, {abc: 'a', abc3: 'a3'});
  });
});
