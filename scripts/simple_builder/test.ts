/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Integration test for the simple-builder build + gc workflow.
 * Run with: npx ts-node scripts/simple_builder/test.ts
 *
 * 1. Creates a model with two persist sources
 * 2. Runs build — expects 2 tables built
 * 3. Changes the model (drops one source, adds a new one)
 * 4. Runs build again — expects 1 exists + 1 built
 * 5. Runs gc — expects 1 table dropped (the removed source)
 * 6. Runs gc again — expects nothing to drop (idempotent)
 */

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, writeFile, mkdir, rm} from 'fs/promises';
import * as path from 'path';
import {build} from './build';
import {gc} from './gc';
import type {BuilderLog, GCLog, Log} from './log_types';
import type {Connection, BuildManifest} from '@malloydata/malloy';
import {Runtime, Manifest, EMPTY_BUILD_MANIFEST} from '@malloydata/malloy';
// eslint-disable-next-line n/no-extraneous-import
import {DuckDBConnection} from '@malloydata/db-duckdb';

const ROOT = path.resolve(__dirname, '../../.tmp/simple_builder_test');
const FLIGHTS_PARQUET = path.resolve(
  __dirname,
  '../../test/data/malloytest-parquet/flights.parquet'
);
const MODEL_FILE = path.join(ROOT, 'test.malloy');
const MANIFEST_FILE = path.join(ROOT, 'manifest.json');
const SQL_FILE = path.join(ROOT, 'output.sql');
const LOG_DIR = path.join(ROOT, 'logs');

async function readJSON<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf-8'));
}

async function readLogFiles(): Promise<Log[]> {
  const files = (await readdir(LOG_DIR))
    .filter(f => f.endsWith('.json'))
    .sort();
  const logs: Log[] = [];
  for (const f of files) {
    logs.push(await readJSON<Log>(path.join(LOG_DIR, f)));
  }
  return logs;
}

// Model v1: two persist sources
const MODEL_V1 = `##! experimental.persistence
source: flights is duckdb.table('${FLIGHTS_PARQUET}') extend {
  measure: flight_count is count()
}

#@ persist name=by_carrier
source: by_carrier is flights -> {
  group_by: carrier
  aggregate: flight_count
}

#@ persist name=by_origin
source: by_origin is flights -> {
  group_by: origin
  aggregate: flight_count
}
`;

// Model v2: drop by_origin, add by_destination
const MODEL_V2 = `##! experimental.persistence
source: flights is duckdb.table('${FLIGHTS_PARQUET}') extend {
  measure: flight_count is count()
}

#@ persist name=by_carrier
source: by_carrier is flights -> {
  group_by: carrier
  aggregate: flight_count
}

#@ persist name=by_destination
source: by_destination is flights -> {
  group_by: destination
  aggregate: flight_count
}
`;

function check(condition: boolean, msg: string): void {
  assert.ok(condition, msg);
  console.log(`  OK: ${msg}`);
}

test('build v1 → build v2 → gc → gc', async () => {
  // Setup
  await rm(ROOT, {recursive: true, force: true});
  await mkdir(ROOT, {recursive: true});

  try {
    // ── Step 1: Build v1 ──────────────────────────────────────────────
    console.log('\n=== Step 1: Build v1 ===');
    await writeFile(MODEL_FILE, MODEL_V1);
    await build({
      modelFile: MODEL_FILE,
      manifestFile: MANIFEST_FILE,
      sqlFile: SQL_FILE,
      logDir: LOG_DIR,
    });

    const manifest1 = await readJSON<BuildManifest>(MANIFEST_FILE);
    const names1 = Object.values(manifest1.entries).map(e => e.tableName);
    check(names1.includes('by_carrier'), 'manifest has by_carrier');
    check(names1.includes('by_origin'), 'manifest has by_origin');
    check(
      Object.keys(manifest1.entries).length === 2,
      'manifest has 2 entries'
    );

    const sql1 = await readFile(SQL_FILE, 'utf-8');
    check(
      sql1.includes('CREATE TABLE by_carrier'),
      'SQL has CREATE TABLE by_carrier'
    );
    check(
      sql1.includes('CREATE TABLE by_origin'),
      'SQL has CREATE TABLE by_origin'
    );

    const logs1 = await readLogFiles();
    check(logs1.length === 1, '1 log file after build v1');
    const buildLog1 = logs1[0] as BuilderLog;
    check(buildLog1.type === 'build', 'log is a build log');
    check(buildLog1.entries.length === 2, 'build log has 2 entries');
    check(
      buildLog1.entries.every(e => e.action === 'built'),
      'all entries are "built"'
    );

    // ── Step 2: Build v2 ──────────────────────────────────────────────
    console.log('\n=== Step 2: Build v2 ===');
    await writeFile(MODEL_FILE, MODEL_V2);
    await build({
      modelFile: MODEL_FILE,
      manifestFile: MANIFEST_FILE,
      sqlFile: SQL_FILE,
      logDir: LOG_DIR,
    });

    const manifest2 = await readJSON<BuildManifest>(MANIFEST_FILE);
    const names2 = Object.values(manifest2.entries).map(e => e.tableName);
    check(names2.includes('by_carrier'), 'manifest still has by_carrier');
    check(names2.includes('by_destination'), 'manifest has by_destination');
    check(!names2.includes('by_origin'), 'manifest no longer has by_origin');
    check(
      Object.keys(manifest2.entries).length === 2,
      'manifest has 2 entries'
    );

    const sql2 = await readFile(SQL_FILE, 'utf-8');
    check(
      sql2.includes('CREATE TABLE by_destination'),
      'SQL has CREATE TABLE by_destination'
    );
    check(
      !sql2.includes('CREATE TABLE by_carrier'),
      'SQL does not re-create by_carrier (it existed)'
    );

    const logs2 = await readLogFiles();
    check(logs2.length === 2, '2 log files after build v2');
    const buildLog2 = logs2[1] as BuilderLog;
    check(buildLog2.type === 'build', 'second log is a build log');
    const exists2 = buildLog2.entries.filter(e => e.action === 'exists');
    const built2 = buildLog2.entries.filter(e => e.action === 'built');
    check(exists2.length === 1, '1 exists entry');
    check(exists2[0].tableName === 'by_carrier', 'exists entry is by_carrier');
    check(built2.length === 1, '1 built entry');
    check(
      built2[0].tableName === 'by_destination',
      'built entry is by_destination'
    );

    // ── Step 3: GC ───────────────────────────────────────────────────
    console.log('\n=== Step 3: GC ===');
    const gcSqlFile = path.join(ROOT, 'gc.sql');
    await gc(LOG_DIR, gcSqlFile);

    const gcSql = await readFile(gcSqlFile, 'utf-8');
    check(
      gcSql.includes('DROP TABLE IF EXISTS by_origin'),
      'GC SQL drops by_origin'
    );
    check(!gcSql.includes('by_carrier'), 'GC SQL does not touch by_carrier');
    check(
      !gcSql.includes('by_destination'),
      'GC SQL does not touch by_destination'
    );

    const logs3 = await readLogFiles();
    const gcLogs = logs3.filter(l => l.type === 'gc');
    check(gcLogs.length === 1, '1 GC log written');
    const gcLog = gcLogs[0] as GCLog;
    check(gcLog.entries.length === 1, 'GC log has 1 entry');
    check(gcLog.entries[0].action === 'dropped', 'GC entry action is dropped');
    check(gcLog.entries[0].tableName === 'by_origin', 'GC dropped by_origin');

    // ── Step 4: GC again (idempotent) ────────────────────────────────
    console.log('\n=== Step 4: GC again (should be no-op) ===');
    const gcSqlFile2 = path.join(ROOT, 'gc2.sql');
    await gc(LOG_DIR, gcSqlFile2);

    const logs4 = await readLogFiles();
    const gcLogs2 = logs4.filter(l => l.type === 'gc');
    check(gcLogs2.length === 1, 'still only 1 GC log (no new drops)');

    console.log('\n=== All checks passed ===');
  } finally {
    await rm(ROOT, {recursive: true, force: true});
  }
});

/**
 * Test that a query against a persist source produces the same results
 * with and without a manifest, and that the manifest version's SQL
 * references the persisted table name instead of inlining the query.
 */
test('runtime queries with and without manifest', async () => {
  await rm(ROOT, {recursive: true, force: true});
  await mkdir(ROOT, {recursive: true});

  try {
    // Build v1 to get manifest and SQL
    await writeFile(MODEL_FILE, MODEL_V1);
    await build({
      modelFile: MODEL_FILE,
      manifestFile: MANIFEST_FILE,
      sqlFile: SQL_FILE,
      logDir: LOG_DIR,
    });

    // Create a DuckDB connection and materialize the persisted tables
    const connection = new DuckDBConnection({
      name: 'duckdb',
      databasePath: ':memory:',
      workingDirectory: path.dirname(MODEL_FILE),
    });
    await connection.runSQL(
      `CREATE TABLE flights AS SELECT * FROM parquet_scan('${FLIGHTS_PARQUET}')`
    );

    // Execute build SQL to create by_carrier and by_origin tables
    const buildSql = await readFile(SQL_FILE, 'utf-8');
    for (const stmt of buildSql.split(';\n').filter(s => s.trim())) {
      await connection.runRawSQL(stmt);
    }

    const urlReader = {
      readURL: async (url: URL) => readFile(url.pathname, 'utf-8'),
    };
    const connections = {
      lookupConnection: async (name?: string): Promise<Connection> => {
        if (!name || name === 'duckdb') return connection;
        throw new Error(`Unknown connection: ${name}`);
      },
    };

    // Load the build manifest and set it on the runtime
    const manifest = new Manifest();
    manifest.loadText(await readFile(MANIFEST_FILE, 'utf-8'));

    const runtime = new Runtime({
      connections,
      urlReader,
    });
    runtime.buildManifest = manifest.buildManifest;

    // Model with a query appended
    const modelWithQuery = MODEL_V1 + '\nrun: by_carrier -> { select: * }\n';

    // Two query materializers: manifest from runtime, and explicitly empty
    const queryWithManifest = runtime.loadQuery(modelWithQuery);
    const queryPlain = runtime.loadQuery(modelWithQuery, {
      buildManifest: EMPTY_BUILD_MANIFEST,
    });

    // ── SQL comparison ─────────────────────────────────────────────
    // The manifest SQL should reference the persisted table directly
    // (FROM by_carrier) while the plain SQL inlines the query (FROM (SELECT ...).
    console.log('\n=== Runtime: SQL comparison ===');
    const sqlManifest = await queryWithManifest.getSQL();
    const sqlPlain = await queryPlain.getSQL();

    // Manifest SQL reads directly from the persisted table;
    // plain SQL inlines the query as a CTE.
    const fromTable = /FROM\s+by_carrier\s/;
    check(fromTable.test(sqlManifest), 'manifest SQL has FROM by_carrier');
    check(!fromTable.test(sqlPlain), 'plain SQL does not have FROM by_carrier');

    // ── Data comparison ────────────────────────────────────────────
    console.log('\n=== Runtime: data comparison ===');
    const resultManifest = await runtime.loadQuery(modelWithQuery).run();
    const resultPlain = await runtime
      .loadQuery(modelWithQuery, {buildManifest: EMPTY_BUILD_MANIFEST})
      .run();

    const dataPlain = resultPlain.data.toObject();
    const dataManifest = resultManifest.data.toObject();

    check(dataPlain.length > 0, 'results are not empty');
    check(
      dataPlain.length === dataManifest.length,
      `same number of rows (${dataPlain.length})`
    );

    // Sort both by carrier and compare row-by-row
    type Row = {carrier: string; flight_count: number};
    const sortByCarrier = (a: Row, b: Row) =>
      a.carrier.localeCompare(b.carrier);
    const rowsPlain = (dataPlain as Row[]).sort(sortByCarrier);
    const rowsManifest = (dataManifest as Row[]).sort(sortByCarrier);

    for (let i = 0; i < rowsPlain.length; i++) {
      check(
        rowsPlain[i].carrier === rowsManifest[i].carrier &&
          rowsPlain[i].flight_count === rowsManifest[i].flight_count,
        `row ${i}: ${rowsPlain[i].carrier} = ${rowsPlain[i].flight_count}`
      );
    }

    await connection.close();
    console.log('\n=== Runtime query checks passed ===');
  } finally {
    await rm(ROOT, {recursive: true, force: true});
  }
});
