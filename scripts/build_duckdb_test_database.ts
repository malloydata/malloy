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

// duckdb node bindings do not come with Typescript types, require is required
// https://github.com/duckdb/duckdb/tree/master/tools/nodejs
// eslint-disable-next-line @typescript-eslint/no-var-requires
import {DuckDBConnection} from '../packages/malloy-db-duckdb';

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
      `CREATE TABLE malloytest.numbers AS SELECT * FROM parquet_scan('${duckdbDir}numbers.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.state_facts AS SELECT * FROM parquet_scan('${parquetDir}state_facts.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.words AS SELECT * FROM parquet_scan('${duckdbDir}words.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.words_bigger AS SELECT * FROM parquet_scan('${duckdbDir}words_bigger.parquet')`
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
