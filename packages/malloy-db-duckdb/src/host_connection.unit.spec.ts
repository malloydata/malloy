/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryRecord} from '@malloydata/malloy';
import {HostDuckDBConnection} from './host_connection';

describe('HostDuckDBConnection', () => {
  const rows: QueryRecord[] = [{n: 1}, {n: 2}, {n: 3}];

  test('a host answering with a promise: run and stream share row limits', async () => {
    const connection = new HostDuckDBConnection(
      'duckdb',
      {digest: 'test-db', query: async () => rows},
      {rowLimit: 2}
    );
    expect((await connection.runSQL('SELECT n')).rows).toEqual(
      rows.slice(0, 2)
    );
    const streamed: QueryRecord[] = [];
    for await (const row of connection.runSQLStream('SELECT n', {
      rowLimit: 1,
    })) {
      streamed.push(row);
    }
    expect(streamed).toEqual(rows.slice(0, 1));
    expect(connection.getDigest()).toBe('test-db');
  });

  test('a string the host throws reaches the schema error', async () => {
    const connection = new HostDuckDBConnection('duckdb', {
      digest: 'test-db',
      query: () => {
        // eslint-disable-next-line no-throw-literal -- what embedding glue does
        throw 'Catalog Error: Table with name t does not exist!';
      },
    });
    const {errors} = await connection.fetchSchemaForTables(
      {'duckdb.t': 't'},
      {}
    );
    expect(errors['duckdb.t']).toContain('Table with name t does not exist');
  });
});
