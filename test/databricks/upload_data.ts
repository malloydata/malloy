/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

/**
 * Upload test parquet files to Databricks and create tables.
 *
 * Reads env vars:
 *   DATABRICKS_HOST       — e.g. adb-1234567890.12.azuredatabricks.net
 *   DATABRICKS_TOKEN      — personal access token
 *   DATABRICKS_WAREHOUSE_ID — SQL warehouse ID (for DDL)
 *   DATABRICKS_CATALOG    — Unity Catalog name (e.g. malloy_ci)
 *
 * Run manually:
 *   npx tsx test/databricks/upload_data.ts
 */

import {readFile} from 'fs/promises';
import * as path from 'path';
// eslint-disable-next-line n/no-extraneous-import
import {DBSQLClient, DBSQLLogger, LogLevel} from '@databricks/sql';

const PARQUET_DIR = path.resolve(__dirname, '../data/malloytest-parquet');

const TABLES = [
  'aircraft',
  'aircraft_models',
  'airports',
  'alltypes',
  'carriers',
  'flights',
  'ga_sample',
  'state_facts',
];

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

async function main() {
  const host = requireEnv('DATABRICKS_HOST');
  const token = requireEnv('DATABRICKS_TOKEN');
  const warehouseId = requireEnv('DATABRICKS_WAREHOUSE_ID');
  const catalog = requireEnv('DATABRICKS_CATALOG');

  const schema = 'malloytest';
  const volume = 'test_data';

  // Connect
  const logger = new DBSQLLogger({level: LogLevel.error});
  const client = new DBSQLClient({logger});
  await client.connect({
    host,
    path: `/sql/1.0/warehouses/${warehouseId}`,
    token,
  });
  const session = await client.openSession({
    initialCatalog: catalog,
  });

  console.log(`Connected to ${host}, catalog: ${catalog}`);

  async function runSQL(sql: string): Promise<void> {
    const op = await session.executeStatement(sql, {runAsync: true});
    await op.fetchAll();
    await op.close();
  }

  // Create schema and volume
  console.log(`Creating schema ${catalog}.${schema}...`);
  await runSQL(`CREATE SCHEMA IF NOT EXISTS ${catalog}.${schema}`);

  console.log(`Creating volume ${catalog}.${schema}.${volume}...`);
  await runSQL(`CREATE VOLUME IF NOT EXISTS ${catalog}.${schema}.${volume}`);

  // Upload parquet files and create tables
  for (const table of TABLES) {
    const filename = `${table}.parquet`;
    const localPath = path.join(PARQUET_DIR, filename);
    const volumePath = `/Volumes/${catalog}/${schema}/${volume}/${filename}`;

    // Upload file via REST API
    console.log(`Uploading ${filename}...`);
    const body = new Uint8Array(await readFile(localPath));
    const uploadUrl = `https://${host}/api/2.0/fs/files${volumePath}`;
    const resp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body,
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(
        `Upload failed for ${filename}: ${resp.status} ${errBody}`
      );
    }

    // Create table from uploaded parquet
    console.log(`Creating table ${catalog}.${schema}.${table}...`);
    await runSQL(
      `CREATE OR REPLACE TABLE ${catalog}.${schema}.${table} AS SELECT * FROM read_files('${volumePath}')`
    );
  }

  await session.close();
  await client.close();

  console.log('\nDone. All tables created successfully.');
}

main().catch(err => {
  throw err;
});
