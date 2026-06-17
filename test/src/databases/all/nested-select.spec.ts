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

    test.when(runtime.dialect.supportsNestedProjectionLimit)(
      'limit on a projection nest caps array length',
      async () => {
        const {data} = await runQuery(model, limitQuery);
        const lengths = data.map(row => {
          const names = row['names'];
          return Array.isArray(names) ? names.length : -1;
        });
        for (const len of lengths) {
          expect(len).toBeLessThanOrEqual(3);
        }
        // At least one group has more than 3 candidates, so the cap actually bit.
        expect(lengths).toContain(3);
      }
    );

    test.when(!runtime.dialect.supportsNestedProjectionLimit)(
      'limit on a projection nest is rejected at compile time',
      async () => {
        await expect(runQuery(model, limitQuery)).rejects.toThrow(
          /does not support 'limit:' on a nested 'select:'/
        );
      }
    );

    test('where on a projection nest filters elements', async () => {
      const {data} = await runQuery(
        model,
        `
        run: ${table} -> {
          group_by: f1 is substr(popular_name, 1, 1)
          nest: names is { select: popular_name; where: popular_name != 'Ava' }
        }
        `
      );
      const values = data
        .flatMap(row => (Array.isArray(row['names']) ? row['names'] : []))
        .map(n => n['popular_name']);
      expect(values.length).toBeGreaterThan(0);
      expect(values).not.toContain('Ava');
    });

    test('depth-3 projection nest is not empty', async () => {
      const {data} = await runQuery(
        model,
        `
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
        `
      );
      let leaves = 0;
      for (const r of data) {
        const l2 = r['by2'];
        if (!Array.isArray(l2)) continue;
        for (const m of l2) {
          const l3 = m['by3'];
          if (!Array.isArray(l3)) continue;
          for (const n of l3) {
            const names = n['names'];
            if (Array.isArray(names)) leaves += names.length;
          }
        }
      }
      expect(leaves).toBeGreaterThan(0);
    });

    test.when(runtime.dialect.supportsNestedProjectionLimit)(
      'order_by then limit keeps the ordered top-N',
      async () => {
        const {data} = await runQuery(
          model,
          `
          run: ${table} -> {
            group_by: f1 is substr(popular_name, 1, 1)
            nest: names is {
              select: popular_name
              order_by: popular_name desc
              limit: 2
            }
          }
          `
        );
        for (const row of data) {
          const names = row['names'];
          if (!Array.isArray(names)) continue;
          expect(names.length).toBeLessThanOrEqual(2);
          const values = names.map(n => n['popular_name']);
          const descending = [...values].sort().reverse();
          expect(values).toEqual(descending);
        }
      }
    );
  });
});
