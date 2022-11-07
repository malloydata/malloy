/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

// LTNOTE: we need this extension to be installed to correctly index
//  postgres data...  We should probably do this on connection creation...
//
//     create extension if not exists tsm_system_rows
//

import * as crypto from "crypto";
import {
  FetchSchemaAndRunSimultaneously,
  FetchSchemaAndRunStreamSimultaneously,
  PersistSQLResults,
  RunSQLOptions,
  StreamingConnection,
  StructDef,
  MalloyQueryData,
  NamedStructDefs,
  AtomicFieldTypeInner,
  QueryData,
  PooledConnection,
  parseTableURI,
  SQLBlock,
  Connection,
  QueryDataRow,
} from "@malloydata/malloy";
import { Client, Pool, PoolClient } from "pg";
import QueryStream from "pg-query-stream";

const postgresToMalloyTypes: { [key: string]: AtomicFieldTypeInner } = {
  "character varying": "string",
  name: "string",
  text: "string",
  date: "date",
  integer: "number",
  bigint: "number",
  "double precision": "number",
  "timestamp without time zone": "timestamp", // maybe not
  oid: "string",
  boolean: "boolean",
  // ARRAY: "string",
  "timestamp with time zone": "timestamp",
  timestamp: "timestamp",
  '"char"': "string",
  character: "string",
  smallint: "number",
  xid: "string",
  real: "number",
  interval: "string",
  inet: "string",
  regtype: "string",
  numeric: "number",
  bytea: "string",
  pg_ndistinct: "number",
};

interface PostgresQueryConfiguration {
  rowLimit?: number;
}

type PostgresQueryConfigurationReader =
  | PostgresQueryConfiguration
  | (() => PostgresQueryConfiguration)
  | (() => Promise<PostgresQueryConfiguration>);

interface PostgresConnectionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
}

type PostgresConnectionConfigurationReader =
  | PostgresConnectionConfiguration
  | (() => Promise<PostgresConnectionConfiguration>);

const DEFAULT_PAGE_SIZE = 1000;
const SCHEMA_PAGE_SIZE = 1000;

export class PostgresConnection
  implements Connection, StreamingConnection, PersistSQLResults
{
  private schemaCache = new Map<
    string,
    | { schema: StructDef; error?: undefined }
    | { error: string; schema?: undefined }
  >();
  private sqlSchemaCache = new Map<
    string,
    | { schema: StructDef; error?: undefined }
    | { error: string; schema?: undefined }
  >();
  private queryConfigReader: PostgresQueryConfigurationReader;
  private configReader: PostgresConnectionConfigurationReader;
  public readonly name;

  constructor(
    name: string,
    queryConfigReader: PostgresQueryConfigurationReader = {},
    configReader: PostgresConnectionConfigurationReader = {}
  ) {
    this.queryConfigReader = queryConfigReader;
    this.configReader = configReader;
    this.name = name;
  }

  private async readQueryConfig(): Promise<PostgresQueryConfiguration> {
    if (this.queryConfigReader instanceof Function) {
      return this.queryConfigReader();
    } else {
      return this.queryConfigReader;
    }
  }

  private async readConfig(): Promise<PostgresConnectionConfiguration> {
    if (this.configReader instanceof Function) {
      return this.configReader();
    } else {
      return this.configReader;
    }
  }

  get dialectName(): string {
    return "postgres";
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canFetchSchemaAndRunSimultaneously(): this is FetchSchemaAndRunSimultaneously {
    // TODO feature-sql-block Implement FetchSchemaAndRunSimultaneously
    return false;
  }

  public canFetchSchemaAndRunStreamSimultaneously(): this is FetchSchemaAndRunStreamSimultaneously {
    return false;
  }

  public canStream(): this is StreamingConnection {
    return true;
  }

  public async fetchSchemaForTables(missing: string[]): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    const schemas: NamedStructDefs = {};
    const errors: { [name: string]: string } = {};

    for (const tableURL of missing) {
      let inCache = this.schemaCache.get(tableURL);
      if (!inCache) {
        try {
          inCache = {
            schema: await this.getTableSchema(tableURL),
          };
          this.schemaCache.set(tableURL, inCache);
        } catch (error) {
          inCache = { error: error.message };
        }
      }
      if (inCache.schema !== undefined) {
        schemas[tableURL] = inCache.schema;
      } else {
        errors[tableURL] = inCache.error;
      }
    }
    return { schemas, errors };
  }

  public async fetchSchemaForSQLBlocks(sqlRefs: SQLBlock[]): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    const schemas: NamedStructDefs = {};
    const errors: { [name: string]: string } = {};

    for (const sqlRef of sqlRefs) {
      const key = sqlRef.name;
      let inCache = this.sqlSchemaCache.get(key);
      if (!inCache) {
        try {
          inCache = {
            schema: await this.getSQLBlockSchema(sqlRef),
          };
          this.schemaCache.set(key, inCache);
        } catch (error) {
          inCache = { error: error.message };
        }
      }
      if (inCache.schema !== undefined) {
        schemas[key] = inCache.schema;
      } else {
        errors[key] = inCache.error;
      }
    }
    return { schemas, errors };
  }

  protected async getClient(): Promise<Client> {
    const config = await this.readConfig();
    return new Client({
      user: config.username,
      password: config.password,
      database: config.databaseName,
      port: config.port,
      host: config.host,
    });
  }

  protected async runPostgresQuery(
    sqlCommand: string,
    _pageSize: number,
    _rowIndex: number,
    deJSON: boolean
  ): Promise<MalloyQueryData> {
    const client = await this.getClient();
    await client.connect();

    let result = await client.query(sqlCommand);
    if (Array.isArray(result)) {
      result = result.pop();
    }
    if (deJSON) {
      for (let i = 0; i < result.rows.length; i++) {
        result.rows[i] = result.rows[i].row;
      }
    }
    await client.end();
    return { rows: result.rows as QueryData, totalRows: result.rows.length };
  }

  private async getSQLBlockSchema(sqlRef: SQLBlock): Promise<StructDef> {
    const structDef: StructDef = {
      type: "struct",
      dialect: "postgres",
      name: sqlRef.name,
      structSource: {
        type: "sql",
        method: "subquery",
        sqlBlock: sqlRef,
      },
      structRelationship: {
        type: "basetable",
        connectionName: this.name,
      },
      fields: [],
    };

    // TODO -- Should be a uuid
    const tempTableName = `malloy${Math.floor(Math.random() * 10000000)}`;
    const infoQuery = `
      drop table if exists ${tempTableName};
      create temp table ${tempTableName} as SELECT * FROM (
        ${sqlRef.select}
      ) as x where false;
      SELECT column_name, c.data_type, e.data_type as element_type
      FROM information_schema.columns c LEFT JOIN information_schema.element_types e
        ON ((c.table_catalog, c.table_schema, c.table_name, 'TABLE', c.dtd_identifier)
          = (e.object_catalog, e.object_schema, e.object_name, e.object_type, e.collection_type_identifier))
      where table_name='${tempTableName}';
    `;
    await this.schemaFromQuery(infoQuery, structDef);
    return structDef;
  }

  private async schemaFromQuery(
    infoQuery: string,
    structDef: StructDef
  ): Promise<void> {
    const result = await this.runPostgresQuery(
      infoQuery,
      SCHEMA_PAGE_SIZE,
      0,
      false
    );
    for (const row of result.rows) {
      const postgresDataType = row["data_type"] as string;
      let s = structDef;
      let malloyType = postgresToMalloyTypes[postgresDataType];
      let name = row["column_name"] as string;
      if (postgresDataType === "ARRAY") {
        malloyType = postgresToMalloyTypes[row["element_type"] as string];
        s = {
          type: "struct",
          name: row["column_name"] as string,
          dialect: this.dialectName,
          structRelationship: { type: "nested", field: name, isArray: true },
          structSource: { type: "nested" },
          fields: [],
        };
        structDef.fields.push(s);
        name = "value";
      }
      if (malloyType !== undefined) {
        s.fields.push({
          type: malloyType,
          name,
        });
      } else {
        s.fields.push({
          name,
          type: "string",
          e: [`'Postgres type "${postgresDataType}" not supported by Malloy'`],
        });
      }
    }
  }

  private async getTableSchema(tableURL: string): Promise<StructDef> {
    const { tablePath } = parseTableURI(tableURL);
    const structDef: StructDef = {
      type: "struct",
      name: tableURL,
      dialect: "postgres",
      structSource: { type: "table", tablePath },
      structRelationship: {
        type: "basetable",
        connectionName: this.name,
      },
      fields: [],
    };
    const [schema, table] = tablePath.split(".");
    if (table === undefined) {
      throw new Error("Default schema not yet supported in Postgres");
    }
    const infoQuery = `
      SELECT column_name, c.data_type, e.data_type as element_type
      FROM information_schema.columns c LEFT JOIN information_schema.element_types e
        ON ((c.table_catalog, c.table_schema, c.table_name, 'TABLE', c.dtd_identifier)
          = (e.object_catalog, e.object_schema, e.object_name, e.object_type, e.collection_type_identifier))
        WHERE table_name = '${table}'
          AND table_schema = '${schema}'
    `;

    await this.schemaFromQuery(infoQuery, structDef);
    return structDef;
  }

  public async executeSQLRaw(query: string): Promise<QueryData> {
    const config = await this.readQueryConfig();
    const queryData = await this.runPostgresQuery(
      query,
      config.rowLimit || DEFAULT_PAGE_SIZE,
      0,
      false
    );
    return queryData.rows;
  }

  public async test(): Promise<void> {
    await this.executeSQLRaw("SELECT 1");
  }

  public async runSQL(
    sql: string,
    { rowLimit }: RunSQLOptions = {},
    rowIndex = 0
  ): Promise<MalloyQueryData> {
    const config = await this.readQueryConfig();

    return await this.runPostgresQuery(
      sql,
      rowLimit ?? config.rowLimit ?? DEFAULT_PAGE_SIZE,
      rowIndex,
      true
    );
  }

  public async *runSQLStream(
    sqlCommand: string,
    options?: { rowLimit?: number }
  ): AsyncIterableIterator<QueryDataRow> {
    const query = new QueryStream(sqlCommand);
    const client = await this.getClient();
    client.connect();
    const rowStream = client.query(query);
    let index = 0;
    for await (const row of rowStream) {
      yield row.row as QueryDataRow;
      index += 1;
      if (options?.rowLimit !== undefined && index >= options.rowLimit) {
        query.destroy();
        break;
      }
    }
    await client.end();
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = crypto.createHash("md5").update(sqlCommand).digest("hex");
    const tableName = `tt${hash}`;

    const cmd = `CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    // console.log(cmd);
    await this.runPostgresQuery(cmd, 1000, 0, false);
    return tableName;
  }
}

export class PooledPostgresConnection
  extends PostgresConnection
  implements PooledConnection
{
  private pool: Pool;

  constructor(name: string) {
    super(name);
    this.pool = new Pool();
  }

  public isPool(): true {
    return true;
  }

  public async drain(): Promise<void> {
    await this.pool.end();
  }

  protected async runPostgresQuery(
    sqlCommand: string,
    _pageSize: number,
    _rowIndex: number,
    deJSON: boolean
  ): Promise<MalloyQueryData> {
    let result = await this.pool.query(sqlCommand);

    if (Array.isArray(result)) {
      result = result.pop();
    }
    if (deJSON) {
      for (let i = 0; i < result.rows.length; i++) {
        result.rows[i] = result.rows[i].row;
      }
    }
    return { rows: result.rows as QueryData, totalRows: result.rows.length };
  }

  private async getClientFromPool(): Promise<[PoolClient, () => void]> {
    return await new Promise((resolve, reject) =>
      this.pool.connect((error, client: PoolClient, releaseClient) => {
        if (error) {
          reject(error);
        } else {
          resolve([client, releaseClient]);
        }
      })
    );
  }

  public async *runSQLStream(
    sqlCommand: string,
    options?: { rowLimit?: number }
  ): AsyncIterableIterator<QueryDataRow> {
    const query = new QueryStream(sqlCommand);
    let index = 0;
    // This is a strange hack... `this.pool.query(query)` seems to return the wrong
    // type. Because `query` is a `QueryStream`, the result is supposed to be a
    // `QueryStream` as well, but it's not. So instead, we get a client and call
    // `client.query(query)`, which does what it's supposed to.
    const [client, releaseClient] = await this.getClientFromPool();
    const resultStream: QueryStream = client.query(query);
    for await (const row of resultStream) {
      yield row.row as QueryDataRow;
      index += 1;
      if (options?.rowLimit !== undefined && index >= options.rowLimit) {
        query.destroy();
        break;
      }
    }
    releaseClient();
  }
}
