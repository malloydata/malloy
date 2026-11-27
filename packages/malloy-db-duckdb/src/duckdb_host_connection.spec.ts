/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {DuckDBConnection as NodeConnection} from '@duckdb/node-api';
import {DuckDBInstance} from '@duckdb/node-api';
import type {QueryRecord} from '@malloydata/malloy';
import {DuckDBHostConnection} from './duckdb_host_connection';
import {makeDigest} from '@malloydata/malloy';

// A host over a real DuckDB, answering as DuckDBHost.query's doc says a host
// should: rows as getRowObjectsJson() gives them, in a UTC session.
describe('DuckDBHostConnection over a real DuckDB', () => {
  let db: NodeConnection;
  let connection: DuckDBHostConnection;

  beforeAll(async () => {
    db = await (await DuckDBInstance.create(':memory:')).connect();
    await db.run("SET TimeZone='UTC'");
    connection = new DuckDBHostConnection('duckdb', {
      databaseId: 'memory',
      query: async sql =>
        (await db.runAndReadAll(sql)).getRowObjectsJson() as QueryRecord[],
    });
  });

  afterAll(() => db.closeSync());

  const VALUES = `SELECT
    1::BIGINT AS big,
    2::INTEGER AS int,
    1.5::DECIMAL(5, 2) AS dec,
    DATE '2020-01-02' AS day,
    TIMESTAMP '2020-01-02 03:04:05' AS ts,
    [1, 2] AS list,
    {'a': 1} AS rec`;

  test('a query returns rows in DuckDB JSON form', async () => {
    const {rows} = await connection.runSQL(VALUES);
    expect(rows).toEqual([
      {
        big: '1',
        int: 2,
        dec: '1.50',
        day: '2020-01-02',
        ts: '2020-01-02 03:04:05',
        list: [1, 2],
        rec: {a: 1},
      },
    ]);
  });

  test('a stream yields the same rows, up to the row limit', async () => {
    const streamed: QueryRecord[] = [];
    for await (const row of connection.runSQLStream(
      'SELECT * FROM range(5) AS t(n)',
      {rowLimit: 2}
    )) {
      streamed.push(row);
    }
    expect(streamed).toEqual([{n: '0'}, {n: '1'}]);
  });

  test('a table schema is read through DESCRIBE', async () => {
    await db.run('CREATE TABLE t AS ' + VALUES);
    const {schemas, errors} = await connection.fetchSchemaForTables(
      {t: 't'},
      {}
    );
    expect(errors).toEqual({});
    expect(schemas['t'].fields.map(f => [f.name, f.type])).toEqual([
      ['big', 'number'],
      ['int', 'number'],
      ['dec', 'number'],
      ['day', 'date'],
      ['ts', 'timestamp'],
      ['list', 'array'],
      ['rec', 'record'],
    ]);
  });
});

describe('DuckDBHostConnection', () => {
  test('a stream from a host answering with a promise keeps the row limit', async () => {
    const rows: QueryRecord[] = [{n: 1}, {n: 2}, {n: 3}];
    const connection = new DuckDBHostConnection('duckdb', {
      databaseId: 'test-db',
      query: async () => rows,
    });
    const streamed: QueryRecord[] = [];
    for await (const row of connection.runSQLStream('SELECT n', {
      rowLimit: 1,
    })) {
      streamed.push(row);
    }
    expect(streamed).toEqual(rows.slice(0, 1));
  });

  test('the digest names the host database', () => {
    const connection = new DuckDBHostConnection('duckdb', {
      databaseId: 'test-db',
      query: () => [],
    });
    expect(connection.getDigest()).toBe(makeDigest('duckdb-host', 'test-db'));
  });

  test('a table schema is read from the host answering DESCRIBE', async () => {
    const sent: string[] = [];
    const connection = new DuckDBHostConnection('duckdb', {
      databaseId: 'test-db',
      query: sql => {
        sent.push(sql);
        return [
          {column_name: 'carrier', column_type: 'VARCHAR'},
          {column_name: 'distance', column_type: 'BIGINT'},
        ];
      },
    });
    const {schemas, errors} = await connection.fetchSchemaForTables(
      {flights: 'flights'},
      {}
    );
    expect(errors).toEqual({});
    expect(sent.some(sql => sql.includes('DESCRIBE'))).toBe(true);
    expect(schemas['flights'].fields.map(f => [f.name, f.type])).toEqual([
      ['carrier', 'string'],
      ['distance', 'number'],
    ]);
  });
});
