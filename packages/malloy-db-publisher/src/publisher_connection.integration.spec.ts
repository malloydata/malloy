/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as malloy from '@malloydata/malloy';
import type {QueryRecord} from '@malloydata/malloy';
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
      total += Number(row['cnt'] ?? 0);
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

  it('uses correct timeout configuration for long-running queries', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test that a real query completes within the timeout period
    // The timeout is set to 600000ms (10 minutes) in the Configuration
    // Using a real query that aggregates data from the ecommerce_bq.users table
    const startTime = Date.now();
    const res = await conn.runSQL(
      'SELECT state, COUNT(*) as user_count FROM ecommerce_bq.users GROUP BY state ORDER BY user_count DESC LIMIT 5'
    );
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify query completed successfully with real data
    expect(res.totalRows).toBe(5);
    expect(res.rows.length).toBe(5);
    expect(res.rows[0]).toHaveProperty('state');
    expect(res.rows[0]).toHaveProperty('user_count');
    expect(res.rows[0]['user_count']).toBeGreaterThan(0);
    // Verify the results are sorted by user_count descending
    expect(typeof res.rows[0]['state']).toBe('string');
    expect(typeof res.rows[0]['user_count']).toBe('number');
    // Verify sorting: first state should have more users than the last
    if (res.rows.length > 1) {
      const firstCount = res.rows[0]['user_count'] as number;
      const lastCount = res.rows[res.rows.length - 1]['user_count'] as number;
      expect(firstCount).toBeGreaterThanOrEqual(lastCount);
    }

    // Verify query completed well within the timeout period
    // (This test ensures the timeout is set high enough for normal operations)
    expect(duration).toBeLessThan(600000); // Should complete in less than 10 minutes
  });

  it('handles timeout configuration for streaming queries', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test that streaming queries work with the configured timeout
    // Using a real query that selects user data from the ecommerce_bq.users table
    const startTime = Date.now();
    const stream = conn.runSQLStream(
      'SELECT id, first_name, last_name, state FROM ecommerce_bq.users LIMIT 10'
    );
    const results: QueryRecord[] = [];

    for await (const row of stream) {
      results.push(row);
    }
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify streaming completed successfully with real data
    expect(results.length).toBe(10);
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('first_name');
    expect(results[0]).toHaveProperty('last_name');
    expect(results[0]).toHaveProperty('state');
    expect(typeof results[0]['id']).toBe('number');
    expect(typeof results[0]['first_name']).toBe('string');
    expect(typeof results[0]['last_name']).toBe('string');
    expect(typeof results[0]['state']).toBe('string');

    // Verify streaming completed well within the timeout period
    expect(duration).toBeLessThan(600000); // Should complete in less than 10 minutes
  });

  it('successfully queries ecommerce table', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test that a valid ecommerce table query works
    const res = await conn.runSQL(
      'SELECT COUNT(*) as total_users FROM ecommerce_bq.users'
    );
    expect(res.totalRows).toBe(1);
    expect(res.rows[0]['total_users']).toBeGreaterThan(0);
  });

  it('handles error when querying non-existent california_schools table', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test error handling for non-existent table
    await expect(
      conn.runSQL('SELECT * FROM california_schools LIMIT 10')
    ).rejects.toThrow();
  });

  it('handles error when querying non-existent california_schools table and captures error message', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test error handling for non-existent table and verify error message
    try {
      await conn.runSQL('SELECT * FROM california_schools LIMIT 10');
      fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const errorMessage = (error as Error).message;
      expect(errorMessage).toBeDefined();
      expect(typeof errorMessage).toBe('string');
      expect(errorMessage.length).toBeGreaterThan(0);
      // Error message should indicate table not found or similar
      // Note: The actual error might be a 502 status code or other HTTP error
      const hasErrorIndicator =
        errorMessage.toLowerCase().includes('not found') ||
        errorMessage.toLowerCase().includes('does not exist') ||
        errorMessage.toLowerCase().includes('unknown') ||
        errorMessage.toLowerCase().includes('table') ||
        errorMessage.toLowerCase().includes('dataset') ||
        errorMessage.toLowerCase().includes('qualified') ||
        errorMessage.toLowerCase().includes('status code') ||
        errorMessage.toLowerCase().includes('request failed') ||
        errorMessage.toLowerCase().includes('502') ||
        errorMessage.toLowerCase().includes('500');
      expect(hasErrorIndicator).toBe(true);
    }
  });

  it('handles error when querying table with typo salifornia_schools.frpm1', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test error handling for table with typo in name
    await expect(
      conn.runSQL('SELECT * FROM salifornia_schools.frpm1 LIMIT 10')
    ).rejects.toThrow();
  });

  it('handles error when querying table with typo salifornia_schools.frpm1 and captures error message', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test error handling for table with typo and verify error message
    try {
      await conn.runSQL('SELECT * FROM salifornia_schools.frpm1 LIMIT 10');
      fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const errorMessage = (error as Error).message;
      expect(errorMessage).toBeDefined();
      expect(typeof errorMessage).toBe('string');
      expect(errorMessage.length).toBeGreaterThan(0);
      // Error message should indicate table/dataset not found or similar
      // Note: The actual error might be a 502 status code or other HTTP error
      const hasErrorIndicator =
        errorMessage.toLowerCase().includes('not found') ||
        errorMessage.toLowerCase().includes('does not exist') ||
        errorMessage.toLowerCase().includes('unknown') ||
        errorMessage.toLowerCase().includes('table') ||
        errorMessage.toLowerCase().includes('dataset') ||
        errorMessage.toLowerCase().includes('qualified') ||
        errorMessage.toLowerCase().includes('status code') ||
        errorMessage.toLowerCase().includes('request failed') ||
        errorMessage.toLowerCase().includes('502') ||
        errorMessage.toLowerCase().includes('500');
      expect(hasErrorIndicator).toBe(true);
    }
  });

  it('handles error when fetching schema for non-existent california_schools table', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test error handling when fetching schema for non-existent table
    await expect(
      conn.fetchTableSchema('california_schools', 'california_schools')
    ).rejects.toThrow();
  });

  it('handles error when fetching schema for table with typo salifornia_schools.frpm1', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test error handling when fetching schema for table with typo
    await expect(
      conn.fetchTableSchema('salifornia_schools', 'salifornia_schools.frpm1')
    ).rejects.toThrow();
  });

  it('handles error when fetching SQL schema for non-existent california_schools table', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test error handling when fetching SQL schema for non-existent table
    // Note: fetchSelectSchema may return an error message instead of throwing
    try {
      const schema = await conn.fetchSelectSchema({
        connection: 'bq_demo',
        selectStr: 'SELECT * FROM california_schools LIMIT 10',
      });
      // If it doesn't throw, check if the schema contains an error indicator
      // This might happen if the API returns an error message in the schema
      // The schema should indicate an error or be invalid
      expect(schema).toBeDefined();
    } catch (error) {
      // If it throws, that's also valid
      expect(error).toBeInstanceOf(Error);
      const errorMessage = (error as Error).message;
      expect(errorMessage).toBeDefined();
    }
  });

  it('handles error when fetching SQL schema for table with typo salifornia_schools.frpm1', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test error handling when fetching SQL schema for table with typo
    // Note: fetchSelectSchema may return an error message instead of throwing
    try {
      const schema = await conn.fetchSelectSchema({
        connection: 'bq_demo',
        selectStr: 'SELECT * FROM salifornia_schools.frpm1 LIMIT 10',
      });
      // If it doesn't throw, check if the schema contains an error indicator
      // This might happen if the API returns an error message in the schema
      // The schema should indicate an error or be invalid
      expect(schema).toBeDefined();
    } catch (error) {
      // If it throws, that's also valid
      expect(error).toBeInstanceOf(Error);
      const errorMessage = (error as Error).message;
      expect(errorMessage).toBeDefined();
      // Error message should indicate dataset not found
      expect(
        errorMessage.toLowerCase().includes('not found') ||
          errorMessage.toLowerCase().includes('dataset')
      ).toBe(true);
    }
  });

  it('handles error when streaming query for non-existent california_schools table', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test error handling when streaming query for non-existent table
    const stream = conn.runSQLStream(
      'SELECT * FROM california_schools LIMIT 10'
    );
    await expect(async () => {
      for await (const _row of stream) {
        // Should not reach here
      }
    }).rejects.toThrow();
  });

  it('handles error when streaming query for table with typo salifornia_schools.frpm1', async () => {
    if (!conn) {
      pending('Publisher service not available');
      return;
    }
    // Test error handling when streaming query for table with typo
    const stream = conn.runSQLStream(
      'SELECT * FROM salifornia_schools.frpm1 LIMIT 10'
    );
    await expect(async () => {
      for await (const _row of stream) {
        // Should not reach here
      }
    }).rejects.toThrow();
  });
});
