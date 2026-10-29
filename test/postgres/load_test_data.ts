/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

/*
 * Load the malloytest tables into a running postgres from the parquet files.
 * Connects the way psql and the postgres test connection do, through libpq's
 * PG* variables, which the extension reads when the attach string is empty.
 */

import {
  loadExtension,
  loadMalloytest,
  openDuckDB,
} from '../data/parquet_loader';

(async () => {
  const db = await openDuckDB();
  await loadExtension(db, 'postgres');
  await db.run("ATTACH '' AS pg (TYPE postgres)");
  // The sampling tests use TABLESAMPLE SYSTEM_ROWS
  await db.run(
    "CALL postgres_execute('pg', 'CREATE EXTENSION IF NOT EXISTS tsm_system_rows')"
  );
  console.log('Loading malloytest into postgres');
  await loadMalloytest(db, 'pg.malloytest', {
    // Postgres has no anonymous record type for the nested columns
    skip: ['ga_sample'],
  });
  await db.close();
})();
