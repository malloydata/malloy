/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '@malloydata/malloy/test/matchers';
import {runQuery, wrapTestModel} from '@malloydata/malloy/test';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

// A nested `select:` (projection nest) compiles to an array-aggregate. These
// exercise depth (the inner projection used to pin to group_set 0 and return
// []), `limit:` (used to reference a column swallowed into the aggregate),
// `where:`, and the multi-stage case. `limit:` on a projection nest is a
// dialect capability (`supportsNestedProjectionLimit`); a multi-stage nest
// needs `supportsPipelinesInViews`. The matchers print the generated SQL on
// failure, which is how cross-dialect issues get diagnosed.
runtimes.runtimeMap.forEach((runtime, databaseName) => {
  const tm = wrapTestModel(runtime, '');
  const table = `${databaseName}.table('malloytest.state_facts')`;

  describe(`nested select - ${databaseName}`, () => {
    test('depth-2 projection nest is populated', async () => {
      await expect(`
        run: ${table} -> {
          group_by: f1 is substr(popular_name, 1, 1)
          nest: by2 is {
            group_by: f2 is substr(popular_name, 1, 2)
            nest: names is { select: popular_name }
          }
        }
      `).toMatchResult(tm, {
        f1: 'A',
        by2: [
          {
            f2: 'Av',
            names: [
              {popular_name: 'Ava'},
              {popular_name: 'Ava'},
              {popular_name: 'Ava'},
            ],
          },
        ],
      });
    });

    test('depth-3 projection nest is populated', async () => {
      await expect(`
        run: ${table} -> {
          group_by: f1 is substr(popular_name, 1, 1)
          nest: by2 is {
            group_by: f2 is substr(popular_name, 1, 2)
            nest: by3 is {
              group_by: f3 is substr(popular_name, 1, 3)
              nest: names is { select: popular_name }
            }
          }
        }
      `).toMatchPaths(tm, {'by2.by3.names.popular_name': 'Ava'});
    });

    test('all-group_by nesting (control) still works', async () => {
      await expect(`
        run: ${table} -> {
          group_by: f1 is substr(popular_name, 1, 1)
          nest: by2 is {
            group_by: f2 is substr(popular_name, 1, 2)
            nest: names is { group_by: popular_name }
          }
        }
      `).toMatchPaths(tm, {'by2.names.popular_name': 'Ava'});
    });

    const limitQuery = `
      run: ${table} -> {
        group_by: f1 is substr(popular_name, 1, 1)
        nest: names is { select: popular_name; limit: 3 }
      }
    `;

    test.when(runtime.dialect.supportsNestedProjectionLimit)(
      'limit on a projection nest caps the array',
      async () => {
        await expect(limitQuery).toMatchResult(tm, {
          f1: 'A',
          names: [
            {popular_name: 'Ava'},
            {popular_name: 'Ava'},
            {popular_name: 'Ava'},
          ],
        });
      }
    );

    test.when(!runtime.dialect.supportsNestedProjectionLimit)(
      'limit on a projection nest is rejected at compile time',
      async () => {
        await expect(runQuery(tm.model, limitQuery)).rejects.toThrow(
          /does not support 'limit:' on a nested 'select:'/
        );
      }
    );

    test('where on a projection nest filters elements', async () => {
      // Group 'A' is all "Ava", so filtering it out leaves an empty array.
      await expect(`
        run: ${table} -> {
          group_by: f1 is substr(popular_name, 1, 1)
          nest: names is { select: popular_name; where: popular_name != 'Ava' }
        }
      `).toMatchResult(tm, {f1: 'A', names: []});
    });

    test.when(runtime.dialect.supportsNestedProjectionLimit)(
      'order_by then limit keeps the ordered top-N',
      async () => {
        await expect(`
          run: ${table} -> {
            group_by: f1 is substr(popular_name, 1, 1)
            nest: names is {
              select: popular_name
              order_by: popular_name desc
              limit: 2
            }
          }
        `).toMatchResult(tm, {
          f1: 'A',
          names: [{popular_name: 'Ava'}, {popular_name: 'Ava'}],
        });
      }
    );

    const multiStageQuery = `
      run: ${table} -> {
        group_by: f1 is substr(popular_name, 1, 1)
        nest: m is {
          group_by: popular_name
        } -> {
          select: popular_name
        }
      }
    `;

    test.when(runtime.dialect.supportsPipelinesInViews)(
      'multi-stage nest works',
      async () => {
        await expect(multiStageQuery).toMatchResult(tm, {});
      }
    );

    test.when(!runtime.dialect.supportsPipelinesInViews)(
      'multi-stage nest is rejected at compile time',
      async () => {
        await expect(runQuery(tm.model, multiStageQuery)).rejects.toThrow(
          /does not support a multi-stage pipeline/
        );
      }
    );

    // A projection-FIRST multi-stage nest (issue #2899): the stage that
    // re-pipes the nested array must carry the prior CTE's group-set-suffixed
    // columns forward, not the query's final names. Broke only on dialects
    // without SELECT * REPLACE (Trino); guarded here without a `limit:` so it
    // isolates the carry-forward from the array-agg slice the limit case adds.
    test.when(runtime.dialect.supportsPipelinesInViews)(
      'multi-stage: a projection first stage carries forward',
      async () => {
        await expect(`
          run: ${table} -> {
            group_by: f1 is substr(popular_name, 1, 1)
            nest: m is { select: popular_name } -> { select: popular_name }
          }
        `).toMatchResult(tm, {
          f1: 'A',
          m: [
            {popular_name: 'Ava'},
            {popular_name: 'Ava'},
            {popular_name: 'Ava'},
          ],
        });
      }
    );

    // The first stage of a multi-stage nest is still a projection: its `limit:`
    // folds into that stage's array-agg ("compile the first stage and stop").
    // This composes the projection-`limit:` fix here with the multi-stage
    // stage-combination fix from #2899 (the carry-forward stage now references
    // the group-set-suffixed names the prior CTE produced, e.g. `f1__0`/`m__0`,
    // not the final names) -- so it runs wherever pipelined nests are
    // supported, Trino included.
    test.when(runtime.dialect.supportsPipelinesInViews)(
      'multi-stage: a projection first-stage limit caps that stage',
      async () => {
        await expect(`
          run: ${table} -> {
            group_by: f1 is substr(popular_name, 1, 1)
            nest: m is { select: popular_name; limit: 3 } -> { select: popular_name }
          }
        `).toMatchResult(tm, {
          f1: 'A',
          m: [
            {popular_name: 'Ava'},
            {popular_name: 'Ava'},
            {popular_name: 'Ava'},
          ],
        });
      }
    );
  });
});
