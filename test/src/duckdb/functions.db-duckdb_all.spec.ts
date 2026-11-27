/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {testDatabase} from '../test_database';

afterAll(() => testDatabase.shutdown());

const testModel = wrapTestModel(testDatabase, '');

it('dayname', async () => {
  await expect(`
      run: db.sql('select 1') -> {
        select:
          x is dayname(@2024-09-12)
          y is dayname(@2024-09-10 12:22:22)
      }`).toMatchResult(testModel, {x: 'Thursday', y: 'Tuesday'});
});
