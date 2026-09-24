/*
 * Copyright 2025 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';
import {GizmoSQLConnection} from './gizmosql_connection';

const [describe] = describeIfDatabaseAvailable(['gizmosql']);

describe('GizmoSQLConnection', () => {
  let connection: GizmoSQLConnection;

  beforeAll(async () => {
    const uri = process.env['GIZMOSQL_URI'];
    const username = process.env['GIZMOSQL_USERNAME'];
    const password = process.env['GIZMOSQL_PASSWORD'];
    const catalog = process.env['GIZMOSQL_CATALOG'] || 'main';

    if (!uri || !username || !password) {
      throw new Error(
        'Missing required environment variables for GizmoSQL tests:\n' +
          '  GIZMOSQL_URI, GIZMOSQL_USERNAME, GIZMOSQL_PASSWORD'
      );
    }

    connection = new GizmoSQLConnection(
      {
        name: 'test-gizmosql',
        gizmosqlUri: uri,
        gizmosqlUsername: username,
        gizmosqlPassword: password,
        gizmosqlCatalog: catalog,
      },
      () => ({rowLimit: 10})
    );

    await connection.runSQL('SELECT 1');
  });

  afterAll(async () => {
    await connection.close();
  });

  it('should connect and execute simple query', async () => {
    const result = await connection.runSQL('SELECT 1 as test');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]['test']).toBe(1);
  });

  it('should execute query with multiple rows', async () => {
    const result = await connection.runSQL(
      'SELECT * FROM (VALUES (1, \'a\'), (2, \'b\'), (3, \'c\')) AS t(id, name)'
    );
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]['id']).toBe(1);
    expect(result.rows[0]['name']).toBe('a');
    expect(result.rows[1]['id']).toBe(2);
    expect(result.rows[1]['name']).toBe('b');
    expect(result.rows[2]['id']).toBe(3);
    expect(result.rows[2]['name']).toBe('c');
  });

  it('should respect row limit', async () => {
    const result = await connection.runSQL(
      'SELECT * FROM (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12)) AS t(id)'
    );
    expect(result.rows.length).toBeLessThanOrEqual(10);
  });

  it('should fetch table schema', async () => {
    const schema = await connection.fetchTableSchema(
      'test',
      'information_schema.tables'
    );
    expect(schema.fields.length).toBeGreaterThan(0);
    expect(schema.fields.some(f => f['name'] === 'table_name')).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    await expect(
      connection.runSQL('SELECT * FROM nonexistent_table_xyz')
    ).rejects.toThrow();
  });

  it('should test connection successfully', async () => {
    await expect(connection.test()).resolves.not.toThrow();
  });

  it('should create hash for SQL commands', async () => {
    const hash1 = await connection.createHash('SELECT 1');
    const hash2 = await connection.createHash('SELECT 1');
    const hash3 = await connection.createHash('SELECT 2');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(32); // MD5 hash length
  });

  it('should stream query results', async () => {
    const rows: unknown[] = [];
    for await (const row of connection.runSQLStream('SELECT 1 as test')) {
      rows.push(row);
    }
    expect(rows).toHaveLength(1);
    expect((rows[0] as {test: number})['test']).toBe(1);
  });
});
