/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

/* eslint-disable no-console */

// duckdb node bindings do not come with Typescript types, require is required
// https://github.com/duckdb/duckdb/tree/master/tools/nodejs
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { DuckDBConnection } from "@malloydata/db-duckdb";

import fs from "fs";

const cwd = "./test/data/duckdb/";
const databasePath = `${cwd}duckdb_test.db`;
if (fs.existsSync(databasePath)) {
  console.log(`Database at ${databasePath} already exists, removing`);
  fs.rmSync(databasePath);
}

const database = new DuckDBConnection("duckdb", databasePath);

const run = (sql: string) => {
  return database.runRawSQL(sql);
};

console.log(`Creating database at ${databasePath}`);

(async () => {
  try {
    await run(`CREATE SCHEMA malloytest`);
    await run(
      `CREATE TABLE malloytest.aircraft AS SELECT * FROM parquet_scan('${cwd}aircraft.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.aircraft_models AS SELECT * FROM parquet_scan('${cwd}aircraft_models.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.airports AS SELECT * FROM parquet_scan('${cwd}airports.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.alltypes AS SELECT * FROM parquet_scan('${cwd}alltypes.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.alltypes2 AS SELECT * FROM parquet_scan('${cwd}alltypes2.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.bq_medicare_test AS SELECT * FROM parquet_scan('${cwd}bq_medicare_test.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.carriers AS SELECT * FROM parquet_scan('${cwd}carriers.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.flights AS SELECT * FROM parquet_scan('${cwd}flights.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.numbers AS SELECT * FROM parquet_scan('${cwd}numbers.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.state_facts AS SELECT * FROM parquet_scan('${cwd}state_facts.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.words AS SELECT * FROM parquet_scan('${cwd}words.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.words_bigger AS SELECT * FROM parquet_scan('${cwd}words_bigger.parquet')`
    );
    await run(
      `CREATE TABLE malloytest.ga_sample AS SELECT * FROM parquet_scan('${cwd}ga_sample.parquet')`
    );
  } catch (e) {
    console.log(e);
  }

  await database.close();
})();
