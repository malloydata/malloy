/* eslint-disable no-console, n/no-process-exit */
import {DatabricksConnection} from '@malloydata/db-databricks/src/databricks_connection';
// eslint-disable-next-line n/no-extraneous-import
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({path: path.join(__dirname, '../../.env')});

async function main() {
  const warehouseId = process.env['DATABRICKS_WAREHOUSE_ID'];
  const dbPath =
    process.env['DATABRICKS_PATH'] ||
    (warehouseId ? `/sql/1.0/warehouses/${warehouseId}` : '');
  const conn = new DatabricksConnection('databricks', {
    host: process.env['DATABRICKS_HOST'] || '',
    path: dbPath,
    token: process.env['DATABRICKS_TOKEN'],
    defaultCatalog: process.env['DATABRICKS_CATALOG'],
    defaultSchema: process.env['DATABRICKS_SCHEMA'],
  });

  const sql = process.argv[2];
  if (!sql) {
    console.error(
      'Usage: npx ts-node test/databricks/diag_databricks.ts "SELECT ..."'
    );
    process.exit(1);
  }

  try {
    const result = await conn.runSQL(sql);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (e: unknown) {
    console.error('Error:', (e as Error).message);
  }
}

main();
