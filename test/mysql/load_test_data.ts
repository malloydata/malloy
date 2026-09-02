/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

/*
 * Load the malloytest tables into a running mysql from the parquet files.
 * Connects with the same MYSQL_* variables, read the same way, as the mysql
 * test connection.
 */

import {MySQLExecutor} from '../../packages/malloy-db-mysql';
import {
  loadExtension,
  loadMalloytest,
  openDuckDB,
  scalarTypesOnly,
} from '../data/parquet_loader';

const options = MySQLExecutor.getConnectionOptionsFromEnv();
const attach = [
  ...(options.host ? [`host=${options.host}`] : []),
  ...(options.port ? [`port=${options.port}`] : []),
  ...(options.user ? [`user=${options.user}`] : []),
  ...(options.password ? [`password=${options.password}`] : []),
  // The system database is always there; the load creates malloytest itself
  'database=mysql',
].join(' ');

(async () => {
  const db = await openDuckDB();
  await loadExtension(db, 'mysql');
  await db.run(`ATTACH '${attach}' AS my (TYPE mysql)`);
  console.log('Loading malloytest into mysql');
  await loadMalloytest(db, 'my.malloytest', scalarTypesOnly);
  await db.close();
})();
