/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 * The consumer-contract canary's "app". It consumes the published `@malloydata/*`
 * packages exactly as a downstream app does — through their package entry points,
 * not via source. See ./CONTEXT.md for why.
 *
 * The single side-effect import of `@malloydata/malloy-connections` is the whole
 * point: that umbrella registers every dialect and drags in their native/ESM
 * surface (db-postgres -> pg -> pg-native, db-databricks -> native kernel,
 * db-duckdb/native, ...) — the same path that broke real consumers. So even
 * though the smoke query only touches DuckDB, the bundler/loader still has to cope
 * with the full connector graph.
 *
 * Two harnesses exercise this file (see package.json `canary:*`):
 *   - bundle-check.mjs  — esbuild-bundles it for node (catches an un-bundleable
 *                         native / bare require: the pg-native / databricks class)
 *   - consume.spec.ts   — loads it under a plain ts-jest config, no babel transform
 *                         (catches an ESM-only runtime dep: the uuid / @noble class)
 */

// Registers all dialects and pulls in the full connector surface (incl. native
// paths). This is how a real consumer enables connections.
import '@malloydata/malloy-connections';

import {SingleConnectionRuntime} from '@malloydata/malloy';
import {DuckDBConnection} from '@malloydata/db-duckdb';

// A real end-to-end use of the consumed API, against the one connection that needs
// no credentials. Proves the published package actually *works* when consumed —
// not merely that it loads.
export async function smoke(): Promise<number> {
  const connection = new DuckDBConnection({
    name: 'duckdb',
    databasePath: ':memory:',
  });
  const runtime = new SingleConnectionRuntime({connection});
  const result = await runtime
    .loadQuery('run: duckdb.sql("SELECT 1 as one") -> { select: one }')
    .run();
  const one = result.data.path(0, 'one').value;
  await connection.close();
  return Number(one);
}
