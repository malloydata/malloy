/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {testDatabase} from '../test_database';

afterAll(() => testDatabase.shutdown());

const testModel = wrapTestModel(testDatabase, '');

it('runs an sql query', async () => {
  await expect('run: db.sql("SELECT 1 as n") -> { select: n }').toMatchResult(
    testModel,
    {n: 1}
  );
});
