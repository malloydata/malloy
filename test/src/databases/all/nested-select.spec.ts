/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import {runQuery} from '@malloydata/malloy/test';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

// Collect every leaf element found at `row[outer][*][inner]` across all rows,
// using runtime guards so the `Record<string, unknown>` result needs no casts.
function leafElements(
  data: Record<string, unknown>[],
  outer: string,
  inner: string
): unknown[] {
  const out: unknown[] = [];
  for (const row of data) {
    const outerArr = row[outer];
    if (!Array.isArray(outerArr)) continue;
    for (const mid of outerArr) {
      const innerArr = mid[inner];
      if (Array.isArray(innerArr)) out.push(...innerArr);
    }
  }
  return out;
}

// A nested `select:` (projection nest) compiles to an array-aggregate. These
// exercise the two things that used to be broken: depth >= 2 (the inner
// projection used to pin to group_set 0 and return []) and `limit:` (which used
// to reference a column swallowed into the aggregate). `limit:` on a projection
// nest is a dialect capability (`supportsNestedProjectionLimit`); dialects
// without it reject the query at compile time.
runtimes.runtimeMap.forEach((runtime, databaseName) => {
  const model = runtime.loadModel('');
  const table = `${databaseName}.table('malloytest.state_facts')`;

  describe(`nested select - ${databaseName}`, () => {
    test('depth-2 projection nest is not empty', async () => {
      const {data} = await runQuery(
        model,
        `
        run: ${table} -> {
          group_by: f1 is substr(popular_name, 1, 1)
          nest: by2 is {
            group_by: f2 is substr(popular_name, 1, 2)
            nest: names is { select: popular_name }
          }
        }
        `
      );
      // The depth-2 bug returned [] for every innermost projection.
      expect(leafElements(data, 'by2', 'names').length).toBeGreaterThan(0);
    });

    test('all-group_by nesting (control) still works', async () => {
      const {data} = await runQuery(
        model,
        `
        run: ${table} -> {
          group_by: f1 is substr(popular_name, 1, 1)
          nest: by2 is {
            group_by: f2 is substr(popular_name, 1, 2)
            nest: names is { group_by: popular_name }
          }
        }
        `
      );
      expect(leafElements(data, 'by2', 'names').length).toBeGreaterThan(0);
    });

    const limitQuery = `
      run: ${table} -> {
        group_by: f1 is substr(popular_name, 1, 1)
        nest: names is { select: popular_name; limit: 3 }
      }
    `;

    if (runtime.dialect.supportsNestedProjectionLimit) {
      test('limit on a projection nest caps array length', async () => {
        const {data} = await runQuery(model, limitQuery);
        const lengths = data.map(row =>
          Array.isArray(row.names) ? row.names.length : -1
        );
        for (const len of lengths) {
          expect(len).toBeLessThanOrEqual(3);
        }
        // At least one group has more than 3 candidates, so the cap actually bit.
        expect(lengths).toContain(3);
      });
    } else {
      test('limit on a projection nest is rejected at compile time', async () => {
        await expect(runQuery(model, limitQuery)).rejects.toThrow(
          /does not support 'limit:' on a nested 'select:'/
        );
      });
    }
  });
});
