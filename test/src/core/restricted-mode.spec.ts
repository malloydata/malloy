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

describe('loadRestrictedQuery — end-to-end through the public API', () => {
  test('clean restricted query against a trusted source runs and returns data', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    const result = await model
      .loadRestrictedQuery('run: states -> { aggregate: ct is count() }')
      .run();
    expect(result.data.path(0, 'ct').value).toBeGreaterThan(0);
  });

  test('restricted query with `import` throws MalloyError tagged restricted-mode', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    await expect(
      model.loadRestrictedQuery('import "other"').run()
    ).rejects.toMatchObject({
      problems: expect.arrayContaining([
        expect.objectContaining({errorTag: 'restricted-mode'}),
      ]),
    });
  });

  test('restricted query reaching the database directly via `connection.table` is rejected', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
    `);
    let err: MalloyError | undefined;
    try {
      await model
        .loadRestrictedQuery(
          "run: duckdb.table('malloytest.state_facts') -> { aggregate: ct is count() }"
        )
        .run();
    } catch (e) {
      err = e as MalloyError;
    }
    expect(err).toBeInstanceOf(MalloyError);
    const restricted = err!.problems.filter(
      p => p.errorTag === 'restricted-mode'
    );
    expect(restricted.length).toBeGreaterThan(0);
  });
});
