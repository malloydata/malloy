/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  MalloyQueryData,
  QueryRecord,
  SQLSourceDef,
  SQLSourceRequest,
  StructDef,
  TableSourceDef,
} from '@malloydata/malloy';
import {
  RedshiftDialect,
  decodeDottedTablePath,
  makeDigest,
  sqlKey,
} from '@malloydata/malloy';
import {
  PostgresConnection,
  PooledPostgresConnection,
} from '@malloydata/db-postgres';
import type {CustomTypesConfig} from 'pg';
import {Client, Pool, types as pgTypes} from 'pg';

const SCHEMA_PAGE_SIZE = 1000;

// node-postgres parses OID 1114 (timestamp) and 1082 (date) in the host's local
// timezone, but Redshift returns them as session-UTC civil values Malloy reads as
// UTC; on a non-UTC host that shifts every bare timestamp/date. Parse them as UTC.
// OID 1184 (timestamptz) already carries an offset and is left to the default parser.
const REDSHIFT_TIMESTAMP_OID = 1114;
const REDSHIFT_DATE_OID = 1082;

function parseUtcTimestamp(value: string | null): Date | null {
  if (value === null) return null;
  const m =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/.exec(
      value
    );
  if (!m) return new Date(value);
  const [, y, mo, d, h, mi, s, frac] = m;
  const ms = frac ? Number((frac + '000').slice(0, 3)) : 0;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, ms));
}

function parseUtcDate(value: string | null): Date | null {
  if (value === null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date(value);
  const [, y, mo, d] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d));
}

const REDSHIFT_TYPES: CustomTypesConfig = {
  getTypeParser: ((oid: number, format?: unknown) => {
    if (oid === REDSHIFT_TIMESTAMP_OID) return parseUtcTimestamp;
    if (oid === REDSHIFT_DATE_OID) return parseUtcDate;
    return (pgTypes.getTypeParser as (o: number, f?: unknown) => unknown)(
      oid,
      format
    );
  }) as CustomTypesConfig['getTypeParser'],
};

// svv_columns covers external/Spectrum + late-binding views that information_schema.columns omits.
const REDSHIFT_SCHEMA_QUERY = `
  SELECT column_name, data_type
  FROM svv_columns
  WHERE table_name = $1
    AND table_schema = $2
  ORDER BY ordinal_position
`;

function decodeDottedSegments(input: string): string[] | undefined {
  const result = decodeDottedTablePath(input, {
    quoteChar: '"',
    escapeStyle: 'doubled',
    bareIdentRegex: /^[A-Za-z_][A-Za-z0-9_$]*/,
    dialectName: 'Redshift',
  });
  if (!result.ok) return undefined;
  return result.segments.map(s => (s.quoted ? s.value : s.value.toLowerCase()));
}

async function fetchRedshiftTableSchema(
  tableKey: string,
  tablePath: string,
  connectionName: string,
  dialect: RedshiftDialect,
  runQuery: (sql: string, values: unknown[]) => Promise<MalloyQueryData>
): Promise<TableSourceDef | string> {
  const structDef: StructDef = {
    type: 'table',
    name: tableKey,
    dialect: 'redshift',
    tablePath,
    connection: connectionName,
    fields: [],
  };
  const segments = decodeDottedSegments(tablePath);
  if (segments === undefined || segments.length < 2) {
    return 'Default schema not yet supported in Redshift';
  }
  const [schema, table] = segments.slice(-2);
  try {
    const {rows, totalRows} = await runQuery(REDSHIFT_SCHEMA_QUERY, [
      table,
      schema,
    ]);
    if (!totalRows) {
      throw new Error('Unable to read schema.');
    }
    for (const row of rows) {
      const malloyType = dialect.sqlTypeToMalloyType(
        row['data_type'] as string
      );
      structDef.fields.push({
        ...malloyType,
        name: row['column_name'] as string,
      });
    }
  } catch (error) {
    return `Error fetching schema for ${tablePath}: ${error.message}`;
  }
  return structDef;
}

// Redshift's pg_type has no typcategory, so resolve each column's type with format_type alone.
async function fetchRedshiftSelectSchema(
  client: Client,
  sqlRef: SQLSourceRequest,
  dialectName: string,
  dialect: RedshiftDialect
): Promise<SQLSourceDef> {
  const structDef: SQLSourceDef = {
    type: 'sql_select',
    ...sqlRef,
    dialect: dialectName,
    fields: [],
    name: sqlKey(sqlRef.connection, sqlRef.selectStr),
  };
  const described = await client.query({
    text: `SELECT * FROM (${sqlRef.selectStr}) _t LIMIT 0`,
  });
  const oids = [...new Set(described.fields.map(f => f.dataTypeID))];
  const typeByOid = new Map<number, string>();
  if (oids.length) {
    const params = oids.map((_, i) => `$${i + 1}`).join(',');
    const {rows} = await client.query<{oid: number; formatted: string}>(
      `SELECT oid, format_type(oid, NULL) AS formatted FROM pg_type WHERE oid IN (${params})`,
      oids
    );
    for (const r of rows) typeByOid.set(Number(r.oid), r.formatted);
  }
  for (const field of described.fields) {
    const sqlType = typeByOid.get(field.dataTypeID) ?? 'character varying';
    structDef.fields.push({
      ...dialect.sqlTypeToMalloyType(sqlType),
      name: field.name,
    });
  }
  return structDef;
}

type RedshiftConfig = {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  connectionString?: string;
  setupSQL?: string;
};

// node-postgres only enables SSL when a connectionString carries sslmode; Redshift
// refuses non-TLS, so fold discrete host/port fields into an sslmode=require URL.
function withRedshiftSsl(config: RedshiftConfig): RedshiftConfig {
  if (config.connectionString || !config.host) return config;
  const enc = encodeURIComponent;
  const auth = config.username
    ? `${enc(config.username)}${config.password ? `:${enc(config.password)}` : ''}@`
    : '';
  const port = config.port ? `:${config.port}` : '';
  const db = config.databaseName ? `/${enc(config.databaseName)}` : '';
  return {
    setupSQL: config.setupSQL,
    connectionString: `postgresql://${auth}${config.host}${port}${db}?sslmode=require`,
  };
}

// Redshift rejects `CREATE TEMP TABLE IF NOT EXISTS ... AS`; DROP-then-CREATE
// reaches the same idempotent end-state (the hash-named table holds the query rows).
async function manifestRedshiftTemporaryTable(
  sqlCommand: string,
  dialect: RedshiftDialect,
  runQuery: (sql: string) => Promise<MalloyQueryData>
): Promise<string> {
  const hash = makeDigest(sqlCommand);
  const tableName = `tt${hash.slice(0, dialect.maxIdentifierLength - 2)}`;
  await runQuery(`DROP TABLE IF EXISTS ${tableName};`);
  await runQuery(`CREATE TEMPORARY TABLE ${tableName} AS (${sqlCommand});`);
  return tableName;
}

// Two near-identical classes: each extends a different Postgres base
// (PostgresConnection / PooledPostgresConnection) that can't share a mixin (TS4094
// on private base members), so both declare the same overrides over shared helpers.

export class RedshiftConnection extends PostgresConnection {
  private readonly redshiftDialect = new RedshiftDialect();

  protected override async readConfig() {
    return withRedshiftSsl(await super.readConfig());
  }

  protected override async getClient(): Promise<Client> {
    const {
      username: user,
      password,
      databaseName: database,
      port,
      host,
      connectionString,
    } = await this.readConfig();
    return new Client({
      user,
      password,
      database,
      port,
      host,
      connectionString,
      types: REDSHIFT_TYPES,
    });
  }

  override get dialectName(): string {
    return 'redshift';
  }

  override get supportsNesting(): boolean {
    return false;
  }

  public override async connectionSetup(client: Client): Promise<void> {
    await client.query('SET enable_case_sensitive_identifier TO true');
    await super.connectionSetup(client);
  }

  public override async manifestTemporaryTable(
    sqlCommand: string
  ): Promise<string> {
    return manifestRedshiftTemporaryTable(
      sqlCommand,
      this.redshiftDialect,
      sql => this.runPostgresQuery(sql, SCHEMA_PAGE_SIZE, 0, false)
    );
  }

  protected override dejsonRow(row: QueryRecord): QueryRecord {
    return row;
  }

  override async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef | string> {
    return fetchRedshiftTableSchema(
      tableKey,
      tablePath,
      this.name,
      this.redshiftDialect,
      (sql, values) =>
        this.runPostgresQuery(sql, SCHEMA_PAGE_SIZE, 0, false, values)
    );
  }

  override async fetchSelectSchema(
    sqlRef: SQLSourceRequest
  ): Promise<SQLSourceDef | string> {
    const client = await this.getClient();
    await client.connect();
    await this.connectionSetup(client);
    try {
      return await fetchRedshiftSelectSchema(
        client,
        sqlRef,
        this.dialectName,
        this.redshiftDialect
      );
    } finally {
      await client.end();
    }
  }
}

export class PooledRedshiftConnection extends PooledPostgresConnection {
  private readonly redshiftDialect = new RedshiftDialect();
  private redshiftPool: Pool | undefined;

  protected override async readConfig() {
    return withRedshiftSsl(await super.readConfig());
  }

  override get dialectName(): string {
    return 'redshift';
  }

  override get supportsNesting(): boolean {
    return false;
  }

  public override async connectionSetup(client: Client): Promise<void> {
    await client.query('SET enable_case_sensitive_identifier TO true');
    await super.connectionSetup(client);
  }

  override async getPool(): Promise<Pool> {
    if (!this.redshiftPool) {
      const {
        username: user,
        password,
        databaseName: database,
        port,
        host,
        connectionString,
      } = await this.readConfig();
      const pool = new Pool({
        user,
        password,
        database,
        port,
        host,
        connectionString,
        types: REDSHIFT_TYPES,
      });
      pool.on('acquire', client => {
        client.query("SET TIME ZONE 'UTC'");
        client.query('SET enable_case_sensitive_identifier TO true');
      });
      this.redshiftPool = pool;
    }
    return this.redshiftPool;
  }

  override async drain(): Promise<void> {
    await this.redshiftPool?.end();
    await super.drain();
  }

  public override async manifestTemporaryTable(
    sqlCommand: string
  ): Promise<string> {
    return manifestRedshiftTemporaryTable(
      sqlCommand,
      this.redshiftDialect,
      sql => this.runPostgresQuery(sql, SCHEMA_PAGE_SIZE, 0, false)
    );
  }

  protected override dejsonRow(row: QueryRecord): QueryRecord {
    return row;
  }

  override async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef | string> {
    return fetchRedshiftTableSchema(
      tableKey,
      tablePath,
      this.name,
      this.redshiftDialect,
      (sql, values) =>
        this.runPostgresQuery(sql, SCHEMA_PAGE_SIZE, 0, false, values)
    );
  }

  override async fetchSelectSchema(
    sqlRef: SQLSourceRequest
  ): Promise<SQLSourceDef | string> {
    const client = await this.getClient();
    await client.connect();
    await this.connectionSetup(client);
    try {
      return await fetchRedshiftSelectSchema(
        client,
        sqlRef,
        this.dialectName,
        this.redshiftDialect
      );
    } finally {
      await client.end();
    }
  }
}
