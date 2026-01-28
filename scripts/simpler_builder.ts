/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Simple builder script for testing the persist API.
 *
 * Usage: npx ts-node scripts/simpler_builder.ts <model.malloy> -m <manifest.json> -s <output.sql>
 *
 * This script:
 * 1. Loads a Malloy file
 * 2. Finds all #@ persist queries
 * 3. Builds them in dependency order
 * 4. Writes CREATE TABLE statements to the SQL file
 * 5. Updates the manifest after each build
 */

import {readFile, writeFile} from 'fs/promises';
import * as path from 'path';
import type {Connection} from '@malloydata/malloy';
import {Malloy} from '@malloydata/malloy';
import type {BuildManifest, BuildManifestEntry} from '@malloydata/malloy';
import {DuckDBConnection} from '../packages/malloy-db-duckdb';

// Parse command line arguments
function parseArgs(): {modelFile: string; manifestFile: string; sqlFile: string} {
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
    console.error('Usage: npx ts-node scripts/simpler_builder.ts <model.malloy> -m <manifest.json> -s <output.sql>');
    process.exit(1);
  }

  if (!manifestFile) {
    console.error('Error: Manifest file is required (-m / --manifest)');
    console.error('Usage: npx ts-node scripts/simpler_builder.ts <model.malloy> -m <manifest.json> -s <output.sql>');
    process.exit(1);
  }

  if (!sqlFile) {
    console.error('Error: SQL output file is required (-s / --sql)');
    console.error('Usage: npx ts-node scripts/simpler_builder.ts <model.malloy> -m <manifest.json> -s <output.sql>');
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

async function main() {
  const {modelFile, manifestFile, sqlFile} = parseArgs();

  const filePath = fullPath(modelFile);
  const fileDir = path.dirname(filePath);
  const fileUrl = `file://${filePath}`;

  // Create DuckDB connection with flights.parquet loaded
  const connection = new DuckDBConnection('duckdb', ':memory:', fileDir);
  await connection.runSQL(
    `CREATE TABLE flights AS SELECT * FROM parquet_scan('test/data/duckdb/flights.parquet')`
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

  // Get persist queries using the new Model API
  const persistQueries = model.getPersistQueries();
  if (persistQueries.length === 0) {
    console.log('No #@ persist queries found in model');
    await connection.close();
    return;
  }

  console.log(`Found ${persistQueries.length} persist queries`);

  // Get build graphs using the new Model API
  const graphs = await model.getBuildGraphs(connections);
  const queryDigests = model.getQueryDigests();

  // Initialize manifest
  const manifest: BuildManifest = {
    modelUrl: fileUrl,
    buildStartedAt: new Date().toISOString(),
    buildFinishedAt: '',
    buildEntries: {},
  };

  // Collect all nodes from graphs and their dependencies
  const allNodes = new Map<string, {digest: string; dependsOn: string[]}>();
  for (const graph of graphs) {
    for (const level of graph.nodes) {
      for (const node of level) {
        allNodes.set(node.id.name, {
          digest: node.id.queryDigest,
          dependsOn: node.dependsOn.map(d => d.name),
        });
        for (const dep of node.dependsOn) {
          if (!allNodes.has(dep.name)) {
            allNodes.set(dep.name, {
              digest: dep.queryDigest,
              dependsOn: [],
            });
          }
        }
      }
    }
  }

  // Helper to get table name for a query
  function getTableName(queryName: string, digest: string): string {
    const namedQuery = model.getNamedQuery(queryName);
    const parsed = namedQuery.tagParse({prefix: /^#@ /});
    const explicitName = parsed.tag.text('name');
    if (explicitName) {
      return explicitName;
    }
    return `TBL_${digest.substring(0, 12)}`;
  }

  // Build in topological order, collecting SQL statements
  const sqlStatements: string[] = [];
  const builtQueries = new Set<string>();

  while (builtQueries.size < allNodes.size) {
    let progress = false;

    for (const [name, info] of allNodes) {
      if (builtQueries.has(name)) continue;

      // Check if all dependencies are built
      const depsBuilt = info.dependsOn.every(dep => builtQueries.has(dep));
      if (!depsBuilt) continue;

      // Build this query using the new NamedQuery API
      const tableName = getTableName(name, info.digest);
      const namedQuery = model.getNamedQuery(name);

      // Pass the current manifest so dependencies can be substituted
      const preparedResult = namedQuery.getPreparedResult({buildManifest: manifest});

      // Generate CREATE TABLE statement
      const createStatement = `CREATE TABLE ${tableName} AS\n${preparedResult.sql};\n`;
      sqlStatements.push(createStatement);
      console.log(`Built: ${name} -> ${tableName}`);

      // Update manifest with this entry
      const entry: BuildManifestEntry = {
        queryDigest: info.digest,
        tableName,
        buildStartedAt: new Date().toISOString(),
        buildFinishedAt: new Date().toISOString(),
      };
      manifest.buildEntries[info.digest] = entry;

      builtQueries.add(name);
      progress = true;
    }

    if (!progress && builtQueries.size < allNodes.size) {
      console.error('Circular dependency detected!');
      break;
    }
  }

  // Finalize manifest
  manifest.buildFinishedAt = new Date().toISOString();

  // Write SQL file
  const sqlPath = fullPath(sqlFile);
  await writeFile(sqlPath, sqlStatements.join('\n'));
  console.log(`Wrote SQL: ${sqlPath}`);

  // Write manifest
  const manifestPath = fullPath(manifestFile);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Wrote manifest: ${manifestPath}`);

  // Clean up
  await connection.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
