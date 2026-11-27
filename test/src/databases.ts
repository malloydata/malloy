/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Every database the tests can run on, as data. `jest.config.ts` reads this
// file to build its projects, so it imports nothing. Each name here is also a
// connection in `malloy-config.json`, and the two must match exactly.
//
// The rules for which tests run where are in the Testing section of the
// repo-root CONTEXT.md.

export interface DatabaseEntry {
  /** The dialect its connection reports, known without connecting. */
  dialect: string;
  /**
   * What its connection's `canStream()` reports, known without connecting.
   * The first query checks it against the connection.
   */
  canStream: boolean;
  /** Glob, from the repo root, of the connection package tests it runs. */
  connectionTests?: string;
  /**
   * Globs, from `test/src`. If present, `dbtest` runs only the `db-all` files
   * matched.
   */
  dbAllPassing?: string[];
  /** Globs, from `test/src`. `dbtest` leaves out the `db-all` files matched. */
  dbAllSkip?: string[];
}

// A set names databases by what they are, never by what they can do.
// Capabilities belong in `test.when`.
export const databaseSets: Record<string, string[]> = {
  presto_trino: ['presto', 'trino'],
  duckdb_all: ['duckdb', 'duckdb_wasm'],
};

export const databases: Record<string, DatabaseEntry> = {
  // The stand-in: plain specs run on this one.
  duckdb: {
    dialect: 'duckdb',
    canStream: true,
    connectionTests: 'packages/malloy-db-duckdb/**',
  },
  duckdb_wasm: {
    dialect: 'duckdb',
    canStream: true,
    connectionTests: 'packages/malloy-db-duckdb/**',
  },
  motherduck: {
    dialect: 'duckdb',
    canStream: true,
    connectionTests: 'packages/malloy-db-duckdb/**',
  },
  bigquery: {
    dialect: 'standardsql',
    canStream: true,
    connectionTests: 'packages/malloy-db-bigquery/**',
  },
  postgres: {
    dialect: 'postgres',
    canStream: true,
    connectionTests: 'packages/malloy-db-postgres/**',
  },
  mysql: {
    dialect: 'mysql',
    canStream: false,
    connectionTests: 'packages/malloy-db-mysql/**',
  },
  snowflake: {
    dialect: 'snowflake',
    canStream: true,
    connectionTests: 'packages/malloy-db-snowflake/**',
  },
  trino: {
    dialect: 'trino',
    canStream: false,
    connectionTests: 'packages/malloy-db-trino/**',
  },
  presto: {
    dialect: 'presto',
    canStream: false,
    connectionTests: 'packages/malloy-db-trino/**',
  },
  databricks: {
    dialect: 'databricks',
    canStream: false,
    connectionTests: 'packages/malloy-db-databricks/**',
  },
  // Experimental. CI runs only the shared files it passes; none yet.
  sqlserver: {
    dialect: 'sqlserver',
    canStream: true,
    connectionTests: 'packages/malloy-db-sqlserver/**',
    dbAllPassing: [],
  },
  // The shared suite through DuckDB, against the test data loaded into SQL
  // Server.
  mssql_via_duckdb: {dialect: 'duckdb', canStream: true},
};
