/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {TrinoConnection} from './trino_connection';
import {TrinoExecutor} from './trino_executor';
import crypto from 'crypto';

describe('setupSQL', () => {
  const config = TrinoExecutor.getConnectionOptionsFromEnv('trino');
  if (!config) {
    it('skips — no TRINO_SERVER configured', () => {});
    return;
  }
  const uid = crypto.randomBytes(4).toString('hex');
  const connections: TrinoConnection[] = [];

  function makeConn(name: string, setupSQL: string): TrinoConnection {
    const conn = new TrinoConnection(name, undefined, {...config, setupSQL});
    connections.push(conn);
    return conn;
  }

  afterAll(async () => {
    await Promise.all(connections.map(c => c.close()));
  });

  it('runs a single setup statement', async () => {
    const schema = `setup_single_${uid}`;
    const conn = makeConn(
      'trino',
      `CREATE SCHEMA IF NOT EXISTS memory.${schema}`
    );
    const result = await conn.runSQL(
      `SELECT schema_name FROM memory.information_schema.schemata WHERE schema_name = '${schema}'`
    );
    expect(result.rows.length).toBe(1);
    // cleanup
    await conn.runSQL(`DROP SCHEMA IF EXISTS memory.${schema}`);
  });

  it('runs multiple semicolon-newline-separated statements', async () => {
    const schema = `setup_multi_${uid}`;
    const table = `${schema}.test_tbl`;
    const conn = makeConn(
      'trino',
      [
        `CREATE SCHEMA IF NOT EXISTS memory.${schema}`,
        `CREATE TABLE IF NOT EXISTS memory.${table} (v INTEGER)`,
      ].join(';\n')
    );
    const result = await conn.runSQL(
      `SELECT table_name FROM memory.information_schema.tables WHERE table_schema = '${schema}' AND table_name = 'test_tbl'`
    );
    expect(result.rows.length).toBe(1);
    // cleanup
    await conn.runSQL(`DROP TABLE IF EXISTS memory.${table}`);
    await conn.runSQL(`DROP SCHEMA IF EXISTS memory.${schema}`);
  });

  it('handles multi-line statements', async () => {
    const schema = `setup_ml_${uid}`;
    const conn = makeConn(
      'trino',
      `CREATE SCHEMA IF NOT EXISTS\n  memory.${schema}`
    );
    const result = await conn.runSQL(
      `SELECT schema_name FROM memory.information_schema.schemata WHERE schema_name = '${schema}'`
    );
    expect(result.rows.length).toBe(1);
    // cleanup
    await conn.runSQL(`DROP SCHEMA IF EXISTS memory.${schema}`);
  });
});
