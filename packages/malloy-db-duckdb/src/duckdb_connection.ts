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
  FieldTypeDef,
  PooledConnection,
  SQLBlock,
  StructDef,
} from "@malloydata/malloy";
import {
  FetchSchemaAndRunSimultaneously,
  FetchSchemaAndRunStreamSimultaneously,
  StreamingConnection,
} from "@malloydata/malloy/src/runtime_types";

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
  INTEGER: "number",
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
      //   await this.runDuckDBQuery("DROP MACRO sum_distinct");
      //   try {
      //     await this.runDuckDBQuery(
      //       `
      //       create macro sum_distinct(l) as  (
      //         select sum(x.val) as value FROM (select unnest(l)) x
      //       )
      //       `
      //     );
      //   } catch (e) {}
    }
    this.isSetup = true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  public async runRawSQL(sql: string): Promise<any> {
    await this.setup();
    return this.runDuckDBQuery(sql);
  }

  public async runSQL(sql: string): Promise<MalloyQueryData> {
    await this.setup();
    // console.log(sql);

    const statements = sql.split("-- hack: split on this");

    while (statements.length > 1) {
      try {
        await this.runDuckDBQuery(statements[0]);
        statements.unshift();
      } catch (e) {
        /* Do nothing */
      }
    }
    const retVal = await this.runDuckDBQuery(statements[0]);
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
    await this.runRawSQL(`drop table if exists ${tempTableName};`);
    const createQuery = `
      create temp table ${tempTableName} as SELECT * FROM (
        ${sqlRef.select}
      ) as x where false;;
    `;
    console.log(createQuery);
    await this.runRawSQL(createQuery);
    await this.schemaFromQuery(
      `SELECT column_name, data_type FROM information_schema.columns where table_name='${tempTableName}'`,
      structDef
    );
    return structDef;
  }

  private async schemaFromQuery(
    infoQuery: string,
    structDef: StructDef
  ): Promise<void> {
    const result = await this.runDuckDBQuery(infoQuery);
    for (const row of result.rows) {
      let duckDBType = row["data_type"] as string;
      let malloyType = duckDBToMalloyTypes[duckDBType];
      const name = row["column_name"] as string;
      const arrayMatch = duckDBType.match(/(?<duckDBType>.*)\[\]$/);
      if (arrayMatch && arrayMatch.groups) {
        duckDBType = arrayMatch.groups["duckDBType"];
        malloyType = duckDBToMalloyTypes[duckDBType];
        const innerStructDef: StructDef = {
          type: "struct",
          name,
          dialect: this.dialectName,
          structSource: { type: "nested" },
          structRelationship: { type: "nested", field: name, isArray: true },
          fields: [{ type: malloyType, name: "value" } as FieldTypeDef],
        };
        structDef.fields.push(innerStructDef);
      } else {
        if (malloyType !== undefined) {
          structDef.fields.push({
            type: malloyType,
            name,
          });
        } else {
          throw new Error(`unknown duckdb type ${duckDBType}`);
        }
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

  canFetchSchemaAndRunSimultaneously(): this is FetchSchemaAndRunSimultaneously {
    return false;
  }

  canStream(): this is StreamingConnection {
    return false;
  }

  canFetchSchemaAndRunStreamSimultaneously(): this is FetchSchemaAndRunStreamSimultaneously {
    return false;
  }

  public async test(): Promise<void> {
    await this.runRawSQL("SELECT 1");
  }
}
