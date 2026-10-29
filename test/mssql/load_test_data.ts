/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

/*
 * Load the malloytest tables into a running SQL Server from the parquet
 * files, through DuckDB's mssql extension. Connects as the mssql test
 * connection does. Waits for the server first, since the container image
 * ships no client to wait with.
 */

import {
  loadExtension,
  loadMalloytest,
  openDuckDB,
  scalarTypesOnly,
} from '../data/parquet_loader';
import {mssqlConnectionString} from './connection_string';

const database = 'malloytest';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const db = await openDuckDB();
  await loadExtension(db, 'mssql', 'community');

  // Attach the always-present master database, retrying while the server
  // comes up, then recreate the test database from scratch.
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      await db.run(
        `ATTACH '${mssqlConnectionString('master')}' AS ms (TYPE mssql)`
      );
      break;
    } catch (e) {
      if (Date.now() > deadline) {
        throw e;
      }
      const reason = e instanceof Error ? e.message.split('\n')[0] : `${e}`;
      console.log(`  waiting for SQL Server: ${reason}`);
      await sleep(2000);
    }
  }
  await db.run(
    `SELECT mssql_exec('ms', 'IF DB_ID(''${database}'') IS NOT NULL DROP DATABASE ${database}')`
  );
  await db.run(`SELECT mssql_exec('ms', 'CREATE DATABASE ${database}')`);
  await db.run('DETACH ms');
  await db.run(
    `ATTACH '${mssqlConnectionString(database)}' AS ms (TYPE mssql)`
  );

  console.log('Loading malloytest into mssql');
  await loadMalloytest(db, `ms.${database}`, scalarTypesOnly);
  await db.close();
})();
