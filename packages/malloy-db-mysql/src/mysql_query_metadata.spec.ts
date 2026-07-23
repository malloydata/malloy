/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MySQLConnection} from './mysql_connection';

// MySQL has no native tagging mechanism, so query metadata is applied as a
// leading comment. runRawSQL is stubbed so no real MySQL query runs.
describe('db-mysql queryMetadata wiring (offline)', () => {
  afterEach(() => jest.restoreAllMocks());

  const makeConn = () => new MySQLConnection('mysql', {});

  const stubRunRawSQL = (conn: MySQLConnection) =>
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(conn as any, 'runRawSQL')
      .mockResolvedValue({rows: [], totalRows: 0});

  it('prepends the metadata comment to the statement', async () => {
    const conn = makeConn();
    const spy = stubRunRawSQL(conn);
    await conn.runSQL('SELECT 1', {queryMetadata: {env: 'prod'}});
    expect(spy).toHaveBeenCalledWith('-- env="prod"\nSELECT 1');
  });

  it('runs the statement unchanged for absent or empty metadata (no prefix)', async () => {
    const conn = makeConn();
    const spy = stubRunRawSQL(conn);
    await conn.runSQL('SELECT 1');
    await conn.runSQL('SELECT 1', {queryMetadata: {}});
    expect(spy).toHaveBeenNthCalledWith(1, 'SELECT 1');
    expect(spy).toHaveBeenNthCalledWith(2, 'SELECT 1');
  });
});
