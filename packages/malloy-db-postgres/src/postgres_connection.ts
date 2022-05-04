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

import {
  StructDef,
  MalloyQueryData,
  NamedStructDefs,
  AtomicFieldTypeInner,
  QueryData,
  PooledConnection,
  parseTableURL,
  SQLBlock,
  Connection,
} from "@malloydata/malloy";
import { PersistSQLResults } from "@malloydata/malloy/src/runtime_types";
import { Client, Pool } from "pg";

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

export class PostgresConnection implements Connection {
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
    return false;
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

  public async runSQLBlockAndFetchResultSchema(
    // TODO feature-sql-block Implement an actual version of this that does these simultaneously
    sqlBlock: SQLBlock,
    options?: { rowLimit?: number | undefined }
  ): Promise<{ data: MalloyQueryData; schema: StructDef }> {
    const data = await this.runSQL(sqlBlock.select, options);
    const schema = (await this.fetchSchemaForSQLBlocks([sqlBlock])).schemas[
      sqlBlock.name
    ];
    return { data, schema };
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
        throw new Error(`unknown postgres type ${postgresDataType}`);
      }
    }
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
    { rowLimit }: { rowLimit?: number } = {},
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
