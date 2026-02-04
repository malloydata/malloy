/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable n/no-process-exit */

/**
 * Simple builder script for testing the source persist API.
 *
 * Usage: npx ts-node scripts/simple-builder.ts <model.malloy> -m <manifest.json> -s <output.sql>
 *
 * This script:
 * 1. Loads a Malloy file
 * 2. Finds all #@ persist sources
 * 3. Builds them in dependency order
 * 4. Writes CREATE TABLE statements to the SQL file
 * 5. Updates the manifest after each build
 */

import {readFile, writeFile} from 'fs/promises';
import * as path from 'path';
import type {
  Connection,
  BuildManifest,
  BuildManifestEntry,
  PersistSource,
  BuildNode,
} from '@malloydata/malloy';
import {Malloy} from '@malloydata/malloy';
// eslint-disable-next-line n/no-extraneous-import
import {DuckDBConnection} from '@malloydata/db-duckdb';

// Parse command line arguments
function parseArgs(): {
  modelFile: string;
  manifestFile: string;
  sqlFile: string;
} {
  const args = process.argv.slice(2);
  let modelFile: string | undefined;
  let manifestFile: string | undefined;
  let sqlFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-m' || arg === '--manifest') {
      manifestFile = args[++i];
    } else if (arg === '-s' || arg === '--sql') {
      sqlFile = args[++i];
    } else if (!arg.startsWith('-')) {
      modelFile = arg;
    }
  }

  if (!modelFile) {
    console.error('Error: Model file is required');
    console.error(
      'Usage: npx ts-node scripts/simple-builder.ts <model.malloy> -m <manifest.json> -s <output.sql>'
    );
    process.exit(1);
  }

  if (!manifestFile) {
    console.error('Error: Manifest file is required (-m / --manifest)');
    console.error(
      'Usage: npx ts-node scripts/simple-builder.ts <model.malloy> -m <manifest.json> -s <output.sql>'
    );
    process.exit(1);
  }

  if (!sqlFile) {
    console.error('Error: SQL output file is required (-s / --sql)');
    console.error(
      'Usage: npx ts-node scripts/simple-builder.ts <model.malloy> -m <manifest.json> -s <output.sql>'
    );
    process.exit(1);
  }

  return {modelFile, manifestFile, sqlFile};
}

function fullPath(fn: string): string {
  if (fn[0] === '/') {
    return fn;
  }
  return path.join(process.cwd(), fn);
}

/**
 * Flatten a BuildNode tree into a list, with dependencies before dependents.
 * Returns nodes in topological order (dependencies first).
 */
function flattenBuildNodes(nodes: BuildNode[]): BuildNode[] {
  const result: BuildNode[] = [];
  const seen = new Set<string>();

  function visit(node: BuildNode) {
    if (seen.has(node.sourceID)) return;
    // Visit dependencies first
    for (const dep of node.dependsOn) {
      visit(dep);
    }
    seen.add(node.sourceID);
    result.push(node);
  }

  for (const node of nodes) {
    visit(node);
  }

  return result;
}

async function main() {
  const {modelFile, manifestFile, sqlFile} = parseArgs();

  const filePath = fullPath(modelFile);
  const fileDir = path.dirname(filePath);
  const fileUrl = `file://${filePath}`;

  // Create DuckDB connection with flights.parquet loaded
  const connection = new DuckDBConnection({
    name: 'duckdb',
    databasePath: ':memory:',
    workingDirectory: fileDir,
  });
  await connection.runSQL(
    "CREATE TABLE flights AS SELECT * FROM parquet_scan('test/data/duckdb/flights.parquet')"
  );

  // Set up URL reader
  const readURL = async (url: URL): Promise<string> => {
    const urlPath = url.pathname;
    return await readFile(urlPath, {encoding: 'utf-8'});
  };

  // Set up connection lookup
  const connections = {
    lookupConnection: async (name: string): Promise<Connection> => {
      if (name === 'duckdb' || name === undefined) {
        return connection;
      }
      throw new Error(`Unknown connection: ${name}`);
    },
  };

  // Read and parse the Malloy file
  const source = await readFile(filePath, {encoding: 'utf-8'});
  const parse = Malloy.parse({source, url: new URL(fileUrl)});

  // Compile the model
  const model = await Malloy.compile({
    urlReader: {readURL},
    connections,
    parse,
  });

  // Get build plan using the new Model API
  const plan = model.getBuildPlan();

  if (plan.graphs.length === 0) {
    console.log('No #@ persist sources found in model');
    await connection.close();
    return;
  }

  console.log(
    `Found ${Object.keys(plan.sources).length} persist sources in ${plan.graphs.length} graph(s)`
  );

  // Get connection digest for BuildID computation
  const connectionDigest = await connection.getDigest();
  const connectionDigests: Record<string, string> = {
    duckdb: connectionDigest,
  };

  // Initialize manifest
  const manifest: BuildManifest = {
    modelUrl: fileUrl,
    buildStartedAt: new Date().toISOString(),
    buildFinishedAt: '',
    buildEntries: {},
  };

  // Collect all SQL statements
  const sqlStatements: string[] = [];

  // Process each graph (one per connection)
  for (const graph of plan.graphs) {
    console.log(`\nProcessing graph for connection: ${graph.connectionName}`);

    // Flatten nodes from all levels into topological order
    const allNodes: BuildNode[] = [];
    for (const level of graph.nodes) {
      for (const node of level) {
        allNodes.push(...flattenBuildNodes([node]));
      }
    }

    // Remove duplicates (keep first occurrence, which is the dependency)
    const seenIds = new Set<string>();
    const uniqueNodes = allNodes.filter(node => {
      if (seenIds.has(node.sourceID)) return false;
      seenIds.add(node.sourceID);
      return true;
    });

    console.log(`  ${uniqueNodes.length} sources to build`);

    // Build each source in order
    for (const node of uniqueNodes) {
      const source: PersistSource = plan.sources[node.sourceID];
      if (!source) {
        console.error(`  Warning: Source not found for ${node.sourceID}`);
        continue;
      }

      // Get the table name from annotation or generate one
      const parsed = source.tagParse({prefix: /^#@ /});
      const explicitName = parsed.tag.text('name');

      // Get SQL with manifest substitution for dependencies
      const sql = source.getSQL({
        buildManifest: manifest,
        connectionDigests,
      });

      // Compute BuildID
      const buildId = source.makeBuildId(connectionDigest, sql);

      // Determine table name
      const tableName = explicitName || `persist_${buildId.substring(0, 12)}`;

      // Generate CREATE TABLE statement
      const createStatement = `-- ${source.name} (${node.sourceID})\nCREATE TABLE ${tableName} AS\n${sql};\n`;
      sqlStatements.push(createStatement);
      console.log(`  Built: ${source.name} -> ${tableName}`);

      // Update manifest with this entry
      const entry: BuildManifestEntry = {
        buildId,
        tableName,
        buildStartedAt: new Date().toISOString(),
        buildFinishedAt: new Date().toISOString(),
      };
      manifest.buildEntries[buildId] = entry;
    }
  }

  // Finalize manifest
  manifest.buildFinishedAt = new Date().toISOString();

  // Write SQL file
  const sqlPath = fullPath(sqlFile);
  await writeFile(sqlPath, sqlStatements.join('\n'));
  console.log(`\nWrote SQL: ${sqlPath}`);

  // Write manifest
  const manifestPath = fullPath(manifestFile);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Wrote manifest: ${manifestPath}`);

  // Clean up
  await connection.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
