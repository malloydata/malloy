/* Copyright 2023 Google LLC
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

import {PooledPostgresConnection} from './postgres_connection';
import crypto from 'crypto';
import type {SQLSourceDef} from '@malloydata/malloy';
import * as malloy from '@malloydata/malloy';
import {wrapTestModel} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';

/*
 * !IMPORTANT
 *
 * The connection is reused for each test, so if you do not name your tables
 * and keys uniquely for each test you will see cross test interactions.
 */

describe('postgres schema caching', () => {
  let connection: PooledPostgresConnection;
  let getTableSchema: jest.SpyInstance;
  let getSQLBlockSchema: jest.SpyInstance;

  const SQL_BLOCK_1: SQLSourceDef = {
    type: 'sql_select',
    name: 'block1',
    dialect: 'postgres',
    connection: 'mock_postgres',
    fields: [],
    selectStr: "SELECT 'block1' AS sql_block1",
  };

  const SQL_BLOCK_2: SQLSourceDef = {
    type: 'sql_select',
    name: 'block2',
    dialect: 'postgres',
    connection: 'mock_postgres',
    fields: [],
    selectStr: "SELECT 'block2' AS sql_block2",
  };

  beforeAll(async () => {
    connection = new PooledPostgresConnection('mock_postgres');
    await connection.runSQL('SELECT 1');
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    getTableSchema = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(PooledPostgresConnection.prototype as any, 'fetchTableSchema')
      .mockResolvedValue({
        type: 'table',
        dialect: 'postgres',
        name: 'name',
        tablePath: 'test',
        connection: 'mock_postgres',
      });

    getSQLBlockSchema = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(PooledPostgresConnection.prototype as any, 'fetchSelectSchema')
      .mockResolvedValue({
        type: 'sql_select',
        dialect: 'postgres',
        name: 'name',
        selectStr: SQL_BLOCK_1.selectStr,
        connection: 'mock_postgres',
        fields: [],
      });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('caches table schema', async () => {
    await connection.fetchSchemaForTables({'test1': 'table1'}, {});
    expect(getTableSchema).toBeCalledTimes(1);
    await connection.fetchSchemaForTables({'test1': 'table1'}, {});
    expect(getTableSchema).toBeCalledTimes(1);
  });

  it('refreshes table schema', async () => {
    await connection.fetchSchemaForTables({'test2': 'table2'}, {});
    expect(getTableSchema).toBeCalledTimes(1);
    await connection.fetchSchemaForTables(
      {'test2': 'table2'},
      {refreshTimestamp: Date.now() + 10}
    );
    expect(getTableSchema).toBeCalledTimes(2);
  });

  it('caches sql schema', async () => {
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
    expect(getSQLBlockSchema).toBeCalledTimes(1);
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
    expect(getSQLBlockSchema).toBeCalledTimes(1);
  });

  it('refreshes sql schema', async () => {
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {});
    expect(getSQLBlockSchema).toBeCalledTimes(1);
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {
      refreshTimestamp: Date.now() + 10,
    });
    expect(getSQLBlockSchema).toBeCalledTimes(2);
  });
});

describe('postgres schema reading', () => {
  it('distinguishes time stamp with and without offset', async () => {
    const connection = new PooledPostgresConnection('postgres');
    const schema = await connection.fetchSchemaForSQLStruct(
      {
        connection: 'postgres',
        selectStr:
          'SELECT current_timestamp AS offset_ts, localtimestamp as ts',
      },
      {}
    );
    if (schema.error) {
      throw new Error(`Error fetching schema: ${schema.error}`);
    }
    if (schema.structDef) {
      expect(schema.structDef.fields[0]).toEqual({
        name: 'offset_ts',
        type: 'timestamptz',
      });
      expect(schema.structDef.fields[1]).toEqual({
        name: 'ts',
        type: 'timestamp',
      });
    }
    await connection.close();
  });

  it('maps integer types correctly', async () => {
    const connection = new PooledPostgresConnection('postgres');
    const schema = await connection.fetchSchemaForSQLStruct(
      {
        connection: 'postgres',
        selectStr:
          'SELECT 1::smallint AS small_int, 2::integer AS int_val, 3::bigint AS big_int',
      },
      {}
    );
    if (schema.error) {
      throw new Error(`Error fetching schema: ${schema.error}`);
    }
    if (schema.structDef) {
      expect(schema.structDef.fields[0]).toEqual({
        name: 'small_int',
        type: 'number',
        numberType: 'integer',
      });
      expect(schema.structDef.fields[1]).toEqual({
        name: 'int_val',
        type: 'number',
        numberType: 'integer',
      });
      expect(schema.structDef.fields[2]).toEqual({
        name: 'big_int',
        type: 'number',
        numberType: 'bigint',
      });
    }
    await connection.close();
  });
});

/**
 * Tests for reading numeric values through Malloy queries
 */
describe('numeric value reading', () => {
  const connection = new PooledPostgresConnection('postgres');
  const runtime = new malloy.SingleConnectionRuntime({
    urlReader: {readURL: async () => ''},
    connection,
  });
  const testModel = wrapTestModel(runtime, '');

  afterAll(async () => {
    await connection.close();
  });

  describe('integer types', () => {
    it.each(['SMALLINT', 'INTEGER', 'BIGINT'])(
      'reads %s correctly',
      async sqlType => {
        await expect(
          `run: postgres.sql("SELECT 10::${sqlType} as d")`
        ).toMatchResult(testModel, {d: 10});
      }
    );
  });

  describe('float types', () => {
    it.each(['REAL', 'DOUBLE PRECISION', 'NUMERIC', 'DECIMAL'])(
      'reads %s correctly',
      async sqlType => {
        await expect(
          `run: postgres.sql("SELECT 10.5::${sqlType} as f")`
        ).toMatchResult(testModel, {f: 10.5});
      }
    );
  });
});

describe('setupSQL', () => {
  const uid = crypto.randomBytes(4).toString('hex');

  it('runs a single setup statement', async () => {
    const table = `setup_single_${uid}`;
    const connection = new PooledPostgresConnection({
      name: 'postgres',
      setupSQL: `CREATE TEMP TABLE IF NOT EXISTS ${table} (v int)`,
    });
    try {
      // Query through the pool directly — the acquire hook runs setupSQL,
      // creating the temp table on the same client before our query executes.
      const pool = await connection.getPool();
      const result = await pool.query(
        `SELECT count(*)::integer AS n FROM ${table}`
      );
      expect(result.rows[0].n).toBe(0);
    } finally {
      await connection.close();
    }
  });

  it('runs multiple semicolon-newline-separated statements', async () => {
    const table = `setup_multi_${uid}`;
    const connection = new PooledPostgresConnection({
      name: 'postgres',
      setupSQL: [
        `CREATE TEMP TABLE IF NOT EXISTS ${table} (v int)`,
        `INSERT INTO ${table} VALUES (42)`,
      ].join(';\n'),
    });
    try {
      const pool = await connection.getPool();
      const result = await pool.query(`SELECT v FROM ${table} LIMIT 1`);
      expect(result.rows[0].v).toBe(42);
    } finally {
      await connection.close();
    }
  });

  it('handles multi-line statements', async () => {
    const table = `setup_multiline_${uid}`;
    const connection = new PooledPostgresConnection({
      name: 'postgres',
      setupSQL: `CREATE TEMP TABLE IF NOT EXISTS ${table}\n  (v int)`,
    });
    try {
      const pool = await connection.getPool();
      const result = await pool.query(
        `SELECT count(*)::integer AS n FROM ${table}`
      );
      expect(result.rows[0].n).toBe(0);
    } finally {
      await connection.close();
    }
  });
});
