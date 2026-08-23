/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DuckDBConnection} from './duckdb_connection';

// DuckDB has no native tagging mechanism, so query metadata is applied as a
// leading comment on the data statement. runRawSQL is stubbed so no real DuckDB
// query runs.
describe('db-duckdb queryMetadata wiring (offline)', () => {
  afterEach(() => jest.restoreAllMocks());

  const stubRunRawSQL = (conn: DuckDBConnection) =>
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(conn as any, 'runRawSQL')
      .mockResolvedValue({rows: [], totalRows: 0});

  it('prepends the metadata comment to the data statement', async () => {
    const conn = new DuckDBConnection('duckdb');
    const spy = stubRunRawSQL(conn);
    await conn.runSQL('SELECT 1', {
      queryMetadata: {application_name: 'my-app', env: 'prod'},
    });
    expect(spy).toHaveBeenCalledWith(
      '-- application_name="my-app" env="prod"\nSELECT 1'
    );
  });

  it('runs the statement unchanged for absent or empty metadata (no prefix)', async () => {
    const conn = new DuckDBConnection('duckdb');
    const spy = stubRunRawSQL(conn);
    await conn.runSQL('SELECT 1');
    await conn.runSQL('SELECT 1', {queryMetadata: {}});
    expect(spy).toHaveBeenNthCalledWith(1, 'SELECT 1');
    expect(spy).toHaveBeenNthCalledWith(2, 'SELECT 1');
  });
});
