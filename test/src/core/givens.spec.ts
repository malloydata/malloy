/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';
import {TestSelect} from '../test-select';
import {MalloyConfig, Runtime} from '@malloydata/malloy';
import type {URLReader} from '@malloydata/malloy';
import type {GivenValue} from '@malloydata/malloy';

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

  test('date given filters against a date column', async () => {
    const ts = new TestSelect(runtime.dialect);
    const tableSQL = ts.generate(
      {id: 1, d: ts.mk_date('2024-01-15')},
      {id: 2, d: ts.mk_date('2024-06-15')}
    );
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: BEFORE :: date
      source: rows is duckdb.sql("""${tableSQL}""")
      query: q is rows -> {
        where: d < $BEFORE
        aggregate: ct is count()
      }
    `);
    const r = await model
      .loadQueryByName('q')
      .run({givens: {BEFORE: '2024-03-01'}});
    expect(r.data.path(0, 'ct').value).toBe(1);
  });

  test('naive timestamp given accepts T-separator and space-separator', async () => {
    const ts = new TestSelect(runtime.dialect);
    const tableSQL = ts.generate(
      {id: 1, t: ts.mk_timestamp('2024-01-01 12:00:00')},
      {id: 2, t: ts.mk_timestamp('2024-01-01 13:00:00')}
    );
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: BEFORE :: timestamp
      source: rows is duckdb.sql("""${tableSQL}""")
      query: q is rows -> {
        where: t < $BEFORE
        aggregate: ct is count()
      }
    `);
    // T-separator form
    const rT = await model
      .loadQueryByName('q')
      .run({givens: {BEFORE: '2024-01-01T12:30:00'}});
    expect(rT.data.path(0, 'ct').value).toBe(1);
    // Space-separator form
    const rSp = await model
      .loadQueryByName('q')
      .run({givens: {BEFORE: '2024-01-01 12:30:00'}});
    expect(rSp.data.path(0, 'ct').value).toBe(1);
  });

  test('naive timestamp given rejects offset-bearing strings', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: T :: timestamp
      query: q is duckdb.table('malloytest.state_facts') -> { group_by: state }
    `);
    await expect(
      model.loadQueryByName('q').run({givens: {T: '2024-01-01T12:00:00Z'}})
    ).rejects.toThrow(/use 'timestamptz'/);
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

  test('string array given accepts a JS array', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: ROLES :: string[]
      query: q is duckdb.table('malloytest.state_facts') -> { group_by: state }
    `);
    // Binding succeeds; query doesn't reference $ROLES so just runs.
    const r = await model
      .loadQueryByName('q')
      .run({givens: {ROLES: ['admin', 'viewer']}});
    expect(r.data.toObject().length).toBeGreaterThan(0);
  });

  test('record given accepts a JS object with matching keys', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: SESSION :: { user_id :: string, tenant :: string }
      query: q is duckdb.table('malloytest.state_facts') -> { group_by: state }
    `);
    const r = await model
      .loadQueryByName('q')
      .run({givens: {SESSION: {user_id: 'alice', tenant: 'acme'}}});
    expect(r.data.toObject().length).toBeGreaterThan(0);
  });

  test('array-of-records given accepts a JS array of objects', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: USERS :: { name :: string, age :: number }[]
      query: q is duckdb.table('malloytest.state_facts') -> { group_by: state }
    `);
    const r = await model.loadQueryByName('q').run({
      givens: {
        USERS: [
          {name: 'alice', age: 30},
          {name: 'bob', age: 25},
        ],
      },
    });
    expect(r.data.toObject().length).toBeGreaterThan(0);
  });

  test('compound given: type mismatch at depth includes a path', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: SESSION :: { user_id :: string, tenant :: string }
      query: q is duckdb.table('malloytest.state_facts') -> { group_by: state }
    `);
    await expect(
      model
        .loadQueryByName('q')
        .run({givens: {SESSION: {user_id: 42, tenant: 'acme'}}})
    ).rejects.toThrow(/SESSION\.user_id.*expected string.*got number/);
  });

  test('record given: missing key throws with the missing path', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: SESSION :: { user_id :: string, tenant :: string }
      query: q is duckdb.table('malloytest.state_facts') -> { group_by: state }
    `);
    await expect(
      model.loadQueryByName('q').run({givens: {SESSION: {user_id: 'alice'}}})
    ).rejects.toThrow(/SESSION\.tenant.*missing required key/);
  });

  test('record given: extra key throws with the unexpected path', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: SESSION :: { user_id :: string, tenant :: string }
      query: q is duckdb.table('malloytest.state_facts') -> { group_by: state }
    `);
    await expect(
      model.loadQueryByName('q').run({
        givens: {SESSION: {user_id: 'alice', tenant: 'acme', extra: 'x'}},
      })
    ).rejects.toThrow(/SESSION\.extra.*unexpected key/);
  });

  test('array given: outer-shape mismatch (got string)', async () => {
    const model = runtime.loadModel(`
      ##! experimental.givens
      given: ROLES :: string[]
      query: q is duckdb.table('malloytest.state_facts') -> { group_by: state }
    `);
    await expect(
      model.loadQueryByName('q').run({givens: {ROLES: 'admin'}})
    ).rejects.toThrow(/ROLES.*expected array.*got string/);
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

describe('givens — per-runtime supply via givensPath (Stage 4b)', () => {
  // Build a Runtime backed by the duckdb test connection, but with a
  // MalloyConfig pointing at an in-memory JSON file. The config + URLReader
  // combination is what triggers the auto-read path under test.
  function runtimeWithGivensFile(givensJSON: Record<string, GivenValue>) {
    const configURL = 'file:///test-givens/malloy-config.json';
    const givensURL = 'file:///test-givens/local-givens.json';
    const reader: URLReader = {
      async readURL(url: URL): Promise<string> {
        if (url.toString() !== givensURL) {
          throw new Error(`Not found: ${url.toString()}`);
        }
        return JSON.stringify(givensJSON);
      },
    };
    const config = new MalloyConfig(
      {givensPath: './local-givens.json'},
      {configURL}
    );
    return new Runtime({
      config,
      urlReader: reader,
      connections: {
        lookupConnection: () => Promise.resolve(runtime.connection),
      },
    });
  }

  test('per-runtime givens supply value when no per-query supply is given', async () => {
    const r = runtimeWithGivensFile({STATE: 'CA'});
    const result = await r
      .loadModel(
        `
        ##! experimental.givens
        given: STATE :: string
        query: q is duckdb.table('malloytest.state_facts') -> {
          where: state = $STATE
          group_by: state
        }
      `
      )
      .loadQueryByName('q')
      .run();
    expect(result.data.path(0, 'state').value).toBe('CA');
    expect(result.data.toObject().length).toBe(1);
  });

  test('per-query supply overrides per-runtime supply (per-key)', async () => {
    const r = runtimeWithGivensFile({STATE: 'CA'});
    const result = await r
      .loadModel(
        `
        ##! experimental.givens
        given: STATE :: string
        query: q is duckdb.table('malloytest.state_facts') -> {
          where: state = $STATE
          group_by: state
        }
      `
      )
      .loadQueryByName('q')
      .run({givens: {STATE: 'NV'}});
    expect(result.data.path(0, 'state').value).toBe('NV');
  });

  test('per-runtime and per-query merge per-key when keys differ', async () => {
    // The model declares two givens. Per-runtime supplies one, per-query
    // supplies the other; both should land.
    const r = runtimeWithGivensFile({STATE: 'CA'});
    const result = await r
      .loadModel(
        `
        ##! experimental.givens
        given:
          STATE :: string
          MIN_AIRPORTS :: number
        query: q is duckdb.table('malloytest.state_facts') -> {
          where: state = $STATE and airport_count >= $MIN_AIRPORTS
          group_by: state
        }
      `
      )
      .loadQueryByName('q')
      .run({givens: {MIN_AIRPORTS: 1}});
    expect(result.data.path(0, 'state').value).toBe('CA');
  });

  test('missing givens file throws on first compile with the URL in the message', async () => {
    const configURL = 'file:///test-givens/malloy-config.json';
    const reader: URLReader = {
      async readURL(url: URL): Promise<string> {
        throw new Error(`Not found: ${url.toString()}`);
      },
    };
    const config = new MalloyConfig(
      {givensPath: './local-givens.json'},
      {configURL}
    );
    const r = new Runtime({
      config,
      urlReader: reader,
      connections: {
        lookupConnection: () => Promise.resolve(runtime.connection),
      },
    });
    await expect(
      r
        .loadModel(
          `
          ##! experimental.givens
          given: STATE :: string is "CA"
          query: q is duckdb.table('malloytest.state_facts') -> { group_by: state }
        `
        )
        .loadQueryByName('q')
        .run()
    ).rejects.toThrow(
      /failed to read givens file at file:\/\/\/test-givens\/local-givens\.json/
    );
  });
});

describe('givens — Runtime constructor `givens:` option (Stage 4c/4d)', () => {
  test('constructor givens supply values when no per-query supply is given', async () => {
    const r = new Runtime({
      connections: {
        lookupConnection: () => Promise.resolve(runtime.connection),
      },
      givens: {STATE: 'CA'},
    });
    const result = await r
      .loadModel(
        `
        ##! experimental.givens
        given: STATE :: string
        query: q is duckdb.table('malloytest.state_facts') -> {
          where: state = $STATE
          group_by: state
        }
      `
      )
      .loadQueryByName('q')
      .run();
    expect(result.data.path(0, 'state').value).toBe('CA');
  });

  test('per-query supply wins over constructor givens (per-key)', async () => {
    const r = new Runtime({
      connections: {
        lookupConnection: () => Promise.resolve(runtime.connection),
      },
      givens: {STATE: 'CA'},
    });
    const result = await r
      .loadModel(
        `
        ##! experimental.givens
        given: STATE :: string
        query: q is duckdb.table('malloytest.state_facts') -> {
          where: state = $STATE
          group_by: state
        }
      `
      )
      .loadQueryByName('q')
      .run({givens: {STATE: 'NV'}});
    expect(result.data.path(0, 'state').value).toBe('NV');
  });

  test('constructor givens win over file givens (per-key)', async () => {
    const configURL = 'file:///test-givens/malloy-config.json';
    const givensURL = 'file:///test-givens/local-givens.json';
    const reader: URLReader = {
      async readURL(url: URL): Promise<string> {
        if (url.toString() !== givensURL) {
          throw new Error(`Not found: ${url.toString()}`);
        }
        return JSON.stringify({STATE: 'CA'});
      },
    };
    const config = new MalloyConfig(
      {givensPath: './local-givens.json'},
      {configURL}
    );
    const r = new Runtime({
      config,
      urlReader: reader,
      connections: {
        lookupConnection: () => Promise.resolve(runtime.connection),
      },
      givens: {STATE: 'NV'}, // overrides file's 'CA'
    });
    const result = await r
      .loadModel(
        `
        ##! experimental.givens
        given: STATE :: string
        query: q is duckdb.table('malloytest.state_facts') -> {
          where: state = $STATE
          group_by: state
        }
      `
      )
      .loadQueryByName('q')
      .run();
    expect(result.data.path(0, 'state').value).toBe('NV');
  });
});

describe('givens — finalizeGivens (Stage 4e)', () => {
  function runtimeWithFinalize(opts: {
    finalizeGivens: string[];
    constructorGivens?: Record<string, GivenValue>;
    fileGivens?: Record<string, GivenValue>;
  }) {
    const configURL = 'file:///test-givens/malloy-config.json';
    const givensURL = 'file:///test-givens/local-givens.json';
    const reader: URLReader = {
      async readURL(url: URL): Promise<string> {
        if (url.toString() !== givensURL) {
          throw new Error(`Not found: ${url.toString()}`);
        }
        return JSON.stringify(opts.fileGivens ?? {});
      },
    };
    const configPojo: Record<string, unknown> = {
      finalizeGivens: opts.finalizeGivens,
    };
    if (opts.fileGivens) {
      configPojo['givensPath'] = './local-givens.json';
    }
    const config = new MalloyConfig(configPojo, {configURL});
    return new Runtime({
      config,
      urlReader: reader,
      connections: {
        lookupConnection: () => Promise.resolve(runtime.connection),
      },
      givens: opts.constructorGivens,
    });
  }

  test('per-query supply for a finalized given throws at API entry', async () => {
    const r = runtimeWithFinalize({
      finalizeGivens: ['STATE'],
      constructorGivens: {STATE: 'CA'},
    });
    await expect(
      r
        .loadModel(
          `
          ##! experimental.givens
          given: STATE :: string
          query: q is duckdb.table('malloytest.state_facts') -> {
            where: state = $STATE
            group_by: state
          }
        `
        )
        .loadQueryByName('q')
        .run({givens: {STATE: 'NV'}})
    ).rejects.toThrow(
      /'STATE'.*finalized at the runtime layer.*finalizeGivens/
    );
  });

  test('finalized given still drives the query when supplied per-runtime', async () => {
    const r = runtimeWithFinalize({
      finalizeGivens: ['STATE'],
      constructorGivens: {STATE: 'CA'},
    });
    const result = await r
      .loadModel(
        `
        ##! experimental.givens
        given: STATE :: string
        query: q is duckdb.table('malloytest.state_facts') -> {
          where: state = $STATE
          group_by: state
        }
      `
      )
      .loadQueryByName('q')
      .run();
    expect(result.data.path(0, 'state').value).toBe('CA');
  });

  test('Model.givens filters out finalized names', async () => {
    const r = runtimeWithFinalize({
      finalizeGivens: ['STATE'],
      constructorGivens: {STATE: 'CA'},
    });
    const model = await r
      .loadModel(
        `
        ##! experimental.givens
        given:
          STATE :: string
          MIN_AIRPORTS :: number is 100
        query: q is duckdb.table('malloytest.state_facts') -> {
          where: state = $STATE and airport_count >= $MIN_AIRPORTS
          group_by: state
        }
      `
      )
      .getModel();
    const surfaceNames = [...model.givens.keys()];
    expect(surfaceNames).toContain('MIN_AIRPORTS');
    expect(surfaceNames).not.toContain('STATE');
  });

  test('PreparedQuery.givens filters out finalized names (cascades from Model)', async () => {
    const r = runtimeWithFinalize({
      finalizeGivens: ['STATE'],
      constructorGivens: {STATE: 'CA'},
    });
    const pq = await r
      .loadModel(
        `
        ##! experimental.givens
        given:
          STATE :: string
          MIN_AIRPORTS :: number is 100
        query: q is duckdb.table('malloytest.state_facts') -> {
          where: state = $STATE and airport_count >= $MIN_AIRPORTS
          group_by: state
        }
      `
      )
      .loadQueryByName('q')
      .getPreparedQuery();
    const surfaceNames = [...pq.givens.keys()];
    expect(surfaceNames).toContain('MIN_AIRPORTS');
    expect(surfaceNames).not.toContain('STATE');
  });

  test('finalizeGivens with no resolved value throws when a query needs it', async () => {
    const r = runtimeWithFinalize({
      finalizeGivens: ['STATE'],
      // no constructor or file givens — finalize set is unsatisfied
    });
    await expect(
      r
        .loadModel(
          `
          ##! experimental.givens
          given: STATE :: string is "X"
          query: q is duckdb.table('malloytest.state_facts') -> {
            where: state = $STATE
            group_by: state
          }
        `
        )
        .loadQueryByName('q')
        .run()
    ).rejects.toThrow(/finalized given.*no resolved value.*STATE/);
  });

  test('unsatisfied finalize entry does NOT block a query that does not reference it', async () => {
    // The shared-config case: one project's config covers many .malloy
    // files. Files declare overlapping but distinct given sets. A
    // finalize entry that some other file needs shouldn't stop a query
    // here that doesn't touch it.
    const r = runtimeWithFinalize({
      finalizeGivens: ['UNUSED_BY_THIS_QUERY'],
      // no value supplied — but the query below doesn't reference it.
    });
    const result = await r
      .loadModel(
        `
        ##! experimental.givens
        given: UNUSED_BY_THIS_QUERY :: string is "X"
        query: q is duckdb.table('malloytest.state_facts') -> {
          group_by: state
        }
      `
      )
      .loadQueryByName('q')
      .run();
    // Query just runs. No throw.
    expect(result.data.toObject().length).toBeGreaterThan(0);
  });

  test('finalizeGivens entries can be satisfied by file values', async () => {
    const r = runtimeWithFinalize({
      finalizeGivens: ['STATE'],
      fileGivens: {STATE: 'CA'},
    });
    const result = await r
      .loadModel(
        `
        ##! experimental.givens
        given: STATE :: string
        query: q is duckdb.table('malloytest.state_facts') -> {
          where: state = $STATE
          group_by: state
        }
      `
      )
      .loadQueryByName('q')
      .run();
    expect(result.data.path(0, 'state').value).toBe('CA');
  });
});
