/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Probe table-path acceptance per engine in a single Node process.
// For each candidate name, run `SELECT * FROM <name> LIMIT 0` and classify
// the outcome:
//   ACCEPT  — engine parsed the path; failed only because no such table.
//   REJECT  — engine reported a parse/syntax error.
//   ?       — other error (printed verbatim for inspection).

import '@malloydata/malloy-connections';
import {createConnectionsFromConfig} from '@malloydata/malloy';
// Reuse the per-engine env→config mapping from run_sql.ts via copy. Keeping
// this script self-contained beats coupling two scripts.
import type {
  ConnectionsConfig,
  ConnectionConfigEntry,
} from '@malloydata/malloy';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === '' ? undefined : v;
}
function num(v: string | undefined): number | undefined {
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

const CONFIG: ConnectionsConfig = {
  connections: {
    postgres: compact({
      is: 'postgres',
      host: env('PGHOST'),
      port: num(env('PGPORT')),
      username: env('PGUSER'),
      password: env('PGPASSWORD'),
      databaseName: env('PGDATABASE') ?? 'postgres',
    }) as ConnectionConfigEntry,
    mysql: compact({
      is: 'mysql',
      host: env('MYSQL_HOST'),
      port: num(env('MYSQL_PORT')),
      database: env('MYSQL_DATABASE'),
      user: env('MYSQL_USER'),
      password: env('MYSQL_PASSWORD'),
    }) as ConnectionConfigEntry,
    trino: compact({
      is: 'trino',
      server: env('TRINO_SERVER'),
      port: num(env('TRINO_PORT')),
      catalog: env('TRINO_CATALOG'),
      schema: env('TRINO_SCHEMA'),
      user: env('TRINO_USER'),
      password: env('TRINO_PASSWORD'),
    }) as ConnectionConfigEntry,
    bigquery: compact({
      is: 'bigquery',
      projectId: env('GCP_PROJECT_ID') ?? env('GOOGLE_CLOUD_PROJECT'),
      serviceAccountKeyPath: env('GOOGLE_APPLICATION_CREDENTIALS'),
      billingProjectId: env('GCP_BILLING_PROJECT_ID'),
    }) as ConnectionConfigEntry,
    snowflake: compact({
      is: 'snowflake',
      account: env('SNOWFLAKE_ACCOUNT'),
      username: env('SNOWFLAKE_USER'),
      password: env('SNOWFLAKE_PASSWORD'),
      role: env('SNOWFLAKE_ROLE'),
      warehouse: env('SNOWFLAKE_WAREHOUSE'),
      database: env('SNOWFLAKE_DATABASE'),
      schema: env('SNOWFLAKE_SCHEMA'),
    }) as ConnectionConfigEntry,
    databricks: compact({
      is: 'databricks',
      host: env('DATABRICKS_HOST'),
      path:
        env('DATABRICKS_PATH') ??
        (env('DATABRICKS_WAREHOUSE_ID')
          ? `/sql/1.0/warehouses/${env('DATABRICKS_WAREHOUSE_ID')}`
          : undefined),
      token: env('DATABRICKS_TOKEN'),
      defaultCatalog: env('DATABRICKS_CATALOG'),
      defaultSchema: env('DATABRICKS_SCHEMA'),
    }) as ConnectionConfigEntry,
  },
};

// Per-engine quote character for delimited identifiers.
const QUOTE: Record<string, string> = {
  postgres: '"',
  trino: '"',
  bigquery: '`',
  snowflake: '"',
  mysql: '`',
  databricks: '`',
};

interface ProbeCase {
  label: string;
  ref: (q: string) => string;
}

const CORPUS: ProbeCase[] = [
  {label: 'bare foo', ref: () => 'foo'},
  {label: 'bare foo$bar', ref: () => 'foo$bar'},
  {label: 'bare 1foo', ref: () => '1foo'},
  {label: 'quoted "foo"', ref: q => `${q}foo${q}`},
  {label: 'quoted-doubled', ref: q => `${q}foo${q}${q}bar${q}`},
  {label: 'dotted schema.foo', ref: () => 'schema.foo'},
  {label: 'dotted-quoted', ref: q => `${q}schema${q}.${q}foo${q}`},
  {label: 'unterminated quote', ref: q => `${q}foo`},
];

function classify(message: string): 'REJECT' | 'ACCEPT' | '?' {
  const m = message.toLowerCase();
  // Engine parse/syntax-error tokens.
  if (
    m.includes('syntax error') ||
    m.includes('mismatched input') ||
    m.includes('parse error') ||
    m.includes('parsing failed') ||
    m.includes('unexpected token') ||
    m.includes('invalid syntax') ||
    m.includes('unclosed identifier') ||
    m.includes('unterminated quoted') ||
    m.includes('identifiers must not start with a digit') ||
    m.includes('trailing junk after numeric literal') ||
    m.includes('unexpected integer literal')
  ) {
    return 'REJECT';
  }
  // Engine accepted parse but couldn't find the table / dataset / schema.
  if (
    m.includes('does not exist') ||
    m.includes('not found') ||
    m.includes("doesn't exist") ||
    m.includes('cannot be found') ||
    m.includes('table_or_view_not_found') ||
    m.includes('object does not exist') ||
    m.includes('unknown database') ||
    m.includes('must be qualified') || // BigQuery: bare name needs dataset
    m.includes('not authorized') ||
    m.includes('was not found') ||
    m.includes('unable to find') ||
    m.includes('schema_not_found') ||
    m.includes('table_not_found')
  ) {
    return 'ACCEPT';
  }
  return '?';
}

async function probeEngine(
  engine: string,
  lookup: ReturnType<typeof createConnectionsFromConfig>
) {
  console.log(`\n=== ${engine} ===`);
  let conn;
  try {
    conn = await lookup.lookupConnection(engine);
  } catch (e) {
    console.log(
      `  (connection failed: ${(e as Error).message.split('\n')[0]})`
    );
    return;
  }
  const q = QUOTE[engine] ?? '"';
  for (const c of CORPUS) {
    const ref = c.ref(q);
    let outcome: string;
    try {
      await conn.runSQL(`SELECT * FROM ${ref} LIMIT 0`);
      outcome = 'OK(?!)';
    } catch (e) {
      const full = (e as Error).message ?? String(e);
      const cls = classify(full);
      const flat = full.replace(/\s+/g, ' ').trim();
      outcome = `${cls}  ${flat.slice(0, 180)}`;
    }
    console.log(`  ${c.label.padEnd(22)} ${ref.padEnd(28)} ${outcome}`);
  }
}

async function main() {
  const lookup = createConnectionsFromConfig(CONFIG);
  try {
    for (const engine of [
      'postgres',
      'mysql',
      'trino',
      'bigquery',
      'snowflake',
      'databricks',
    ]) {
      await probeEngine(engine, lookup);
    }
  } finally {
    await lookup.close();
  }
}

main().catch(e => {
  console.error(e?.stack ?? String(e));
  process.exit(1);
});
