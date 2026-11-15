/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryRecord} from '@malloydata/malloy';
import {makeDigest} from '@malloydata/malloy';
import {HostDuckDBConnection} from './host_connection';

describe('HostDuckDBConnection', () => {
  test('a stream from a host answering with a promise keeps the row limit', async () => {
    const rows: QueryRecord[] = [{n: 1}, {n: 2}, {n: 3}];
    const connection = new HostDuckDBConnection('duckdb', {
      digest: 'test-db',
      query: async () => rows,
    });
    const streamed: QueryRecord[] = [];
    for await (const row of connection.runSQLStream('SELECT n', {
      rowLimit: 1,
    })) {
      streamed.push(row);
    }
    expect(streamed).toEqual(rows.slice(0, 1));
    expect(connection.getDigest()).toBe(makeDigest('duckdb-host', 'test-db'));
  });
});
