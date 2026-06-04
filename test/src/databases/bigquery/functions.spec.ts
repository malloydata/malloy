/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const [describe, databases] = describeIfDatabaseAvailable(['bigquery']);
const runtimes = new RuntimeList(databases);

afterAll(async () => {
  await runtimes.closeAll();
});

describe('dialect specific function tests for standardsql', () => {
  const runtime = runtimes.runtimeMap.get('bigquery');
  const testModel = runtime && wrapTestModel(runtime, '');

  it('runs the max_by function - bigquery', async () => {
    await expect(`run: bigquery.sql("""
              SELECT 1 as y, 55 as x
    UNION ALL SELECT 50 as y, 22 as x
    UNION ALL SELECT 100 as y, 1 as x
    """) -> {
    aggregate:
      m1 is max_by(x, y)
      m2 is max_by(y, x)
    }`).toMatchResult(testModel!, {m1: 1, m2: 1});
  });

  it('runs the max_by function by grouping - bigquery', async () => {
    await expect(`run: bigquery.sql("""
              SELECT 1 as y, 55 as x, 10 as z
    UNION ALL SELECT 50 as y, 22 as x, 10 as z
    UNION ALL SELECT 1 as y, 10 as x, 20 as z
    UNION ALL SELECT 100 as y, 15 as x, 20 as z
    """) -> {
    group_by:
      z
    aggregate:
      m1 is max_by(x, y)
      m2 is max_by(y, x)
    }`).toMatchRows(testModel!, [
      {z: 10, m1: 22, m2: 1},
      {z: 20, m1: 15, m2: 100},
    ]);
  });

  it('runs the min_by function - bigquery', async () => {
    await expect(`run: bigquery.sql("""
              SELECT 1 as y, 55 as x
    UNION ALL SELECT 50 as y, 22 as x
    UNION ALL SELECT 100 as y, 1 as x
    """) -> {
    aggregate:
      m1 is min_by(x, y)
      m2 is min_by(y, x)
    }`).toMatchResult(testModel!, {m1: 55, m2: 100});
  });
});
