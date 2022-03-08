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
const duckdb = require("duckdb");

import fs from "fs";

const cwd = "./test/data/duckdb/";
const databasePath = `${cwd}duckdb_test.db`;
if (fs.existsSync(databasePath)) {
  console.log(`Database at ${databasePath} already exists, removing`);
  fs.rmSync(databasePath);
}

const database = new duckdb.Database(databasePath);

const run = (sql: string) => {
  return new Promise((resolve, reject) => {
    database.all(sql, (err: any, res: any) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
};

console.log(`Creating database at ${databasePath}`);

(async () => {
  try {
    await run(
      `CREATE TABLE aircraft AS SELECT * FROM parquet_scan('${cwd}aircraft.parquet')`
    );
    await run(
      `CREATE TABLE aircraft_models AS SELECT * FROM parquet_scan('${cwd}aircraft_models.parquet')`
    );
    await run(
      `CREATE TABLE airports AS SELECT * FROM parquet_scan('${cwd}airports.parquet')`
    );
    await run(
      `CREATE TABLE alltypes AS SELECT * FROM parquet_scan('${cwd}alltypes.parquet')`
    );
    await run(
      `CREATE TABLE alltypes2 AS SELECT * FROM parquet_scan('${cwd}alltypes2.parquet')`
    );
    await run(
      `CREATE TABLE bq_medicare_test AS SELECT * FROM parquet_scan('${cwd}bq_medicare_test.parquet')`
    );
    await run(
      `CREATE TABLE carriers AS SELECT * FROM parquet_scan('${cwd}carriers.parquet')`
    );
    await run(
      `CREATE TABLE flights AS SELECT * FROM parquet_scan('${cwd}flights.parquet')`
    );
    await run(
      `CREATE TABLE flights_partitioned AS SELECT * FROM parquet_scan('${cwd}flights_partitioned.parquet')`
    );
    await run(
      `CREATE TABLE numbers AS SELECT * FROM parquet_scan('${cwd}numbers.parquet')`
    );
    await run(
      `CREATE TABLE state_facts AS SELECT * FROM parquet_scan('${cwd}state_facts.parquet')`
    );
    await run(
      `CREATE TABLE words AS SELECT * FROM parquet_scan('${cwd}words.parquet')`
    );
    await run(
      `CREATE TABLE words_bigger AS SELECT * FROM parquet_scan('${cwd}words_bigger.parquet')`
    );
  } catch (e) {
    console.log(e);
  }
})();
