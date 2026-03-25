/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {readFile, writeFile, mkdir} from 'fs/promises';
import * as path from 'path';
import type {Connection} from '@malloydata/malloy';
import {Malloy, Manifest} from '@malloydata/malloy';
// eslint-disable-next-line n/no-extraneous-import
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

  // --- Connection setup (hardcoded DuckDB for this sample builder) ---
  // A real builder would use MalloyConfig to create connections from a
  // config file. This sample hardcodes a DuckDB connection for simplicity.
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

  // --- Compile ---
  const source = await readFile(modelFile, {encoding: 'utf-8'});
  const parse = Malloy.parse({source, url: new URL(fileUrl)});
  const model = await Malloy.compile({
    urlReader: {readURL},
    connections,
    parse,
  });

  // --- Build plan ---
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

  const connectionDigest = await connection.getDigest();
  const connectionDigests: Record<string, string> = {
    duckdb: connectionDigest,
  };

  // --- Load existing manifest ---
  const manifest = new Manifest();
  try {
    manifest.loadText(await readFile(manifestFile, 'utf-8'));
  } catch {
    // No existing manifest — start fresh
  }
  const sqlStatements: string[] = [];
  const logEntries: BuildLogEntry[] = [];
  const now = new Date();
  const buildStartedAt = now.toISOString();

  // --- Process build graphs ---
  // Each graph contains sources for one connection, organized into levels.
  // Levels represent parallelism boundaries: all nodes within a level are
  // independent and could be built concurrently. This sample builder
  // serializes everything into a SQL script, but a live builder could
  // execute all nodes within a level in parallel, waiting for each level
  // to complete before starting the next.
  for (const graph of plan.graphs) {
    console.log(`\nProcessing graph for connection: ${graph.connectionName}`);

    // Flatten into topological order for serial SQL output
    const allNodes = graph.nodes.flatMap(level =>
      level.flatMap(node => flattenBuildNodes([node]))
    );

    // Dedup (keep first occurrence = the dependency)
    const seenIds = new Set<string>();
    const uniqueNodes = allNodes.filter(node => {
      if (seenIds.has(node.sourceID)) return false;
      seenIds.add(node.sourceID);
      return true;
    });

    console.log(`  ${uniqueNodes.length} sources to build`);

    for (const node of uniqueNodes) {
      const source = plan.sources[node.sourceID];
      if (!source) {
        console.error(`  Warning: Source not found for ${node.sourceID}`);
        continue;
      }

      const parsed = source.tagParse({prefix: /^#@ /});
      const explicitName = parsed.tag.text('name');

      // BuildID must use no-opts SQL (fully inlined) to match the runtime,
      // which always compiles with empty options for BuildID computation.
      // The manifest-substituted SQL is used for CREATE TABLE (more efficient).
      const buildId = source.makeBuildId(connectionDigest, source.getSQL());
      const sql = source.getSQL({
        buildManifest: manifest.buildManifest,
        connectionDigests,
      });
      const nameProvided = !!explicitName;
      const tableName = explicitName || `persist_${buildId.substring(0, 12)}`;
      validateTableName(tableName);

      // Already built — just mark it active in the manifest
      if (manifest.buildManifest.entries[buildId]) {
        manifest.touch(buildId);
        console.log(`  Exists: ${source.name} -> ${tableName}`);
        logEntries.push({action: 'exists', buildId, tableName, nameProvided});
        continue;
      }

      // Not yet built — emit CREATE TABLE
      // NOTE: this sample builder only generates SQL, it does not execute it.
      // A live builder would run the SQL here and time the actual execution.
      const buildStartTime = new Date().toISOString();
      const createStatement = `-- ${source.name} (${node.sourceID})\nCREATE TABLE ${tableName} AS\n${sql};\n`;
      sqlStatements.push(createStatement);
      const buildEndTime = new Date().toISOString();

      console.log(`  Built: ${source.name} -> ${tableName}`);
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

  const buildEndedAt = new Date().toISOString();

  // --- Write outputs ---
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
