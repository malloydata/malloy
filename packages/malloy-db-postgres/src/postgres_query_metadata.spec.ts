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

describe('db-postgres query metadata (offline)', () => {
  it('emits SET application_name + GUCs after SET TIME ZONE at session open', async () => {
    const conn = new PostgresConnection({
      name: 'pg',
      applicationName: 'credible',
      sessionSettings: {statement_timeout: '60s'},
    });
    const {client, calls} = fakeClient();
    await conn.connectionSetup(client);
    expect(calls).toEqual([
      "SET TIME ZONE 'UTC'",
      "SET application_name = 'credible'",
      "SET statement_timeout = '60s'",
    ]);
  });

  it('emits only SET TIME ZONE when no query metadata is configured', async () => {
    const conn = new PostgresConnection({name: 'pg'});
    const {client, calls} = fakeClient();
    await conn.connectionSetup(client);
    expect(calls).toEqual(["SET TIME ZONE 'UTC'"]);
  });

  it('escapes single quotes in the application_name value', async () => {
    const conn = new PostgresConnection({
      name: 'pg',
      applicationName: "cred'ible",
    });
    const {client, calls} = fakeClient();
    await conn.connectionSetup(client);
    expect(calls).toContain("SET application_name = 'cred''ible'");
  });

  it('skips GUC keys that are not bare identifiers', async () => {
    const conn = new PostgresConnection({
      name: 'pg',
      sessionSettings: {'bad key; DROP': 'x', 'search_path': 'analytics'},
    });
    const {client, calls} = fakeClient();
    await conn.connectionSetup(client);
    expect(calls).toContain("SET search_path = 'analytics'");
    expect(calls.some(s => s.includes('bad key'))).toBe(false);
  });

  describe('connection digest', () => {
    const digest = (opts: {
      applicationName?: string;
      sessionSettings?: Record<string, string>;
    }): string => new PostgresConnection({name: 'pg', ...opts}).getDigest();

    it('is unchanged by application_name (observability-only)', () => {
      expect(digest({})).toBe(digest({applicationName: 'credible'}));
    });

    it('differs when session settings differ (they affect the session)', () => {
      expect(digest({sessionSettings: {search_path: 'analytics'}})).not.toBe(
        digest({})
      );
    });
  });
});
