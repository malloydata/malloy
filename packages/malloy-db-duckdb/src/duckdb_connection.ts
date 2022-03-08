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
  AtomicFieldTypeInner,
  Connection,
  MalloyQueryData,
  NamedStructDefs,
  parseTableURL,
  PooledConnection,
  SQLBlock,
  StructDef,
} from "@malloydata/malloy";

// duckdb node bindings do not come with Typescript types, require is required
// https://github.com/duckdb/duckdb/tree/master/tools/nodejs
// eslint-disable-next-line @typescript-eslint/no-var-requires
const duckdb = require("duckdb");

const duckDBToMalloyTypes: { [key: string]: AtomicFieldTypeInner } = {
  name: "string",
  text: "string",
  date: "date",
  integer: "number",
  bigint: "number",
  "double precision": "number",
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
};

export class DuckDBConnection implements Connection {
  public readonly name;

  protected connection;
  protected database;

  constructor(name: string) {
    this.name = name;

    // TODO temp! For now, just create in-memory database. Production usage will require more options here
    this.database = new duckdb.Database(":memory:");
    this.connection = this.database.connect();
  }

  get dialectName(): string {
    return "duckdb";
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  protected async runDuckDBQuery(sql: string): Promise<MalloyQueryData> {
    const result = await this.connection.all(sql);
    return {
      rows: result,
      totalRows: result.length,
    };
  }

  public async runSQL(sql: string): Promise<MalloyQueryData> {
    return await this.runDuckDBQuery(sql);
  }

  public async runSQLBlockAndFetchResultSchema(
    sqlBlock: SQLBlock
  ): Promise<{ data: MalloyQueryData; schema: StructDef }> {
    const data = await this.runSQL(sqlBlock.select);
    const schema = (await this.fetchSchemaForSQLBlocks([sqlBlock])).schemas[
      sqlBlock.name
    ];
    return { data, schema };
  }

  private async getSQLBlockSchema(sqlRef: SQLBlock): Promise<StructDef> {
    const structDef: StructDef = {
      type: "struct",
      dialect: "duckdb",
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
      SELECT column_name, data_type FROM information_schema.columns where table_name='${tempTableName}';
    `;
    await this.schemaFromQuery(infoQuery, structDef);
    return structDef;
  }

  private async schemaFromQuery(
    infoQuery: string,
    structDef: StructDef
  ): Promise<void> {
    const result = await this.runDuckDBQuery(infoQuery);
    for (const row of result.rows) {
      const duckDBType = row["data_type"] as string;
      const malloyType = duckDBToMalloyTypes[duckDBType];
      if (malloyType !== undefined) {
        structDef.fields.push({
          type: malloyType,
          name: row["column_name"] as string,
        });
      } else {
        throw new Error(`unknown duckdb type ${duckDBType}`);
      }
    }
  }

  public async fetchSchemaForSQLBlocks(sqlRefs: SQLBlock[]): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    const schemas: NamedStructDefs = {};
    const errors: { [name: string]: string } = {};

    for (const sqlRef of sqlRefs) {
      try {
        schemas[sqlRef.name] = await this.getSQLBlockSchema(sqlRef);
      } catch (error) {
        errors[sqlRef.name] = error;
      }
    }
    return { schemas, errors };
  }

  public async fetchSchemaForTables(tables: string[]): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    const schemas: NamedStructDefs = {};
    const errors: { [name: string]: string } = {};

    for (const tableURL of tables) {
      try {
        schemas[tableURL] = await this.getTableSchema(tableURL);
      } catch (error) {
        errors[tableURL] = error;
      }
    }
    return { schemas, errors };
  }

  private async getTableSchema(tableURL: string): Promise<StructDef> {
    const structDef: StructDef = {
      type: "struct",
      name: tableURL,
      dialect: "duckdb",
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
      throw new Error("Default schema not yet supported in DuckDB");
    }
    const infoQuery = `
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = '${table}'
        AND table_schema = '${schema}'
    `;

    await this.schemaFromQuery(infoQuery, structDef);
    return structDef;
  }
}
