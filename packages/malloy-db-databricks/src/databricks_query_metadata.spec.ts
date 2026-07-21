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

describe('db-databricks query metadata (offline)', () => {
  beforeEach(() => {
    mockExecCalls.length = 0;
  });

  it('emits SET QUERY_TAGS and SET settings at session open, after SET TIME ZONE', async () => {
    const conn = new DatabricksConnection('dbx', {
      ...BASE,
      queryTags: {team: 'finance', app: 'my-app'},
      sessionSettings: {statement_timeout: '60'},
    });
    await connect(conn);
    expect(mockExecCalls).toEqual([
      "SET TIME ZONE 'UTC'",
      "SET QUERY_TAGS['team'] = 'finance', QUERY_TAGS['app'] = 'my-app'",
      "SET statement_timeout = '60'",
    ]);
  });

  it('emits only SET TIME ZONE when no query metadata is configured', async () => {
    const conn = new DatabricksConnection('dbx', {...BASE});
    await connect(conn);
    expect(mockExecCalls).toEqual(["SET TIME ZONE 'UTC'"]);
  });

  it('uses the QUERY_TAGS associative-array grammar (not a plain SET query_tags)', async () => {
    const conn = new DatabricksConnection('dbx', {
      ...BASE,
      queryTags: {'cost-center': 'abc'},
    });
    await connect(conn);
    expect(mockExecCalls).toContain("SET QUERY_TAGS['cost-center'] = 'abc'");
  });

  it('escapes single quotes and backslashes in tag keys and values', async () => {
    const conn = new DatabricksConnection('dbx', {
      ...BASE,
      queryTags: {"o'brien": "a'b\\c"},
    });
    await connect(conn);
    expect(mockExecCalls).toContain(
      "SET QUERY_TAGS['o\\'brien'] = 'a\\'b\\\\c'"
    );
  });

  it('skips session-setting keys that are not bare identifiers', async () => {
    const conn = new DatabricksConnection('dbx', {
      ...BASE,
      sessionSettings: {'bad key; DROP': 'x', 'good_key': 'y'},
    });
    await connect(conn);
    expect(mockExecCalls).toContain("SET good_key = 'y'");
    expect(mockExecCalls.some(s => s.includes('bad key'))).toBe(false);
  });

  describe('connection digest', () => {
    const digest = (c: DatabricksConnection): string => c.getDigest();

    it('excludes query metadata (both tags and session settings)', () => {
      const base = digest(new DatabricksConnection('dbx', BASE));
      expect(
        digest(
          new DatabricksConnection('dbx', {...BASE, queryTags: {team: 'fin'}})
        )
      ).toBe(base);
      expect(
        digest(
          new DatabricksConnection('dbx', {
            ...BASE,
            sessionSettings: {some_setting: 'x'},
          })
        )
      ).toBe(base);
    });
  });
});
