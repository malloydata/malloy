/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {createTestRuntime, wrapTestModel} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';
import {AthenaConnection, AthenaExecutor} from '.';

/*
 * The dialect's own behaviour on a live engine v3 workgroup: a scalar query
 * runs, and what the dialect declares unsupported is refused. Runs when
 * ATHENA_WORKGROUP is set; the malloytest tables are not needed.
 */
const config = AthenaExecutor.getConnectionOptionsFromEnv();
const describeLive = config ? describe : describe.skip;

describeLive('Athena dialect', () => {
  const connection = new AthenaConnection('athena', config);
  const runtime = createTestRuntime(connection);
  // A test runtime waives the experimental gate; this one keeps it, so the
  // model below has to name the dialect.
  runtime.isTestRuntime = false;
  const testModel = wrapTestModel(
    runtime,
    `
    ##! experimental.dialect.athena
    source: t is athena.sql("""
      SELECT * FROM (VALUES
        (1, 'a', TIMESTAMP '2024-01-02 03:04:05', DATE '2024-01-02'),
        (1, 'b', TIMESTAMP '2024-01-03 00:00:00', DATE '2024-01-03'),
        (2, 'c', TIMESTAMP '2024-02-01 12:00:00', DATE '2024-02-01')
      ) AS v(k, s, t, d)
    """)`
  );

  afterAll(async () => {
    await connection.close();
  });

  it('runs a grouped query on a sql block, with its timestamp and date typed', async () => {
    await expect(`
      run: t -> {
        group_by: k
        aggregate: n is count(), first is min(t), first_day is min(d)
        order_by: k
      }
    `).toMatchResult(testModel, {
      k: 1,
      n: 2,
      first: new Date('2024-01-02T03:04:05Z'),
      first_day: '2024-01-02',
    });
  });

  it('refuses a nest at translation', async () => {
    await expect(
      runtime
        .loadModel(
          `##! experimental.dialect.athena
           source: t is athena.sql("SELECT 1 AS k, 'a' AS s")`
        )
        .loadQuery('run: t -> { group_by: k; nest: by_s is { group_by: s } }')
        .getSQL()
    ).rejects.toThrow("'athena' does not support nested queries");
  });

  it('refuses a record literal, naming the engine fact', async () => {
    await expect(
      runtime
        .loadModel(
          `##! experimental.dialect.athena
           source: t is athena.sql("SELECT 1 AS k")`
        )
        .loadQuery('run: t -> { select: r is {a is 1} }')
        .getSQL()
    ).rejects.toThrow(
      'Athena dialect does not support record literals: a compound value arrives from the API as text'
    );
  });
});
