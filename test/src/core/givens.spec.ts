/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';
import {TestSelect} from '../test-select';

const runtime = runtimeFor('duckdb');

const envDatabases = (
  process.env['MALLOY_DATABASES'] ||
  process.env['MALLOY_DATABASE'] ||
  'duckdb'
).split(',');

let describe = globalThis.describe;
if (!envDatabases.includes('duckdb')) {
  describe = describe.skip;
  describe.skip = describe;
}

afterAll(async () => {
  await runtime.connection.close();
});

describe('givens — runtime supply path (Stage 4)', () => {
  test('string given supplied via .run({givens})', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: STATE :: string
      query: q is duckdb.table('malloytest.state_facts') -> {
        where: state = $STATE
        group_by: state
      }
    `);
    const result = await model
      .loadQueryByName('q')
      .run({givens: {STATE: 'CA'}});
    expect(result.data.path(0, 'state').value).toBe('CA');
    expect(result.data.toObject().length).toBe(1);
  });

  test('number given drives a where comparison', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: FLOOR_VAL_POPULAR :: number is 1000
      query: q is duckdb.table('malloytest.state_facts') -> {
        where: airport_count >= $FLOOR_VAL_POPULAR
        group_by: state
      }
    `);
    // Default of 1000 → some states match
    const r1 = await model.loadQueryByName('q').run();
    const baseline = r1.data.toObject().length;
    // Tighten the threshold: count should be smaller
    const r2 = await model
      .loadQueryByName('q')
      .run({givens: {FLOOR_VAL_POPULAR: 100000}});
    expect(r2.data.toObject().length).toBeLessThan(baseline);
  });

  test('default chain: given references another given', async () => {
    // B has no caller value but references A which is supplied — B's
    // default expression resolves through the supplied A.
    const model = runtime.loadModel(`
      ##! experimental.givens
      given:
        A :: number
        B :: number is $A + 1
      query: q is duckdb.table('malloytest.state_facts') -> {
        where: airport_count >= $B
        group_by: state
      }
    `);
    // Set A=99 so threshold becomes 100 — different from setting A=999 (1000)
    const r1 = await model.loadQueryByName('q').run({givens: {A: 99}});
    const r2 = await model.loadQueryByName('q').run({givens: {A: 999}});
    // Tighter threshold → fewer matching states
    expect(r2.data.toObject().length).toBeLessThanOrEqual(
      r1.data.toObject().length
    );
  });

  test('boolean given gates a where filter', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: ONLY_CA :: boolean
      query: q is duckdb.table('malloytest.state_facts') -> {
        where: ($ONLY_CA = false) or state = 'CA'
        group_by: state
      }
    `);
    const all = await model
      .loadQueryByName('q')
      .run({givens: {ONLY_CA: false}});
    expect(all.data.toObject().length).toBeGreaterThan(1);
    const onlyCa = await model
      .loadQueryByName('q')
      .run({givens: {ONLY_CA: true}});
    expect(onlyCa.data.toObject().length).toBe(1);
    expect(onlyCa.data.path(0, 'state').value).toBe('CA');
  });

  test('default value is used when caller supplies no givens', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: STATE :: string is "CA"
      query: q is duckdb.table('malloytest.state_facts') -> {
        where: state = $STATE
        group_by: state
      }
    `);
    const result = await model.loadQueryByName('q').run();
    expect(result.data.path(0, 'state').value).toBe('CA');
  });

  test('unknown given key throws with did-you-mean', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: TENANT :: string
      query: q is duckdb.table('malloytest.state_facts') -> { group_by: state }
    `);
    await expect(
      model.loadQueryByName('q').run({givens: {TENNANT: 'acme'}})
    ).rejects.toThrow(/unknown given 'TENNANT'.*did you mean 'TENANT'/);
  });

  test('type mismatch throws at boundary', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: FLOOR_VAL :: number
      query: q is duckdb.table('malloytest.state_facts') -> {
        where: airport_count >= $FLOOR_VAL
        group_by: state
      }
    `);
    await expect(
      // boolean where number was declared
      model.loadQueryByName('q').run({givens: {FLOOR_VAL: true}})
    ).rejects.toThrow(/expected number/);
  });

  test('PreparedQuery.givens lists only what this query references', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given:
        A :: string is "CA"
        B :: string is "NV"
      query: q is duckdb.table('malloytest.state_facts') -> {
        where: state = $A
        group_by: state
      }
    `);
    const pq = await model.loadQueryByName('q').getPreparedQuery();
    const names = [...pq.givens.keys()];
    expect(names).toEqual(['A']);
    expect(pq.givens.get('A')?.type.type).toBe('string');
  });

  test('timestamptz given supplied as JS Date filters in UTC', async () => {
    const ts = new TestSelect(runtime.dialect);
    const tableSQL = ts.generate(
      {id: 1, t: ts.mk_timestamptz('2024-01-01 00:00:00 [UTC]')},
      {id: 2, t: ts.mk_timestamptz('2024-06-01 00:00:00 [UTC]')}
    );
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: BEFORE :: timestamptz
      source: rows is duckdb.sql("""${tableSQL}""")
      query: q is rows -> {
        where: t < $BEFORE
        aggregate: ct is count()
      }
    `);
    const r = await model
      .loadQueryByName('q')
      .run({givens: {BEFORE: new Date('2024-03-01T00:00:00Z')}});
    expect(r.data.path(0, 'ct').value).toBe(1);
  });

  test('timestamptz given honors offset on supplied ISO string', async () => {
    const ts = new TestSelect(runtime.dialect);
    // Two rows 1h apart in UTC; the cutoff straddles them when interpreted
    // with the supplied offset, but would miss both if the offset were
    // ignored.
    const tableSQL = ts.generate(
      {id: 1, t: ts.mk_timestamptz('2024-01-01 12:00:00 [UTC]')},
      {id: 2, t: ts.mk_timestamptz('2024-01-01 13:00:00 [UTC]')}
    );
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: BEFORE :: timestamptz
      source: rows is duckdb.sql("""${tableSQL}""")
      query: q is rows -> {
        where: t < $BEFORE
        aggregate: ct is count()
      }
    `);
    // "2024-01-01T07:30:00-05:00" == 2024-01-01 12:30:00Z
    //   → matches the 12:00Z row, not the 13:00Z row.
    // If the offset were dropped (treated as 07:30Z), the cutoff would be
    // before both rows and the count would be 0.
    const r = await model
      .loadQueryByName('q')
      .run({givens: {BEFORE: '2024-01-01T07:30:00-05:00'}});
    expect(r.data.path(0, 'ct').value).toBe(1);
  });

  test('filter<T> given supplies a Malloy filter expression', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: STATE_F :: filter<string>
      query: q is duckdb.table('malloytest.state_facts') -> {
        where: state ~ $STATE_F
        group_by: state
        order_by: state
      }
    `);
    const r = await model
      .loadQueryByName('q')
      .run({givens: {STATE_F: 'CA, NV'}});
    const states = r.data.toObject().map(row => row['state']);
    expect(states.sort()).toEqual(['CA', 'NV']);
  });
});
