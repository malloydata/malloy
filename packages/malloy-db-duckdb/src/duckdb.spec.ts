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
import type {SQLSourceRequest, StructDef} from '@malloydata/malloy';
import {mkArrayDef} from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';

const [describe] = describeIfDatabaseAvailable(['duckdb']);

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
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
    });

    it('refreshes sql schema', async () => {
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {
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

  describe('schema parser', () => {
    it('parses arrays', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: ARRAY_SCHEMA});
      expect(structDef.fields[0]).toEqual(
        mkArrayDef({type: 'number', numberType: 'integer'}, 'test')
      );
    });

    it('parses inline', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: INLINE_SCHEMA});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'record',
        'join': 'one',
        'fields': [
          {'name': 'a', ...dblType},
          {'name': 'b', ...intTyp},
          {'name': 'c', ...strTyp},
        ],
      });
    });

    it('parses nested', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: NESTED_SCHEMA});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'array',
        'elementTypeDef': {type: 'record_element'},
        'join': 'many',
        'fields': [
          {'name': 'a', 'numberType': 'float', 'type': 'number'},
          {'name': 'b', 'numberType': 'integer', 'type': 'number'},
          {'name': 'c', 'type': 'string'},
        ],
      });
    });
    it('parses struct with sql native field', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: PROFESSOR_SCHEMA});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'array',
        'elementTypeDef': {type: 'record_element'},
        'join': 'many',
        'fields': [
          {'name': 'professor_id', 'type': 'sql native', 'rawType': 'UUID'},
          {'name': 'name', 'type': 'string'},
          {'name': 'age', 'numberType': 'integer', 'type': 'number'},
          {'name': 'total_sections', 'numberType': 'integer', 'type': 'number'},
        ],
      });
    });

    it('parses a simple type', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: 'varchar(60)'});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'string',
      });
    });

    it('parses unknown type', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: 'UUID'});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'sql native',
        'rawType': 'UUID',
      });
    });
  });
});

/**
 * Create a basic StructDef for the purpose of passing to
 * DuckDBConnection.fillStructDefFromTypeMap()
 *
 * @returns valid StructDef for testing
 */
const makeStructDef = (): StructDef => {
  return {
    type: 'table',
    name: 'test',
    dialect: 'duckdb',
    tablePath: 'test',
    connection: 'duckdb',
    fields: [],
  };
};

//
// SQL blocks for testing table name detection in
// DuckDBConnection.fetchSchemaForSQLBlock()
//

// Uses string value for table
const SQL_BLOCK_1: SQLSourceRequest = {
  connection: 'duckdb',
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

// Uses read_parquet() for table
const SQL_BLOCK_2: SQLSourceRequest = {
  connection: 'duckdb',
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

//
// Type strings for testing DuckDBConnection.fillStructDefFromTypeMap()
//

// 'integer[]' is array
const ARRAY_SCHEMA = 'integer[]';

// STRUCT(...) is inline
const INLINE_SCHEMA = 'STRUCT(a double, b integer, c varchar(60))';

// STRUCT(....)[] is nested
const NESTED_SCHEMA = 'STRUCT(a double, b integer, c varchar(60))[]';

const intTyp = {type: 'number', numberType: 'integer'};
const strTyp = {type: 'string'};
const dblType = {type: 'number', numberType: 'float'};

const PROFESSOR_SCHEMA =
  'STRUCT(professor_id UUID, "name" VARCHAR, age BIGINT, total_sections BIGINT)[]';
