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
import { Database, OPEN_READONLY, OPEN_READWRITE } from "duckdb";
import { RunSQLOptions } from "@malloydata/malloy/src/malloy";

const duckDBToMalloyTypes: { [key: string]: AtomicFieldTypeInner } = {
  BIGINT: "number",
  DOUBLE: "number",
  VARCHAR: "string",
  DATE: "date",
  TIMESTAMP: "timestamp",
  TIME: "string",
  DECIMAL: "number",
  BOOLEAN: "boolean",
  INTEGER: "number",
};

export class DuckDBConnection implements Connection, PersistSQLResults {
  protected connection;
  protected database;
  protected isSetup = false;

  constructor(
    public readonly name: string,
    databasePath = "test/data/duckdb/duckdb_test.db",
    workingDirectory = "/"
  ) {
    this.database = new Database(
      databasePath,
      OPEN_READWRITE, // databasePath === ":memory:" ? OPEN_READWRITE : OPEN_READONLY,
      (err) => {
        if (err) {
          return console.error(err);
        }
      }
    );
    this.connection = this.database.connect();
    if (workingDirectory) {
      this.runDuckDBQuery(`SET FILE_SEARCH_PATH='${workingDirectory}'`);
    }
  }

  get dialectName(): string {
    return "duckdb";
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  protected async setup(): Promise<void> {
    if (!this.isSetup) {
      // TODO: This is where we will load extensions once we figure
      // out how to better support them.
      // await this.runDuckDBQuery("INSTALL 'json'");
      // await this.runDuckDBQuery("LOAD 'json'");
      // await this.runDuckDBQuery("INSTALL 'httpfs'");
      // await this.runDuckDBQuery("LOAD 'httpfs'");
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
      this.connection.all(sql, (err: Error, result: any) => {
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

  public async runRawSQL(sql: string): Promise<unknown> {
    await this.setup();
    return this.runDuckDBQuery(sql);
  }

  public async runSQL(
    sql: string,
    options: RunSQLOptions = {}
  ): Promise<MalloyQueryData> {
    // console.log(sql);
    await this.setup();

    const rowLimit = options.rowLimit ?? 10;

    const statements = sql.split("-- hack: split on this");

    while (statements.length > 1) {
      await this.runDuckDBQuery(statements[0]);
      statements.shift();
    }

    const retVal = await this.runDuckDBQuery(statements[0]);
    let result = retVal.rows;
    if (result.length > rowLimit) {
      result = result.slice(0, rowLimit);
    }
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

    await this.schemaFromQuery(
      `DESCRIBE SELECT * FROM (${sqlRef.select})`,
      structDef
    );
    return structDef;
  }

  /**
   * Split's a structs columns declaration into individual columns
   * to be fed back into fillStructDefFromTypeMap(). Handles commas
   * within nested STRUCT() declarations.
   *
   * (https://github.com/looker-open-source/malloy/issues/635)
   *
   * @param s struct's column declaration
   * @returns Array of column type declarations
   */
  private splitColumns(s: string) {
    const columns = [];
    let parens = 0;
    let column = "";
    let eatSpaces = true;
    for (let idx = 0; idx < s.length; idx++) {
      const c = s.charAt(idx);
      if (eatSpaces && c === " ") {
        // Eat space
      } else {
        eatSpaces = false;
        if (!parens && c === ",") {
          columns.push(column);
          column = "";
          eatSpaces = true;
        } else {
          column += c;
        }
        if (c === "(") {
          parens += 1;
        } else if (c === ")") {
          parens -= 1;
        }
      }
    }
    columns.push(column);
    return columns;
  }

  private stringToTypeMap(s: string): { [name: string]: string } {
    const ret: { [name: string]: string } = {};
    const columns = this.splitColumns(s);
    for (const c of columns) {
      //const [name, type] = c.split(" ", 1);
      const columnMatch = c.match(/^(?<name>[^\s]+) (?<type>.*)$/);
      if (columnMatch && columnMatch.groups) {
        ret[columnMatch.groups["name"]] = columnMatch.groups["type"];
      } else {
        throw new Error(`Badly form Structure definition ${s}`);
      }
    }
    return ret;
  }

  private fillStructDefFromTypeMap(
    structDef: StructDef,
    typeMap: { [name: string]: string }
  ) {
    for (const name in typeMap) {
      let duckDBType = typeMap[name];
      // Remove DECIMAL(x,y) precision to simplify lookup
      duckDBType = duckDBType.replace(/^DECIMAL\(\d+,\d+\)/g, "DECIMAL");
      let malloyType = duckDBToMalloyTypes[duckDBType];
      const arrayMatch = duckDBType.match(/(?<duckDBType>.*)\[\]$/);
      if (arrayMatch && arrayMatch.groups) {
        duckDBType = arrayMatch.groups["duckDBType"];
      }
      const structMatch = duckDBType.match(/^STRUCT\((?<fields>.*)\)$/);
      if (structMatch && structMatch.groups) {
        const newTypeMap = this.stringToTypeMap(structMatch.groups["fields"]);
        const innerStructDef: StructDef = {
          type: "struct",
          name,
          dialect: this.dialectName,
          structSource: { type: arrayMatch ? "nested" : "inline" },
          structRelationship: {
            type: arrayMatch ? "nested" : "inline",
            field: name,
            isArray: false,
          },
          fields: [],
        };
        this.fillStructDefFromTypeMap(innerStructDef, newTypeMap);
        structDef.fields.push(innerStructDef);
      } else {
        if (arrayMatch) {
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
  }

  private async schemaFromQuery(
    infoQuery: string,
    structDef: StructDef
  ): Promise<void> {
    const typeMap: { [key: string]: string } = {};

    const result = await this.runDuckDBQuery(infoQuery);
    for (const row of result.rows) {
      typeMap[row["column_name"] as string] = row["column_type"] as string;
    }
    this.fillStructDefFromTypeMap(structDef, typeMap);
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
        errors[tableURL] = error.toString();
      }
    }
    return { schemas, errors };
  }

  private async getTableSchema(tableURL: string): Promise<StructDef> {
    const { tablePath: tableName } = parseTableURL(tableURL);
    const structDef: StructDef = {
      type: "struct",
      name: tableName,
      dialect: "duckdb",
      structSource: { type: "table" },
      structRelationship: {
        type: "basetable",
        connectionName: this.name,
      },
      fields: [],
    };

    // const { tablePath: tableName } = parseTableURL(tableURL);
    // const [schema, table] = tableName.split(".");
    // if (table === undefined) {
    //   throw new Error("Default schema not yet supported in DuckDB");
    // }
    // const infoQuery = `
    //   SELECT column_name, data_type FROM information_schema.columns
    //   WHERE table_name = '${table}'
    //     AND table_schema = '${schema}'
    // `;

    const infoQuery = `DESCRIBE SELECT * FROM ${
      tableName.match(/\//) ? `'${tableName}'` : tableName
    };`;
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

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = crypto.createHash("md5").update(sqlCommand).digest("hex");
    const tableName = `tt${hash}`;

    const cmd = `CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    // console.log(cmd);
    await this.runRawSQL(cmd);
    return tableName;
  }
}
