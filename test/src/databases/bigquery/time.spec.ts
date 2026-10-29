/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList} from '../../runtimes';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {describeIfDatabaseAvailable} from '../../util';

const [describe, databases] = describeIfDatabaseAvailable(['bigquery']);
const runtimes = new RuntimeList(databases);

afterAll(async () => {
  await runtimes.closeAll();
});

describe('time specific tests for standardsql', () => {
  const runtime = runtimes.runtimeMap.get('bigquery');
  const testModel = runtime && wrapTestModel(runtime, '');

  const utc_2020 = '2020-02-20T00:00:00.000Z';

  test('can cast unsupported DATETIME to timestamp', async () => {
    await expect(
      `run: bigquery.sql("SELECT DATETIME '2020-02-20 00:00:00' as t_datetime") -> {
          select: mex_220 is t_datetime::timestamp
      }`
    ).toMatchResult(testModel!, {mex_220: utc_2020});
  });
});
