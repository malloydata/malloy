/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {EmptyURLReader, MalloyConfig, Runtime} from '@malloydata/malloy';
import {DuckDBConnection} from '@malloydata/db-duckdb';
import '@malloydata/db-duckdb/native';

// Two DuckDB files hold a table with the same name and schema but different
// rows, so a query sent to the wrong connection returns the other one's rows
// instead of failing.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'malloy-multi-conn-'));
const databasePath = {
  a: path.join(tmpDir, 'a.duckdb'),
  b: path.join(tmpDir, 'b.duckdb'),
};
const rows = {a: ['a1', 'a2'], b: ['b1']};

async function createDatabase(file: string, names: string[]): Promise<void> {
  const writer = new DuckDBConnection({name: 'writer', databasePath: file});
  try {
    const values = names.map(n => `('${n}')`).join(', ');
    await writer.runSQL(
      `CREATE TABLE things AS SELECT * FROM (VALUES ${values}) AS t(name)`
    );
  } finally {
    await writer.close();
  }
}

const runtime = new Runtime({
  config: new MalloyConfig({
    connections: {
      a: {is: 'duckdb', databasePath: databasePath.a, readOnly: true},
      b: {is: 'duckdb', databasePath: databasePath.b, readOnly: true},
    },
  }),
  urlReader: new EmptyURLReader(),
});

const model = runtime.loadModel(`
  source: from_a is a.table('things')
  source: from_b is b.table('things')
`);

async function namesFrom(sourceName: string): Promise<unknown[]> {
  const result = await model
    .loadQuery(`run: ${sourceName} -> { select: name; order_by: name }`)
    .run();
  return result.data.toObject().map(row => row['name']);
}

beforeAll(async () => {
  await createDatabase(databasePath.a, rows.a);
  await createDatabase(databasePath.b, rows.b);
});

afterAll(async () => {
  await runtime.shutdown();
  fs.rmSync(tmpDir, {recursive: true, force: true});
});

describe('Multi-connection', () => {
  it('a query on connection a returns the rows in a', async () => {
    expect(await namesFrom('from_a')).toEqual(rows.a);
  });

  it('a query on connection b returns the rows in b', async () => {
    expect(await namesFrom('from_b')).toEqual(rows.b);
  });
});
