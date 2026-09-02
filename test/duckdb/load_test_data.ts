/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

/*
 * Build the DuckDB test database, test/data/duckdb/duckdb_test.db, from the
 * parquet files.
 */

import * as fs from 'fs';
import * as path from 'path';
import {loadMalloytest, openDuckDB} from '../data/parquet_loader';

const databasePath = path.resolve(__dirname, '../data/duckdb/duckdb_test.db');

(async () => {
  if (fs.existsSync(databasePath)) {
    console.log(`Database at ${databasePath} already exists, removing`);
    fs.rmSync(databasePath);
  }
  console.log(`Creating database at ${databasePath}`);
  const loader = await openDuckDB(databasePath);
  await loadMalloytest(loader, 'malloytest');
  await loader.close();
})();
