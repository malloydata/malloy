/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryRecord} from '@malloydata/malloy';
import {HostDuckDBConnection} from './host_connection';

describe('HostDuckDBConnection', () => {
  test('asks the host to DESCRIBE, and re-asks only on a refresh', async () => {
    const columns: QueryRecord[] = [
      {column_name: 'carrier', column_type: 'VARCHAR'},
      {column_name: 'stops', column_type: 'STRUCT(code VARCHAR)[]'},
    ];
    const asked: string[] = [];
    const connection = new HostDuckDBConnection('duckdb', {
      query: sql => {
        asked.push(sql);
        return columns;
      },
    });
    const fetch = (refreshTimestamp?: number) =>
      connection.fetchSchemaForTables(
        {'duckdb.flights': 'flights'},
        {refreshTimestamp}
      );

    const first = await fetch();
    const fields = first.schemas['duckdb.flights'].fields;
    expect(fields.map(f => [f.name, f.type])).toEqual([
      ['carrier', 'string'],
      ['stops', 'array'],
    ]);
    await fetch();
    expect(asked).toEqual(['DESCRIBE SELECT * FROM flights']);

    columns.push({column_name: 'distance', column_type: 'INTEGER'});
    const refreshed = await fetch(Date.now() + 1);
    expect(asked).toHaveLength(2);
    expect(refreshed.schemas['duckdb.flights'].fields).toHaveLength(3);
  });
});
