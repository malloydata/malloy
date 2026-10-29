/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Client} from 'pg';
import {PostgresConnection} from './postgres_connection';

// A pg Client stub that records the SQL it is asked to run — no network.
function fakeClient(): {client: Client; calls: string[]} {
  const calls: string[] = [];
  const client = {
    query: (sql: string) => {
      calls.push(sql);
      return Promise.resolve({rows: []});
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return {client, calls};
}

describe('db-postgres queryMetadata wiring (offline)', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('data query — bag prepended as a leading comment', () => {
    const stubQuery = (conn: PostgresConnection): jest.SpyInstance =>
      jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(conn as any, 'runPostgresQuery')
        .mockResolvedValue({rows: [], totalRows: 0});

    it('prepends the metadata comment to the data statement', async () => {
      const conn = new PostgresConnection({name: 'pg'});
      const spy = stubQuery(conn);
      await conn.runSQL('SELECT 1', {
        queryMetadata: {application_name: 'my-app', team: 'finance'},
      });
      expect(spy.mock.calls[0][0]).toBe(
        '-- application_name="my-app" team="finance"\nSELECT 1'
      );
    });

    it('runs the statement unchanged for absent or empty metadata (no prefix)', async () => {
      const conn = new PostgresConnection({name: 'pg'});
      const spy = stubQuery(conn);
      await conn.runSQL('SELECT 1');
      await conn.runSQL('SELECT 1', {queryMetadata: {}});
      expect(spy.mock.calls[0][0]).toBe('SELECT 1');
      expect(spy.mock.calls[1][0]).toBe('SELECT 1');
    });

    it('throws on an invalid bag', async () => {
      const conn = new PostgresConnection({name: 'pg'});
      stubQuery(conn);
      await expect(
        conn.runSQL('SELECT 1', {queryMetadata: {'bad key': 'v'}})
      ).rejects.toThrow(/Invalid query metadata/);
    });
  });

  describe('session open', () => {
    it('sets only SET TIME ZONE at session open', async () => {
      const conn = new PostgresConnection({name: 'pg'});
      const {client, calls} = fakeClient();
      await conn.connectionSetup(client);
      expect(calls).toEqual(["SET TIME ZONE 'UTC'"]);
    });
  });
});
