/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
// No prebuilt shared model, each test is complete.  Makes debugging easier.

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  const q = runtime.getQuoter();
  const testModel = wrapTestModel(runtime, '');
  it(`sql expression with turducken - ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.sql(
        """SELECT * FROM (%{
          ${databaseName}.table('malloytest.state_facts') -> {
            aggregate: c is count()
          }
        }) AS state_facts """
      ) -> { select: * }
    `).toMatchResult(testModel, {c: 51});
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
    `).toMatchResult(testModel, {c: 51});
  });
  it(`sql expression in other sql expression - ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.sql("""
        SELECT * from (%{
          ${databaseName}.sql("""SELECT 1 as ${q`one`} """) -> { group_by: one }
        }) as the_table
      """) -> { group_by: one }
    `).toMatchResult(testModel, {one: 1});
  });
  it(`run sql expression as query - ${databaseName}`, async () => {
    await expect(
      `run: ${databaseName}.sql("""SELECT 1 as ${q`one`} """)`
    ).toMatchResult(testModel, {one: 1});
  });
});
