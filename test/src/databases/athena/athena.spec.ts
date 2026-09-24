/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

/*
 * Behaviour particular to Athena: a nest leaves the engine as JSON and comes
 * back as rows in every shape core reads one, and the engine facts the
 * dialect declares hold. The malloytest tables are not needed.
 */
const [describe, databases] = describeIfDatabaseAvailable(['athena']);
const runtimes = new RuntimeList(databases);

afterAll(async () => {
  await runtimes.closeAll();
});

describe.each(runtimes.runtimeList)(
  'Athena dialect - %s',
  (databaseName, runtime) => {
    if (runtime === undefined) {
      throw new Error("Couldn't build runtime");
    }
    // A test runtime waives the experimental gate; this one keeps it, so the
    // model below has to name the dialect.
    runtime.isTestRuntime = false;
    const testModel = wrapTestModel(
      runtime,
      `
    ##! experimental.dialect.athena
    source: t is ${databaseName}.sql("""
      SELECT * FROM (VALUES
        (1, 'a', TIMESTAMP '2024-01-02 03:04:05', DATE '2024-01-02'),
        (1, 'b', TIMESTAMP '2024-01-03 00:00:00', DATE '2024-01-03'),
        (2, 'c', TIMESTAMP '2024-02-01 12:00:00', DATE '2024-02-01')
      ) AS v(k, s, t, d)
    """)`
    );

    it('runs a query on a sql block', async () => {
      await expect(`
      run: t -> { aggregate: n is count() }
    `).toMatchResult(testModel, {n: 3});
    });

    it('returns a nest as rows, with its timestamps and dates typed', async () => {
      await expect(`
      run: t -> {
        group_by: k
        nest: rows is { select: s, t, d; order_by: s }
        order_by: k
      }
    `).toMatchResult(testModel, {
        k: 1,
        rows: [
          {s: 'a', t: new Date('2024-01-02T03:04:05Z'), d: '2024-01-02'},
          {s: 'b', t: new Date('2024-01-03T00:00:00Z'), d: '2024-01-03'},
        ],
      });
    });

    it('returns a nest with no rows as an empty array', async () => {
      await expect(`
      run: t -> {
        group_by: k
        nest: none is { where: s = 'zzz'; group_by: s }
        order_by: k
      }
    `).toMatchResult(testModel, {k: 1, none: []});
    });

    it('applies a limit inside a grouped nest without QUALIFY', async () => {
      await expect(`
      run: t -> {
        group_by: k
        nest: top is { group_by: s; aggregate: n is count(); order_by: s desc; limit: 1 }
        order_by: k
      }
    `).toMatchResult(testModel, {k: 1, top: [{s: 'b', n: 1}]});
    });

    it('refuses a pipelined nest, which Athena runs as a correlated subquery it does not support', async () => {
      await expect(
        runtime
          .loadModel(
            `##! experimental.dialect.athena
           source: t is ${databaseName}.sql("SELECT 1 AS k, 'a' AS s")`
          )
          .loadQuery(
            `run: t -> {
            group_by: k
            nest: latest is { select: s } -> { select: s; limit: 1 }
          }`
          )
          .getSQL()
      ).rejects.toThrow(
        "'athena' does not support a multi-stage pipeline ('->') in a nested query"
      );
    });

    it('reads a nest from a previous stage in a second stage', async () => {
      await expect(`
      run: t -> {
        group_by: k
        nest: rows is { select: s, t, d }
      } -> {
        select: s is rows.s, t is rows.t, d is rows.d
        order_by: s
      }
    `).toMatchResult(testModel, {
        s: 'a',
        t: new Date('2024-01-02T03:04:05Z'),
        d: '2024-01-02',
      });
    });

    it('returns record and array literals', async () => {
      await expect(`
      run: t -> {
        select: rec is {a is 1, b is 'x'}, arr is [1, 2]
        limit: 1
      }
    `).toMatchResult(testModel, {rec: {a: 1, b: 'x'}, arr: [1, 2]});
    });
  }
);
