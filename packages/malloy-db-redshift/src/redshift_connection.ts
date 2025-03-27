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
//  postgres data...  We should probably do this on connection creation...
//
//     create extension if not exists tsm_system_rows
//

import * as crypto from 'crypto';
import {
  Connection,
  ConnectionConfig,
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  RedshiftDialect,
  QueryData,
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

import {Pool, types} from 'pg';
// Override parser for 64-bit integers (OID 20) and standard integers (OID 23)
types.setTypeParser(20, val => parseInt(val, 10));
types.setTypeParser(23, val => parseInt(val, 10));
import {randomUUID} from 'crypto';
interface RedshiftConnectionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  schema?: string;
}

type RedshiftConnectionConfigurationReader = RedshiftConnectionConfiguration;

export interface RedshiftConnectionOptions
  extends ConnectionConfig,
    RedshiftConnectionConfiguration {}

export class RedshiftConnection
  extends BaseConnection
  implements Connection, StreamingConnection, PersistSQLResults
{
  public readonly name: string;
  private config: RedshiftConnectionConfigurationReader = {};
  private readonly dialect = new RedshiftDialect();
  private pool: Pool;
  constructor(
    name: string,
    configReader?: RedshiftConnectionConfigurationReader,
    queryOptionsReader?: QueryOptionsReader
  );
  constructor(
    name: string,
    configReader?: RedshiftConnectionConfigurationReader,
    queryOptionsReader?: QueryOptionsReader
  ) {
    super();
    this.name = name;
    if (configReader) {
      this.config = configReader;
    }

    // Synchronously get config
    let config;
    if (this.config instanceof Function) {
      config = this.config();
    } else {
      config = this.config;
    }

    const {
      username: user,
      password,
      databaseName: database,
      port,
      host,
    } = config;

    this.pool = new Pool({
      user,
      password,
      database,
      port,
      host,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  protected async readConfig(): Promise<RedshiftConnectionConfiguration> {
    if (this.config instanceof Function) {
      return this.config();
    } else {
      return this.config;
    }
  }

  get dialectName(): string {
    return 'redshift';
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
    const tempTableName = `tmp${randomUUID()}`.replace(/-/g, '');
    const infoQuery = `DROP TABLE IF EXISTS ${tempTableName};
      CREATE TEMP TABLE ${tempTableName} AS ${sqlRef.selectStr};
      SELECT "column" as "column_name", type as "data_type", null as "comment"
      FROM pg_table_def
      WHERE tablename = '${tempTableName}';
      `;
    try {
      await this.schemaFromQuery(infoQuery, structDef);
    } catch (error) {
      const queries = infoQuery;
      return `Error fetching SELECT schema for \n ${queries}: \n ${error}`;
    }
    return structDef;
  }

  private async schemaFromQuery(
    infoQuery: string | string[],
    structDef: StructDef
  ): Promise<void> {
    const {rows, totalRows} = await this.runSQL(infoQuery);
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
      dialect: 'redshift',
      tablePath,
      connection: this.name,
      fields: [],
    };
    const [schema, table] = tablePath.split('.');
    if (table === undefined) {
      return 'Default schema not yet supported in Postgres';
    }
    const infoQuery = `SELECT "column_name", "data_type", "remarks" as "comment"
      FROM svv_columns
      WHERE table_schema = '${schema}'
      AND table_name = '${table}';`;

    try {
      await this.schemaFromQuery(infoQuery, structDef);
    } catch (error) {
      return `Error fetching TABLE schema for ${tablePath}: ${error.message}`;
    }
    return structDef;
  }

  public async test(): Promise<void> {
    await this.runSQL('SELECT 1');
  }

  protected async runRedshiftQuery(
    sql: string | string[],
    _pageSize: number,
    _rowIndex: number,
    deJSON: boolean
  ): Promise<MalloyQueryData> {
    const sqlArray = this.config.schema
      ? [`SET search_path TO ${this.config.schema};`]
      : [];
    if (Array.isArray(sql)) {
      sqlArray.push(...sql);
    } else {
      sqlArray.push(sql);
    }

    let client;
    try {
      // get client from pool
      client = await this.pool.connect();

      let result;
      for (const sqlStatement of sqlArray) {
        result = await client.query(sqlStatement);
      }
      if (Array.isArray(result)) {
        result = result.pop();
      }
      if (result?.rows) {
        result.rows = result.rows.map(row => {
          const newRow = {...row};
          Object.keys(newRow).forEach((key, index) => {
            if (key === '?column?') {
              newRow[index + 1] = newRow[key];
              delete newRow[key];
            }
          });
          return newRow;
        });
      }

      return {
        rows: result.rows as QueryData,
        totalRows: result.rows.length,
      };
    } catch (error) {
      throw new Error(`Error executing query: ${error.message}`);
    } finally {
      if (client) client.release();
    }
  }

  public async runSQL(
    sql: string | string[],
    {rowLimit}: RunSQLOptions = {},
    _rowIndex = 0
  ): Promise<MalloyQueryData> {
    const result = await this.runRedshiftQuery(sql, 100000, 0, true);
    return result;
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

    const cmd = [
      // redshift turns camelcase into all lowercase
      // this doesn't actually matter for prod,
      // but temp table tests do expect the original case
      'SET enable_case_sensitive_identifier TO true;',
      `DROP TABLE IF EXISTS ${tableName};`,
      `CREATE TEMP TABLE ${tableName} AS ${sqlCommand};`,
    ];
    await this.runSQL(cmd);
    return tableName;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
    return;
  }
}
