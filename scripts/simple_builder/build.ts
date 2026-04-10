/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * SIMPLE BUILDER — A teaching implementation of the Malloy persistence builder.
 *
 * This file demonstrates the builder contract: the 5-step workflow that every
 * persistence builder must follow. The malloy-cli `build` command is a
 * production implementation of the same contract with multi-connection support,
 * config file discovery, and error reporting. This sample trades all of that
 * for clarity.
 *
 * ## The builder contract
 *
 *   1. LOAD — Load (or create) a Manifest from an existing manifest file.
 *      The manifest maps BuildIDs to table names from prior builds.
 *
 *   2. COMPILE — Compile the model to obtain its IR. The manifest is not
 *      passed to the compiler. Manifest substitution happens in step 4,
 *      when calling `source.getSQL({buildManifest, connectionDigests})`.
 *
 *   3. PLAN — Call `model.getBuildPlan()` to get the dependency graph.
 *      The plan groups sources by connection and levels them for parallel
 *      execution. All nodes in the same level are independent of each other.
 *
 *   4. BUILD — Walk the graph in dependency order. For each source:
 *      a. Compute the BuildID from `source.getSQL()` (no manifest — full
 *         inline SQL) and the connection digest.
 *      b. If the BuildID is already in the manifest, `touch()` it (marks
 *         it active for GC, but does not rebuild).
 *      c. Otherwise, get the *build SQL* from `source.getSQL({buildManifest,
 *         connectionDigests})` — this version substitutes already-built
 *         dependencies with their table names — then CREATE TABLE and
 *         `update()` the manifest.
 *
 *   5. WRITE — Write `manifest.activeEntries` to disk. Only entries that
 *      were touched or updated in this run are included. Entries from prior
 *      builds that were not referenced are pruned — this is how GC works.
 *
 * ## Key insight: the manifest is part of the build loop
 *
 *   `manifest.buildManifest` returns a *stable reference*. When you call
 *   `manifest.update(buildId, {tableName})`, the change is immediately
 *   visible to subsequent `source.getSQL({buildManifest, ...})` calls in
 *   the same build run. This is how dependency chains work:
 *
 *     source A (persist) → builds first, manifest.update(A)
 *     source B (persist, depends on A) → getSQL() sees A's table name
 *
 *   Without this, B's SQL would contain A's full inline SQL instead of a
 *   table reference, producing a different (and much more expensive) query.
 *
 * ## BuildID vs build SQL
 *
 *   These are two different SQL strings for the same source:
 *
 *   - **BuildID SQL** — `source.getSQL()` with no options. Produces the
 *     fully-inlined SQL with no manifest substitution. This is hashed
 *     (with the connection digest) to produce the BuildID. The BuildID
 *     must be stable regardless of build order, so it never includes
 *     manifest-substituted table names.
 *
 *   - **Build SQL** — `source.getSQL({buildManifest, connectionDigests})`.
 *     Dependencies that are already in the manifest are replaced with
 *     their table names. This is the SQL you actually execute in
 *     CREATE TABLE. It's more efficient because it reads from pre-built
 *     tables instead of recomputing dependencies inline.
 *
 * ## Divergences from malloy-cli
 *
 *   This sample differs from the production CLI builder in a few ways:
 *
 *   - **Table naming:** The CLI requires `#@ persist name=...` and errors
 *     if missing. This sample falls back to `persist_<buildId prefix>` for
 *     sources without an explicit name. Use explicit names in production.
 *
 *   - **Strict mode:** The CLI sets `manifest.strict = true` on new
 *     manifests so that missing entries throw at query time. This sample
 *     does not set strict mode.
 *
 *   - **Execution:** This sample only generates a SQL script file — it does
 *     not execute the CREATE TABLE statements. The CLI executes them and
 *     reports timing.
 *
 *   - **Connections:** The CLI uses MalloyConfig to create connections from
 *     a config file. This sample hardcodes a single DuckDB connection.
 */

import {readFile, writeFile, mkdir} from 'fs/promises';
import * as path from 'path';
import type {Connection} from '@malloydata/malloy';
import {Malloy, Manifest} from '@malloydata/malloy';
// eslint-disable-next-line n/no-extraneous-import
import {DuckDBConnection} from '@malloydata/db-duckdb';
import type {BuilderLog, BuildLogEntry} from './log_types';
import {logFileName} from './log_types';

export interface BuildOptions {
  modelFile: string;
  manifestFile: string;
  sqlFile: string;
  logDir: string;
}

/**
 * Validate that a table name is safe to interpolate into SQL.
 * Rejects names containing characters that could enable SQL injection.
 */
function validateTableName(tableName: string): void {
  if (/[;'"\\]/.test(tableName)) {
    throw new Error(
      `Unsafe table name "${tableName}": must not contain ; ' " or \\`
    );
  }
}

export async function build(opts: BuildOptions): Promise<void> {
  const {modelFile, manifestFile, sqlFile, logDir} = opts;
  const fileDir = path.dirname(modelFile);
  const fileUrl = `file://${modelFile}`;

  // --- Connection setup (hardcoded DuckDB for this sample) ---
  // A real builder would use MalloyConfig to create connections from a
  // config file. See malloy-cli's build.ts for that pattern.
  const connection = new DuckDBConnection({
    name: 'duckdb',
    databasePath: ':memory:',
    workingDirectory: fileDir,
  });
  await connection.runSQL(
    "CREATE TABLE flights AS SELECT * FROM parquet_scan('test/data/malloytest-parquet/flights.parquet')"
  );

  const readURL = async (url: URL): Promise<string> => {
    return await readFile(url.pathname, {encoding: 'utf-8'});
  };

  const connections = {
    lookupConnection: async (name?: string): Promise<Connection> => {
      if (!name || name === 'duckdb') {
        return connection;
      }
      throw new Error(`Unknown connection: ${name}`);
    },
  };

  // =========================================================
  // STEP 1: LOAD — Load existing manifest (or start empty)
  // =========================================================
  // The manifest maps BuildIDs to table names from prior builds. Loading
  // it lets us skip sources that haven't changed (their BuildID still
  // matches an entry).
  const manifest = new Manifest();
  try {
    manifest.loadText(await readFile(manifestFile, 'utf-8'));
  } catch {
    // No existing manifest — start fresh
  }

  // =========================================================
  // STEP 2: COMPILE — Compile the model
  // =========================================================
  // Compile the model to get its IR. The manifest is NOT passed here —
  // the compiler doesn't need it yet. Manifest substitution happens later,
  // when we call source.getSQL({buildManifest, connectionDigests}) during
  // the build loop (step 4). That's where already-built dependencies
  // resolve to table references instead of inline SQL.
  const modelText = await readFile(modelFile, {encoding: 'utf-8'});
  const parse = Malloy.parse({source: modelText, url: new URL(fileUrl)});
  const model = await Malloy.compile({
    urlReader: {readURL},
    connections,
    parse,
  });

  // =========================================================
  // STEP 3: PLAN — Get the build plan from the compiled model
  // =========================================================
  // The build plan contains:
  //   - graphs: one per connection, each with leveled BuildNode arrays
  //   - sources: keyed by sourceID, each a PersistSource with getSQL()
  //   - tagParseLog: errors from parsing #@ annotations
  const plan = model.getBuildPlan();

  for (const msg of plan.tagParseLog) {
    const loc = msg.at ? ` (${msg.at.url}:${msg.at.range.start.line + 1})` : '';
    console.warn(`WARNING: ${msg.message}${loc}`);
  }

  if (plan.graphs.length === 0) {
    console.log('No #@ persist sources found in model');
    await connection.close();
    return;
  }

  console.log(
    `Found ${Object.keys(plan.sources).length} persist sources in ${plan.graphs.length} graph(s)`
  );

  // Cache connection digests. The connection digest includes
  // connection-specific settings (database path, search path, etc.).
  // Two users with different connection configs get different BuildIDs
  // for the same Malloy source.
  const connectionDigest = await connection.getDigest();
  const connectionDigests: Record<string, string> = {
    duckdb: connectionDigest,
  };

  const sqlStatements: string[] = [];
  const logEntries: BuildLogEntry[] = [];
  const now = new Date();
  const buildStartedAt = now.toISOString();

  // =========================================================
  // STEP 4: BUILD — Walk graphs in dependency order
  // =========================================================
  // Each graph contains sources for one connection. Within a graph,
  // sources are organized into levels:
  //
  //   graph.nodes = [
  //     [nodeA, nodeB],   // level 0 — no dependencies, parallel-safe
  //     [nodeC],          // level 1 — depends on level 0, parallel-safe within level
  //     [nodeD, nodeE],   // level 2 — depends on levels 0+1
  //   ]
  //
  // All nodes within a level are independent and can be built concurrently.
  // Levels must be processed sequentially — level N depends on level N-1.
  // A production builder would parallelize within each level.
  for (const graph of plan.graphs) {
    console.log(`\nProcessing graph for connection: ${graph.connectionName}`);

    for (const level of graph.nodes) {
      // Within this level, all nodes are independent. A production builder
      // could build them in parallel (Promise.all). This sample serializes
      // for simplicity.
      //
      // Note: diamond dependencies could cause a sourceID to appear more
      // than once. No dedup needed — the second visit finds the entry
      // already in the manifest and just touch()es it.
      for (const node of level) {
        const persistSource = plan.sources[node.sourceID];
        if (!persistSource) {
          console.error(`  Warning: Source not found for ${node.sourceID}`);
          continue;
        }

        // Read the #@ persist annotation for builder-specific properties.
        // The CLI requires name=...; this sample falls back to a hash prefix.
        const parsed = persistSource.tagParse({prefix: /^#@ /});
        const explicitName = parsed.tag.text('name');

        // --- Compute the BuildID ---
        // IMPORTANT: BuildID uses the no-options SQL (fully inlined, no manifest
        // substitution). This ensures the BuildID is stable regardless of build
        // order — it depends only on the source's SQL and connection config,
        // not on whether dependencies happen to be built yet.
        const buildIdSQL = persistSource.getSQL();
        const buildId = persistSource.makeBuildId(connectionDigest, buildIdSQL);

        // Already built — just mark it active so it survives GC
        const existingEntry = manifest.buildManifest.entries[buildId];
        if (existingEntry) {
          manifest.touch(buildId);

          console.log(
            `  Exists: ${persistSource.name} -> ${existingEntry.tableName}`
          );
          logEntries.push({
            action: 'exists',
            buildId,
            tableName: existingEntry.tableName,
            nameProvided: !!explicitName,
          });
          continue;
        }

        // --- Not yet built: compute the build SQL ---
        // This version substitutes already-built dependencies with their table
        // names. Because manifest.buildManifest is a stable reference, any
        // manifest.update() call from a prior iteration is already visible here.
        const buildSQL = persistSource.getSQL({
          buildManifest: manifest.buildManifest,
          connectionDigests,
        });

        const nameProvided = !!explicitName;
        const tableName = explicitName || `persist_${buildId.substring(0, 12)}`;
        validateTableName(tableName);

        // NOTE: This sample only generates SQL, it does not execute it.
        // A live builder would run the SQL here:
        //   await conn.runSQL(`CREATE TABLE ${tableName} AS ${buildSQL}`);
        const buildStartTime = new Date().toISOString();
        const createStatement = `-- ${persistSource.name} (${node.sourceID})\nCREATE TABLE ${tableName} AS\n${buildSQL};\n`;
        sqlStatements.push(createStatement);
        const buildEndTime = new Date().toISOString();

        console.log(`  Built: ${persistSource.name} -> ${tableName}`);

        // Update the manifest IMMEDIATELY after building. This is critical:
        // subsequent sources in this build that depend on this one will call
        // getSQL({buildManifest, ...}) and see this table name instead of
        // the full inline SQL.
        manifest.update(buildId, {tableName});

        logEntries.push({
          action: 'built',
          buildId,
          tableName,
          nameProvided,
          buildStartedAt: buildStartTime,
          buildEndedAt: buildEndTime,
        });
      }
    }
  }

  const buildEndedAt = new Date().toISOString();

  // =========================================================
  // STEP 5: WRITE — Persist the manifest with only active entries
  // =========================================================
  // manifest.activeEntries contains only entries that were touched (already
  // existed) or updated (newly built) during this run. Entries from prior
  // builds that were not referenced are excluded — this is garbage collection.
  // A separate GC pass can then drop the corresponding tables.
  await writeFile(sqlFile, sqlStatements.join('\n'));
  console.log(`\nWrote SQL: ${sqlFile}`);

  await writeFile(
    manifestFile,
    JSON.stringify(manifest.activeEntries, null, 2)
  );
  console.log(`Wrote manifest: ${manifestFile}`);

  const buildLog: BuilderLog = {
    type: 'build',
    startedAt: buildStartedAt,
    endedAt: buildEndedAt,
    entries: logEntries,
  };
  await mkdir(logDir, {recursive: true});
  const logPath = path.join(logDir, logFileName('build', now));
  await writeFile(logPath, JSON.stringify(buildLog, null, 2));
  console.log(`Wrote build log: ${logPath}`);

  await connection.close();
}
