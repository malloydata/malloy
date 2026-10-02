/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyError} from '@malloydata/malloy';
import {
  DuckDBDialect,
  getDialect,
  InMemoryURLReader,
  registerDialect,
  SingleConnectionRuntime,
} from '@malloydata/malloy';
import {DuckDBConnection} from '@malloydata/db-duckdb';

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

async function getError<T>(promise: Promise<T>): Promise<Error | undefined> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return undefined;
}

/**
 * A file acknowledges an experimental dialect with
 * `##! experimental.dialect.NAME` wherever it takes one on: by naming a
 * connection on it, or by importing a source or query that uses it. The
 * acknowledgment is a pragma, so an importer gets no credit for the line in
 * the file it imports.
 */
describe('experimental dialects', () => {
  const duckdbX = 'duckdb_experimental';
  const flag = `##! experimental.dialect.${duckdbX}`;

  class DuckdbXConnection extends DuckDBConnection {
    name = duckdbX;
    get dialectName(): string {
      return duckdbX;
    }
  }

  class DuckdbXDialect extends DuckDBDialect {
    experimental = true;
    name = duckdbX;
    get dialectName(): string {
      return duckdbX;
    }
  }

  const connection = new DuckdbXConnection(duckdbX, ':memory:');
  registerDialect(new DuckdbXDialect());

  const libURL = 'file:///lib.malloy';
  const lib = [
    flag,
    `source: s is ${duckdbX}.sql('SELECT 1 as one')`,
    'query: q is s -> { select: one }',
  ].join('\n');

  function runtime(): SingleConnectionRuntime {
    return new SingleConnectionRuntime({
      connection,
      urlReader: new InMemoryURLReader(new Map([[libURL, lib]])),
    });
  }

  /** The one problem a refused compile reports, with the line it points at. */
  async function refusal(
    src: string
  ): Promise<{message: string; line: number | undefined}> {
    const error = await getError(runtime().getModel(src));
    expect(error).toBeDefined();
    const problems = (error as MalloyError).problems;
    expect(problems).toHaveLength(1);
    return {
      message: problems[0].message,
      line: problems[0].at?.range.start.line,
    };
  }

  test('naming a connection on the dialect needs the flag', async () => {
    const got = await refusal(
      ['-- line zero', `source: s is ${duckdbX}.sql('SELECT 1 as one')`].join(
        '\n'
      )
    );
    expect(got.message).toContain(flag);
    expect(got.line).toBe(1);
  });

  test('a connection named like an object property is still checked', async () => {
    const named = new DuckdbXConnection(duckdbX, ':memory:');
    named.name = 'constructor';
    const error = await getError(
      new SingleConnectionRuntime({connection: named}).getModel(
        "source: s is constructor.sql('SELECT 1 as one')"
      )
    );
    expect(error).toBeDefined();
    expect((error as MalloyError).problems[0].message).toContain(flag);
    await named.close();
  });

  test('the flag admits a connection on the dialect', async () => {
    await runtime().getModel(
      [flag, `source: s is ${duckdbX}.sql('SELECT 1 as one')`].join('\n')
    );
  });

  test('importing a source on the dialect needs the flag, reported at the import', async () => {
    const got = await refusal(
      ['-- line zero', `import "${libURL}"`, 'run: s -> { select: one }'].join(
        '\n'
      )
    );
    expect(got.message).toContain(flag);
    expect(got.line).toBe(1);
  });

  test('importing only a query on the dialect needs the flag', async () => {
    const got = await refusal(`import {q} from "${libURL}"`);
    expect(got.message).toContain(flag);
  });

  test('the flag admits an import and use of the dialect', async () => {
    const sql = await runtime()
      .loadModel([flag, `import "${libURL}"`].join('\n'))
      .loadQuery('run: s -> { select: one }')
      .getSQL();
    expect(sql).toContain('SELECT');
  });

  test('a query over a model needs nothing of its own', async () => {
    const sql = await runtime()
      .loadModel(
        [flag, `source: s is ${duckdbX}.sql('SELECT 1 as one')`].join('\n')
      )
      .loadQuery('run: s -> { select: one }')
      .getSQL();
    expect(sql).toContain('SELECT');
  });

  test('an accepted dialect needs no flag anywhere', async () => {
    // What the shared-suite harness does once per process for the dialect
    // under test. Undone below by registering a fresh dialect object.
    getDialect(duckdbX).acceptExperimental();
    try {
      const sql = await runtime()
        .loadModel(
          [
            `import "${libURL}"`,
            `source: t is ${duckdbX}.sql('SELECT 2 as two')`,
          ].join('\n')
        )
        .loadQuery('run: s -> { select: one }')
        .getSQL();
      expect(sql).toContain('SELECT');
    } finally {
      registerDialect(new DuckdbXDialect());
    }
  });

  afterAll(async () => {
    await connection.close();
    registerDialect(new DuckDBDialect());
  });
});
