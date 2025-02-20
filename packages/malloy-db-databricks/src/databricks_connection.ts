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

import {
  Connection,
  ConnectionConfig,
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  DatabricksDialect,
  QueryDataRow,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  SQLSourceDef,
  TableSourceDef,
  StreamingConnection,
  StructDef,
  mkArrayDef,
} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';

import {Client} from 'pg';
import {DBSQLClient} from '@databricks/sql';
import crypto from 'crypto';
import IDBSQLSession from '@databricks/sql/dist/contracts/IDBSQLSession';
import {ConnectionOptions} from '@databricks/sql/dist/contracts/IDBSQLClient';

const DEFAULT_PAGE_SIZE = 1000;

export interface DatabricksConnectionOptions extends ConnectionConfig {
  host: string;
  path: string;
  token?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  defaultCatalog: string;
}

export class DatabricksConnection
  extends BaseConnection
  implements Connection, StreamingConnection, PersistSQLResults
{
  public readonly name: string;
  private queryOptionsReader: QueryOptionsReader = {};
  private config: DatabricksConnectionOptions = {
    host: '',
    path: '',
    name: '',
    defaultCatalog: '',
  };

  private readonly dialect = new DatabricksDialect();

  private client: DBSQLClient | null = null;
  private session: IDBSQLSession | null = null;

  constructor(
    name: string,
    arg?: DatabricksConnectionOptions,
    queryOptionsReader?: QueryOptionsReader
  );
  constructor(
    name: string,
    arg: DatabricksConnectionOptions,
    queryOptionsReader?: QueryOptionsReader
  ) {
    super();
    this.name = name;

    this.config = arg;

    if (queryOptionsReader) {
      this.queryOptionsReader = queryOptionsReader;
    }

    this.client = new DBSQLClient();
  }

  private async readQueryConfig(): Promise<RunSQLOptions> {
    if (this.queryOptionsReader instanceof Function) {
      return this.queryOptionsReader();
    } else {
      return this.queryOptionsReader;
    }
  }

  get dialectName(): string {
    return 'databricks';
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
    return true;
  }

  async fetchSelectSchema(
    sqlRef: SQLSourceDef
  ): Promise<SQLSourceDef | string> {
    const structDef: SQLSourceDef = {...sqlRef, fields: []};

    const infoQuery = [
      `CREATE OR REPLACE TEMP VIEW temp_schema_view AS
      ${sqlRef.selectStr};`,
      'DESCRIBE TABLE temp_schema_view;',
    ];

    try {
      await this.schemaFromQuery(infoQuery, structDef);
    } catch (error) {
      return `SELECT Error fetching schema for ${sqlRef.selectStr}: ${error}`;
    }
    return structDef;
  }

  private async schemaFromQuery(
    infoQuery: string[],
    structDef: StructDef
  ): Promise<void> {
    const {rows, totalRows} = await this.runRawSQL(infoQuery);
    if (!totalRows) {
      throw new Error('Unable to read schema.');
    }
    for (const row of rows) {
      const databricksDataType = row['data_type'] as string;
      const name = row['col_name'] as string;
      if (databricksDataType === 'ARRAY') {
        const elementType = this.dialect.sqlTypeToMalloyType(
          row['element_type'] as string
        );
        structDef.fields.push(mkArrayDef(elementType, name));
      } else {
        const malloyType = this.dialect.sqlTypeToMalloyType(databricksDataType);
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
      dialect: 'databricks',
      tablePath,
      connection: this.name,
      fields: [],
    };
    const [_, table] = tablePath.split('.');
    if (table === undefined) {
      return 'Table is undefined';
    }

    const infoQuery = `
      DESCRIBE TABLE ${tablePath}
    `;

    try {
      await this.schemaFromQuery([infoQuery], structDef);
    } catch (error) {
      return `Table Error fetching schema for ${tablePath} with config: ${JSON.stringify(
        this.config
      )}: ${error.message}`;
    }
    return structDef;
  }

  public async test(): Promise<void> {
    await this.runSQL('SELECT 1');
  }

  public async connectionSetup(client: Client): Promise<void> {
    await client.query("SET TIME ZONE 'UTC'");
  }

  public async runRawSQL(
    sql: string[],
    {rowLimit}: RunSQLOptions = {},
    _rowIndex = 0
  ): Promise<MalloyQueryData> {
    if (!this.client) {
      throw new Error('Databricks connection not established');
    }

    const queryConfig = await this.readQueryConfig();
    const args = this.config.token
      ? {
          token: this.config.token,
          host: this.config.host,
          path: this.config.path,
        }
      : ({
          authType: 'databricks-oauth',
          host: this.config.host,
          path: this.config.path,
          oauthClientId: this.config.oauthClientId,
          oauthClientSecret: this.config.oauthClientSecret,
        } as ConnectionOptions);

    return this.client
      .connect(args)
      .then(async client => {
        const session = await client.openSession();
        const catalogStmt = `USE CATALOG ${this.config.defaultCatalog}`;
        const sqlWithCatalog = [catalogStmt, ...sql];
        let result: QueryDataRow[] = [];
        for (let i = 0; i < sqlWithCatalog.length; i++) {
          const queryOperation = await session.executeStatement(
            sqlWithCatalog[i],
            {
              runAsync: true,
            }
          );
          result = (await queryOperation.fetchAll()) as QueryDataRow[];
          await queryOperation.close();
        }

        // Extract actual result from Databricks response
        const actualResult = result.map(row =>
          row['row'] ? JSON.parse(String(row['row'])) : row
        );

        // restrict num rows if necessary
        const databricksRowLimit =
          rowLimit ?? queryConfig.rowLimit ?? DEFAULT_PAGE_SIZE;

        if (result.length > databricksRowLimit) {
          result = result.slice(0, databricksRowLimit);
        }

        const finalResult = {rows: actualResult, totalRows: result.length};
        await session.close();
        await client.close();
        return finalResult;
      })
      .catch(error => {
        throw new Error(`Databricks connection / execution error: ${error}`);
      });
  }

  public async runSQL(
    sql: string,
    {rowLimit}: RunSQLOptions = {},
    _rowIndex = 0
  ): Promise<MalloyQueryData> {
    const {rows, totalRows} = await this.runRawSQL(
      [sql],
      {rowLimit},
      _rowIndex
    );
    const actualResult = rows.map(row =>
      row['row'] ? JSON.parse(String(row['row'])) : row
    );
    return {rows: actualResult, totalRows};
  }

  public async *runSQLStream(
    sqlCommand: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    const result = await this.runSQL(sqlCommand, {rowLimit});
    for (const row of result.rows) {
      if (abortSignal?.aborted) break;
      yield row;
    }
  }

  public async estimateQueryCost(_: string): Promise<QueryRunStats> {
    return {};
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = crypto.createHash('md5').update(sqlCommand).digest('hex');
    const tableName = `tt${hash}`;
    const cmd = `CREATE or replace TEMPORARY VIEW ${tableName} AS (${sqlCommand})`;
    await this.runSQL(cmd);
    return tableName;
  }

  async close(): Promise<void> {
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}
