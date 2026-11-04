/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';
import {Malloy, MalloyConfig, MalloyError, Runtime} from '@malloydata/malloy';
import type {GivenValue, URLReader} from '@malloydata/malloy';

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

  test('timezone injection is rejected before SQL generation or execution', async () => {
    const model = runtime.loadModel(`
      source: states is duckdb.table('malloytest.state_facts')
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

describe('givens declared in restricted text', () => {
  const flag = '##! experimental.givens\n';
  const docs = `source: docs is duckdb.sql("SELECT 'alice' AS owner, 1 AS n UNION ALL SELECT 'bob', 2") extend {
    where: $OPEN = '' or owner = $OPEN
  }
`;
  const files: Record<string, string> = {
    'file:///test/base.malloy': `${flag}given: OPEN :: string is ''\n${docs}`,
    'file:///test/hides.malloy': `${flag}import {docs} from "base.malloy"\n`,
    'file:///test/surfaces.malloy': `${flag}import {docs, OPEN} from "base.malloy"\n`,
    'file:///test/plain.malloy': `${flag}given: TENANT :: string is 'model default'
source: docs is duckdb.sql("SELECT 'alice' AS owner, 1 AS n")
`,
    'file:///test/persists.malloy': `##! experimental { givens persistence }
source: docs is duckdb.sql("SELECT 'alice' AS owner, 1 AS n")
`,
    'file:///test/w.json': JSON.stringify({W: 9}),
    'file:///test/open.json': JSON.stringify({OPEN: 'alice'}),
  };
  const urlReader: URLReader = {
    readURL: async url => {
      const contents = files[url.toString()];
      if (contents === undefined) throw new Error(`Not found: ${url}`);
      return contents;
    },
  };

  function makeRuntime(
    options: {
      givens?: Record<string, GivenValue>;
      finalizeGivens?: string[];
      givensPath?: string;
    } = {}
  ) {
    const {finalizeGivens, givensPath} = options;
    return new Runtime({
      urlReader,
      connections: {
        lookupConnection: () => Promise.resolve(runtime.connection),
      },
      givens: options.givens,
      config:
        finalizeGivens || givensPath
          ? new MalloyConfig(
              {finalizeGivens, givensPath},
              {configURL: 'file:///test/malloy-config.json'}
            )
          : undefined,
    });
  }

  function restrictedOn(
    modelFile: string,
    text: string,
    rt: Runtime = makeRuntime()
  ) {
    return rt
      .loadModel(new URL(`file:///test/${modelFile}`))
      .loadRestrictedQuery(text);
  }

  const ownW = `
    given: W :: number is 2
    run: docs -> { select: owner, scaled is n * $W; order_by: owner }
  `;
  const ownOpen = `
    given: OPEN :: string is 'ted'
    run: docs -> { select: owner, mine is $OPEN; order_by: owner }
  `;

  test('runs on its default', async () => {
    const result = await restrictedOn('hides.malloy', ownW).run();
    expect(result.data.toObject()).toEqual([
      {owner: 'alice', scaled: 2},
      {owner: 'bob', scaled: 4},
    ]);
  });

  test('one value reaches every use in the text', async () => {
    const result = await restrictedOn(
      'hides.malloy',
      `
        given: W :: number is 2
        source: scaled_docs is docs extend { dimension: scaled is n * $W }
        run: scaled_docs -> { select: scaled, w is $W; order_by: scaled }
      `
    ).run({givens: {W: 5}});
    expect(result.data.toObject()).toEqual([
      {scaled: 5, w: 5},
      {scaled: 10, w: 5},
    ]);
  });

  const noDefault = `
    given: W :: number
    run: docs -> { select: owner, w is $W; order_by: owner }
  `;

  test('with no default, fails unless supplied', async () => {
    await expect(restrictedOn('hides.malloy', noDefault).run()).rejects.toThrow(
      /Given 'W' has no value and no default.*add a default at its declaration\.$/m
    );
  });

  test('with no default, takes a per-call value', async () => {
    const result = await restrictedOn('hides.malloy', noDefault).run({
      givens: {W: 7},
    });
    expect(result.data.toObject()).toEqual([
      {owner: 'alice', w: 7},
      {owner: 'bob', w: 7},
    ]);
  });

  test('a default can read a surfaced given', async () => {
    const result = await restrictedOn(
      'surfaces.malloy',
      'given: W :: string is $OPEN\nrun: docs -> { select: owner, w is $W }'
    ).run({givens: {OPEN: 'alice'}});
    expect(result.data.toObject()).toEqual([{owner: 'alice', w: 'alice'}]);
  });

  test('a surfaced name cannot be declared', async () => {
    await expect(
      restrictedOn(
        'surfaces.malloy',
        "given: OPEN :: string is 'x'\nrun: docs -> { select: owner }"
      ).run()
    ).rejects.toThrow(/Cannot redefine 'OPEN'/);
  });

  test('a hidden name is a separate given, and the model keeps its own', async () => {
    const result = await restrictedOn('hides.malloy', ownOpen).run();
    expect(result.data.toObject()).toEqual([
      {owner: 'alice', mine: 'ted'},
      {owner: 'bob', mine: 'ted'},
    ]);
  });

  test('a per-call value for a hidden name reaches only the new given', async () => {
    const result = await restrictedOn('hides.malloy', ownOpen).run({
      givens: {OPEN: 'alice'},
    });
    expect(result.data.toObject()).toEqual([
      {owner: 'alice', mine: 'alice'},
      {owner: 'bob', mine: 'alice'},
    ]);
  });

  test('without the declaration, a value for a hidden name is unknown', async () => {
    await expect(
      restrictedOn('hides.malloy', 'run: docs -> { select: owner }').run({
        givens: {OPEN: 'alice'},
      })
    ).rejects.toThrow(/unknown given 'OPEN'\.$/m);
  });

  test('the model keeps no trace of the declaration', async () => {
    const materializer = makeRuntime().loadModel(
      new URL('file:///test/hides.malloy')
    );
    await materializer.loadRestrictedQuery(ownW).run();
    await expect(
      materializer
        .loadRestrictedQuery('run: docs -> { select: owner, w is $W }')
        .run()
    ).rejects.toThrow(/`\$W` references a given named `W`/);
  });

  test('the prepared query reports it and the model does not', async () => {
    const materializer = makeRuntime().loadModel(
      new URL('file:///test/hides.malloy')
    );
    const prepared = await materializer
      .loadRestrictedQuery(ownW)
      .getPreparedQuery();
    const model = await materializer.getModel();
    expect([...prepared.givens.keys()]).toEqual(['W']);
    expect(model.givens.has('W')).toBe(false);
  });

  test('its value appears in the generated SQL', async () => {
    const sql = await restrictedOn('hides.malloy', ownW).getSQL({
      givens: {W: 7},
    });
    expect(sql).toContain('*7');
  });

  test('takes a constructor value, which other queries then reject', async () => {
    const rt = makeRuntime({givens: {W: 9}});
    const result = await restrictedOn('hides.malloy', ownW, rt).run();
    expect(result.data.toObject()).toEqual([
      {owner: 'alice', scaled: 9},
      {owner: 'bob', scaled: 18},
    ]);
    await expect(
      restrictedOn('hides.malloy', 'run: docs -> { select: owner }', rt).run()
    ).rejects.toThrow(/unknown given 'W'/);
  });

  describe('a config file value', () => {
    const reservedW = /the name `W` is reserved\. Use a different name\./;

    test('with its name fails the query, even though it has a default', async () => {
      const rt = makeRuntime({givensPath: './w.json'});
      await expect(
        restrictedOn('hides.malloy', ownW, rt).run()
      ).rejects.toThrow(reservedW);
      await expect(
        restrictedOn('hides.malloy', ownW, rt).getSQL()
      ).rejects.toThrow(reservedW);
    });

    test('with its name reports the declaration', async () => {
      const rt = makeRuntime({givensPath: './w.json'});
      await expect(
        restrictedOn('hides.malloy', ownW, rt).run()
      ).rejects.toMatchObject({
        problems: [
          expect.objectContaining({
            code: 'runtime-given-unknown',
            at: expect.objectContaining({
              range: expect.objectContaining({
                start: expect.objectContaining({line: 1}),
              }),
            }),
          }),
        ],
      });
    });

    test('with its name fails the query when the call supplies it too', async () => {
      const rt = makeRuntime({givensPath: './w.json'});
      await expect(
        restrictedOn('hides.malloy', ownW, rt).run({givens: {W: 7}})
      ).rejects.toThrow(reservedW);
    });

    test('with its name fails a persistence build', async () => {
      const rt = makeRuntime({givensPath: './w.json'});
      const prepared = await restrictedOn(
        'persists.malloy',
        'given: W :: number is 2\nrun: docs -> { select: w is $W }',
        rt
      ).getPreparedQuery();
      await expect(rt.getBuildTargets(prepared.model)).rejects.toThrow(
        reservedW
      );
    });

    test('still binds to the given the model surfaces', async () => {
      const rt = makeRuntime({givensPath: './open.json'});
      const result = await restrictedOn(
        'surfaces.malloy',
        "given: X :: string is 'x'\nrun: docs -> { select: owner, x is $X }",
        rt
      ).run();
      expect(result.data.toObject()).toEqual([{owner: 'alice', x: 'x'}]);
    });

    test('still binds to a given declared in trusted text', async () => {
      const rt = makeRuntime({givensPath: './w.json'});
      const result = await rt
        .loadModel(new URL('file:///test/hides.malloy'))
        .loadQuery(ownW)
        .run();
      expect(result.data.toObject()).toEqual([
        {owner: 'alice', scaled: 9},
        {owner: 'bob', scaled: 18},
      ]);
    });
  });

  describe('a finalized name', () => {
    const finalized = {givens: {W: 9}, finalizeGivens: ['W']};

    test('cannot be declared', async () => {
      await expect(
        restrictedOn('hides.malloy', ownW, makeRuntime(finalized)).run()
      ).rejects.toMatchObject({
        problems: [
          expect.objectContaining({
            code: 'restricted-construct-forbidden',
            errorTag: 'restricted-mode',
          }),
        ],
      });
    });

    test('still fails an ordinary query on a model without it', async () => {
      await expect(
        restrictedOn(
          'hides.malloy',
          'run: docs -> { select: owner }',
          makeRuntime(finalized)
        ).run()
      ).rejects.toThrow(/unknown given 'W'/);
    });

    test('with no value fails a query that reads it through a default', async () => {
      const throughDefault =
        'given: X :: string is $TENANT\nrun: docs -> { select: x is $X }';
      const rt = makeRuntime({finalizeGivens: ['TENANT']});
      const materializer = rt.loadModel(new URL('file:///test/plain.malloy'));
      await expect(
        materializer.loadRestrictedQuery(throughDefault).run()
      ).rejects.toThrow(/Finalized given 'TENANT' has no resolved value/);
      await expect(
        materializer.loadQuery(throughDefault).run()
      ).rejects.toThrow(/Finalized given 'TENANT' has no resolved value/);
    });

    test('cannot be declared when the model also surfaces it', async () => {
      await expect(
        restrictedOn(
          'surfaces.malloy',
          "given: OPEN :: string is 'x'\nrun: docs -> { select: owner }",
          makeRuntime({givens: {OPEN: 'alice'}, finalizeGivens: ['OPEN']})
        ).run()
      ).rejects.toThrow(/Cannot redefine 'OPEN'/);
    });
  });
});

describe('Malloy.compile', () => {
  test('refuses finalizedGivens with a pre-parsed translator', async () => {
    const parse = Malloy.parse({
      source: 'given: W :: number is 1',
      options: {restrictedMode: true},
    });
    await expect(
      Malloy.compile({
        parse,
        urlReader: {readURL: () => Promise.reject(new Error('unused'))},
        connections: {
          lookupConnection: () => Promise.resolve(runtime.connection),
        },
        finalizedGivens: new Set(['W']),
      })
    ).rejects.toThrow(/finalizedGivens cannot be applied/);
  });
});
