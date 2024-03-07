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

import {DuckDBCommon} from './duckdb_common';
import {DuckDBConnection} from './duckdb_connection';
import {SQLBlock} from '@malloydata/malloy';

const envDatabases = (
  process.env['MALLOY_DATABASES'] ||
  process.env['MALLOY_DATABASE'] ||
  ''
).split(',');

let describe = globalThis.describe;
if (!envDatabases.includes('duckdb')) {
  describe = describe.skip;
}

/*
 * !IMPORTANT
 *
 * The connection is reused for each test, so if you do not name your tables
 * and keys uniquely for each test you will see cross test interactions.
 */

describe('DuckDBConnection', () => {
  let connection: DuckDBConnection;

  beforeAll(async () => {
    connection = new DuckDBConnection('duckdb');
    await connection.runSQL('SELECT 1');
    expect(Object.keys(DuckDBConnection.activeDBs).length).toEqual(1);
  });

  afterAll(async () => {
    await connection.close();
    expect(Object.keys(DuckDBConnection.activeDBs).length).toEqual(0);
  });

  describe('schema', () => {
    let runRawSQL: jest.SpyInstance;

    beforeEach(async () => {
      runRawSQL = jest
        .spyOn(DuckDBCommon.prototype, 'runRawSQL')
        .mockResolvedValue({rows: [], totalRows: 0});
    });

    afterEach(() => {
      jest.resetAllMocks();
      runRawSQL.mockRestore();
    });

    it('caches table schema', async () => {
      await connection.fetchSchemaForTables({'test1': 'table1'}, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForTables({'test1': 'table1'}, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
    });

    it('refreshes table schema', async () => {
      await connection.fetchSchemaForTables({'test2': 'table2'}, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForTables(
        {'test2': 'table2'},
        {refreshTimestamp: Date.now() + 10}
      );
      expect(runRawSQL).toHaveBeenCalledTimes(2);
    });

    it('caches sql schema', async () => {
      await connection.fetchSchemaForSQLBlock(SQL_BLOCK_1, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForSQLBlock(SQL_BLOCK_1, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
    });

    it('refreshes sql schema', async () => {
      await connection.fetchSchemaForSQLBlock(SQL_BLOCK_2, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForSQLBlock(SQL_BLOCK_2, {
        refreshTimestamp: Date.now() + 10,
      });
      expect(runRawSQL).toHaveBeenCalledTimes(2);
    });
  });

  describe('multiple connections', () => {
    it('can open multiple connections with different settings', async () => {
      const connection1 = new DuckDBConnection('duckdb1');
      const connection2 = new DuckDBConnection('duckdb2');

      await connection1.runRawSQL("SET FILE_SEARCH_PATH='/home/user1'");
      await connection2.runRawSQL("SET FILE_SEARCH_PATH='/home/user2'");

      const val1 = await connection1.runSQL(
        "SELECT current_setting('FILE_SEARCH_PATH') AS val"
      );
      const val2 = await connection2.runSQL(
        "SELECT current_setting('FILE_SEARCH_PATH') AS val"
      );

      expect(Object.keys(DuckDBConnection.activeDBs).length).toEqual(1);
      expect(DuckDBConnection.activeDBs[':memory:'].connections.length).toEqual(
        3
      );
      expect(val1).toEqual({rows: [{val: '/home/user1'}], totalRows: 1});
      expect(val2).toEqual({rows: [{val: '/home/user2'}], totalRows: 1});

      await connection1.close();
      await connection2.close();
    });
  });
});

const SQL_BLOCK_1 = {
  type: 'sqlBlock',
  name: 'block1',
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
} as SQLBlock;

const SQL_BLOCK_2 = {
  type: 'sqlBlock',
  name: 'block2',
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
} as SQLBlock;
