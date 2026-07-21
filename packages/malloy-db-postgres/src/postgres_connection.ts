/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// LTNOTE: we need this extension to be installed to correctly index
//  postgres data...  We should probably do this on connection creation...
//
//     create extension if not exists tsm_system_rows
//

import type {
  Connection,
  ConnectionConfig,
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  QueryData,
  QueryRecord,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  SQLSourceDef,
  TableSourceDef,
  StreamingConnection,
  StructDef,
  SQLSourceRequest,
} from '@malloydata/malloy';
import {
  PostgresDialect,
  mkArrayDef,
  sqlKey,
  makeDigest,
  decodeDottedTablePath,
} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';

import {Client, Pool} from 'pg';
import type {ClientConfig, FieldDef} from 'pg';
import QueryStream from 'pg-query-stream';

/**
 * Serializable TLS options for a Postgres connection, forwarded verbatim into
 * pg's native `Object.assign(clientOptions, ssl)`. This is the subset that can
 * live in a saved/registry connection config (all PEM strings + booleans).
 *
 * Semantics (these mirror pg / Node `tls`, NOT libpq):
 * - `ssl: true` (or `rejectUnauthorized: true`, the default) → full
 *   verification against the trust store, including hostname (verify-full).
 * - `rejectUnauthorized: false` → encrypt but do NOT verify (libpq's
 *   `sslmode=require` / `no-verify`); use only when you can't verify.
 * - `ca` pins a trusted CA (PEM, or an array of PEMs).
 *
 * `servername` only takes effect when the connection `host` is an IP literal
 * (e.g. `127.0.0.1`) — pg overwrites `servername` with `host` whenever `host`
 * is a DNS name like `localhost`, so servername-based verification through a
 * tunnel requires connecting via IP. When the certificate doesn't match the
 * host pg connected to, pg throws; the connector annotates that error with
 * this servername/host guidance.
 *
 * verify-ca against a cert with no matching SAN/CN (e.g. Cloud SQL legacy
 * per-instance certs) needs `checkServerIdentity`, a function — not
 * expressible here or in `type: 'json'` config. Pass the full pg `ssl`
 * (`tls.ConnectionOptions`) via the config-reader constructor form
 * (`new PostgresConnection(name, queryOptions, () => ({..., ssl}))`) for that
 * case; the serializable options object is limited to this subset.
 *
 * `ssl` is passed through literally — `type: 'json'` config is never
 * reference-resolved (a malloy security invariant), so secret `key`/
 * `passphrase` material cannot be pulled from an `{env:...}`/overlay
 * reference. Inject secrets programmatically at construction; never persist
 * them in a shared connection config. Secrets are never logged.
 */
export type PostgresSSLConfig = {
  ca?: string | string[];
  cert?: string;
  key?: string;
  passphrase?: string;
  crl?: string | string[];
  servername?: string;
  rejectUnauthorized?: boolean;
};

interface PostgresConnectionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  connectionString?: string;
  setupSQL?: string;
  // Session metadata applied at session open (connection-layer only in v1):
  // `SET application_name = '<value>'` plus allowlisted session GUCs as
  // `SET <key> = '<value>'`. Observability-only; never data identity.
  applicationName?: string;
  sessionSettings?: Record<string, string>;
  // Programmatic callers get pg's full ssl surface (incl. `checkServerIdentity`
  // for verify-ca). Saved/registry config is limited to the serializable
  // PostgresSSLConfig subset — see PostgresConnectionOptions.
  ssl?: ClientConfig['ssl'];
}

interface InfoSchemaColumn {
  columnName: string;
  dataType: string; // c.data_type    (e.g. 'ARRAY', 'integer', 'USER-DEFINED')
  elementType: string | null; // e.data_type    (or NULL for scalars)
}

/** internal shape of pg_type we care about */
interface PgTypeRow {
  oid: number;
  typname: string;
  typtype: string; // 'b'=base, 'd'=domain, 'e'=enum, 'c'=composite, 'r'=range, 'm'=multirange, 'p'=pseudo
  typcategory: string; // 'A'=array
  typelem: number; // element OID if array
  typbasetype: number; // base OID if domain
  formatted: string; // format_type(oid,NULL)
}

type PostgresConnectionConfigurationReader =
  | PostgresConnectionConfiguration
  | (() => Promise<PostgresConnectionConfiguration>);

const DEFAULT_PAGE_SIZE = 1000;
const SCHEMA_PAGE_SIZE = 1000;

// pg verifies the server certificate against the host it actually connects to,
// not `ssl.servername` (which pg drops when the host is a DNS name). When that
// check fails, pg throws a terse altname error; augment it with how to fix a
// tunneled connection rather than trying to predict pg's host resolution up
// front. Mutates and returns the original error so its type and stack survive.
function addTlsHint(err: unknown): unknown {
  if (!(err instanceof Error)) return err;
  const code = (err as {code?: unknown}).code;
  const isCertHostMismatch =
    code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    (/certificate/i.test(err.message) &&
      /altname|does not match/i.test(err.message));
  if (isCertHostMismatch) {
    err.message +=
      "\n[malloy-db-postgres] The server certificate does not match the host pg connected to. pg verifies against the connection host, not ssl.servername, unless the host is an IP. For a tunnel, connect via the DB's IP (e.g. host '127.0.0.1') and set ssl.servername to the real hostname; or omit ssl.servername to verify against the host directly.";
  }
  return err;
}

// Escape a value for a single-quoted Postgres string literal (standard SQL:
// double the single quotes; standard_conforming_strings leaves backslashes
// literal).
function escapePostgresString(s: string): string {
  return s.replace(/'/g, "''");
}

// A settable GUC key must be a bare identifier (it is not quoted).
const POSTGRES_SETTING_KEY = /^[A-Za-z_][A-Za-z0-9_.]*$/;

// Deterministic serialization of session settings for the connection digest.
// Generic GUCs alter session behaviour (like `setupSQL`, which the digest
// already folds in), so they belong in connection identity; returns undefined
// when unset so digests are unchanged for connections that omit them. The
// observability-only `application_name` is deliberately excluded.
function digestSessionSettings(
  settings?: Record<string, string>
): string | undefined {
  if (!settings) return undefined;
  const keys = Object.keys(settings).sort();
  if (keys.length === 0) return undefined;
  return JSON.stringify(keys.map(k => [k, settings[k]]));
}

/**
 * Decode a canonical Postgres dotted-table path into its underlying
 * identifier strings as they appear in `information_schema`. The schema
 * lookup is a string-literal comparison, not an identifier reference,
 * so Postgres's bare-name lowercase folding doesn't happen for us — we
 * apply it here: bare segments → lowercase, `"…"` segments → as-is.
 */
function decodeDottedSegments(input: string): string[] | undefined {
  const result = decodeDottedTablePath(input, {
    quoteChar: '"',
    escapeStyle: 'doubled',
    bareIdentRegex: /^[A-Za-z_][A-Za-z0-9_$]*/,
    dialectName: 'Postgres',
  });
  if (!result.ok) return undefined;
  return result.segments.map(s => (s.quoted ? s.value : s.value.toLowerCase()));
}

export interface PostgresConnectionOptions
  extends ConnectionConfig, Omit<PostgresConnectionConfiguration, 'ssl'> {
  // Serializable subset only. Full pg TLS options (functions/Buffers) are not
  // representable in `type: 'json'` config; pass them programmatically via the
  // `PostgresConnectionConfiguration` (name/configReader) constructor form.
  ssl?: boolean | PostgresSSLConfig;
}

export class PostgresConnection
  extends BaseConnection
  implements Connection, StreamingConnection, PersistSQLResults
{
  public readonly name: string;
  protected setupSQL: string | undefined;
  protected applicationName: string | undefined;
  protected sessionSettings: Record<string, string> | undefined;
  private queryOptionsReader: QueryOptionsReader = {};
  private configReader: PostgresConnectionConfigurationReader = {};

  private readonly dialect = new PostgresDialect();

  constructor(
    options: PostgresConnectionOptions,
    queryOptionsReader?: QueryOptionsReader
  );
  constructor(
    name: string,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: PostgresConnectionConfigurationReader
  );
  constructor(
    arg: string | PostgresConnectionOptions,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: PostgresConnectionConfigurationReader
  ) {
    super();
    if (typeof arg === 'string') {
      this.name = arg;
      if (configReader) {
        this.configReader = configReader;
      }
    } else {
      const {
        name,
        setupSQL,
        applicationName,
        sessionSettings,
        ...configReader
      } = arg;
      this.name = name;
      this.setupSQL = setupSQL;
      this.applicationName = applicationName;
      this.sessionSettings = sessionSettings;
      this.configReader = configReader;
    }
    if (queryOptionsReader) {
      this.queryOptionsReader = queryOptionsReader;
    }
  }

  private async readQueryConfig(): Promise<RunSQLOptions> {
    if (this.queryOptionsReader instanceof Function) {
      return this.queryOptionsReader();
    } else {
      return this.queryOptionsReader;
    }
  }

  protected async readConfig(): Promise<PostgresConnectionConfiguration> {
    if (this.configReader instanceof Function) {
      return this.configReader();
    } else {
      return this.configReader;
    }
  }

  get dialectName(): string {
    return 'postgres';
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canStream(): this is StreamingConnection {
    return true;
  }

  public getDigest(): string {
    // If configReader is an object (not a function), use its properties
    if (typeof this.configReader !== 'function') {
      const {host, port, username, databaseName, connectionString} =
        this.configReader;
      const parts: (string | undefined)[] = [
        'postgres',
        host,
        port !== undefined ? String(port) : undefined,
        username,
        databaseName,
        connectionString,
        this.setupSQL,
      ];
      const sessionSettings = digestSessionSettings(this.sessionSettings);
      if (sessionSettings !== undefined) parts.push(sessionSettings);
      return makeDigest(...parts);
    }
    // Fall back to connection name if config is async
    return makeDigest('postgres', this.name);
  }

  public get supportsNesting(): boolean {
    return true;
  }

  protected buildClientConfig(
    cfg: PostgresConnectionConfiguration
  ): ClientConfig {
    return {
      user: cfg.username,
      password: cfg.password,
      database: cfg.databaseName,
      port: cfg.port,
      host: cfg.host,
      connectionString: cfg.connectionString,
      ssl: cfg.ssl,
    };
  }

  // Runs a connect/query op, annotating pg's terse certificate-mismatch error
  // with actionable TLS guidance (see addTlsHint).
  protected async withTlsHint<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (e) {
      throw addTlsHint(e);
    }
  }

  protected async getClient(): Promise<Client> {
    return new Client(this.buildClientConfig(await this.readConfig()));
  }

  protected async runPostgresQuery(
    sqlCommand: string,
    _pageSize: number,
    _rowIndex: number,
    deJSON: boolean,
    values?: unknown[]
  ): Promise<MalloyQueryData> {
    const client = await this.getClient();
    await this.withTlsHint(() => client.connect());
    await this.connectionSetup(client);

    let result = await client.query(sqlCommand, values);
    if (Array.isArray(result)) {
      result = result.pop();
    }
    if (deJSON) {
      for (let i = 0; i < result.rows.length; i++) {
        result.rows[i] = result.rows[i].row;
      }
    }
    await client.end();
    return {
      rows: result.rows as QueryData,
      totalRows: result.rows.length,
    };
  }

  async fetchSelectSchema(
    sqlRef: SQLSourceRequest
  ): Promise<SQLSourceDef | string> {
    const structDef: SQLSourceDef = {
      type: 'sql_select',
      ...sqlRef,
      dialect: this.dialectName,
      fields: [],
      name: sqlKey(sqlRef.connection, sqlRef.selectStr),
    };
    const client = await this.getClient();
    await this.withTlsHint(() => client.connect());
    await this.connectionSetup(client);
    // 1) Get row-descriptor without fetching data
    const res = await client.query({
      text: `SELECT * FROM (${sqlRef.selectStr}) _t LIMIT 0`,
    });

    // 2) Resolve every OID we might touch (field, array element, domain base)
    const neededOids = new Set<number>();

    res.fields.forEach(f => neededOids.add(f.dataTypeID));
    // we'll add more OIDs later (typelem / typebasetype) lazily

    // helper to fetch pg_type rows on demand, with cache
    const pgTypeCache = new Map<number, PgTypeRow>();

    const loadTypes = async (oids: number[]) => {
      if (oids.length === 0) return;
      const params = oids.map((_, i) => `$${i + 1}`).join(',');
      const {rows} = await client.query<PgTypeRow>(
        `
      SELECT
        oid,
        typname,
        typtype,
        typcategory,
        typelem,
        typbasetype,
        format_type(oid, NULL) AS formatted
      FROM pg_type
      WHERE oid IN (${params})
      `,
        oids
      );
      rows.forEach(r => pgTypeCache.set(r.oid, r));
    };

    // Prime the cache
    await loadTypes([...neededOids]);

    // 3) recursive mapper → info-schema compliant strings
    const mapDataType = async (oid: number): Promise<string> => {
      let t = pgTypeCache.get(oid);
      if (!t) {
        await loadTypes([oid]);
        t = pgTypeCache.get(oid)!;
      }

      // ARRAY?
      if (t.typcategory === 'A') return 'ARRAY';

      // DOMAIN?  recurse to its base type
      if (t.typtype === 'd') return mapDataType(t.typbasetype);

      // ENUM, COMPOSITE, RANGE, MULTIRANGE, PSEUDO  → USER-DEFINED
      if (['e', 'c', 'r', 'm', 'p'].includes(t.typtype)) return 'USER-DEFINED';

      // built-in scalar or base type of domain
      return t.formatted;
    };

    // helper to resolve element_type (NULL for scalars)
    const mapElementType = async (oid: number): Promise<string | null> => {
      let t = pgTypeCache.get(oid);
      if (!t) {
        await loadTypes([oid]);
        t = pgTypeCache.get(oid)!;
      }
      if (t.typcategory !== 'A') return null; // not an array

      // Ensure element row cached
      if (!pgTypeCache.has(t.typelem)) await loadTypes([t.typelem]);
      return mapDataType(t.typelem);
    };

    // 4) Build final array in original column order
    const result: InfoSchemaColumn[] = [];
    for (const field of res.fields as FieldDef[]) {
      result.push({
        columnName: field.name,
        dataType: await mapDataType(field.dataTypeID),
        elementType: await mapElementType(field.dataTypeID),
      });
    }
    for (const row of result) {
      const postgresDataType = row.dataType;
      const name = row.columnName;
      if (postgresDataType === 'ARRAY') {
        const elementType = this.dialect.sqlTypeToMalloyType(
          row.elementType as string
        );
        structDef.fields.push(mkArrayDef(elementType, name));
      } else {
        const malloyType = this.dialect.sqlTypeToMalloyType(postgresDataType);
        structDef.fields.push({...malloyType, name});
      }
    }
    await client.end();
    return structDef;
  }

  private async schemaFromQuery(
    infoQuery: string,
    structDef: StructDef,
    values?: unknown[]
  ): Promise<void> {
    const {rows, totalRows} = await this.runPostgresQuery(
      infoQuery,
      SCHEMA_PAGE_SIZE,
      0,
      false,
      values
    );
    if (!totalRows) {
      throw new Error('Unable to read schema.');
    }
    for (const row of rows) {
      const postgresDataType = row['data_type'] as string;
      const name = row['column_name'] as string;
      if (postgresDataType === 'ARRAY') {
        const elementType = this.dialect.sqlTypeToMalloyType(
          row['element_type'] as string
        );
        structDef.fields.push(mkArrayDef(elementType, name));
      } else {
        const malloyType = this.dialect.sqlTypeToMalloyType(postgresDataType);
        structDef.fields.push({...malloyType, name});
      }
    }
  }

  async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef | string> {
    const structDef: StructDef = {
      type: 'table',
      name: tableKey,
      dialect: 'postgres',
      tablePath,
      connection: this.name,
      fields: [],
    };
    // tablePath is canonical SQL — bare segments (case-folded to lower by
    // Postgres) or `"…"` quoted segments (case-preserving, `""` escape).
    // The information_schema lookup needs the raw identifier strings, not
    // the SQL surface form, so decode each segment.
    const segments = decodeDottedSegments(tablePath);
    if (segments === undefined || segments.length < 2) {
      return 'Default schema not yet supported in Postgres';
    }
    const [schema, table] = segments.slice(-2);
    const infoQuery = `
      SELECT column_name, c.data_type, e.data_type as element_type
      FROM information_schema.columns c LEFT JOIN information_schema.element_types e
        ON ((c.table_catalog, c.table_schema, c.table_name, 'TABLE', c.dtd_identifier)
          = (e.object_catalog, e.object_schema, e.object_name, e.object_type, e.collection_type_identifier))
        WHERE table_name = $1
          AND table_schema = $2
    `;

    try {
      await this.schemaFromQuery(infoQuery, structDef, [table, schema]);
    } catch (error) {
      return `Error fetching schema for ${tablePath}: ${error.message}`;
    }
    return structDef;
  }

  public async test(): Promise<void> {
    await this.runSQL('SELECT 1');
  }

  // SET statements for the connection-level application_name and session
  // settings, run at every session open (both the non-pooled and pooled
  // hooks). Non-identifier GUC keys are skipped — the ingestion layer
  // validates strictly; the driver stays lenient.
  protected sessionMetadataStatements(): string[] {
    const statements: string[] = [];
    if (this.applicationName !== undefined) {
      statements.push(
        `SET application_name = '${escapePostgresString(this.applicationName)}'`
      );
    }
    for (const [key, value] of Object.entries(this.sessionSettings ?? {})) {
      if (!POSTGRES_SETTING_KEY.test(key)) continue;
      statements.push(`SET ${key} = '${escapePostgresString(value)}'`);
    }
    return statements;
  }

  public async connectionSetup(client: Client): Promise<void> {
    await client.query("SET TIME ZONE 'UTC'");
    for (const stmt of this.sessionMetadataStatements()) {
      await client.query(stmt);
    }
    if (this.setupSQL) {
      for (const stmt of this.setupSQL.split(';\n')) {
        const trimmed = stmt.trim();
        if (trimmed) {
          await client.query(trimmed);
        }
      }
    }
  }

  public async runSQL(
    sql: string,
    {rowLimit}: RunSQLOptions = {},
    rowIndex = 0
  ): Promise<MalloyQueryData> {
    const config = await this.readQueryConfig();

    return this.runPostgresQuery(
      sql,
      rowLimit ?? config.rowLimit ?? DEFAULT_PAGE_SIZE,
      rowIndex,
      true
    );
  }

  public async *runSQLStream(
    sqlCommand: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryRecord> {
    const query = new QueryStream(sqlCommand);
    const client = await this.getClient();
    await this.withTlsHint(() => client.connect());
    await this.connectionSetup(client);
    const rowStream = client.query(query);
    let index = 0;
    for await (const row of rowStream) {
      yield row.row as QueryRecord;
      index += 1;
      if (
        (rowLimit !== undefined && index >= rowLimit) ||
        abortSignal?.aborted
      ) {
        query.destroy();
        break;
      }
    }
    await client.end();
  }

  public async estimateQueryCost(_: string): Promise<QueryRunStats> {
    return {};
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = makeDigest(sqlCommand);
    const tableName = `tt${hash.slice(0, this.dialect.maxIdentifierLength - 2)}`;

    const cmd = `CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    // console.log(cmd);
    await this.runPostgresQuery(cmd, 1000, 0, false);
    return tableName;
  }

  async close(): Promise<void> {
    return;
  }
}

export class PooledPostgresConnection
  extends PostgresConnection
  implements PooledConnection
{
  private _pool: Pool | undefined;

  constructor(
    options: PostgresConnectionOptions,
    queryOptionsReader?: QueryOptionsReader
  );
  constructor(
    name: string,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: PostgresConnectionConfigurationReader
  );
  constructor(
    arg: string | PostgresConnectionOptions,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: PostgresConnectionConfigurationReader
  ) {
    if (typeof arg === 'string') {
      super(arg, queryOptionsReader, configReader);
    } else {
      super(arg, queryOptionsReader);
    }
  }

  public isPool(): this is PooledConnection {
    return true;
  }

  public async drain(): Promise<void> {
    await this._pool?.end();
  }

  async getPool(): Promise<Pool> {
    if (!this._pool) {
      this._pool = new Pool(this.buildClientConfig(await this.readConfig()));
      this._pool.on('acquire', client => {
        client.query("SET TIME ZONE 'UTC'");
        for (const stmt of this.sessionMetadataStatements()) {
          client.query(stmt);
        }
        if (this.setupSQL) {
          for (const stmt of this.setupSQL.split(';\n')) {
            const trimmed = stmt.trim();
            if (trimmed) {
              client.query(trimmed);
            }
          }
        }
      });
    }
    return this._pool;
  }

  protected async runPostgresQuery(
    sqlCommand: string,
    _pageSize: number,
    _rowIndex: number,
    deJSON: boolean,
    values?: unknown[]
  ): Promise<MalloyQueryData> {
    const pool = await this.getPool();
    let result = await this.withTlsHint(() => pool.query(sqlCommand, values));

    if (Array.isArray(result)) {
      result = result.pop();
    }
    if (deJSON) {
      for (let i = 0; i < result.rows.length; i++) {
        result.rows[i] = result.rows[i].row;
      }
    }
    return {
      rows: result.rows as QueryData,
      totalRows: result.rows.length,
    };
  }

  public async *runSQLStream(
    sqlCommand: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryRecord> {
    const query = new QueryStream(sqlCommand);
    let index = 0;
    // This is a strange hack... `this.pool.query(query)` seems to return the wrong
    // type. Because `query` is a `QueryStream`, the result is supposed to be a
    // `QueryStream` as well, but it's not. So instead, we get a client and call
    // `client.query(query)`, which does what it's supposed to.
    const pool = await this.getPool();
    const client = await this.withTlsHint(() => pool.connect());
    const resultStream: QueryStream = client.query(query);
    for await (const row of resultStream) {
      yield row.row as QueryRecord;
      index += 1;
      if (
        (rowLimit !== undefined && index >= rowLimit) ||
        abortSignal?.aborted
      ) {
        query.destroy();
        break;
      }
    }
    client.release();
  }

  async close(): Promise<void> {
    await this.drain();
  }
}
