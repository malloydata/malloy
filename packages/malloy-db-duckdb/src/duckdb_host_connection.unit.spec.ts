/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryRecord} from '@malloydata/malloy';
import {makeDigest} from '@malloydata/malloy';
import {DuckDBHostConnection} from './duckdb_host_connection';

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
