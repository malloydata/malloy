/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import {MalloyError} from '@malloydata/malloy';

afterAll(() => testDatabase.shutdown());

describe('loadRestrictedQuery — end-to-end through the public API', () => {
  test('clean restricted query against a trusted source runs and returns data', async () => {
    const model = testDatabase.runtime.loadModel(`
      source: states is db.table('malloytest.state_facts')
    `);
    const result = await model
      .loadRestrictedQuery('run: states -> { aggregate: ct is count() }')
      .run();
    expect(result.data.path(0, 'ct').value).toBeGreaterThan(0);
  });

  test('timezone injection is rejected before SQL generation or execution', async () => {
    const model = testDatabase.runtime.loadModel(`
      source: states is db.table('malloytest.state_facts')
    `);
    const queryText = `run: states -> {
      timezone: "UTC' || (SELECT 'UTC') || '"
      select: d is now.day
      limit: 1
    }`;
    const expectedError = {
      problems: expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-timezone',
          severity: 'error',
        }),
      ]),
    };
    // Separate query instances exercise each entry point without reusing
    // the other entry point's cached compilation failure.
    await expect(
      model.loadRestrictedQuery(queryText).getSQL()
    ).rejects.toMatchObject(expectedError);
    await expect(
      model.loadRestrictedQuery(queryText).run()
    ).rejects.toMatchObject(expectedError);
  });

  test('restricted query with `import` throws MalloyError tagged restricted-mode', async () => {
    const model = testDatabase.runtime.loadModel(`
      source: states is db.table('malloytest.state_facts')
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
    const model = testDatabase.runtime.loadModel(`
      source: states is db.table('malloytest.state_facts')
    `);
    let err: MalloyError | undefined;
    try {
      await model
        .loadRestrictedQuery(
          "run: db.table('malloytest.state_facts') -> { aggregate: ct is count() }"
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
