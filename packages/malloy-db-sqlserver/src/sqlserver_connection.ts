/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Connection,
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  QueryData,
  QueryRecord,
  QueryOptionsReader,
  RunSQLOptions,
  SQLSourceDef,
  TableSourceDef,
  StreamingConnection,
  StructDef,
  SQLSourceRequest,
} from '@malloydata/malloy';
import {
  SQLServerDialect,
  sqlKey,
  makeDigest,
  decodeDottedTablePath,
} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';
import * as mssql from 'mssql';

/**
 * `sql` is a SQL Server login; the `azure-*` kinds are Microsoft Entra ID,
 * `azure-default` being the DefaultAzureCredential chain (managed identity,
 * workload identity, environment service principal, az CLI).
 */
export type SQLServerAuthentication =
  | 'sql'
  | 'azure-default'
  | 'azure-service-principal'
  | 'azure-msi'
  | 'azure-access-token'
  | 'ntlm';

export interface SQLServerConfiguration {
  server?: string;
  port?: number;
  database?: string;
  authentication?: SQLServerAuthentication;
  user?: string;
  password?: string;
  /** Windows domain, for `ntlm` */
  domain?: string;
  /** Entra application (client) id, for `azure-service-principal` and a user-assigned `azure-msi` */
  clientId?: string;
  tenantId?: string;
  clientSecret?: string;
  /** A token the caller already holds, for `azure-access-token` */
  accessToken?: string;
  /** Encrypt the connection; on by default, as tedious defaults it */
  encrypt?: boolean;
  /** Accept a certificate the client cannot verify, e.g. a local container's */
  trustServerCertificate?: boolean;
  /** The name the server's certificate is issued to, when it is not `server` */
  hostNameInCertificate?: string;
  /** A named instance, located through SQL Browser; `port` is then not used */
  instanceName?: string;
  /** What the server records as program_name for this connection */
  applicationName?: string;
  /** Ask an availability group for a readable secondary */
  readOnlyIntent?: boolean;
  /** Try every IP an availability group listener resolves to at once */
  multiSubnetFailover?: boolean;
  /**
   * An ADO.NET-style connection string, instead of the fields above. Only one
   * of the two may be given.
   */
  connectionString?: string;
  setupSQL?: string;
  /** tedious defaults to 15 s, which a scan can exceed */
  requestTimeoutMs?: number;
  poolMin?: number;
  poolMax?: number;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

// Sent ahead of every batch, since the pool hands out whichever connection is
// free. DATEFIRST 7 (Sunday) is only the default for US English logins.
const SESSION_SETUP = [
  'SET DATEFIRST 7',
  'SET QUOTED_IDENTIFIER ON',
  'SET ANSI_NULLS ON',
  'SET ANSI_WARNINGS ON',
];

export class SQLServerExecutor {
  /** The test harness's connection, from the MSSQL_* variables; empty when unset */
  public static getConnectionOptionsFromEnv(): SQLServerConfiguration {
    const server = process.env['MSSQL_HOST'];
    if (!server) {
      return {};
    }
    const port = process.env['MSSQL_PORT'];
    const trust = process.env['MSSQL_TRUST_SERVER_CERTIFICATE'];
    return {
      server,
      port: port ? Number(port) : undefined,
      user: process.env['MSSQL_USER'],
      password: process.env['MSSQL_PASSWORD'],
      database: process.env['MSSQL_DATABASE'],
      trustServerCertificate:
        trust === undefined ? undefined : trust === 'true',
    };
  }
}

/** The driver's authentication object for a configuration */
function authenticationFor(
  config: SQLServerConfiguration
): mssql.config['authentication'] {
  const kind = config.authentication ?? 'sql';
  switch (kind) {
    case 'sql':
      return {
        type: 'default',
        options: {userName: config.user, password: config.password},
      };
    case 'ntlm':
      return {
        type: 'ntlm',
        options: {
          userName: config.user ?? '',
          password: config.password ?? '',
          domain: config.domain ?? '',
        },
      };
    case 'azure-default':
      return {
        type: 'azure-active-directory-default',
        options: {clientId: config.clientId},
      };
    case 'azure-msi':
      return {
        type: 'azure-active-directory-msi-vm',
        options: {clientId: config.clientId},
      };
    case 'azure-service-principal':
      if (!config.clientId || !config.clientSecret || !config.tenantId) {
        throw new Error(
          'SQL Server azure-service-principal authentication needs clientId, clientSecret and tenantId'
        );
      }
      return {
        type: 'azure-active-directory-service-principal-secret',
        options: {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          tenantId: config.tenantId,
        },
      };
    case 'azure-access-token':
      if (!config.accessToken) {
        throw new Error(
          'SQL Server azure-access-token authentication needs accessToken'
        );
      }
      return {
        type: 'azure-active-directory-access-token',
        options: {token: config.accessToken},
      };
  }
}

/** The principal the connection runs as; two principals can see different rows */
function principalOf(config: SQLServerConfiguration): string | undefined {
  switch (config.authentication ?? 'sql') {
    case 'sql':
      return config.user;
    case 'ntlm':
      return config.domain ? `${config.domain}\\${config.user}` : config.user;
    case 'azure-service-principal':
    case 'azure-msi':
    case 'azure-default':
      return config.clientId;
    case 'azure-access-token':
      return undefined;
  }
}

// A connection string without its secrets: the keys ADO.NET spells a password
// or a client secret with, in any case and spacing, dropped whole. A value in
// braces may hold a semicolon.
export function connectionStringIdentity(connectionString: string): string {
  const secret = /^(password|pwd|client ?secret|access ?token)$/i;
  return connectionString
    .split(/;(?=(?:[^{}]|\{[^}]*\})*$)/)
    .filter(part => !secret.test(part.split('=')[0].trim()))
    .join(';');
}

/** The driver's config; a connection string and structured fields are not merged */
export function driverConfig(config: SQLServerConfiguration): mssql.config {
  const structured = [
    'server',
    'port',
    'instanceName',
    'database',
    'authentication',
    'user',
    'password',
    'clientId',
    'tenantId',
    'clientSecret',
    'accessToken',
  ].filter(k => config[k as keyof SQLServerConfiguration] !== undefined);
  if (config.connectionString !== undefined && structured.length > 0) {
    throw new Error(
      `SQL Server connection sets connectionString and also ${structured.join(', ')}; use one or the other`
    );
  }
  const pool = {
    min: config.poolMin ?? 0,
    max: config.poolMax ?? 4,
  };
  const requestTimeout = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (config.connectionString !== undefined) {
    return {
      server: '',
      options: {connectionString: config.connectionString},
      pool,
      requestTimeout,
    };
  }
  // `host,port` is how SSMS and Looker write a non-default port
  const [host, hostPort] = (config.server ?? 'localhost').split(',', 2);
  const port = config.port ?? (hostPort ? Number(hostPort) : 1433);
  return {
    server: host,
    port: config.instanceName === undefined ? port : undefined,
    database: config.database,
    authentication: authenticationFor(config),
    options: {
      encrypt: config.encrypt ?? true,
      trustServerCertificate: config.trustServerCertificate ?? false,
      useUTC: true,
      instanceName: config.instanceName,
      appName: config.applicationName,
      readOnlyIntent: config.readOnlyIntent ?? false,
      multiSubnetFailover: config.multiSubnetFailover ?? false,
      serverName: config.hostNameInCertificate,
    },
    pool,
    requestTimeout,
  };
}

/** A canonical table path as OBJECT_ID() reads it: bracket-quoted segments */
function objectIdLiteral(dialect: SQLServerDialect, tablePath: string): string {
  if (
    dialect.identifierEscapeStyle !== 'doubled' &&
    dialect.identifierEscapeStyle !== 'backslash'
  ) {
    throw new Error(`${dialect.name}: identifierEscapeStyle is not set`);
  }
  const decoded = decodeDottedTablePath(tablePath, {
    quoteChar: dialect.identifierQuoteChar,
    escapeStyle: dialect.identifierEscapeStyle,
    bareIdentRegex: dialect.tablePathBareIdentRegex,
    dialectName: dialect.name,
  });
  if (!decoded.ok) {
    throw new Error(decoded.error);
  }
  const bracketed = decoded.segments
    .map(seg => `[${seg.value.replace(/]/g, ']]')}]`)
    .join('.');
  return `'${bracketed.replace(/'/g, "''")}'`;
}

export interface SQLServerConnectionOptions extends SQLServerConfiguration {
  name: string;
}

export class SQLServerConnection
  extends BaseConnection
  implements
    Connection,
    StreamingConnection,
    PersistSQLResults,
    PooledConnection
{
  public readonly name: string;
  private readonly dialect = new SQLServerDialect();
  private readonly config: SQLServerConfiguration;
  private readonly queryOptions: QueryOptionsReader;
  private pool: mssql.ConnectionPool | undefined;
  private connecting: Promise<mssql.ConnectionPool> | undefined;

  constructor(
    options: SQLServerConnectionOptions,
    queryOptions?: QueryOptionsReader
  );
  constructor(
    name: string,
    config?: SQLServerConfiguration,
    queryOptions?: QueryOptionsReader
  );
  constructor(
    arg: string | SQLServerConnectionOptions,
    configOrQueryOptions?: SQLServerConfiguration | QueryOptionsReader,
    queryOptions?: QueryOptionsReader
  ) {
    super();
    if (typeof arg === 'string') {
      this.name = arg;
      this.config = (configOrQueryOptions as SQLServerConfiguration) ?? {};
      this.queryOptions = queryOptions ?? {};
    } else {
      const {name, ...config} = arg;
      this.name = name;
      this.config = config;
      this.queryOptions = (configOrQueryOptions as QueryOptionsReader) ?? {};
    }
  }

  get dialectName(): string {
    return this.dialect.name;
  }

  public isPool(): this is PooledConnection {
    return true;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canStream(): this is StreamingConnection {
    return true;
  }

  public getDigest(): string {
    const c = this.config;
    return makeDigest(
      'sqlserver',
      c.connectionString === undefined
        ? undefined
        : connectionStringIdentity(c.connectionString),
      c.server,
      c.port !== undefined ? String(c.port) : undefined,
      c.instanceName,
      c.database,
      c.authentication ?? 'sql',
      principalOf(c),
      c.setupSQL
    );
  }

  private readQueryOptions(): RunSQLOptions {
    return typeof this.queryOptions === 'function'
      ? this.queryOptions()
      : this.queryOptions;
  }

  private batchPrefix(): string {
    const setup = [...SESSION_SETUP];
    if (this.config.setupSQL) {
      setup.push(this.config.setupSQL);
    }
    return setup.join(';\n') + ';\n';
  }

  private async getPool(): Promise<mssql.ConnectionPool> {
    if (this.pool) {
      return this.pool;
    }
    if (!this.connecting) {
      const pool = new mssql.ConnectionPool(driverConfig(this.config));
      this.connecting = pool.connect().then(p => {
        this.pool = p;
        return p;
      });
    }
    return this.connecting;
  }

  public async test(): Promise<void> {
    await this.runRawSQL('SELECT 1 AS one');
  }

  public async runSQL(
    sql: string,
    options: RunSQLOptions = {}
  ): Promise<MalloyQueryData> {
    const rowLimit = options.rowLimit ?? this.readQueryOptions().rowLimit;
    const result = await this.runRawSQL(
      this.sqlWithQueryMetadata(sql, options.queryMetadata)
    );
    const rows = result.rows.map(row => this.parseRow(row));
    if (rowLimit !== undefined && rows.length > rowLimit) {
      return {rows: rows.slice(0, rowLimit), totalRows: rowLimit};
    }
    return {rows, totalRows: rows.length};
  }

  // The dialect's final stage returns each row as one JSON document
  private parseRow(row: QueryRecord): QueryRecord {
    const document = row['row'];
    if (typeof document !== 'string') {
      throw new Error(
        'SQL Server runSQL expects a row per JSON document, as the dialect writes; runRawSQL runs other SQL'
      );
    }
    return JSON.parse(document);
  }

  public async runRawSQL(sql: string): Promise<MalloyQueryData> {
    return this.runBatch(sql);
  }

  // Each parameter is an NVARCHAR(MAX) the batch reads as @name
  private async runBatch(
    sql: string,
    parameters: Record<string, string> = {}
  ): Promise<MalloyQueryData> {
    const pool = await this.getPool();
    const request = pool.request();
    for (const [name, value] of Object.entries(parameters)) {
      request.input(name, mssql.NVarChar(mssql.MAX), value);
    }
    const result = await request.query(this.batchPrefix() + sql);
    const rows = (result.recordset ?? []) as QueryData;
    return {rows, totalRows: rows.length};
  }

  public async *runSQLStream(
    sqlCommand: string,
    options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryRecord> {
    const {rowLimit, abortSignal} = options;
    const pool = await this.getPool();
    const request = pool.request();
    request.stream = true;
    const stream = request.toReadableStream();
    const cancel = () => request.cancel();
    abortSignal?.addEventListener('abort', cancel, {once: true});
    try {
      request.query(
        this.batchPrefix() +
          this.sqlWithQueryMetadata(sqlCommand, options.queryMetadata)
      );
      let index = 0;
      for await (const row of stream) {
        yield this.parseRow(row as QueryRecord);
        index += 1;
        if (rowLimit !== undefined && index >= rowLimit) {
          request.cancel();
          break;
        }
      }
    } finally {
      abortSignal?.removeEventListener('abort', cancel);
    }
  }

  private async schemaFromRows(
    rows: QueryData,
    structDef: StructDef
  ): Promise<void> {
    for (const row of rows) {
      const name = row['column_name'] as string;
      const sqlType = row['data_type'] as string;
      const malloyType = this.dialect.sqlTypeToMalloyType(sqlType);
      structDef.fields.push({...malloyType, name});
    }
  }

  async fetchTableSchema(
    tableName: string,
    tablePath: string
  ): Promise<TableSourceDef | string> {
    const structDef: TableSourceDef = {
      type: 'table',
      name: tableName,
      tablePath,
      dialect: this.dialectName,
      connection: this.name,
      fields: [],
    };
    let objectId: string;
    try {
      objectId = objectIdLiteral(this.dialect, tablePath);
    } catch (e) {
      return `Invalid table path ${tablePath}: ${e.message}`;
    }
    const infoQuery = `
      SELECT
        c.name AS column_name,
        CASE
          WHEN t.name IN ('decimal', 'numeric') THEN CONCAT(t.name, '(', c.precision, ',', c.scale, ')')
          ELSE t.name
        END AS data_type
      FROM sys.columns c
      JOIN sys.types t ON t.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID(${objectId})
      ORDER BY c.column_id`;
    try {
      const result = await this.runRawSQL(infoQuery);
      if (result.rows.length === 0) {
        return `Table ${tablePath} not found`;
      }
      await this.schemaFromRows(result.rows, structDef);
    } catch (error) {
      return `Error fetching schema for ${tablePath}: ${error.message}`;
    }
    return structDef;
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
    // Describes the statement without running it
    const infoQuery = `
      SELECT
        name AS column_name,
        system_type_name AS data_type,
        error_message
      FROM sys.dm_exec_describe_first_result_set(@sql, NULL, 0)
      ORDER BY column_ordinal`;
    try {
      const result = await this.runBatch(infoQuery, {sql: sqlRef.selectStr});
      const failed = result.rows.find(r => r['error_message'] !== null);
      if (failed) {
        return `Error fetching schema for SQL block: ${failed['error_message']}`;
      }
      await this.schemaFromRows(result.rows, structDef);
    } catch (error) {
      return `Error fetching schema for SQL block: ${error.message}`;
    }
    return structDef;
  }

  /**
   * A table in tempdb, which lives until the server restarts: a temp table
   * would go with the pooled connection that created it. The query usually
   * begins with a CTE, which cannot sit inside `SELECT INTO ... FROM (...)`,
   * so the server describes the query, creates the table from that
   * description, and fills it through INSERT ... EXEC.
   */
  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = makeDigest(sqlCommand).slice(0, 32);
    const tableName = `tempdb.dbo.malloy_tt${hash}`;
    const cmd = `IF OBJECT_ID('${tableName}') IS NULL
BEGIN
  DECLARE @error NVARCHAR(MAX) = (
    SELECT TOP 1 error_message
    FROM sys.dm_exec_describe_first_result_set(@sql, NULL, 0)
    WHERE error_message IS NOT NULL
  );
  IF @error IS NOT NULL THROW 50000, @error, 1;
  DECLARE @columns NVARCHAR(MAX) = (
    SELECT STRING_AGG(QUOTENAME(name) + N' ' + system_type_name, N', ')
      WITHIN GROUP (ORDER BY column_ordinal)
    FROM sys.dm_exec_describe_first_result_set(@sql, NULL, 0)
  );
  BEGIN TRY
    EXEC(N'CREATE TABLE ${tableName} (' + @columns + N')');
    INSERT INTO ${tableName} EXEC sp_executesql @sql;
  END TRY
  BEGIN CATCH
    -- 2714: another connection created it first
    IF ERROR_NUMBER() <> 2714 THROW;
  END CATCH
END`;
    await this.runBatch(cmd, {sql: sqlCommand});
    return tableName;
  }

  public async drain(): Promise<void> {
    const pool = this.pool;
    this.pool = undefined;
    this.connecting = undefined;
    await pool?.close();
  }

  async close(): Promise<void> {
    await this.drain();
  }
}
