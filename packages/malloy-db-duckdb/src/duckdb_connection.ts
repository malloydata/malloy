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
  PersistSQLResults,
  PooledConnection,
  SQLBlock,
  StructDef,
} from "@malloydata/malloy";
import { ColumnSpaceField } from "@malloydata/malloy/src/lang/space-field";

// duckdb node bindings do not come with Typescript types, require is required
// https://github.com/duckdb/duckdb/tree/master/tools/nodejs
// eslint-disable-next-line @typescript-eslint/no-var-requires
const duckdb = require("duckdb");

const duckDBToMalloyTypes: { [key: string]: AtomicFieldTypeInner } = {
  BIGINT: "number",
  DOUBLE: "number",
  VARCHAR: "string",
  DATE: "date",
  TIMESTAMP: "timestamp",
  "DECIMAL(38,9)": "number",
  BOOLEAN: "boolean",
};

export class DuckDBConnection implements Connection {
  public readonly name;

  protected connection;
  protected database;
  protected isSetup = false;

  constructor(name: string) {
    this.name = name;

    // TODO temp! For now, just connect to the test database
    this.database = new duckdb.Database("test/data/duckdb/duckdb_test.db");
    this.connection = this.database.connect();
  }

  get dialectName(): string {
    return "duckdb";
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return false;
  }

  // @bporterfield need help writing this. it needs to wait if a setup is in process.
  protected async setup(): Promise<void> {
    if (!this.isSetup) {
      await this.runDuckDBQuery("INSTALL 'json'");
      await this.runDuckDBQuery("LOAD 'json'");
    }
    this.isSetup = true;
  }

  protected async runDuckDBQuery(sql: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.connection.all(sql, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else
          resolve({
            rows: result,
            totalRows: result.length,
          });
      });
    });
  }

  public async runSQL(sql: string): Promise<MalloyQueryData> {
    await this.setup();
    console.log(sql);
    const retVal = await this.runDuckDBQuery(sql);
    const result = JSON.parse(retVal.rows[0].results);
    return { rows: result, totalRows: result.length };
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
