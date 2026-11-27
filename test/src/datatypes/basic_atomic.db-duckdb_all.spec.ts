/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {testDatabase} from '../test_database';

afterAll(() => testDatabase.shutdown());

const testModel = wrapTestModel(testDatabase, '');

it('handles decimal literals', async () => {
  const query = `
    run: db.sql("select 1") -> {
      select:
          n1 is 1.234
          n2 is 1234.0 / 1000
  }
    `;
  await expect(query).toMatchResult(testModel, {n1: 1.234, n2: 1.234});
});
