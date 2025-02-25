/* eslint-disable no-console */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';
// No prebuilt shared model, each test is complete.  Makes debugging easier.

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  const q = runtime.getQuoter();
  it(`sql expression with turducken - ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.sql(
        """SELECT * FROM (%{
          ${databaseName}.table('malloytest.state_facts') -> {
            aggregate: c is count()
          }
        }) AS state_facts """
      ) -> { select: * }
    `).malloyResultMatches(runtime, {c: 51});
  });
  it(`sql expression in second of two queries in same block, dependent on first query - ${databaseName}`, async () => {
    await expect(`
      query:
        a is ${databaseName}.table('malloytest.state_facts') -> {
          aggregate: c is count()
        }
        b is ${databaseName}.sql(
          """SELECT * FROM (%{ a -> { select: * } }) AS state_facts """
        ) -> { select: * }
      run: b
    `).malloyResultMatches(runtime, {c: 51});
  });
  it(`sql expression in other sql expression - ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.sql("""
        SELECT * from (%{
          ${databaseName}.sql("""SELECT 1 as ${q`one`} """) -> { group_by: one }
        }) as the_table
      """) -> { group_by: one }
    `).malloyResultMatches(runtime, {one: 1});
  });
  it(`run sql expression as query - ${databaseName}`, async () => {
    await expect(
      `run: ${databaseName}.sql("""SELECT 1 as ${q`one`} """)`
    ).malloyResultMatches(runtime, {one: 1});
  });
});
