/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Records every statement the session executes, so we can assert what runs at
// session open without a live Databricks warehouse.
const mockExecCalls: string[] = [];

jest.mock('@databricks/sql', () => ({
  LogLevel: {error: 'error'},
  DBSQLLogger: jest.fn().mockImplementation(() => ({})),
  DBSQLClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(async () => {}),
    openSession: jest.fn(async () => ({
      executeStatement: jest.fn(async (sql: string) => {
        mockExecCalls.push(sql);
        return {fetchAll: async () => [], close: async () => {}};
      }),
    })),
  })),
}));

import {DatabricksConnection} from './databricks_connection';

const BASE = {host: 'h', path: '/sql/1.0/warehouses/w', token: 't'};

const connect = (conn: DatabricksConnection): Promise<void> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (conn as any).ensureConnected();

describe('db-databricks queryMetadata wiring (offline)', () => {
  beforeEach(() => {
    mockExecCalls.length = 0;
  });

  it('prepends the metadata comment to the data statement', async () => {
    const conn = new DatabricksConnection('dbx', {...BASE});
    await conn.runSQL('SELECT 1', {
      queryMetadata: {application_name: 'my-app', team: 'finance'},
    });
    expect(mockExecCalls).toContain(
      '-- application_name="my-app" team="finance"\nSELECT 1'
    );
  });

  it('sends the statement unchanged when there is no metadata', async () => {
    const conn = new DatabricksConnection('dbx', {...BASE});
    await conn.runSQL('SELECT 1');
    expect(mockExecCalls).toContain('SELECT 1');
  });

  it('emits only SET TIME ZONE at session open (no tag statements)', async () => {
    const conn = new DatabricksConnection('dbx', {...BASE});
    await connect(conn);
    expect(mockExecCalls).toEqual(["SET TIME ZONE 'UTC'"]);
  });
});
