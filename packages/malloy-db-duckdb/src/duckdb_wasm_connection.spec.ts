/*
 * Copyright 2023 Google LLC
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

import {wrapTestModel} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';
import {DuckDBCommon} from './duckdb_common';
import {DuckDBWASMConnection} from './duckdb_wasm_connection_node';
import type {SQLSourceDef} from '@malloydata/malloy';
import * as malloy from '@malloydata/malloy';

describe('DuckDBWasmConnection', () => {
  let connection: DuckDBWASMConnection;
  let findTables: jest.SpyInstance;

  beforeAll(async () => {
    connection = new DuckDBWASMConnection('duckdb');
    await connection.runSQL('SELECT 1');
  });

  afterAll(async () => {
    await connection.close();
    await new Promise(resolve => setTimeout(resolve, 10000));
  });

  beforeEach(() => {
    jest
      .spyOn(DuckDBCommon.prototype, 'fetchSelectSchema')
      .mockResolvedValue('mocked');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findTables = jest.spyOn(connection as any, 'findTables');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('finds simple tables in SQL', async () => {
    await connection.fetchSchemaForSQLStruct(
      {
        selectStr: `
SELECT
  created_at,
  sale_price,
  inventory_item_id
FROM 'order_items.parquet'
SELECT
id,
  product_department,
  product_category,
  created_at AS inventory_items_created_at
FROM "inventory_items.parquet"
`,
      } as SQLSourceDef,
      {}
    );
    expect(findTables).toHaveBeenCalledWith(
      ['order_items.parquet', 'inventory_items.parquet'],
      {}
    );
  });

  it('finds table functions in SQL', async () => {
    await connection.fetchSchemaForSQLStruct(
      {
        selectStr: `
SELECT
  created_at,
  sale_price,
  inventory_item_id
FROM read_parquet('order_items2.parquet', arg='value')
SELECT
id,
  product_department,
  product_category,
  created_at AS inventory_items_created_at
FROM read_parquet("inventory_items2.parquet")
`,
      } as SQLSourceDef,
      {}
    );
    expect(findTables).toHaveBeenCalledWith(
      ['order_items2.parquet', 'inventory_items2.parquet'],
      {}
    );
  });

  // Test that DecimalBigNums are correctly handled with scale correction
  it('DecimalBigNum returns correct value', async () => {
    const result = await connection.runSQL('SELECT 1.234 AS n1');
    expect(result).toEqual({'rows': [{'n1': 1.234}], 'totalRows': 1});
  });

  // Test that decimal values in arrays are correctly handled
  it('reads decimal values in arrays correctly', async () => {
    const result = await connection.runSQL('SELECT [1.5, 2.5, 3.5] AS arr');
    expect(result).toEqual({
      'rows': [{'arr': [1.5, 2.5, 3.5]}],
      'totalRows': 1,
    });
  });

  // Test that decimal values in structs are correctly handled
  it('reads decimal values in structs correctly', async () => {
    const result = await connection.runSQL(
      "SELECT {'a': 1.5, 'b': 2.5} AS rec"
    );
    expect(result).toEqual({
      'rows': [{'rec': {'a': 1.5, 'b': 2.5}}],
      'totalRows': 1,
    });
  });

  // Test negative decimal handling
  it('reads negative decimals correctly', async () => {
    const result = await connection.runSQL('SELECT -123.456 AS n');
    expect(result).toEqual({'rows': [{'n': -123.456}], 'totalRows': 1});
  });

  // Test large decimal that exceeds JS safe integer (returns string)
  it('reads large decimals as strings', async () => {
    // DECIMAL(38,10) with a value that exceeds Number.MAX_SAFE_INTEGER
    const result = await connection.runSQL(
      'SELECT 12345678901234567890.1234567890::DECIMAL(38,10) AS n'
    );
    // Should return as string with proper decimal placement
    expect(result.rows[0]['n']).toBe('12345678901234567890.1234567890');
  });

  // Test primitive types pass through correctly
  it('reads string values correctly', async () => {
    const result = await connection.runSQL("SELECT 'hello' AS s");
    expect(result).toEqual({'rows': [{'s': 'hello'}], 'totalRows': 1});
  });

  it('reads boolean values correctly', async () => {
    const result = await connection.runSQL('SELECT true AS b, false AS c');
    expect(result).toEqual({
      'rows': [{'b': true, 'c': false}],
      'totalRows': 1,
    });
  });

  it('reads date values correctly', async () => {
    const result = await connection.runSQL("SELECT DATE '2024-01-15' AS d");
    expect(result.rows[0]['d']).toBeInstanceOf(Date);
    expect((result.rows[0]['d'] as Date).toISOString()).toContain('2024-01-15');
  });
});

/**
 * Tests for reading numeric values through Malloy queries (WASM path)
 */
describe('numeric value reading', () => {
  const connection = new DuckDBWASMConnection('duckdb');
  const runtime = new malloy.SingleConnectionRuntime({
    urlReader: {readURL: async () => ''},
    connection,
  });
  const testModel = wrapTestModel(runtime, '');

  afterAll(async () => {
    await connection.close();
  });

  describe('integer types', () => {
    // Note: UHUGEINT excluded - Arrow returns byte array that can't convert to BigInt in WASM
    it.each([
      'TINYINT',
      'SMALLINT',
      'INTEGER',
      'BIGINT',
      'UTINYINT',
      'USMALLINT',
      'UINTEGER',
      'UBIGINT',
      'HUGEINT',
    ])('reads %s correctly', async sqlType => {
      await expect(
        `run: duckdb.sql("SELECT 10::${sqlType} as d")`
      ).toMatchResult(testModel, {d: 10});
    });
  });

  describe('float types', () => {
    it.each(['FLOAT', 'DOUBLE', 'DECIMAL'])(
      'reads %s correctly',
      async sqlType => {
        await expect(
          `run: duckdb.sql("SELECT 10.5::${sqlType} as f")`
        ).toMatchResult(testModel, {f: 10.5});
      }
    );
  });
});
