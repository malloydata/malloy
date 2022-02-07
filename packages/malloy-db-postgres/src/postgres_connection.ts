/*
 * Copyright 2021 Google LLC
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

import * as crypto from "crypto";
import {
  StructDef,
  MalloyQueryData,
  Connection,
  NamedStructDefs,
  AtomicFieldType,
  QueryData,
  PooledConnection,
  parseTableURL,
  SQLReferenceData,
} from "@malloydata/malloy";
import { Client, Pool } from "pg";

const postgresToMalloyTypes: { [key: string]: AtomicFieldType } = {
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
  pageSize?: number;
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

export class PostgresConnection extends Connection {
  private resultCache = new Map<string, MalloyQueryData>();
  private schemaCache = new Map<string, StructDef>();
  private sqlSchemaCache = new Map<string, StructDef>();
  private queryConfigReader: PostgresQueryConfigurationReader;
  private configReader: PostgresConnectionConfigurationReader;

  constructor(
    name: string,
    queryConfigReader: PostgresQueryConfigurationReader = {},
    configReader: PostgresConnectionConfigurationReader = {}
  ) {
    super(name);
    this.queryConfigReader = queryConfigReader;
    this.configReader = configReader;
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

  public async fetchSchemaForTables(
    missing: string[]
  ): Promise<NamedStructDefs> {
    const tableStructDefs: NamedStructDefs = {};
    for (const tableName of missing) {
      let inCache = this.schemaCache.get(tableName);
      if (!inCache) {
        inCache = await this.getTableSchema(tableName, false);
        this.schemaCache.set(tableName, inCache);
      }
      tableStructDefs[tableName] = inCache;
    }
    return tableStructDefs;
  }

  public async fetchSchemaForSQLBlocks(
    sqlRefs: SQLReferenceData[]
  ): Promise<NamedStructDefs> {
    const tableStructDefs: NamedStructDefs = {};
    for (const sqlRef of sqlRefs) {
      const key = sqlRef.key || "foo";
      const tableName = sqlRef.sql[0];
      let inCache = this.sqlSchemaCache.get(key);
      if (!inCache) {
        inCache = await this.getTableSchema(tableName, true);
        this.schemaCache.set(key, inCache);
      }
      tableStructDefs[key] = inCache;
    }
    return tableStructDefs;
  }

  protected async runPostgresQuery(
    sqlCommand: string,
    _pageSize: number,
    _rowIndex: number,
    deJSON: boolean
  ): Promise<MalloyQueryData> {
    const config = await this.readConfig();
    const client = new Client({
      user: config.username,
      password: config.password,
      database: config.databaseName,
      port: config.port,
      host: config.host,
    });
    await client.connect();

    let result = await client.query(sqlCommand);
    if (result instanceof Array) {
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

  private async getTableSchema(
    tableURLorQuery: string,
    isQuery = false
  ): Promise<StructDef> {
    const structDef: StructDef = {
      type: "struct",
      name: tableURLorQuery,
      dialect: "postgres",
      structSource: isQuery
        ? { type: "sql", method: "subquery" }
        : { type: "table" },
      structRelationship: {
        type: "basetable",
        connectionName: this.name,
      },
      fields: [],
    };

    // run a query that retconst urns the columns of the table or query.

    let infoQuery;
    if (isQuery) {
      const tempTableName = `malloy${Math.floor(Math.random() * 10000000)}`;
      infoQuery = `
        drop table if exists ${tempTableName};
        create temp table ${tempTableName} as SELECT * FROM (
          ${tableURLorQuery}
        ) as x where false;
        SELECT column_name, data_type FROM information_schema.columns where table_name='${tempTableName}';
      `;
    } else {
      const { tablePath: tableName } = parseTableURL(tableURLorQuery);
      const [schema, table] = tableName.split(".");
      if (table === undefined) {
        throw new Error("Default schema not supported Yet in Postgres");
      }
      infoQuery = `
          SELECT column_name, data_type FROM information_schema.columns
          WHERE table_name = '${table}'
            AND table_schema = '${schema}'
          `;
    }

    const result = await this.runPostgresQuery(
      infoQuery,
      SCHEMA_PAGE_SIZE,
      0,
      false
    );
    for (const row of result.rows) {
      const postgresDataType = row["data_type"] as string;
      const malloyType = postgresToMalloyTypes[postgresDataType];
      if (malloyType !== undefined) {
        structDef.fields.push({
          type: malloyType,
          name: row["column_name"] as string,
        });
      } else {
        throw new Error(`unknown postgres type ${postgresDataType}`);
      }
    }
    return structDef;
  }

  public async executeSQLRaw(query: string): Promise<QueryData> {
    const config = await this.readQueryConfig();
    const queryData = await this.runPostgresQuery(
      query,
      config.pageSize || DEFAULT_PAGE_SIZE,
      0,
      false
    );
    return queryData.rows;
  }

  public async test(): Promise<void> {
    await this.executeSQLRaw("SELECT 1");
  }

  public async runSQL(
    sqlCommand: string,
    pageSize?: number,
    rowIndex = 0
  ): Promise<MalloyQueryData> {
    const config = await this.readQueryConfig();
    const hash = crypto
      .createHash("md5")
      .update(sqlCommand)
      .update(String(pageSize))
      .update(String(rowIndex))
      .digest("hex");
    let result;
    if ((result = this.resultCache.get(hash)) !== undefined) {
      return result;
    }
    result = await this.runPostgresQuery(
      sqlCommand,
      pageSize || config.pageSize || DEFAULT_PAGE_SIZE,
      rowIndex,
      true
    );

    this.resultCache.set(hash, result);
    return result;
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
    if (result instanceof Array) {
      result = result.pop();
    }
    if (deJSON) {
      for (let i = 0; i < result.rows.length; i++) {
        result.rows[i] = result.rows[i].row;
      }
    }
    return { rows: result.rows as QueryData, totalRows: result.rows.length };
  }
}
