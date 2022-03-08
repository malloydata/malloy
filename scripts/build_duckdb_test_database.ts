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

console.log(`Creating database at ${databasePath}, this may take some time`);

(async () => {
  try {
    await run(
      `CREATE TABLE aircraft AS SELECT * FROM '${cwd}aircraft.parquet'`
    );
    await run(
      `CREATE TABLE aircraft_models AS SELECT * FROM '${cwd}aircraft_models.parquet'`
    );
    await run(
      `CREATE TABLE airports AS SELECT * FROM '${cwd}airports.parquet'`
    );
    await run(
      `CREATE TABLE carriers AS SELECT * FROM '${cwd}carriers.parquet'`
    );
    await run(
      `CREATE TABLE flights AS SELECT * FROM parquet_scan([
        '${cwd}flights-000000000000.parquet',
        '${cwd}flights-000000000001.parquet',
        '${cwd}flights-000000000002.parquet',
        '${cwd}flights-000000000003.parquet',
        '${cwd}flights-000000000004.parquet',
        '${cwd}flights-000000000005.parquet',
        '${cwd}flights-000000000006.parquet',
        '${cwd}flights-000000000007.parquet',
        '${cwd}flights-000000000008.parquet',
        '${cwd}flights-000000000009.parquet'
      ]);`
    );
  } catch (e) {
    console.log(e);
  }
})();
