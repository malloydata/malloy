/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../test/src/runtimes';

/**
 * What to do when a dialect's standard test connection will not open. Keyed by
 * the dialect name `runtimeFor` accepts.
 */
const remedy = new Map<string, string>([
  [
    'bigquery',
    'Authorize application default credentials: gcloud auth application-default login',
  ],
  [
    'databricks',
    'Set DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_PATH (or DATABRICKS_WAREHOUSE_ID).',
  ],
  ['duckdb', 'Build the test fixture: npm run build-duckdb-db'],
  ['duckdb_wasm', 'Build the test fixture: npm run build-duckdb-db'],
  ['motherduck', 'Set TEST_MD_TOKEN to a MotherDuck service token.'],
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

async function check(dialect: string): Promise<void> {
  const runtime = runtimeFor(dialect);
  try {
    await runtime.connection.runSQL('SELECT 1');
  } finally {
    await runtime.connection.close();
  }
}

async function main(): Promise<void> {
  const dialects = process.argv.slice(2);
  if (dialects.length === 0) {
    console.error(
      'usage: check_dialect_connection <dialect> [dialect...]\n' +
        'Opens each dialect standard test connection and runs SELECT 1.'
    );
    process.exit(2);
  }

  const failures: string[] = [];
  for (const dialect of dialects) {
    try {
      await check(dialect);
      console.log(`${dialect}: connection ok`);
    } catch (error) {
      failures.push(dialect);
      console.error(
        `\n${dialect}: cannot reach the standard test connection.\n` +
          'This is a missing test environment, not a failing test. The tests ' +
          'that follow would fail for the same reason, so they were not run.\n' +
          `  To fix: ${remedy.get(dialect) ?? 'no known setup step for this dialect.'}\n` +
          `  Underlying error: ${error.message}`
      );
    }
  }
  process.exit(failures.length > 0 ? 1 : 0);
}

main();
