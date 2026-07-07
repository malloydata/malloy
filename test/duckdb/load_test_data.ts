/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

import {DuckDBConnection} from '../../packages/malloy-db-duckdb';

import fs from 'fs';

const parquetDir = './test/data/malloytest-parquet/';
const duckdbDir = './test/data/duckdb/';
const databasePath = `${duckdbDir}duckdb_test.db`;
if (fs.existsSync(databasePath)) {
  console.log(`Database at ${databasePath} already exists, removing`);
  fs.rmSync(databasePath);
}

const database = new DuckDBConnection('duckdb', databasePath);

const run = (sql: string) => {
  return database.runRawSQL(sql);
};

console.log(`Creating database at ${databasePath}`);

(async () => {
  try {
    await run('CREATE SCHEMA malloytest');
    await run(
      `CREATE TABLE malloytest.aircraft AS SELECT * FROM parquet_scan('${parquetDir}aircraft.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.aircraft_models AS SELECT * FROM parquet_scan('${parquetDir}aircraft_models.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.airports AS SELECT * FROM parquet_scan('${parquetDir}airports.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.alltypes AS SELECT * FROM parquet_scan('${parquetDir}alltypes.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.carriers AS SELECT * FROM parquet_scan('${parquetDir}carriers.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.flights AS SELECT * FROM parquet_scan('${parquetDir}flights.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.state_facts AS SELECT * FROM parquet_scan('${parquetDir}state_facts.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.ga_sample AS SELECT * FROM parquet_scan('${parquetDir}ga_sample.parquet')`
    );
    console.log('Finished populating database with data from parqeut files');
  } catch (e) {
    console.log(e);
  }

  await database.close();
})();
