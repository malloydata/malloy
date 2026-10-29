/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {PrestoConnection} from './trino_connection';
import {TrinoExecutor} from './trino_executor';

describe('presto setupSQL', () => {
  const config = TrinoExecutor.getConnectionOptionsFromEnv('presto');
  if (!config) {
    it('skips — no PRESTO_HOST configured', () => {});
    return;
  }
  const connections: PrestoConnection[] = [];

  function makeConn(name: string, setupSQL: string): PrestoConnection {
    const conn = new PrestoConnection(name, undefined, {...config, setupSQL});
    connections.push(conn);
    return conn;
  }

  afterAll(async () => {
    await Promise.all(connections.map(c => c.close()));
  });

  // Note: the Presto HTTP client does not carry session state between
  // queries, so SET SESSION effects don't persist.  These tests verify
  // that the setupSQL mechanism itself works (statements execute before
  // the first real query, and bad SQL is rejected).

  it('runs a single setup statement', async () => {
    const conn = makeConn(
      'presto',
      "SET SESSION query_max_execution_time = '30m'"
    );
    const result = await conn.runSQL('SELECT 1 AS v');
    expect(result.rows[0]['v']).toBe(1);
  });

  it('runs multiple semicolon-newline-separated statements', async () => {
    const conn = makeConn(
      'presto',
      [
        "SET SESSION query_max_execution_time = '25m'",
        "SET SESSION query_max_run_time = '25m'",
      ].join(';\n')
    );
    const result = await conn.runSQL('SELECT 1 AS v');
    expect(result.rows[0]['v']).toBe(1);
  });

  it('handles multi-line statements', async () => {
    const conn = makeConn(
      'presto',
      "SET SESSION\n  query_max_execution_time = '20m'"
    );
    const result = await conn.runSQL('SELECT 1 AS v');
    expect(result.rows[0]['v']).toBe(1);
  });

  it('rejects bad setup SQL', async () => {
    const conn = makeConn('presto', 'THIS IS NOT VALID SQL');
    await expect(conn.runSQL('SELECT 1 AS v')).rejects.toThrow();
  });
});
