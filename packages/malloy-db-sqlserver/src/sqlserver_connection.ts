/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// LTNOTE: we need this extension to be installed to correctly index
//  SqlServer data...  We should probably do this on connection creation...
//
//     create extension if not exists tsm_system_rows
//

import * as crypto from 'crypto';
import type {
  Connection,
  ConnectionConfig,
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  QueryData,
  QueryDataRow,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  SQLSourceDef,
  TableSourceDef,
  StreamingConnection,
  StructDef,
  SQLSourceRequest,
} from '@malloydata/malloy';
import {TSQLDialect, mkArrayDef, sqlKey} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';

import {connect, ConnectionPool} from 'mssql';
import {randomUUID} from 'crypto';

const DEFAULT_PAGE_SIZE = 1000;
const SCHEMA_PAGE_SIZE = 1000;

interface SqlServerConnectionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  connectionString?: string;
}

type SqlServerConnectionConfigurationReader =
  | SqlServerConnectionConfiguration
  | (() => Promise<SqlServerConnectionConfiguration>);

export class SqlServerExecutor {
  public static getConnectionOptionsFromEnv(): SqlServerConnectionConfiguration {
    const user = process.env['SQLSERVER_USER'];
    if (user) {
      const host = process.env['SQLSERVER_HOST'];
      const port = Number(process.env['SQLSERVER_PORT']);
      const password = process.env['SQLSERVER_PASSWORD'];
      const database = process.env['SQLSERVER_DATABASE'];
      return {
        host,
        port,
        username: user,
        password,
        databaseName: database,
      };
    }
    return {};
  }
}

export interface SqlServerConnectionOptions
  extends ConnectionConfig,
    SqlServerConnectionConfiguration {}

export class SqlServerConnection
  extends BaseConnection
  implements Connection, StreamingConnection, PersistSQLResults
{
  public readonly name: string;
  private queryOptionsReader: QueryOptionsReader = {};
  private configReader: SqlServerConnectionConfigurationReader = {};

  private readonly dialect = new TSQLDialect();

  constructor(
    options: SqlServerConnectionOptions,
    queryOptionsReader?: QueryOptionsReader
  );
  constructor(
    name: string,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: SqlServerConnectionConfigurationReader
  );
  constructor(
    arg: string | SqlServerConnectionOptions,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: SqlServerConnectionConfigurationReader
  ) {
    super();
    if (typeof arg === 'string') {
      this.name = arg;
      if (configReader) {
        this.configReader = configReader;
      }
    } else {
      const {name, ...configReader} = arg;
      this.name = name;
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

  protected async readConfig(): Promise<SqlServerConnectionConfiguration> {
    if (this.configReader instanceof Function) {
      return this.configReader();
    } else {
      return this.configReader;
    }
  }

  get dialectName(): string {
    return 'SqlServer';
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

  public get supportsNesting(): boolean {
    return false;
  }

  protected async getClient(): Promise<ConnectionPool> {
    const {
      username: user,
      password,
      databaseName: database,
      port,
      host = 'localhost',
      connectionString,
    } = await this.readConfig();
    return connect(
      connectionString || {
        user,
        password,
        database,
        port,
        server: host,
      }
    );
  }

  protected async runSqlServerQuery(
    sqlCommand: string,
    _pageSize: number,
    _rowIndex: number,
    _deJSON: boolean
  ): Promise<MalloyQueryData> {
    const client = await this.getClient();
    await client.connect();
    await this.connectionSetup(client);

    const result = await client.query(sqlCommand);
    let rows: QueryData;
    if (Array.isArray(result.recordsets)) {
      rows = result.recordsets.flat();
    } else {
      throw new Error('SqlServer non-array output is not supported');
    }

    await client.close();
    return {
      rows,
      totalRows: result.rowsAffected.reduce((acc, val) => acc + val, 0),
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
    const tempTableName = `#tmp${randomUUID()}`.replace(/-/g, '');
    const infoQuery = `
      drop table if exists ${tempTableName};
      create table ${tempTableName} as SELECT * FROM (
        ${sqlRef.selectStr}
      ) as x where false;
      SELECT column_name, c.data_type, e.data_type as element_type
      FROM information_schema.columns c LEFT JOIN information_schema.element_types e
        ON ((c.table_catalog, c.table_schema, c.table_name, 'TABLE', c.dtd_identifier)
          = (e.object_catalog, e.object_schema, e.object_name, e.object_type, e.collection_type_identifier))
      where table_name='${tempTableName}';
    `;
    try {
      await this.schemaFromQuery(infoQuery, structDef);
    } catch (error) {
      return `Error fetching schema for ${structDef.name}: ${error}`;
    }
    return structDef;
  }

  private async schemaFromQuery(
    infoQuery: string,
    structDef: StructDef
  ): Promise<void> {
    const {rows, totalRows} = await this.runSqlServerQuery(
      infoQuery,
      SCHEMA_PAGE_SIZE,
      0,
      false
    );
    if (!totalRows) {
      throw new Error('Unable to read schema.');
    }
    for (const row of rows) {
      const SqlServerDataType = row['data_type'] as string;
      const name = row['column_name'] as string;
      if (SqlServerDataType === 'ARRAY') {
        const elementType = this.dialect.sqlTypeToMalloyType(
          row['element_type'] as string
        );
        structDef.fields.push(mkArrayDef(elementType, name));
      } else {
        const malloyType = this.dialect.sqlTypeToMalloyType(SqlServerDataType);
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
      dialect: 'SqlServer',
      tablePath,
      connection: this.name,
      fields: [],
    };
    const [schema, table] = tablePath.split('.');
    if (table === undefined) {
      return 'Default schema not yet supported in SqlServer';
    }
    const infoQuery = `
      SELECT column_name, c.data_type, e.data_type as element_type
      FROM information_schema.columns c LEFT JOIN information_schema.element_types e
        ON ((c.table_catalog, c.table_schema, c.table_name, 'TABLE', c.dtd_identifier)
          = (e.object_catalog, e.object_schema, e.object_name, e.object_type, e.collection_type_identifier))
        WHERE table_name = '${table}'
          AND table_schema = '${schema}'
    `;

    try {
      await this.schemaFromQuery(infoQuery, structDef);
    } catch (error) {
      return `Error fetching schema for ${tablePath}: ${error.message}`;
    }
    return structDef;
  }

  public async test(): Promise<void> {
    await this.runSQL('SELECT 1 AS one, 2 AS two');
  }

  public async connectionSetup(_client: ConnectionPool): Promise<void> {
    // TODO (Vitor): Discuss session timezone in SqlServer, this feature ins't straight forward
    // await client.query("SET TIME ZONE 'UTC'");
  }

  public async runSQL(
    sql: string,
    {rowLimit}: RunSQLOptions = {},
    rowIndex = 0
  ): Promise<MalloyQueryData> {
    const config = await this.readQueryConfig();

    return this.runSqlServerQuery(
      sql,
      rowLimit ?? config.rowLimit ?? DEFAULT_PAGE_SIZE,
      rowIndex,
      true
    );
  }

  public async *runSQLStream(
    sqlCommand: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    const client = await this.getClient();
    const request = client.request();
    const readableStream = request.toReadableStream();
    request.query(sqlCommand);
    let index = 0;

    for await (const row of readableStream) {
      yield row as QueryDataRow;
      index += 1;
      if (
        (rowLimit !== undefined && index >= rowLimit) ||
        abortSignal?.aborted
      ) {
        request.cancel();
        break;
      }
    }

    await client.close();
  }

  public async estimateQueryCost(_: string): Promise<QueryRunStats> {
    return {};
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = crypto.createHash('md5').update(sqlCommand).digest('hex');
    const tableName = `#tt${hash}`;

    const cmd = `CREATE TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    // console.log(cmd);
    await this.runSqlServerQuery(cmd, 1000, 0, false);
    return tableName;
  }

  async close(): Promise<void> {
    return;
  }
}

export class PooledSqlServerConnection
  extends SqlServerConnection
  implements PooledConnection
{
  private _pool: ConnectionPool | undefined;

  constructor(
    options: SqlServerConnectionOptions,
    queryOptionsReader?: QueryOptionsReader
  );
  constructor(
    name: string,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: SqlServerConnectionConfigurationReader
  );
  constructor(
    arg: string | SqlServerConnectionOptions,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: SqlServerConnectionConfigurationReader
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
    await this._pool?.close();
  }

  async getPool(): Promise<ConnectionPool> {
    if (!this._pool) {
      const {
        username: user,
        password,
        databaseName: database,
        port,
        host = 'localhost',
        connectionString,
      } = await this.readConfig();
      if (connectionString) {
        this._pool = new ConnectionPool(connectionString);
      } else {
        this._pool = new ConnectionPool({
          user,
          password,
          database,
          port,
          server: host,
        });
      }
      this._pool.on('acquire', client => client.query("SET TIME ZONE 'UTC'"));
    }
    return this._pool;
  }

  protected async runSqlServerQuery(
    sqlCommand: string,
    _pageSize: number,
    _rowIndex: number,
    _deJSON: boolean
  ): Promise<MalloyQueryData> {
    const pool = await this.getPool();
    const client = await pool.connect();
    const result = await client.query(sqlCommand);

    let rows: QueryData;
    if (Array.isArray(result.recordsets)) {
      rows = result.recordsets.flat();
    } else {
      throw new Error('SqlServer non-array output is not supported');
    }

    await client.close();
    return {
      rows,
      totalRows: result.rowsAffected.reduce((acc, val) => acc + val, 0),
    };
  }

  public async *runSQLStream(
    sqlCommand: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    let index = 0;
    // This is a strange hack... `this.pool.query(query)` seems to return the wrong
    // type. Because `query` is a `QueryStream`, the result is supposed to be a
    // `QueryStream` as well, but it's not. So instead, we get a client and call
    // `client.query(query)`, which does what it's supposed to.
    const pool = await this.getPool();
    const client = await pool.connect();

    const request = client.request();
    const readableStream = request.toReadableStream();
    request.query(sqlCommand);

    for await (const row of readableStream) {
      yield row as QueryDataRow;
      index += 1;
      if (
        (rowLimit !== undefined && index >= rowLimit) ||
        abortSignal?.aborted
      ) {
        request.cancel();
        break;
      }
    }

    await client.close();
  }

  async close(): Promise<void> {
    await this.drain();
  }
}
