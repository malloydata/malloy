/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';
import {MalloyError} from '@malloydata/malloy';

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

describe('ModelMaterializer.validate()', () => {
  test('clean model returns empty array', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    const problems = await model.validate();
    expect(problems).toEqual([]);
  });

  test('translator errors surface as structured LogMessages', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts') extend {
        dimension: bad is no_such_thing
      }
    `);
    const problems = await model.validate();
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every(p => p.severity === 'error')).toBe(true);
    expect(problems.every(p => typeof p.code === 'string')).toBe(true);
  });

  test('validate() is non-throwing even on hard translator failures', async () => {
    const model = runtime.loadModel('this is not malloy syntax at all');
    await expect(model.validate()).resolves.toEqual(expect.any(Array));
    const problems = await model.validate();
    expect(problems.length).toBeGreaterThan(0);
  });

  test('cached: validate() then getModel() does not re-translate', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    const problems = await model.validate();
    expect(problems).toEqual([]);
    const m = await model.getModel();
    expect(m).toBeDefined();
  });
});

describe('QueryMaterializer.validate()', () => {
  test('clean query returns empty array', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    const problems = await model
      .loadQuery('run: states -> { aggregate: ct is count() }')
      .validate();
    expect(problems).toEqual([]);
  });

  test('translator error in query surfaces structured problems', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    const problems = await model
      .loadQuery('run: states -> { aggregate: x is no_such_field }')
      .validate();
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0].severity).toBe('error');
  });

  test('an invalid query surfaces problems with codes', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    const problems = await model
      .loadQuery(
        `run: states -> {
          select: state
          nest: by_year is { aggregate: ct is count() }
        }`
      )
      .validate();
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0].severity).toBe('error');
    expect(typeof problems[0].code).toBe('string');
  });

  test('validate() then run() shares cache — single compile', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    const q = model.loadQuery('run: states -> { aggregate: ct is count() }');
    expect(await q.validate()).toEqual([]);
    const result = await q.run();
    expect(result.data.path(0, 'ct').value).toBeGreaterThan(0);
  });

  test('validate() then getPreparedResult() does not re-compile', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    const q = model.loadQuery('run: states -> { aggregate: ct is count() }');
    expect(await q.validate()).toEqual([]);
    const pr = await q.getPreparedResult();
    expect(pr.sql.toUpperCase()).toContain('COUNT');
  });

  test('getPreparedResult on a failed compile throws MalloyError with problems', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    const q = model.loadQuery(
      `run: states -> {
        select: state
        nest: by_year is { aggregate: ct is count() }
      }`
    );
    await expect(q.getPreparedResult()).rejects.toBeInstanceOf(MalloyError);
    let err: MalloyError | undefined;
    try {
      await q.getPreparedResult();
    } catch (e) {
      if (e instanceof MalloyError) err = e;
    }
    expect(err!.problems.length).toBeGreaterThan(0);
    expect(typeof err!.problems[0].code).toBe('string');
  });

  test('SQL-compile error surfaces with its specific code via validate()', async () => {
    // Unresolved virtual sources reach SQL compile (the translator can't
    // know what virtualMap the runtime will supply), so this exercises
    // the MalloyCompileError → LogMessage path end-to-end.
    const model = runtime.loadModel(`
      ##! experimental.virtual_source
      type: s is { x :: string }
      source: v is duckdb.virtual('no_such_table')::s
    `);
    const problems = await model
      .loadQuery('run: v -> { select: x; limit: 1 }')
      .validate();
    expect(problems.length).toBe(1);
    expect(problems[0].code).toBe('runtime-virtual-map-missing');
    expect(problems[0].severity).toBe('error');
  });

  test('restricted-mode rejections show up in validate()', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    const problems = await model
      .loadRestrictedQuery('import "other"')
      .validate();
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some(p => p.errorTag === 'restricted-mode')).toBe(true);
  });
});
