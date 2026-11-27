/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {testDatabase} from '../test_database';

afterAll(() => testDatabase.shutdown());

describe('time specific tests for standardsql', () => {
  const testModel = wrapTestModel(testDatabase, '');

  const utc_2020 = '2020-02-20T00:00:00.000Z';

  test('can cast unsupported DATETIME to timestamp', async () => {
    await expect(
      `run: db.sql("SELECT DATETIME '2020-02-20 00:00:00' as t_datetime") -> {
          select: mex_220 is t_datetime::timestamp
      }`
    ).toMatchResult(testModel, {mex_220: utc_2020});
  });
});
