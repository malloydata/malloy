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

import {SQLBlock} from '@malloydata/malloy';
import {DuckDBCommon} from './duckdb_common';
import {DuckDBWASMConnection} from './duckdb_wasm_connection_node';

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
      .spyOn(DuckDBCommon.prototype, 'fetchSchemaForSQLBlock')
      .mockResolvedValue({
        error: 'mocked',
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findTables = jest.spyOn(connection as any, 'findTables');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('finds simple tables in SQL', async () => {
    await connection.fetchSchemaForSQLBlock(
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
      } as SQLBlock,
      {refreshSchemaCache: true}
    );
    expect(findTables).toHaveBeenCalledWith([
      'order_items.parquet',
      'inventory_items.parquet',
    ]);
  });

  it('finds table functions in SQL', async () => {
    await connection.fetchSchemaForSQLBlock(
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
      } as SQLBlock,
      {refreshSchemaCache: true}
    );
    expect(findTables).toHaveBeenCalledWith([
      'order_items2.parquet',
      'inventory_items2.parquet',
    ]);
  });
});
