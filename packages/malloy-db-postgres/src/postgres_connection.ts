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
} from "@malloy-lang/malloy";
import { Client, Pool } from "pg";

const postgresToMalloyTypes: { [key: string]: AtomicFieldType } = {
  "character varying": "string",
  name: "string",
  text: "string",
  integer: "number",
  bigint: "number",
  "double precision": "number",
  "timestamp without time zone": "timestamp", // maybe not right
};

interface PostgresConnectionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
}

export class PostgresConnection extends Connection {
  private resultCache = new Map<string, MalloyQueryData>();
  private schemaCache = new Map<string, StructDef>();
  private config: PostgresConnectionConfiguration;

  constructor(name: string, config: PostgresConnectionConfiguration = {}) {
    super(name);
    this.config = config;
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
        inCache = await this.getTableSchema(tableName);
        this.schemaCache.set(tableName, inCache);
      }
      tableStructDefs[tableName] = inCache;
    }
    return tableStructDefs;
  }

  protected async runPostgresQuery(
    sqlCommand: string,
    _pageSize: number,
    _rowIndex: number,
    deJSON: boolean
  ): Promise<MalloyQueryData> {
    const client = new Client({
      user: this.config.username,
      password: this.config.password,
      database: this.config.databaseName,
      port: this.config.port,
      host: this.config.host,
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

  private async getTableSchema(tableURL: string): Promise<StructDef> {
    const structDef: StructDef = {
      type: "struct",
      name: tableURL,
      dialect: "postgres",
      structSource: { type: "table" },
      structRelationship: {
        type: "basetable",
        connectionName: this.name,
      },
      fields: [],
    };

    const { tablePath: tableName } = parseTableURL(tableURL);
    const [schema, table] = tableName.split(".");
    if (table === undefined) {
      throw new Error("Default schema not supported Yet in Postgres");
    }
    const result = await this.runPostgresQuery(
      `
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = '${table}'
        AND table_schema = '${schema}'
      `,
      1000,
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
    const queryData = await this.runPostgresQuery(query, 1000, 0, false);
    return queryData.rows;
  }

  public async runSQL(
    sqlCommand: string,
    pageSize = 1000,
    rowIndex = 0
  ): Promise<MalloyQueryData> {
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
    result = await this.runPostgresQuery(sqlCommand, pageSize, rowIndex, true);

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
