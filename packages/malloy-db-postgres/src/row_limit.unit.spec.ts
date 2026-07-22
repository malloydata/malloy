/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyQueryData} from '@malloydata/malloy';
import {DEFAULT_ROW_LIMIT} from '@malloydata/malloy';
import {PostgresConnection} from './postgres_connection';

class CapturingPostgresConnection extends PostgresConnection {
  rowLimits: number[] = [];

  protected async runPostgresQuery(
    _sqlCommand: string,
    rowLimit: number
  ): Promise<MalloyQueryData> {
    this.rowLimits.push(rowLimit);
    return {rows: [], totalRows: 0};
  }
}

describe('Postgres rowLimit', () => {
  it.each([
    ['shared default', undefined, undefined, DEFAULT_ROW_LIMIT],
    ['configured value', 25, undefined, 25],
    ['per-run override', 25, 5, 5],
    ['zero', 25, 0, 0],
  ])(
    'applies %s',
    async (_name, configuredRowLimit, perRunRowLimit, expected) => {
      const queryOptions =
        configuredRowLimit === undefined
          ? undefined
          : {rowLimit: configuredRowLimit};
      const connection = new CapturingPostgresConnection(
        'postgres',
        queryOptions
      );
      const runOptions =
        perRunRowLimit === undefined ? {} : {rowLimit: perRunRowLimit};

      await connection.runSQL('SELECT 1', runOptions);

      expect(connection.rowLimits).toEqual([expected]);
    }
  );

  it('slices rows in the real query path while preserving totalRows', async () => {
    const connection = new PostgresConnection('postgres');
    const client = {
      connect: jest.fn(),
      query: jest
        .fn()
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({
          rows: [{row: {value: 1}}, {row: {value: 2}}, {row: {value: 3}}],
        }),
      end: jest.fn(),
    };
    const testable = connection as unknown as {
      getClient(): Promise<typeof client>;
      runPostgresQuery(
        sql: string,
        rowLimit: number,
        rowIndex: number,
        deJSON: boolean
      ): Promise<MalloyQueryData>;
    };
    jest.spyOn(testable, 'getClient').mockResolvedValue(client);

    const result = await testable.runPostgresQuery('SELECT value', 2, 0, true);

    expect(result).toEqual({
      rows: [{value: 1}, {value: 2}],
      totalRows: 3,
    });
    expect(client.end).toHaveBeenCalledTimes(1);
  });
});
