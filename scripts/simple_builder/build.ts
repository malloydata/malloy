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
 *   3. PLAN — Call `runtime.getBuildTargets(model)` for the targets to build.
 *      A target is one table: its BuildID, the connection it lives on, and
 *      every source in the model that maps onto it. They arrive grouped by
 *      connection — no dependency ever crosses one, so those groups are
 *      wholly independent builds — and in dependency order within each.
 *
 *   4. BUILD — Each connection's targets, in the order given. For each:
 *      a. If its BuildID is already in the manifest, `touch()` it (marks it
 *         active for GC, but does not rebuild).
 *      b. Otherwise, get the *build SQL* from `source.getSQL({buildManifest,
 *         connectionDigests})` — this version substitutes already-built
 *         dependencies with their table names — then CREATE TABLE and
 *         `update()` the manifest.
 *
 *   5. WRITE — Write `manifest.activeEntries` to disk. Only entries that
 *      were touched or updated in this run are included. Entries from prior
 *      builds that were not referenced are pruned — this is how GC works.
 *
 * ## Key insight: a target is a table, not a source
 *
 *   Several sources routinely name one table — see `BuildTarget` in the API
 *   types for why. `getBuildTargets` does that merge, and every source that
 *   named the table is in `target.sources`. A builder walking sources instead
 *   would create the same table once per name.
 *
 * ## Key insight: the manifest is part of the build loop
 *
 *   `manifest.buildManifest` returns a *stable reference*. When you call
 *   `manifest.update(buildId, {tableName})`, the change is immediately
 *   visible to subsequent `source.getSQL({buildManifest, ...})` calls in
 *   the same build run. This is how dependency chains work:
 *
 *     target A → builds first, manifest.update(A)
 *     target B (depends on A) → getSQL() sees A's table name
 *
 *   Without this, B's SQL would contain A's full inline SQL instead of a
 *   table reference, producing a different (and much more expensive) query.
 *
 * ## BuildID SQL vs build SQL
 *
 *   These are two different SQL strings for the same table:
 *
 *   - **BuildID SQL** — `target.sql`, which is `source.getSQL()` with no
 *     options: fully inlined, no manifest substitution. Its hash (with the
 *     connection digest) is the BuildID. The BuildID must be stable
 *     regardless of build order, so it never includes substituted table
 *     names. `getBuildTargets` has already computed both.
 *
 *   - **Build SQL** — `source.getSQL({buildManifest, connectionDigests})`.
 *     Dependencies that are already in the manifest are replaced with
 *     their table names. This is the SQL you actually execute in
 *     CREATE TABLE. It's more efficient because it reads from pre-built
 *     tables instead of recomputing dependencies inline. Only the builder
 *     can compute it, because only the builder knows what it has built so
 *     far.
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
 *
 *   - **Concurrency:** this sample builds everything one at a time so its SQL
 *     script has a stable order. A builder that wants the parallelism runs the
 *     connections at once and, within each, starts a target as soon as the
 *     things it reads are done — see `ConnectionBuild` in the API types for
 *     both loops.
 */

import {readFile, writeFile, mkdir} from 'fs/promises';
import * as path from 'path';
import {pathToFileURL, fileURLToPath} from 'url';
import type {BuildTarget, Connection, PersistSource} from '@malloydata/malloy';
import {Runtime, Manifest} from '@malloydata/malloy';

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

/**
 * Where a source was declared, as something a person can act on.
 *
 * `PersistSource.location` is the only handle worth reporting against — a name
 * is ambiguous across models, and a sourceID is a name glued to a URL. The core
 * hands over the URL it was given and takes no position on rendering it,
 * because only the caller knows what its URLs mean. This sample loaded
 * everything from the filesystem, so it prints a path and a line number; a
 * builder serving models out of a database would print whatever its users
 * recognize.
 */
function declaredAt(source: PersistSource): string {
  const at = source.location;
  if (at === undefined) {
    return '<no recorded location>';
  }
  const where = at.url.startsWith('file://')
    ? path.relative(process.cwd(), fileURLToPath(at.url))
    : at.url;
  return `${where}:${at.range.start.line + 1}`;
}

/** Every declaration behind one table, for reporting. */
function declaredAtAll(target: BuildTarget): string {
  return target.sources.map(declaredAt).join(', ');
}

/**
 * The name to build this target under, or undefined if nobody asked for one.
 *
 * Naming is a builder question, and this is the shape of it that only a
 * builder can answer: several sources map onto one table, each carrying its
 * own annotation, and they can disagree. The core hands over every source and
 * takes no position — a name means nothing to it. This sample refuses the
 * disagreement, because building one table and honoring one of the two names
 * silently is how a request for a second table gets lost.
 *
 * A target holds several declarations, which is exactly what this error needs:
 * it can point at each place a different name was asked for.
 */
function requestedName(target: BuildTarget): string | undefined {
  const asked = new Map<string, string[]>();
  for (const source of target.sources) {
    const name = source.annotations.parseAsTag('@').tag.text('name');
    if (name === undefined) continue;
    const askers = asked.get(name) ?? [];
    askers.push(declaredAt(source));
    asked.set(name, askers);
  }
  if (asked.size > 1) {
    const conflict = [...asked]
      .map(([name, askers]) => `'${name}' at ${askers.join(', ')}`)
      .join(' and ');
    throw new Error(
      `One table, two names: ${conflict}. These sources have identical SQL, ` +
        'so they share a BuildID and can only produce one table. Give them ' +
        'one name, or make them different computations.'
    );
  }
  return [...asked.keys()][0];
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

  // OR REPLACE because a build may not be the first thing to touch this
  // database: two DuckDB connections built with the same options share one
  // instance, `:memory:` included, so a second build -- or a caller which
  // made its own connection the same way -- finds the table already there.
  await connection.runSQL(
    "CREATE OR REPLACE TABLE flights AS SELECT * FROM parquet_scan('test/data/malloytest-parquet/flights.parquet')"
  );

  // Convert with pathToFileURL/fileURLToPath, never by concatenation: a path
  // with a space or a non-ASCII character percent-encodes, and `url.pathname`
  // hands back the encoded form, which no filesystem will open.
  const readURL = async (url: URL): Promise<string> => {
    return await readFile(fileURLToPath(url), {encoding: 'utf-8'});
  };

  const runtime = new Runtime({
    urlReader: {readURL},
    connections: {
      lookupConnection: async (name?: string): Promise<Connection> => {
        if (!name || name === 'duckdb') {
          return connection;
        }
        throw new Error(`Unknown connection: ${name}`);
      },
    },
  });

  // =========================================================
  // STEP 1: LOAD — Load existing manifest (or start empty)
  // =========================================================
  // The manifest maps BuildIDs to table names from prior builds. Loading it
  // lets us skip tables that haven't changed (their BuildID still matches an
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
  // Compile the model to get its IR. The runtime has no manifest set, so
  // nothing is substituted here — the compiler doesn't need it yet. Manifest
  // substitution happens later, when we call
  // source.getSQL({buildManifest, connectionDigests}) during the build loop
  // (step 4). That's where already-built dependencies resolve to table
  // references instead of inline SQL.
  const model = await runtime.getModel(pathToFileURL(modelFile));

  // =========================================================
  // STEP 3: PLAN — Ask what tables this model needs
  // =========================================================
  // This lives on the Runtime rather than the Model because a BuildID is a
  // hash of the SQL *and the connection's digest* — the answer can't be
  // finished without a connection.
  const {connections, tagParseLog} = await runtime.getBuildTargets(model);

  for (const msg of tagParseLog) {
    const loc = msg.at ? ` (${msg.at.url}:${msg.at.range.start.line + 1})` : '';
    console.warn(`WARNING: ${msg.message}${loc}`);
  }

  const targetCount = connections.flatMap(c => c.targets).length;
  if (targetCount === 0) {
    console.log('No #@ persist sources found in model');
    return;
  }

  console.log(
    `Found ${targetCount} table(s) on ${connections.length} connection(s)`
  );

  // The connection digest includes connection-specific settings (database
  // path, search path, etc.), which is why two users with different connection
  // configs get different BuildIDs for the same Malloy source. Step 4 hands it
  // back to the compiler so manifest lookups agree with what was built.
  const connectionDigests: Record<string, string> = {
    duckdb: connection.getDigest(),
  };

  const sqlStatements: string[] = [];
  const logEntries: BuildLogEntry[] = [];
  const now = new Date();
  const buildStartedAt = now.toISOString();

  // =========================================================
  // STEP 4: BUILD — Each connection, in dependency order
  // =========================================================
  // Connections are wholly independent of one another — a query can't cross
  // one, so a dependency can't either. Within a connection, targets arrive with
  // everything a target depends on ahead of it, so building them in order is
  // correct with no scheduling of any kind.
  //
  // A builder that wants concurrency keeps a promise per target and awaits
  // `target.dependsOn` before starting each one; see the header.
  for (const {connectionName, targets} of connections) {
    console.log(`\nConnection ${connectionName}: ${targets.length} table(s)`);

    for (const target of targets) {
      // Every source that maps onto this table shares one BuildID, so they
      // share one manifest entry and one CREATE TABLE; any of them can
      // generate the SQL. What differs is where each was declared and what
      // `name=` each asked for.
      const declared = declaredAtAll(target);
      const source = target.sources[0];
      const explicitName = requestedName(target);

      // Already built — just mark it active so it survives GC
      const existingEntry = manifest.buildManifest.entries[target.buildId];
      if (existingEntry) {
        manifest.touch(target.buildId);

        console.log(`  Exists: ${existingEntry.tableName} (${declared})`);
        logEntries.push({
          action: 'exists',
          buildId: target.buildId,
          tableName: existingEntry.tableName,
          nameProvided: !!explicitName,
        });
        continue;
      }

      // --- Not yet built: compute the build SQL ---
      // `target.sql` is the BuildID SQL — fully inlined, order-independent,
      // already hashed. This is the other one: dependencies built earlier in
      // this run become table references. Because manifest.buildManifest is a
      // stable reference, any manifest.update() from an earlier target is
      // already visible here.
      const buildSQL = source.getSQL({
        buildManifest: manifest.buildManifest,
        connectionDigests,
      });

      const nameProvided = !!explicitName;
      const tableName = canonicalTableName(
        source,
        explicitName || `persist_${target.buildId.substring(0, 12)}`
      );

      // NOTE: This sample only generates SQL, it does not execute it. A live
      // builder runs the statement here — and this is the only place worth
      // timing, since everything else in this loop is bookkeeping:
      //   await conn.runSQL(`CREATE TABLE ${tableName} AS ${buildSQL}`);
      sqlStatements.push(
        `-- ${declared} (${target.buildId})\nCREATE TABLE ${tableName} AS\n${buildSQL};\n`
      );

      console.log(`  Built: ${tableName} (${declared})`);

      // Update the manifest IMMEDIATELY after building. This is critical:
      // later targets that depend on this one will call
      // getSQL({buildManifest, ...}) and see this table name instead of
      // the full inline SQL.
      manifest.update(target.buildId, {tableName});

      logEntries.push({
        action: 'built',
        buildId: target.buildId,
        tableName,
        nameProvided,
      });
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
