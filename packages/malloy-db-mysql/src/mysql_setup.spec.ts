/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MySQLConnection, MySQLExecutor} from '.';
import crypto from 'crypto';

const config = MySQLExecutor.getConnectionOptionsFromEnv();
const describeMySQL = config.user ? describe : describe.skip;

describeMySQL('setupSQL', () => {
  const uid = crypto.randomBytes(4).toString('hex');
  const connections: MySQLConnection[] = [];

  function makeConn(name: string, setupSQL: string): MySQLConnection {
    const conn = new MySQLConnection(name, {...config, setupSQL});
    connections.push(conn);
    return conn;
  }

  afterAll(async () => {
    await Promise.all(connections.map(c => c.close()));
  });

  it('runs a single setup statement', async () => {
    const varName = `@setup_single_${uid}`;
    const conn = makeConn('mysql', `SET ${varName} = 42`);
    const result = await conn.runSQL(`SELECT ${varName} AS v`);
    expect(result.rows[0]['v']).toBe(42);
  });

  it('runs multiple semicolon-newline-separated statements', async () => {
    const varA = `@setup_a_${uid}`;
    const varB = `@setup_b_${uid}`;
    const conn = makeConn(
      'mysql',
      [`SET ${varA} = 10`, `SET ${varB} = 20`].join(';\n')
    );
    const result = await conn.runSQL(`SELECT ${varA} + ${varB} AS v`);
    expect(result.rows[0]['v']).toBe(30);
  });

  it('handles multi-line statements', async () => {
    const varName = `@setup_ml_${uid}`;
    const conn = makeConn('mysql', `SET\n  ${varName} = 99`);
    const result = await conn.runSQL(`SELECT ${varName} AS v`);
    expect(result.rows[0]['v']).toBe(99);
  });
});
