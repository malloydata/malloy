/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

/*
 * The malloytest tables are the parquet files in test/data/malloytest-parquet,
 * one table per file. Each database's load_test_data script copies them into
 * that database through DuckDB, so the parquet is the only description of the
 * test data. See "Test Data" in test/CONTEXT.md.
 */

import type {QueryRecord} from '@malloydata/malloy';
import * as fs from 'fs';
import * as path from 'path';
import {DuckDBConnection} from '../../packages/malloy-db-duckdb';

export const parquetDir = path.resolve(__dirname, 'malloytest-parquet');

export function parquetTables(): string[] {
  return fs
    .readdirSync(parquetDir)
    .filter(file => file.endsWith('.parquet'))
    .map(file => file.slice(0, -'.parquet'.length))
    .sort();
}

export function parquetPath(table: string): string {
  return path.join(parquetDir, `${table}.parquet`);
}

export interface LoadPlan {
  /** Tables the target cannot hold at all */
  skip?: string[];
  /** Columns to leave out of a table, for types the target lacks */
  omit?: {table: string; columns: string[]}[];
}

/** The plan for a target with no array or record types */
export const scalarTypesOnly: LoadPlan = {
  skip: ['ga_sample'],
  omit: [{table: 'alltypes', columns: ['t_array_string', 't_array_int64']}],
};

/** A DuckDB session that runs SQL and returns the rows */
export interface TestDataDuckDB {
  run(sql: string): Promise<QueryRecord[]>;
  close(): Promise<void>;
}

/**
 * Malloy's own DuckDB connection, so a database is built by the same DuckDB
 * the tests read it with. That connection pins the session zone to UTC,
 * which a loader needs: the parquet timestamps are instants, and a target
 * without a zoned timestamp type must receive their UTC digits.
 */
export async function openDuckDB(
  databasePath = ':memory:'
): Promise<TestDataDuckDB> {
  const connection = new DuckDBConnection('loader', databasePath);
  return {
    run: async sql => (await connection.runRawSQL(sql)).rows,
    close: () => connection.close(),
  };
}

export async function loadExtension(
  db: TestDataDuckDB,
  extension: string,
  repository?: 'community'
): Promise<void> {
  const from = repository ? ` FROM ${repository}` : '';
  await db.run(`INSTALL ${extension}${from}`);
  await db.run(`LOAD ${extension}`);
}

/**
 * Replace `schema` with the malloytest tables. `schema` may live in an
 * attached database (`pg.malloytest`).
 */
export async function loadMalloytest(
  db: TestDataDuckDB,
  schema: string,
  plan: LoadPlan = {}
): Promise<void> {
  await db.run(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await db.run(`CREATE SCHEMA ${schema}`);
  for (const table of parquetTables()) {
    if (plan.skip?.includes(table)) {
      console.log(`  ${table}: skipped`);
      continue;
    }
    const omit = plan.omit?.find(o => o.table === table)?.columns ?? [];
    const columns =
      omit.length > 0
        ? `* EXCLUDE (${omit.map(c => `"${c}"`).join(', ')})`
        : '*';
    await db.run(
      `CREATE TABLE ${schema}.${table} AS SELECT ${columns} FROM read_parquet('${parquetPath(table)}')`
    );
    const rows = await db.run(`SELECT count(*) AS n FROM ${schema}.${table}`);
    console.log(`  ${table}: ${rows[0]['n']} rows`);
  }
}
