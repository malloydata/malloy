/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryMetadata} from '@malloydata/malloy';
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

describe('db-postgres query tags (offline)', () => {
  it('maps applicationName to SET application_name after SET TIME ZONE', async () => {
    const conn = new PostgresConnection({
      name: 'pg',
      queryMetadata: {applicationName: 'my-app'},
    });
    const {client, calls} = fakeClient();
    await conn.connectionSetup(client);
    expect(calls).toEqual([
      "SET TIME ZONE 'UTC'",
      "SET application_name = 'my-app'",
    ]);
  });

  it('does not apply labels (Postgres has no general tag facility)', async () => {
    const conn = new PostgresConnection({
      name: 'pg',
      queryMetadata: {applicationName: 'my-app', labels: {team: 'finance'}},
    });
    const {client, calls} = fakeClient();
    await conn.connectionSetup(client);
    expect(calls).toEqual([
      "SET TIME ZONE 'UTC'",
      "SET application_name = 'my-app'",
    ]);
  });

  it('emits only SET TIME ZONE when no query tags are configured', async () => {
    const conn = new PostgresConnection({name: 'pg'});
    const {client, calls} = fakeClient();
    await conn.connectionSetup(client);
    expect(calls).toEqual(["SET TIME ZONE 'UTC'"]);
  });

  it('escapes single quotes in the application_name value', async () => {
    const conn = new PostgresConnection({
      name: 'pg',
      queryMetadata: {applicationName: "my'app"},
    });
    const {client, calls} = fakeClient();
    await conn.connectionSetup(client);
    expect(calls).toContain("SET application_name = 'my''app'");
  });

  describe('connection digest', () => {
    const digest = (queryMetadata?: QueryMetadata): string =>
      new PostgresConnection({name: 'pg', queryMetadata}).getDigest();

    it('excludes query tags', () => {
      const base = digest();
      expect(digest({applicationName: 'my-app'})).toBe(base);
      expect(digest({labels: {team: 'finance'}})).toBe(base);
    });
  });
});
