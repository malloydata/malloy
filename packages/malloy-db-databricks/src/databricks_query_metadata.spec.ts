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

describe('db-databricks query tags (offline)', () => {
  beforeEach(() => {
    mockExecCalls.length = 0;
  });

  it('emits one SET QUERY_TAGS statement at session open, after SET TIME ZONE', async () => {
    const conn = new DatabricksConnection('dbx', {
      ...BASE,
      queryMetadata: {applicationName: 'my-app', labels: {team: 'finance'}},
    });
    await connect(conn);
    expect(mockExecCalls).toEqual([
      "SET TIME ZONE 'UTC'",
      "SET QUERY_TAGS['team'] = 'finance', QUERY_TAGS['application'] = 'my-app'",
    ]);
  });

  it('emits only SET TIME ZONE when no query tags are configured', async () => {
    const conn = new DatabricksConnection('dbx', {...BASE});
    await connect(conn);
    expect(mockExecCalls).toEqual(["SET TIME ZONE 'UTC'"]);
  });

  it('uses the QUERY_TAGS associative-array grammar, preserving case', async () => {
    const conn = new DatabricksConnection('dbx', {
      ...BASE,
      queryMetadata: {labels: {CostCenter: 'Eng'}},
    });
    await connect(conn);
    expect(mockExecCalls).toContain("SET QUERY_TAGS['CostCenter'] = 'Eng'");
  });

  it('escapes single quotes and backslashes in tag values', async () => {
    const conn = new DatabricksConnection('dbx', {
      ...BASE,
      queryMetadata: {labels: {obrien: "a'b\\c"}},
    });
    await connect(conn);
    expect(mockExecCalls).toContain("SET QUERY_TAGS['obrien'] = 'a\\'b\\\\c'");
  });

  describe('connection digest', () => {
    const digest = (c: DatabricksConnection): string => c.getDigest();

    it('excludes query tags', () => {
      expect(
        digest(
          new DatabricksConnection('dbx', {
            ...BASE,
            queryMetadata: {labels: {team: 'fin'}},
          })
        )
      ).toBe(digest(new DatabricksConnection('dbx', BASE)));
    });
  });
});
