/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 * Documents the aggregate strategy chosen when a stage touches to-many
 * (`join_many`) legs — see malloydata/malloy#2872.
 *
 * Shape: 1,000 parents, two to-many legs with 30 rows per parent each.
 * Expected truth everywhere: a_total = b_total = 1000 * sum(1..30) = 465,000.
 *
 * Current compiler behavior these tests pin down:
 *  - one to-many leg referenced  -> plain SUM (no symmetric machinery)
 *  - two to-many legs in a stage -> cross fan-out (900k joined rows from
 *    61k source rows), symmetric aggregates (DuckDB strategy:
 *    UNNEST(list(distinct {key, val})); MySQL/Postgres use the MD5-hash
 *    SUM(DISTINCT ...) strategy, which is orders of magnitude slower)
 *  - legs pre-aggregated to parent grain via join_one -> plain SUM again
 */

import {DuckDBTestConnection, testRuntimeFor} from '../runtimes';

const envDatabases = (
  process.env['MALLOY_DATABASES'] ||
  process.env['MALLOY_DATABASE'] ||
  'duckdb'
).split(',');

let describe = globalThis.describe;
if (!envDatabases.includes('duckdb')) {
  describe = describe.skip;
}

const LEG_SQL = `
  SELECT (t1.i-1)*30 + t2.j AS id, t1.i AS parent_id, t2.j*1.0 AS amount
  FROM range(1, 1001) t1(i), range(1, 31) t2(j)`;
const PARENT_SQL = 'SELECT t.i AS id FROM range(1, 1001) t(i)';

const model = `
source: leg_a is duckdb.sql("""${LEG_SQL}""") extend { primary_key: id }
source: leg_b is duckdb.sql("""${LEG_SQL}""") extend { primary_key: id }

source: parents is duckdb.sql("""${PARENT_SQL}""") extend {
  primary_key: id
  join_many: a is leg_a on a.parent_id = id
  join_many: b is leg_b on b.parent_id = id
  measure: a_total is a.amount.sum()
  measure: b_total is b.amount.sum()
}

source: parents_preagg is duckdb.sql("""${PARENT_SQL}""") extend {
  primary_key: id
  join_one: a is leg_a -> { group_by: parent_id; aggregate: amount_total is amount.sum() }
    on a.parent_id = id
  join_one: b is leg_b -> { group_by: parent_id; aggregate: amount_total is amount.sum() }
    on b.parent_id = id
  measure: a_total is source.sum(a.amount_total)
  measure: b_total is source.sum(b.amount_total)
}
`;

const SYM_AGG = /list\(distinct/i;
const EXPECTED = 465000;

describe('fan-out symmetric aggregates', () => {
  const runtime = testRuntimeFor(new DuckDBTestConnection('duckdb'));
  const loaded = runtime.loadModel(model);

  afterAll(async () => {
    await runtime.connection.close();
  });

  test('single to-many leg uses a plain aggregate', async () => {
    const query = loaded.loadQuery('run: parents -> { aggregate: a_total }');
    expect(await query.getSQL()).not.toMatch(SYM_AGG);
    const result = await query.run();
    expect(Number(result.data.value[0]['a_total'])).toBe(EXPECTED);
  });

  test('two to-many legs in one stage use symmetric aggregates', async () => {
    const query = loaded.loadQuery(
      'run: parents -> { aggregate: a_total, b_total }'
    );
    expect(await query.getSQL()).toMatch(SYM_AGG);
    const result = await query.run();
    expect(Number(result.data.value[0]['a_total'])).toBe(EXPECTED);
    expect(Number(result.data.value[0]['b_total'])).toBe(EXPECTED);
  });

  test('pre-aggregated join_one legs use plain aggregates', async () => {
    const query = loaded.loadQuery(
      'run: parents_preagg -> { aggregate: a_total, b_total }'
    );
    expect(await query.getSQL()).not.toMatch(SYM_AGG);
    const result = await query.run();
    expect(Number(result.data.value[0]['a_total'])).toBe(EXPECTED);
    expect(Number(result.data.value[0]['b_total'])).toBe(EXPECTED);
  });
});
