/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Usage:
//   ts-node scripts/run_sql.ts CONNECTION 'SELECT 1'
//   echo 'SELECT 1' | ts-node scripts/run_sql.ts CONNECTION
//
// CONNECTION is one of the registered backend names: bigquery, databricks,
// duckdb, mysql, postgres, snowflake, trino, presto.
//
// Per-backend property values are read from environment variables (the same
// ones the spec suites use), then handed to `createConnectionsFromConfig`.

import '@malloydata/malloy-connections';

import {
  createConnectionsFromConfig,
  type ConnectionsConfig,
  type ConnectionConfigEntry,
} from '@malloydata/malloy';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === '' ? undefined : v;
}

function maybeNumber(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function compact<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) {
    if (o[k] === undefined) delete o[k];
  }
  return o;
}

function postgres(): ConnectionConfigEntry {
  return compact({
    is: 'postgres',
    host: env('PGHOST'),
    port: maybeNumber(env('PGPORT')),
    username: env('PGUSER'),
    password: env('PGPASSWORD'),
    databaseName: env('PGDATABASE') ?? 'postgres',
  });
}

function mysql(): ConnectionConfigEntry {
  return compact({
    is: 'mysql',
    host: env('MYSQL_HOST'),
    port: maybeNumber(env('MYSQL_PORT')),
    database: env('MYSQL_DATABASE'),
    user: env('MYSQL_USER'),
    password: env('MYSQL_PASSWORD'),
  });
}

function trinoLike(typeName: 'trino' | 'presto'): ConnectionConfigEntry {
  // Both Trino and Presto share env-var conventions.
  return compact({
    is: typeName,
    server: env('TRINO_SERVER'),
    port: maybeNumber(env('TRINO_PORT')),
    catalog: env('TRINO_CATALOG'),
    schema: env('TRINO_SCHEMA'),
    user: env('TRINO_USER'),
    password: env('TRINO_PASSWORD'),
  });
}

function bigquery(): ConnectionConfigEntry {
  return compact({
    is: 'bigquery',
    projectId: env('GCP_PROJECT_ID') ?? env('GOOGLE_CLOUD_PROJECT'),
    serviceAccountKeyPath: env('GOOGLE_APPLICATION_CREDENTIALS'),
    billingProjectId: env('GCP_BILLING_PROJECT_ID'),
  });
}

function snowflake(): ConnectionConfigEntry {
  return compact({
    is: 'snowflake',
    account: env('SNOWFLAKE_ACCOUNT'),
    username: env('SNOWFLAKE_USER'),
    password: env('SNOWFLAKE_PASSWORD'),
    role: env('SNOWFLAKE_ROLE'),
    warehouse: env('SNOWFLAKE_WAREHOUSE'),
    database: env('SNOWFLAKE_DATABASE'),
    schema: env('SNOWFLAKE_SCHEMA'),
    privateKeyPath: env('SNOWFLAKE_PRIVATE_KEY_PATH'),
    privateKeyPass: env('SNOWFLAKE_PRIVATE_KEY_PASS'),
  });
}

function databricks(): ConnectionConfigEntry {
  const warehouseId = env('DATABRICKS_WAREHOUSE_ID');
  const path =
    env('DATABRICKS_PATH') ??
    (warehouseId ? `/sql/1.0/warehouses/${warehouseId}` : undefined);
  return compact({
    is: 'databricks',
    host: env('DATABRICKS_HOST'),
    path,
    token: env('DATABRICKS_TOKEN'),
    defaultCatalog: env('DATABRICKS_CATALOG'),
    defaultSchema: env('DATABRICKS_SCHEMA'),
  });
}

function duckdb(): ConnectionConfigEntry {
  return {is: 'duckdb'};
}

const CONFIG: ConnectionsConfig = {
  connections: {
    postgres: postgres(),
    mysql: mysql(),
    trino: trinoLike('trino'),
    presto: trinoLike('presto'),
    bigquery: bigquery(),
    snowflake: snowflake(),
    databricks: databricks(),
    duckdb: duckdb(),
  },
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const [, , connName, ...sqlParts] = process.argv;
  if (!connName) {
    console.error(
      'Usage: ts-node scripts/run_sql.ts CONNECTION [SQL]\n' +
        '       (SQL may also come from stdin)'
    );
    process.exit(2);
  }

  let sql = sqlParts.join(' ').trim();
  if (!sql) sql = (await readStdin()).trim();
  if (!sql) {
    console.error('No SQL supplied (argv or stdin).');
    process.exit(2);
  }

  const lookup = createConnectionsFromConfig(CONFIG);
  try {
    const connection = await lookup.lookupConnection(connName);
    // Connection.runSQL is the only public SQL surface, but it assumes
    // Malloy-emitted SQL (each dialect wraps result rows in a single JSON
    // column called "row"). Ad-hoc SQL doesn't fit that envelope, so rows
    // come back undefined. For probing-style use, success/failure is what
    // matters: we exit 0 if the engine accepted the SQL, 1 if it threw.
    try {
      const result = await connection.runSQL(sql);
      console.log(`OK rows=${result.totalRows}`);
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  } finally {
    await lookup.close();
  }
}

main().catch(err => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
