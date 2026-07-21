/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import snowflake from 'snowflake-sdk';
import type {RowStatement} from 'snowflake-sdk';
import {SnowflakeConnection} from './snowflake_connection';
import {snowflakeQueryTag} from './snowflake_executor';

// A minimal fake generic-pool + snowflake connection so runSQL / executor
// logic runs fully offline. Records the execute options of every statement.
interface ExecCall {
  sqlText: string;
  parameters?: Record<string, unknown>;
}

function installFakeSnowflake(queryId = 'q-abc-123'): {
  calls: ExecCall[];
  spy: jest.SpyInstance;
} {
  const calls: ExecCall[] = [];
  const fakeStmt = {
    getQueryId: () => queryId,
    cancel: () => {},
  } as unknown as RowStatement;
  const fakeConn = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute(opts: any): RowStatement {
      calls.push({sqlText: opts.sqlText, parameters: opts.parameters});
      // DDL/ALTER SESSION statements return no rows; a SELECT returns one row.
      const rows = /^\s*select/i.test(opts.sqlText) ? [{T: 1}] : [];
      opts.complete(undefined, fakeStmt, rows);
      return fakeStmt;
    },
  };
  const fakePool = {
    use: (fn: (c: unknown) => Promise<unknown>) => fn(fakeConn),
    acquire: async () => fakeConn,
    release: async () => {},
    drain: async () => {},
    clear: () => {},
  };
  const spy = jest
    .spyOn(snowflake, 'createPool')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockReturnValue(fakePool as any);
  return {calls, spy};
}

// Non-empty so the constructor never falls back to reading connections.toml.
const CONN_OPTIONS = {account: 'test', username: 'test'};

const lastCall = (calls: ExecCall[]): ExecCall => calls[calls.length - 1];

describe('snowflakeQueryTag', () => {
  it('reads queryMetadata.snowflake.queryTag', () => {
    expect(
      snowflakeQueryTag({
        queryMetadata: {snowflake: {queryTag: 'team:finance'}},
      })
    ).toBe('team:finance');
  });

  it('returns undefined when the tag is absent at any level', () => {
    expect(snowflakeQueryTag(undefined)).toBeUndefined();
    expect(snowflakeQueryTag({})).toBeUndefined();
    expect(snowflakeQueryTag({queryMetadata: {}})).toBeUndefined();
    expect(snowflakeQueryTag({queryMetadata: {snowflake: {}}})).toBeUndefined();
  });

  it('ignores a non-string queryTag', () => {
    expect(
      snowflakeQueryTag({
        queryMetadata: {snowflake: {queryTag: 123 as unknown as string}},
      })
    ).toBeUndefined();
  });
});

describe('db-snowflake queryMetadata wiring (offline)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('applies a per-call query tag as parameters.QUERY_TAG on the data statement', async () => {
    const {calls} = installFakeSnowflake();
    const conn = new SnowflakeConnection('sf', {connOptions: CONN_OPTIONS});
    await conn.runSQL('SELECT 1 AS T', {
      queryMetadata: {snowflake: {queryTag: 'team:finance'}},
    });
    expect(lastCall(calls).sqlText).toBe('SELECT 1 AS T');
    expect(lastCall(calls).parameters).toEqual({QUERY_TAG: 'team:finance'});
  });

  it('applies the connection-default tag (from queryOptions) to every statement, including session init', async () => {
    const {calls} = installFakeSnowflake();
    const conn = new SnowflakeConnection('sf', {
      connOptions: CONN_OPTIONS,
      queryOptions: {queryMetadata: {snowflake: {queryTag: 'app:my-app'}}},
    });
    await conn.runSQL('SELECT 1 AS T');
    // Session-init ALTER SESSION statements run before the data query; all of
    // them carry the connection-default tag.
    expect(calls.length).toBeGreaterThan(1);
    for (const c of calls) {
      expect(c.parameters).toEqual({QUERY_TAG: 'app:my-app'});
    }
  });

  it('lets a per-call tag override the connection default on the data statement', async () => {
    const {calls} = installFakeSnowflake();
    const conn = new SnowflakeConnection('sf', {
      connOptions: CONN_OPTIONS,
      queryOptions: {queryMetadata: {snowflake: {queryTag: 'app:my-app'}}},
    });
    await conn.runSQL('SELECT 1 AS T', {
      queryMetadata: {snowflake: {queryTag: 'team:finance'}},
    });
    expect(lastCall(calls).parameters).toEqual({QUERY_TAG: 'team:finance'});
  });

  it('sets no parameters when no tag is present', async () => {
    const {calls} = installFakeSnowflake();
    const conn = new SnowflakeConnection('sf', {connOptions: CONN_OPTIONS});
    await conn.runSQL('SELECT 1 AS T');
    expect(lastCall(calls).parameters).toBeUndefined();
  });

  it('surfaces the warehouse query id as runStats.executionMetadata.snowflake.queryId', async () => {
    installFakeSnowflake('01ab-2345');
    const conn = new SnowflakeConnection('sf', {connOptions: CONN_OPTIONS});
    const res = await conn.runSQL('SELECT 1 AS T');
    expect(res.runStats?.executionMetadata?.snowflake).toEqual({
      queryId: '01ab-2345',
    });
  });

  it('never injects queryTag into the connection options (per-statement only)', () => {
    const {spy} = installFakeSnowflake();
    new SnowflakeConnection('sf', {
      connOptions: CONN_OPTIONS,
      queryOptions: {queryMetadata: {snowflake: {queryTag: 'app:my-app'}}},
    });
    const passedConnOptions = spy.mock.calls[0][0] as Record<string, unknown>;
    expect(passedConnOptions['queryTag']).toBeUndefined();
  });
});
