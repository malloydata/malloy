/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {SQLServerConnection, SQLServerExecutor} from './sqlserver_connection';
import type {SQLSourceDef} from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';

const [describe] = describeIfDatabaseAvailable(['sqlserver']);

/*
 * !IMPORTANT
 *
 * The connection is reused for each test, so if you do not name your tables
 * and keys uniquely for each test you will see cross test interactions.
 */

describe('SQLServerConnection', () => {
  let connection: SQLServerConnection;
  let getTableSchema: jest.SpyInstance;
  let getSQLBlockSchema: jest.SpyInstance;

  beforeAll(async () => {
    connection = new SQLServerConnection(
      'sqlserver-test',
      {},
      SQLServerExecutor.getConnectionOptionsFromEnv()
    );
    await connection.runSQL('SELECT 1');
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    getTableSchema = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(SQLServerConnection.prototype as any, 'fetchTableSchema')
      .mockResolvedValue({
        type: 'table',
        dialect: 'sqlserver',
        name: 'name',
        tablePath: 'test',
        connection: 'sqlserver',
      });

    getSQLBlockSchema = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(SQLServerConnection.prototype as any, 'fetchSelectSchema')
      .mockResolvedValue({
        type: 'sql select',
        dialect: 'sqlserver',
        name: 'name',
        selectStr: SQL_BLOCK_1.selectStr,
        connection: 'sqlserver',
        fields: [],
      });
  });

  afterEach(() => {
    jest.resetAllMocks();
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

  // TODO (vitor): Not sure about this test
  it('caches sql schema', async () => {
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
    expect(getSQLBlockSchema).toBeCalledTimes(1);
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
    expect(getSQLBlockSchema).toBeCalledTimes(1);
  });

  // TODO (vitor): Not sure about this test
  it('refreshes sql schema', async () => {
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {});
    expect(getSQLBlockSchema).toBeCalledTimes(1);
    await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {
      refreshTimestamp: Date.now() + 10,
    });
    expect(getSQLBlockSchema).toBeCalledTimes(2);
  });
});

const SQL_BLOCK_1: SQLSourceDef = {
  type: 'sql_select',
  name: 'block1',
  dialect: 'sqlserver',
  connection: 'sqlserver',
  fields: [],
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
};

const SQL_BLOCK_2: SQLSourceDef = {
  type: 'sql_select',
  name: 'block2',
  dialect: 'sqlserver',
  connection: 'sqlserver',
  fields: [],
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
};
