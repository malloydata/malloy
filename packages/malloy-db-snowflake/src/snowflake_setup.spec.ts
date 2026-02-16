/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as malloy from '@malloydata/malloy';
import {SnowflakeConnection} from './snowflake_connection';
import {SnowflakeExecutor} from './snowflake_executor';
import crypto from 'crypto';

describe('setupSQL', () => {
  const connOptions =
    SnowflakeExecutor.getConnectionOptionsFromEnv() ||
    SnowflakeExecutor.getConnectionOptionsFromToml();
  const uid = crypto.randomBytes(4).toString('hex');
  const connections: SnowflakeConnection[] = [];

  function makeConn(name: string, setupSQL: string): SnowflakeConnection {
    const conn = new SnowflakeConnection(name, {connOptions, setupSQL});
    connections.push(conn);
    return conn;
  }

  afterAll(async () => {
    await Promise.all(connections.map(c => c.close()));
  });

  it('runs a single setup statement', async () => {
    const conn = makeConn(
      'snowflake_setup_single',
      `SET setup_test_${uid} = 42`
    );
    const result = await conn.runSQL(`SELECT $setup_test_${uid} AS V`);
    expect(malloy.API.rowDataToNumber(result.rows[0]['V'])).toBe(42);
  });

  it('runs multiple semicolon-newline-separated statements', async () => {
    const conn = makeConn(
      'snowflake_setup_multi',
      [`SET setup_a_${uid} = 10`, `SET setup_b_${uid} = 20`].join(';\n')
    );
    const result = await conn.runSQL(
      `SELECT $setup_a_${uid} + $setup_b_${uid} AS V`
    );
    expect(malloy.API.rowDataToNumber(result.rows[0]['V'])).toBe(30);
  });

  it('handles multi-line statements', async () => {
    const conn = makeConn(
      'snowflake_setup_multiline',
      `SET\n  setup_ml_${uid} = 99`
    );
    const result = await conn.runSQL(`SELECT $setup_ml_${uid} AS V`);
    expect(malloy.API.rowDataToNumber(result.rows[0]['V'])).toBe(99);
  });
});
