/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabaseNamed} from '../test/src/test_database';

/**
 * What to do when a database's standard test connection will not open. Keyed by
 * the database's name in test/src/databases.ts.
 */
const remedy = new Map<string, string>([
  [
    'bigquery',
    'Authorize application default credentials: gcloud auth application-default login',
  ],
  ['databricks', 'Set DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_PATH.'],
  ['duckdb', 'Build the test fixture: npm run build-duckdb-db'],
  ['duckdb_wasm', 'Build the test fixture: npm run build-duckdb-db'],
  ['motherduck', 'Set MOTHERDUCK_TOKEN to a MotherDuck service token.'],
  ['mssql_via_duckdb', 'Start the server: sh test/mssql/mssql_start.sh'],
  ['mysql', 'Start the server: sh test/mysql/mysql_start.sh'],
  ['sqlserver', 'Start the server: sh test/mssql/mssql_start.sh'],
  ['postgres', 'Start the server: sh test/postgres/postgres_start.sh'],
  ['presto', 'Start the server: sh test/presto/presto_start.sh'],
  [
    'snowflake',
    'Configure a Snowflake connection profile for the Snowflake SDK, or set the SNOWFLAKE_* environment variables.',
  ],
  ['trino', 'Start the server: sh test/trino/trino_start.sh'],
]);

async function check(name: string): Promise<void> {
  const database = testDatabaseNamed(name);
  try {
    await (await database.connection()).runSQL('SELECT 1');
  } finally {
    await database.shutdown();
  }
}

async function main(): Promise<void> {
  const databases = process.argv.slice(2);
  if (databases.length === 0) {
    console.error(
      'usage: check_dialect_connection <database> [database...]\n' +
        'Opens the test connection of each database and runs SELECT 1.'
    );
    process.exit(2);
  }

  const failures: string[] = [];
  for (const database of databases) {
    try {
      await check(database);
      console.log(`${database}: connection ok`);
    } catch (error) {
      failures.push(database);
      console.error(
        `\n${database}: cannot reach the standard test connection.\n` +
          'This is a missing test environment, not a failing test. The tests ' +
          'that follow would fail for the same reason, so they were not run.\n' +
          `  To fix: ${remedy.get(database) ?? 'no known setup step for this database.'}\n` +
          `  Underlying error: ${error.message}`
      );
    }
  }
  process.exit(failures.length > 0 ? 1 : 0);
}

main();
