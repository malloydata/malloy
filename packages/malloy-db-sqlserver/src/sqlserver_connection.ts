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
import {TSQLDialect, sqlKey} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';

import {connect, ConnectionPool} from 'mssql';
import {randomUUID} from 'crypto';

const DEFAULT_PAGE_SIZE = 1000;
const SCHEMA_PAGE_SIZE = 1000;

interface SQLServerConnectionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  connectionString?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  schema?: string;
}

type SQLServerConnectionConfigurationReader =
  | SQLServerConnectionConfiguration
  | (() => Promise<SQLServerConnectionConfiguration>);

export class SQLServerExecutor {
  public static getConnectionOptionsFromEnv(): SQLServerConnectionConfiguration {
    const user = process.env['SQLSERVER_USER'];
    if (user) {
      const host = process.env['SQLSERVER_HOST'];
      const port = Number(process.env['SQLSERVER_PORT']);
      const password = process.env['SQLSERVER_PASSWORD'];
      const database = process.env['SQLSERVER_DATABASE'];
      const schema = process.env['SQLSERVER_SCHEMA'];
      const encrypt =
        process.env['SQLSERVER_ENCRYPT']?.toLowerCase() === 'true';
      const trustServerCertificate =
        process.env['SQLSERVER_TRUST_SERVER_CERTIFICATE']?.toLowerCase() ===
        'true';

      return {
        host,
        port,
        username: user,
        password,
        databaseName: database,
        encrypt,
        trustServerCertificate,
        schema,
      };
    }
    return {};
  }
}

export interface SQLServerConnectionOptions
  extends ConnectionConfig,
    SQLServerConnectionConfiguration {}

export class SQLServerConnection
  extends BaseConnection
  implements Connection, StreamingConnection, PersistSQLResults
{
  public readonly name: string;
  private queryOptionsReader: QueryOptionsReader = {};
  private configReader: SQLServerConnectionConfigurationReader = {};

  private readonly dialect = new TSQLDialect();

  constructor(
    options: SQLServerConnectionOptions,
    queryOptionsReader?: QueryOptionsReader
  );
  constructor(
    name: string,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: SQLServerConnectionConfigurationReader
  );
  constructor(
    arg: string | SQLServerConnectionOptions,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: SQLServerConnectionConfigurationReader
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

  protected async readConfig(): Promise<SQLServerConnectionConfiguration> {
    if (this.configReader instanceof Function) {
      return this.configReader();
    } else {
      return this.configReader;
    }
  }

  get dialectName(): string {
    return 'tsql';
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

  // TODO (vitor): This takes about 20 seconds. Kinda odd but we can figure it out.
  // Right now it needs to run before running the tests.
  protected async maybeCreateNumbersTable(
    client: ConnectionPool,
    schema: string | undefined = 'dbo'
  ) {
    const query = `
    IF OBJECT_ID('[${schema}].malloynumbers', 'U') IS NULL
    BEGIN
        PRINT 'Creating [${schema}].malloynumbers...';

        CREATE TABLE [${schema}].malloynumbers (
            n INT NOT NULL PRIMARY KEY
        );

        PRINT 'Populating [${schema}].malloynumbers with 10 million rows...';

        ;WITH
        E1 AS (SELECT 1 AS n FROM (VALUES(1),(1),(1),(1),(1),(1),(1),(1),(1),(1)) AS x(n)), -- 10
        E2 AS (SELECT 1 AS n FROM E1 AS a CROSS JOIN E1 AS b),                             -- 100
        E3 AS (SELECT 1 AS n FROM E2 AS a CROSS JOIN E2 AS b),                             -- 10,000
        E4 AS (SELECT 1 AS n FROM E3 AS a CROSS JOIN E2 AS b),                             -- 1,000,000
        E5 AS (SELECT 1 AS n FROM E4 AS a CROSS JOIN E1 AS b),                             -- 10,000,000
        Tally AS (
            SELECT TOP (10000000)
                  ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n
            FROM E5
        )
        INSERT INTO [${schema}].malloynumbers (n)
        SELECT n FROM Tally
        OPTION (MAXRECURSION 0);

        PRINT '[${schema}].malloynumbers created and populated.';
    END
    ELSE
    BEGIN
        PRINT '[${schema}].malloynumbers already exists. Skipping creation.';
    END;
    `;
    await client.query(query);
  }

  protected async getClient(): Promise<ConnectionPool> {
    const {
      username: user,
      password,
      databaseName: database,
      port,
      host = 'localhost',
      connectionString,
      encrypt,
      trustServerCertificate,
    } = await this.readConfig();
    return connect(
      connectionString || {
        user,
        password,
        database,
        port,
        server: host,
        options: {
          encrypt,
          trustServerCertificate,
        },
        requestTimeout: 2 * 60 * 1000,
      }
    );
  }

  protected async runSQLServerQuery(
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
      throw new Error('SQLServer non-array output is not supported');
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
    const tempTableName = `#${randomUUID()}`.replace(/-/g, '');

    const infoQuery = `
      DROP TABLE IF EXISTS ${tempTableName};
      SELECT TOP(0) *
      INTO ${tempTableName}
      FROM (${sqlRef.selectStr}) AS t;
      SELECT
          c.name AS column_name,
          typ.name AS data_type,
          NULL as element_type
      FROM tempdb.sys.tables AS t
      JOIN tempdb.sys.columns AS c
          ON t.object_id = c.object_id
      JOIN tempdb.sys.types AS typ
          ON c.user_type_id = typ.user_type_id
      WHERE t.name LIKE '${tempTableName}%';
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
    const {rows, totalRows} = await this.runSQLServerQuery(
      infoQuery,
      SCHEMA_PAGE_SIZE,
      0,
      false
    );
    if (!totalRows) {
      throw new Error('Unable to read schema.');
    }
    for (const row of rows) {
      const SQLServerDataType = row['data_type'] as string;
      const name = row['column_name'] as string;
      const malloyType = this.dialect.sqlTypeToMalloyType(SQLServerDataType);
      structDef.fields.push({...malloyType, name});
    }
  }

  async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef | string> {
    const structDef: StructDef = {
      type: 'table',
      name: tableKey,
      dialect: 'tsql',
      tablePath,
      connection: this.name,
      fields: [],
    };
    const [schema, table] = tablePath.split('.');
    if (table === undefined) {
      return 'Default schema not yet supported in SQLServer';
    }
    // TODO (vitor): Not sure if we want to support spaces in table definitions
    const infoQuery = `
      SELECT
        column_name,
        c.data_type,
        NULL as element_type
      FROM information_schema.columns c
      WHERE table_name = '${table.replace(/`/g, '')}'
        AND table_schema = '${schema.replace(/`/g, '')}';
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
    // TODO (Vitor): Discuss session timezone in SQLServer, this feature ins't straight forward
    // await client.query("SET TIME ZONE 'UTC'");
  }

  public async runSQL(
    sql: string,
    {rowLimit}: RunSQLOptions = {},
    rowIndex = 0
  ): Promise<MalloyQueryData> {
    const config = await this.readQueryConfig();
    const result = await this.runSQLServerQuery(
      sql,
      rowLimit ?? config.rowLimit ?? DEFAULT_PAGE_SIZE,
      rowIndex,
      true
    );
    return result;
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
    const tableName = `#${hash}`;

    const cmd = `CREATE TABLE IF NOT EXISTS [${tableName.replace(
      /`/g,
      ''
    )}] AS (${sqlCommand});`;
    await this.runSQLServerQuery(cmd, 1000, 0, false);
    return tableName;
  }

  async close(): Promise<void> {
    return;
  }
}

export class PooledSQLServerConnection
  extends SQLServerConnection
  implements PooledConnection
{
  private _pool: ConnectionPool | undefined;

  constructor(
    options: SQLServerConnectionOptions,
    queryOptionsReader?: QueryOptionsReader
  );
  constructor(
    name: string,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: SQLServerConnectionConfigurationReader
  );
  constructor(
    arg: string | SQLServerConnectionOptions,
    queryOptionsReader?: QueryOptionsReader,
    configReader?: SQLServerConnectionConfigurationReader
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
        encrypt,
        trustServerCertificate,
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
          options: {
            encrypt,
            trustServerCertificate,
          },
          requestTimeout: 2 * 60 * 1000,
        });
      }
      this._pool.on('acquire', _client => {
        // TODO (vitor): Idk about this set time zone situation...
        // await client.query("SET TIME ZONE 'UTC'");
      });
    }
    return this._pool;
  }

  protected async runSQLServerQuery(
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
      throw new Error('SQLServer non-array output is not supported');
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
