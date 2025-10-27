/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as malloy from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';
import {PublisherConnection} from './publisher_connection';
import {fileURLToPath} from 'url';
import * as util from 'util';
import * as fs from 'fs';

const [describe] = describeIfDatabaseAvailable(['publisher']);

describe.skip('db:Publisher Integration Tests', () => {
  let conn: PublisherConnection | null;
  let runtime: malloy.Runtime | null;

  beforeEach(async () => {
    try {
      conn = await PublisherConnection.create('bq_demo', {
        connectionUri:
          'http://localhost:4000/api/v0/projects/malloy-samples/connections/bq_demo',
      });
      const files = {
        readURL: async (url: URL) => {
          const filePath = fileURLToPath(url);
          return await util.promisify(fs.readFile)(filePath, 'utf8');
        },
      };
      runtime = new malloy.Runtime({
        urlReader: files,
        connection: conn,
      });
    } catch (error) {
      // Skip tests if connection cannot be established
      conn = null;
      runtime = null;
    }
  });

  afterEach(async () => {
    if (conn) {
      await conn.close();
    }
  });

  it('tests the connection', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    await conn.test();
  });

  it('correctly identifies the dialect', () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    expect(conn.dialectName).toBe('standardsql');
  });

  it('correctly identifies the connection as a pooled connection', () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    expect(conn.isPool()).toBe(false);
  });

  it('correctly identifies the connection as a streaming connection', () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    expect(conn.canStream()).toBe(true);
  });

  it('correctly identifies the connection as a persistSQLResults connection', () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    expect(conn.canPersist()).toBe(true);
  });

  it('fetches the table schema', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    const schema = await conn.fetchTableSchema(
      'ecommerce_bq',
      'ecommerce_bq.users'
    );
    expect(schema.type).toBe('table');
    expect(schema.dialect).toBe('standardsql');
    expect(schema.tablePath).toBe('{{projectId}}.ecommerce_bq.users');
    expect(schema.fields.length).toBe(14);
    expect(schema.fields[0].name).toBe('id');
    expect(schema.fields[0].type).toBe('number');
  });

  it('verifies fetchTableSchema returns complete TableSourceDef structure', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    const schema = await conn.fetchTableSchema(
      'ecommerce_bq',
      'ecommerce_bq.users'
    );

    // Verify top-level required fields
    expect(schema).toHaveProperty('type');
    expect(schema).toHaveProperty('dialect');
    expect(schema).toHaveProperty('tablePath');
    expect(schema).toHaveProperty('connection');
    expect(schema).toHaveProperty('fields');

    // Verify field values
    expect(schema.type).toBe('table');
    expect(schema.dialect).toBe('standardsql');
    expect(schema.tablePath).toBe('{{projectId}}.ecommerce_bq.users');
    expect(schema.connection).toBe('bq_demo');
    expect(Array.isArray(schema.fields)).toBe(true);
    expect(schema.fields.length).toBeGreaterThan(0);

    // Verify each field has required properties
    schema.fields.forEach((field, _index) => {
      expect(field).toHaveProperty('name');
      expect(field).toHaveProperty('type');
      expect(typeof field.name).toBe('string');
      expect(typeof field.type).toBe('string');
      expect(field.name.length).toBeGreaterThan(0);
      expect(field.type.length).toBeGreaterThan(0);
    });

    // Verify the schema structure matches expected TableSourceDef format
    expect(schema).toEqual({
      type: 'table',
      name: 'users',
      dialect: 'standardsql',
      tablePath: '{{projectId}}.ecommerce_bq.users',
      connection: 'bq_demo',
      fields: expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          type: expect.any(String),
        }),
      ]),
    });
  });

  it('fetches the sql source schema', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    const schema = await conn.fetchSelectSchema({
      connection: 'bq_demo',
      selectStr: 'SELECT * FROM ecommerce_bq.users',
    });
    expect(schema.type).toBe('sql_select');
    expect(schema.dialect).toBe('standardsql');
    expect(schema.fields.length).toBe(14);
    expect(schema.fields[0].name).toBe('id');
    expect(schema.fields[0].type).toBe('number');
  });

  it('runs a SQL query', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    const res = await conn.runSQL('SELECT 1 as T');
    expect(res.rows[0]['T']).toBe(1);
  });

  it('runs a Malloy query', async () => {
    if (!conn || !runtime) {
      pending('Publisher service not available');
      return;
    }
    const sql = await runtime
      .loadModel("source: users is bq_demo.table('ecommerce_bq.users')")
      .loadQuery(
        'run:  users -> { aggregate: cnt is count() group_by: state order_by: cnt desc limit: 10 }'
      )
      .getSQL();
    const res = await conn.runSQL(sql);
    expect(res.totalRows).toBe(10);
    let total = 0;
    for (const row of res.rows) {
      total += +(row['cnt'] ?? 0);
    }
    expect(total).toBeGreaterThan(0);
  });

  it('runs a Malloy query on an sql source', async () => {
    if (!conn || !runtime) {
      pending('Publisher service not available');
      return;
    }
    const sql = await runtime
      .loadModel(
        "source: users is bq_demo.sql('SELECT * FROM ecommerce_bq.users')"
      )
      .loadQuery(
        'run:  users -> { aggregate: cnt is count() group_by: state order_by: cnt desc limit: 20 }'
      )
      .getSQL();
    const res = await conn.runSQL(sql);
    expect(res.totalRows).toBe(20);
    expect(res.rows[0]['cnt']).toBeGreaterThan(0);
  });

  it('get temporary table name', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    const sql = 'SELECT 1 as T';
    const tempTableName = await conn.manifestTemporaryTable(sql);
    expect(tempTableName).toBeDefined();
    expect(tempTableName.length).toBeGreaterThan(0);
  });

  it('estimates query cost', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    const cost = await conn.estimateQueryCost(
      'SELECT * FROM ecommerce_bq.users'
    );
    expect(cost).toEqual({});
  });

  it('closes connection', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // close() should not throw and should return void
    await expect(conn.close()).resolves.toBeUndefined();
  });
});
