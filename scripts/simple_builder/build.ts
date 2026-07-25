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
 *      The plan groups sources by connection. Within a connection, the
 *      graph holds the *root* sources; each carries its own dependencies
 *      in `dependsOn`.
 *
 *   4. BUILD — Flatten the graph into dependency order (`flattenBuildNodes`)
 *      and walk it. For each source:
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
import {pathToFileURL, fileURLToPath} from 'url';
import type {Connection, PersistSource} from '@malloydata/malloy';
import {Malloy, Manifest} from '@malloydata/malloy';

import {DuckDBConnection} from '@malloydata/db-duckdb';
import type {BuilderLog, BuildLogEntry} from './log_types';
import {logFileName} from './log_types';
import {flattenBuildNodes} from './build_graph';

export interface BuildOptions {
  modelFile: string;
  manifestFile: string;
  sqlFile: string;
  logDir: string;
}

/**
 * Turn a user-supplied `#@ persist name=…` into the table name to build.
 *
 * The name comes from an annotation, so it is arbitrary text, but a manifest
 * entry must hold a canonical table path for its dialect. The dialect knows
 * both rules: `sqlValidateTableName` rejects what it can't express and returns
 * the canonical form of what it can — usually the input verbatim, but not
 * always (DuckDB quotes a file-style path to make it a legal table reference).
 *
 * Use the canonical form for BOTH the CREATE TABLE and the manifest entry.
 * Building one name and recording another leaves the manifest pointing at a
 * table that was never created.
 *
 * It is also the injection guard: nothing the dialect accepts can carry a SQL
 * payload out of the name.
 */
function canonicalTableName(source: PersistSource, requested: string): string {
  const result = source.dialect.sqlValidateTableName(requested);
  if (!result.ok) {
    throw new Error(`Invalid persist name '${requested}': ${result.error}`);
  }
  return result.canonical;
}

export async function build(opts: BuildOptions): Promise<void> {
  // --- Connection setup (hardcoded DuckDB for this sample) ---
  // A real builder would use MalloyConfig to create connections from a
  // config file. See malloy-cli's build.ts for that pattern.
  const connection = new DuckDBConnection({
    name: 'duckdb',
    databasePath: ':memory:',
    workingDirectory: path.dirname(opts.modelFile),
  });
  // Release the connection however the build ends. A build that throws
  // partway — an unusable table name, a failed CREATE — still has to let go
  // of the database.
  try {
    await runBuild(connection, opts);
  } finally {
    await connection.close();
  }
}

async function runBuild(
  connection: DuckDBConnection,
  opts: BuildOptions
): Promise<void> {
  const {modelFile, manifestFile, sqlFile, logDir} = opts;

  await connection.runSQL(
    "CREATE TABLE flights AS SELECT * FROM parquet_scan('test/data/malloytest-parquet/flights.parquet')"
  );

  // Convert with pathToFileURL/fileURLToPath, never by concatenation: a path
  // with a space or a non-ASCII character percent-encodes, and `url.pathname`
  // hands back the encoded form, which no filesystem will open.
  const readURL = async (url: URL): Promise<string> => {
    return await readFile(fileURLToPath(url), {encoding: 'utf-8'});
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
  // The manifest maps BuildIDs to table names from prior builds. Loading it
  // lets us skip sources that haven't changed (their BuildID still matches an
  // entry).
  //
  // Only "the file isn't there" means start fresh. A manifest that exists but
  // can't be read is a different situation: rebuilding everything would be
  // wrong, and step 5 would overwrite the file that could have explained why.
  const manifest = new Manifest();
  const manifestText = await readFile(manifestFile, 'utf-8').catch(
    (e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') return undefined;
      throw e;
    }
  );
  if (manifestText !== undefined) {
    manifest.loadText(manifestText);
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
  const parse = Malloy.parse({
    source: modelText,
    url: pathToFileURL(modelFile),
  });
  const model = await Malloy.compile({
    urlReader: {readURL},
    connections,
    parse,
  });

  // =========================================================
  // STEP 3: PLAN — Get the build plan from the compiled model
  // =========================================================
  // The build plan contains:
  //   - graphs: one per connection (see step 4 for how to walk one)
  //   - sources: keyed by sourceID, each a PersistSource with getSQL()
  //   - tagParseLog: errors from parsing #@ annotations
  const plan = model.getBuildPlan();

  for (const msg of plan.tagParseLog) {
    const loc = msg.at ? ` (${msg.at.url}:${msg.at.range.start.line + 1})` : '';
    console.warn(`WARNING: ${msg.message}${loc}`);
  }

  if (plan.graphs.length === 0) {
    console.log('No #@ persist sources found in model');
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
  // Each graph contains the sources for one connection. `graph.nodes` is
  // typed `BuildNode[][]` — an eventual leveled schedule — but today it
  // holds a single entry: the *root* sources, those nothing else depends
  // on. Everything else hangs off each root's `dependsOn` tree:
  //
  //   graph.nodes = [[ top_carriers ]]
  //                     └─ dependsOn: [ by_carrier ]
  //
  // So iterating `graph.nodes` alone would build `top_carriers` and never
  // build `by_carrier` — the dependency it reads from. `flattenBuildNodes`
  // walks the trees depth-first, dependencies before dependents, and drops
  // the repeats a diamond produces.
  for (const graph of plan.graphs) {
    console.log(`\nProcessing graph for connection: ${graph.connectionName}`);

    for (const node of flattenBuildNodes(graph.nodes.flat())) {
      const persistSource = plan.sources[node.sourceID];
      if (!persistSource) {
        console.error(`  Warning: Source not found for ${node.sourceID}`);
        continue;
      }

      // Read the #@ persist annotation for builder-specific properties.
      // The CLI requires name=...; this sample falls back to a hash prefix.
      const explicitName = persistSource.annotations
        .parseAsTag('@')
        .tag.text('name');

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
      const tableName = canonicalTableName(
        persistSource,
        explicitName || `persist_${buildId.substring(0, 12)}`
      );

      // NOTE: This sample only generates SQL, it does not execute it. A live
      // builder runs the statement here — and this is the only place worth
      // timing, since everything else in this loop is bookkeeping:
      //   await conn.runSQL(`CREATE TABLE ${tableName} AS ${buildSQL}`);
      sqlStatements.push(
        `-- ${persistSource.name} (${node.sourceID})\nCREATE TABLE ${tableName} AS\n${buildSQL};\n`
      );

      console.log(`  Built: ${persistSource.name} -> ${tableName}`);

      // Update the manifest IMMEDIATELY after building. This is critical:
      // subsequent sources in this build that depend on this one will call
      // getSQL({buildManifest, ...}) and see this table name instead of
      // the full inline SQL.
      manifest.update(buildId, {tableName});

      logEntries.push({action: 'built', buildId, tableName, nameProvided});
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
}
