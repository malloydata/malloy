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

  it('fields which are sql keywords are quoted', async () => {
    await expect(`
    run: db.sql('SELECT 1 as "select"') -> {
      select:
        select
        create is select + 1
    }
  `).toMatchResult(testModel, {select: 1, create: 2});
  });
});
