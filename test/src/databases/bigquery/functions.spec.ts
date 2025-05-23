/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {RuntimeList} from '../../runtimes';
import '../../util/db-jest-matchers';
import {describeIfDatabaseAvailable} from '../../util';

const [describe, databases] = describeIfDatabaseAvailable(['bigquery']);
const runtimes = new RuntimeList(databases);

afterAll(async () => {
  await runtimes.closeAll();
});

describe('dialect specific function tests for standardsql', () => {
  const runtime = runtimes.runtimeMap.get('bigquery');

  it('runs the max_by function - bigquery', async () => {
    await expect(`run: bigquery.sql("""
              SELECT 1 as y, 55 as x
    UNION ALL SELECT 50 as y, 22 as x
    UNION ALL SELECT 100 as y, 1 as x
    """) -> {
    aggregate:
      m1 is max_by(x, y)
      m2 is max_by(y, x)
    }`).malloyResultMatches(runtime!, {m1: 1, m2: 1});
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
    }`).malloyResultMatches(runtime!, [
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
    }`).malloyResultMatches(runtime!, {m1: 55, m2: 100});
  });
});
