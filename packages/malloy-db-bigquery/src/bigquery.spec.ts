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

import * as malloy from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';
import {BigQueryConnection} from './bigquery_connection';
import {BigQuery as BigQuerySDK, TableMetadata} from '@google-cloud/bigquery';
import * as util from 'util';
import * as fs from 'fs';
import {fileURLToPath} from 'url';

const [describe] = describeIfDatabaseAvailable(['bigquery']);

describe('db:BigQuery', () => {
  let bq: BigQueryConnection;
  let runtime: malloy.Runtime;

  beforeAll(() => {
    bq = new BigQueryConnection('test');
    const files = {
      readURL: async (url: URL) => {
        const filePath = fileURLToPath(url);
        return await util.promisify(fs.readFile)(filePath, 'utf8');
      },
    };
    runtime = new malloy.Runtime(files, bq);
  });

  it('runs a SQL query', async () => {
    const res = await bq.runSQL('SELECT 1 as t');
    expect(res.rows[0]['t']).toBe(1);
  });

  it('costs a SQL query', async () => {
    const res = await bq.estimateQueryCost(
      'SELECT * FROM malloydata-org.malloytest.airports'
    );
    expect(res.queryCostBytes).toBe(3029200);
  });

  it('gets table schema', async () => {
    const res = await bq.getTableFieldSchema(
      'malloydata-org.malloytest.carriers'
    );
    expect(res.schema).toStrictEqual({
      fields: [
        {name: 'code', type: 'STRING'},
        {name: 'name', type: 'STRING'},
        {name: 'nickname', type: 'STRING'},
      ],
    });
  });

  it.todo('gets table structdefs');

  it('runs a Malloy query', async () => {
    const sql = await runtime
      .loadModel(
        "source: carriers is bigquery.table('malloydata-org.malloytest.carriers') extend { measure: carrier_count is count() }"
      )
      .loadQuery('run: carriers -> { aggregate: carrier_count }')
      .getSQL();
    const res = await bq.runSQL(sql);
    expect(res.rows[0]['carrier_count']).toBe(21);
  });

  it('streams a Malloy query for download', async () => {
    const sql = await runtime
      .loadModel(
        "source: carriers is bigquery.table('malloydata-org.malloytest.carriers') extend { measure: carrier_count is count() }"
      )
      .loadQuery('run: carriers -> { group_by: name }')
      .getSQL();
    const res = await bq.downloadMalloyQuery(sql);

    return new Promise(resolve => {
      let count = 0;
      res.on('data', () => (count += 1));
      res.on('end', () => {
        expect(count).toBe(21);
        resolve(true);
      });
    });
  });

  it('manifests a temporary table', async () => {
    const fullTempTableName = await bq.manifestTemporaryTable('SELECT 1 as t');
    const splitTableName = fullTempTableName.split('.');
    const sdk = new BigQuerySDK();
    const dataset = sdk.dataset(splitTableName[1]);
    const table = dataset.table(splitTableName[2]);
    const exists = await table.exists();
    expect(exists).toBeTruthy();
  });

  const skipThisTestSetion = false; // describe.skip is not ok, given how we patch describe
  if (skipThisTestSetion) {
    describe.skip('manifests permanent table', () => {
      const datasetName = 'test_malloy_test_dataset';
      const tableName = 'test_malloy_test_table';
      const sdk = new BigQuerySDK();

      // delete entire dataset before each test and once tests are complete
      const deleteTestDataset = async () => {
        const dataset = sdk.dataset(datasetName);
        if ((await dataset.exists())[0]) {
          await dataset.delete({
            force: true,
          });
        }
      };
      beforeEach(deleteTestDataset);
      afterAll(deleteTestDataset);

      it('throws if dataset does not exist and createDataset=false', async () => {
        await expect(async () => {
          await bq.manifestPermanentTable(
            'SELECT 1 as t',
            datasetName,
            tableName,
            false,
            false
          );
        }).rejects.toThrowError(`Dataset ${datasetName} does not exist`);
      });

      it('creates dataset if createDataset=true', async () => {
        // note - dataset does not exist b/c of beforeEach()
        await bq.manifestPermanentTable(
          'SELECT 1 as t',
          datasetName,
          tableName,
          false,
          true
        );

        const dataset = sdk.dataset(datasetName);
        const [exists] = await dataset.exists();
        expect(exists).toBeTruthy();
      });

      it('throws if table exist and overwriteExistingTable=false', async () => {
        const newDatasetResponse = await sdk.createDataset(datasetName);
        const dataset = newDatasetResponse[0];
        const tableMeta: TableMetadata = {name: tableName};
        await dataset.createTable(tableName, tableMeta);

        await expect(async () => {
          await bq.manifestPermanentTable(
            'SELECT 1 as t',
            datasetName,
            tableName,
            false,
            true
          );
        }).rejects.toThrowError(`Table ${tableName} already exists`);
      });

      it('manifests a table', async () => {
        const jobId = await bq.manifestPermanentTable(
          'SELECT 1 as t',
          datasetName,
          tableName,
          false,
          true
        );

        // wait for job to complete
        const [job] = await sdk.job(jobId).get();
        let [metaData] = await job.getMetadata();
        while (metaData.status.state !== 'DONE') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          [metaData] = await job.getMetadata();
        }

        // query the new table
        const [queryJob] = await sdk.createQueryJob(
          `SELECT * FROM ${datasetName}.${tableName}`
        );
        const [results] = await queryJob.getQueryResults();
        expect(results[0]).toStrictEqual({t: 1});
      });
    });
  }

  describe('Caching', () => {
    let getTableFieldSchema: jest.SpyInstance;
    let getSQLBlockSchema: jest.SpyInstance;

    beforeEach(async () => {
      getTableFieldSchema = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(BigQueryConnection.prototype as any, 'getTableFieldSchema')
        .mockResolvedValue({
          schema: {},
          needsTableSuffixPseudoColumn: false,
          needsPartitionTimePseudoColumn: false,
          needsPartitionDatePseudoColumn: false,
        });
      getSQLBlockSchema = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(BigQueryConnection.prototype as any, 'getSQLBlockSchema')
        .mockResolvedValue({
          schema: {},
          needsTableSuffixPseudoColumn: false,
          needsPartitionTimePseudoColumn: false,
          needsPartitionDatePseudoColumn: false,
        });
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('caches table schema', async () => {
      await bq.fetchSchemaForTables({'test1': 'table1'}, {});
      expect(getTableFieldSchema).toBeCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await bq.fetchSchemaForTables({'test1': 'table1'}, {});
      expect(getTableFieldSchema).toBeCalledTimes(1);
    });

    it('refreshes table schema', async () => {
      await bq.fetchSchemaForTables({'test2': 'table2'}, {});
      expect(getTableFieldSchema).toBeCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await bq.fetchSchemaForTables(
        {'test2': 'table2'},
        {refreshTimestamp: Date.now() + 10}
      );
      expect(getTableFieldSchema).toBeCalledTimes(2);
    });

    it('caches sql schema', async () => {
      await bq.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
      expect(getSQLBlockSchema).toBeCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await bq.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
      expect(getSQLBlockSchema).toBeCalledTimes(1);
    });

    it('refreshes sql schema', async () => {
      await bq.fetchSchemaForSQLStruct(SQL_BLOCK_2, {});
      expect(getSQLBlockSchema).toBeCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await bq.fetchSchemaForSQLStruct(SQL_BLOCK_2, {
        refreshTimestamp: Date.now() + 10,
      });
      expect(getSQLBlockSchema).toBeCalledTimes(2);
    });
  });
});

const SQL_BLOCK_1: malloy.SQLSourceDef = {
  type: 'sql_select',
  name: 'block1',
  dialect: 'standardsql',
  connection: 'bigquery',
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

const SQL_BLOCK_2: malloy.SQLSourceDef = {
  type: 'sql_select',
  name: 'block2',
  dialect: 'standardsql',
  connection: 'bigquery',
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
