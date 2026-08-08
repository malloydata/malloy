/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Runs the teaching builder in `build.ts` end to end. It exists to keep that
 * file honest: it is cited as documentation, so a claim it makes that stops
 * being true has to fail here rather than quietly mislead the next reader.
 *
 * Each test names the invariant it pins in its doc comment.
 */

import assert from 'node:assert/strict';
import {readFile, readdir, writeFile, mkdir, rm} from 'fs/promises';
import * as path from 'path';
import {fileURLToPath} from 'url';
import {build} from './build';
import {gc} from './gc';
import type {BuilderLog, GCLog, Log} from './log_types';
import type {Connection, BuildManifest} from '@malloydata/malloy';
import {Runtime, Manifest, EMPTY_BUILD_MANIFEST} from '@malloydata/malloy';

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

const BUILD_OPTS = {
  modelFile: MODEL_FILE,
  manifestFile: MANIFEST_FILE,
  sqlFile: SQL_FILE,
  logDir: LOG_DIR,
};

const FLIGHTS = `##! experimental.persistence
source: flights is duckdb.table('${FLIGHTS_PARQUET}') extend {
  measure: flight_count is count()
}
`;

/** Two independent persist sources. */
const MODEL_V1 = `${FLIGHTS}
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

/** by_origin dropped, by_destination added — leaves by_origin orphaned. */
const MODEL_V2 = `${FLIGHTS}
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

/**
 * A chain. top_carriers reads by_carrier, so by_carrier is not a root: the
 * build plan carries it only in top_carriers' `dependsOn`.
 */
const MODEL_V3 = `${FLIGHTS}
#@ persist name=by_carrier
source: by_carrier is flights -> {
  group_by: carrier
  aggregate: flight_count
}

#@ persist name=top_carriers
source: top_carriers is by_carrier -> {
  select: *
  order_by: flight_count desc
  limit: 10
}
`;

/**
 * A name DuckDB accepts only in quoted form, so `sqlValidateTableName`
 * canonicalizes it to `'carriers-out.parquet'`. Quoted in the annotation
 * because MOTLY ends a bare value at the `-`.
 */
const MODEL_V4 = `${FLIGHTS}
#@ persist name="carriers-out.parquet"
source: by_carrier is flights -> {
  group_by: carrier
  aggregate: flight_count
}
`;

/**
 * An extension of a persisted source. It inherits `#@ persist` and does not
 * change the SQL, so it is a second name for the same table.
 */
const MODEL_V6 = `${FLIGHTS}
#@ persist name=by_carrier
source: by_carrier is flights -> {
  group_by: carrier
  aggregate: flight_count
}

source: enriched is by_carrier extend {
  dimension: loud_carrier is upper(carrier)
}

run: enriched -> { select: * }
`;

/** Two names for one computation — a request the builder cannot honor. */
const MODEL_V7 = `${FLIGHTS}
#@ persist name=by_carrier
source: by_carrier is flights -> {
  group_by: carrier
  aggregate: flight_count
}

#@ persist name=also_by_carrier
source: also_by_carrier is by_carrier
`;

/**
 * A name no dialect can express. Grouped by origin so its BuildID differs
 * from V4's — a source already in the manifest is touched without its name
 * being revisited.
 */
const MODEL_V5 = `${FLIGHTS}
#@ persist name="not a table name"
source: by_origin is flights -> {
  group_by: origin
  aggregate: flight_count
}
`;

async function readJSON<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf-8'));
}

/** Every log file in the directory, oldest first (filenames are timestamps). */
async function readLogFiles(): Promise<Log[]> {
  const files = (await readdir(LOG_DIR))
    .filter(f => f.endsWith('.json'))
    .sort();
  return Promise.all(files.map(f => readJSON<Log>(path.join(LOG_DIR, f))));
}

async function buildLogAt(index: number): Promise<BuilderLog> {
  const log = (await readLogFiles())[index];
  if (log.type !== 'build') {
    throw new Error(`log ${index} is a ${log.type} log, expected a build log`);
  }
  return log;
}

function tableNames(manifest: BuildManifest): string[] {
  return Object.values(manifest.entries).map(e => e.tableName);
}

function check(condition: boolean, msg: string): void {
  assert.ok(condition, msg);
}

async function freshRoot(): Promise<void> {
  await rm(ROOT, {recursive: true, force: true});
  await mkdir(ROOT, {recursive: true});
}

/**
 * The incremental cycle: build, change the model, rebuild, collect.
 *
 * Pins that `activeEntries` is what prunes (a source dropped from the model
 * leaves the manifest) and that GC drops exactly the tables that pruning
 * orphaned — no more, and not twice.
 */
test('build → rebuild → gc → gc', async () => {
  await freshRoot();

  try {
    await writeFile(MODEL_FILE, MODEL_V1);
    await build(BUILD_OPTS);

    const manifest1 = await readJSON<BuildManifest>(MANIFEST_FILE);
    check(
      tableNames(manifest1).sort().join() === 'by_carrier,by_origin',
      'both sources are in the manifest'
    );

    const sql1 = await readFile(SQL_FILE, 'utf-8');
    check(
      sql1.includes('CREATE TABLE by_carrier') &&
        sql1.includes('CREATE TABLE by_origin'),
      'SQL creates both tables'
    );

    const log1 = await buildLogAt(0);
    check(
      log1.entries.length === 2 &&
        log1.entries.every(e => e.action === 'built'),
      'both sources were built'
    );

    // V2 drops by_origin and adds by_destination. by_carrier is unchanged, so
    // its BuildID still matches and it is touched rather than rebuilt.
    await writeFile(MODEL_FILE, MODEL_V2);
    await build(BUILD_OPTS);

    const manifest2 = await readJSON<BuildManifest>(MANIFEST_FILE);
    check(
      tableNames(manifest2).sort().join() === 'by_carrier,by_destination',
      'the dropped source is pruned from the manifest'
    );

    const sql2 = await readFile(SQL_FILE, 'utf-8');
    check(
      sql2.includes('CREATE TABLE by_destination') &&
        !sql2.includes('CREATE TABLE by_carrier'),
      'only the new source is rebuilt'
    );

    const log2 = await buildLogAt(1);
    const exists2 = log2.entries.filter(e => e.action === 'exists');
    const built2 = log2.entries.filter(e => e.action === 'built');
    check(
      exists2.length === 1 && exists2[0].tableName === 'by_carrier',
      'by_carrier was touched, not rebuilt'
    );
    check(
      built2.length === 1 && built2[0].tableName === 'by_destination',
      'by_destination was built'
    );

    // GC reads the log history, not the manifest: the pruned manifest no
    // longer names by_origin, so only the history knows there is a table to
    // drop.
    const gcSqlFile = path.join(ROOT, 'gc.sql');
    await gc(LOG_DIR, gcSqlFile);

    const gcSql = await readFile(gcSqlFile, 'utf-8');
    check(
      gcSql.includes('DROP TABLE IF EXISTS by_origin') &&
        !gcSql.includes('by_carrier') &&
        !gcSql.includes('by_destination'),
      'GC drops only the orphaned table'
    );

    const gcLogs = (await readLogFiles()).filter(l => l.type === 'gc');
    check(gcLogs.length === 1, 'one GC log written');
    const gcLog = gcLogs[0] as GCLog;
    check(
      gcLog.entries.length === 1 &&
        gcLog.entries[0].action === 'dropped' &&
        gcLog.entries[0].tableName === 'by_origin',
      'GC log records the drop'
    );

    // The GC log is what makes a second pass a no-op.
    await gc(LOG_DIR, path.join(ROOT, 'gc2.sql'));
    check(
      (await readLogFiles()).filter(l => l.type === 'gc').length === 1,
      'a second GC finds nothing to drop'
    );
  } finally {
    await rm(ROOT, {recursive: true, force: true});
  }
});

/**
 * A persist source that depends on another persist source.
 *
 * Pins that a dependency is built, built *first*, and read from rather than
 * inlined. A builder that skipped it would still produce correct results — the
 * dependent would inline the computation — so the only thing that catches the
 * mistake is the table's absence from the manifest, and then a later GC
 * dropping a table the built source reads from.
 */
test('build a dependency chain', async () => {
  await freshRoot();

  try {
    await writeFile(MODEL_FILE, MODEL_V3);
    await build(BUILD_OPTS);

    const manifest = await readJSON<BuildManifest>(MANIFEST_FILE);
    check(
      tableNames(manifest).sort().join() === 'by_carrier,top_carriers',
      'the dependency and the dependent are both in the manifest'
    );

    const log = await buildLogAt(0);
    check(
      log.entries.length === 2 && log.entries.every(e => e.action === 'built'),
      'both sources were built'
    );

    const sql = await readFile(SQL_FILE, 'utf-8');
    const depAt = sql.indexOf('CREATE TABLE by_carrier');
    const dependentAt = sql.indexOf('CREATE TABLE top_carriers');
    check(depAt >= 0 && dependentAt >= 0, 'SQL creates both tables');
    check(depAt < dependentAt, 'the dependency is created first');
    check(
      /from\s+by_carrier/i.test(sql.slice(dependentAt)),
      'the dependent reads FROM the dependency, rather than inlining it'
    );

    // Nothing changed, so both entries must be recognized and touched. A
    // skipped dependency would fall out of activeEntries and GC would drop a
    // table top_carriers still reads.
    await build(BUILD_OPTS);
    const rebuild = await buildLogAt(1);
    check(
      rebuild.entries.length === 2 &&
        rebuild.entries.every(e => e.action === 'exists'),
      'both entries survive a rebuild'
    );
  } finally {
    await rm(ROOT, {recursive: true, force: true});
  }
});

/**
 * Several sources, one table — the case a builder walking *sources* gets
 * wrong.
 *
 * `enriched` extends `by_carrier`, so it is persistent and shares its SQL,
 * its BuildID, and its `name=`. There is one table to build. A builder that
 * iterated sources would issue the same CREATE TABLE twice, and one that
 * keyed a forced rebuild on the table name would drop and recreate it once
 * per name.
 */
test('an extension of a persisted source is the same table', async () => {
  await freshRoot();

  try {
    await writeFile(MODEL_FILE, MODEL_V6);
    await build(BUILD_OPTS);

    const manifest = await readJSON<BuildManifest>(MANIFEST_FILE);
    check(
      Object.keys(manifest.entries).length === 1 &&
        tableNames(manifest).join() === 'by_carrier',
      'one entry, one table'
    );

    const sql = await readFile(SQL_FILE, 'utf-8');
    check(
      sql.split('CREATE TABLE').length - 1 === 1,
      'the table is created once'
    );

    const log = await buildLogAt(0);
    check(log.entries.length === 1, 'one thing was built');
  } finally {
    await rm(ROOT, {recursive: true, force: true});
  }
});

/**
 * Two names for one computation. The core reports both and takes no
 * position — a name means nothing to it — so refusing is the builder's call,
 * and this sample refuses. Honoring one name silently is how the second table a
 * user
 * asked for disappears.
 */
test('two names for one table is an error', async () => {
  await freshRoot();

  try {
    await writeFile(MODEL_FILE, MODEL_V7);
    // The message has to say *where*, because that is the only thing a person
    // can act on: `by_carrier` and `also_by_carrier`, each at the line it
    // was declared. A name would be ambiguous and a BuildID is a hash.
    await expect(build(BUILD_OPTS)).rejects.toThrow(
      /One table, two names.*test\.malloy:7.*test\.malloy:13/s
    );
  } finally {
    await rm(ROOT, {recursive: true, force: true});
  }
});

/**
 * `name=` is arbitrary annotation text; a manifest entry must be a canonical
 * table path. `dialect.sqlValidateTableName()` bridges the two, and its answer
 * has to be used for both the CREATE TABLE and the manifest entry. Using the
 * raw text for one and the canonical form for the other yields a manifest
 * naming a table that was never created — silently, when the raw text happens
 * to be canonical in some other dialect's grammar.
 */
test('persist name that needs canonicalizing', async () => {
  await freshRoot();
  const canonical = "'carriers-out.parquet'";

  try {
    await writeFile(MODEL_FILE, MODEL_V4);
    await build(BUILD_OPTS);

    const manifest = await readJSON<BuildManifest>(MANIFEST_FILE);
    check(
      tableNames(manifest).join() === canonical,
      'the manifest holds the canonical name'
    );

    const sql = await readFile(SQL_FILE, 'utf-8');
    check(
      sql.includes(`CREATE TABLE ${canonical} AS`),
      'CREATE TABLE used the canonical name'
    );

    const log = await buildLogAt(0);
    check(
      log.entries[0].tableName === canonical,
      'the build log records the canonical name — GC drops what was created'
    );

    // Manifest.update() and loadText() both require canonical table paths, so
    // the canonical form has to survive a write/read round trip.
    await build(BUILD_OPTS);
    check(
      (await buildLogAt(1)).entries[0].action === 'exists',
      'the reloaded manifest entry still matches'
    );

    // A name no dialect can express fails with the dialect's own message.
    await writeFile(MODEL_FILE, MODEL_V5);
    await expect(build(BUILD_OPTS)).rejects.toThrow(
      /Invalid persist name 'not a table name'/
    );
  } finally {
    await rm(ROOT, {recursive: true, force: true});
  }
});

/**
 * The other half of the contract: what the compiler does with what the
 * builder wrote. A query against a persist source reads the built table when
 * the manifest is in play and inlines the source when it isn't — and returns
 * the same rows either way.
 */
test('runtime queries with and without manifest', async () => {
  await freshRoot();

  const connection = new DuckDBConnection({
    name: 'duckdb',
    databasePath: ':memory:',
    workingDirectory: path.dirname(MODEL_FILE),
  });

  try {
    await writeFile(MODEL_FILE, MODEL_V1);
    await build(BUILD_OPTS);

    // The sample writes a SQL script rather than executing it, so materialize
    // its output here to query against.
    await connection.runSQL(
      `CREATE TABLE flights AS SELECT * FROM parquet_scan('${FLIGHTS_PARQUET}')`
    );
    const buildSql = await readFile(SQL_FILE, 'utf-8');
    for (const stmt of buildSql.split(';\n').filter(s => s.trim())) {
      await connection.runRawSQL(stmt);
    }

    const manifest = new Manifest();
    manifest.loadText(await readFile(MANIFEST_FILE, 'utf-8'));

    const runtime = new Runtime({
      connections: {
        lookupConnection: async (name?: string): Promise<Connection> => {
          if (!name || name === 'duckdb') return connection;
          throw new Error(`Unknown connection: ${name}`);
        },
      },
      urlReader: {
        readURL: async (url: URL) => readFile(fileURLToPath(url), 'utf-8'),
      },
    });
    runtime.buildManifest = manifest.buildManifest;

    const model = MODEL_V1 + '\nrun: by_carrier -> { select: * }\n';
    const plainOpts = {buildManifest: EMPTY_BUILD_MANIFEST};

    const fromTable = /FROM\s+by_carrier\s/;
    const sqlManifest = await runtime.loadQuery(model).getSQL();
    const sqlPlain = await runtime.loadQuery(model, plainOpts).getSQL();
    check(fromTable.test(sqlManifest), 'the manifest SQL reads the table');
    check(!fromTable.test(sqlPlain), 'the plain SQL inlines the source');

    type Row = {carrier: string; flight_count: number};
    const byCarrier = (a: Row, b: Row) => a.carrier.localeCompare(b.carrier);
    const rows = async (opts?: typeof plainOpts): Promise<Row[]> => {
      const result = await runtime.loadQuery(model, opts).run();
      return [...(result.data.toObject() as Row[])].sort(byCarrier);
    };
    const rowsManifest = await rows();
    const rowsPlain = await rows(plainOpts);

    check(rowsPlain.length > 0, 'the query returned rows');
    check(
      JSON.stringify(rowsManifest) === JSON.stringify(rowsPlain),
      'the built table and the inlined source return the same rows'
    );
  } finally {
    await connection.close();
    await rm(ROOT, {recursive: true, force: true});
  }
});
