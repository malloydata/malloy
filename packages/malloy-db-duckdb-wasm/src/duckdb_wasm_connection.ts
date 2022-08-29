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
  QueryDataRow,
} from "@malloydata/malloy";
import {
  FetchSchemaAndRunSimultaneously,
  FetchSchemaAndRunStreamSimultaneously,
  StreamingConnection,
} from "@malloydata/malloy/src/runtime_types";
import * as duckdb from "@duckdb/duckdb-wasm";
import { StructRow, Table, Vector } from "apache-arrow";

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

/**
 * Arrow's toJSON() doesn't really do what I'd expect, since
 * it still includes Arrow objects like DecimalBigNums and Vectors,
 * so we need this fairly gross function to unwrap those.
 *
 * @param value Element from an Arrow StructRow.
 * @returns Vanilla Javascript value
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrapArrow = (value: unknown): any => {
  if (value === null) {
    return value;
  } else if (value instanceof Vector) {
    return [...value].map(unwrapArrow);
  } else if (typeof value === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = value as Record<string | symbol, any>;
    // DecimalBigNums appear as Uint32Arrays, but can be identified
    // because they have a Symbol.toPrimitive method
    if (obj[Symbol.toPrimitive]) {
      // There seems to be a bug in [Symbol.toPrimitive]("number") so
      // convert to string first and then to number.
      return Number(obj[Symbol.toPrimitive]());
    } else if (Array.isArray(value)) {
      return value.map(unwrapArrow);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string | symbol, any> = {};
      for (const key in obj) {
        result[key] = unwrapArrow(obj[key]);
      }
      return result;
    }
  }
  return value;
};

/**
 * Process a single Arrow result row into a Malloy QueryDataRow
 * Unfortunately simply calling JSONParse(JSON.stringify(row)) even
 * winds up converting DecimalBigNums to strings instead of numbers.
 * For some reason a custom replacer only sees DecimalBigNums as
 * strings, as well.
 */
const unwrapRow = (row: StructRow): QueryDataRow => {
  return unwrapArrow(row.toJSON());
};

/**
 * Process a duckedb Table into an array of Malloy QueryDataRows
 */
const unwrapTable = (table: Table): QueryDataRow[] => {
  return table.toArray().map(unwrapRow);
};

export class DuckDBWASMConnection
  implements Connection, PersistSQLResults, StreamingConnection
{
  connecting: Promise<void>;
  protected _connection: duckdb.AsyncDuckDBConnection | null = null;
  protected _database: duckdb.AsyncDuckDB | null = null;
  protected isSetup = false;

  constructor(
    public readonly name: string,
    databasePath = "test/data/duckdb/duckdb_test.db",
    private workingDirectory = "/"
  ) {
    this.connecting = this.init();
  }

  async init(): Promise<void> {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    if (bundle.mainWorker) {
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], {
          type: "text/javascript",
        })
      );

      // Instantiate the asynchronous version of DuckDB-wasm
      const worker = new Worker(workerUrl);
      const logger = new duckdb.ConsoleLogger();
      this._database = new duckdb.AsyncDuckDB(logger, worker);
      await this._database.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);
      this._connection = await this._database.connect();
    } else {
      throw new Error("Unable to instantiate duckdb-wasm");
    }
  }

  get connection(): duckdb.AsyncDuckDBConnection | null {
    return this._connection;
  }

  get database(): duckdb.AsyncDuckDB | null {
    return this._database;
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
    await this.connecting;
  }

  protected async runDuckDBQuery(
    sql: string
  ): Promise<{ rows: QueryDataRow[]; totalRows: number }> {
    const table = await this.connection?.query(sql);
    if (table?.numRows) {
      const rows = unwrapTable(table);
      console.log(rows);
      return {
        // Normalize the data from its default proxied form
        rows,
        totalRows: table.numRows,
      };
    } else {
      throw new Error("Boom");
    }
  }

  public async runRawSQL(
    sql: string
  ): Promise<{ rows: QueryDataRow[]; totalRows: number }> {
    await this.setup();
    return this.runDuckDBQuery(sql);
  }

  public async runSQL(
    sql: string,
    options: RunSQLOptions = {}
  ): Promise<MalloyQueryData> {
    const rowLimit = options.rowLimit ?? 10;

    const statements = sql.split("-- hack: split on this");

    while (statements.length > 1) {
      await this.runRawSQL(statements[0]);
      statements.shift();
    }

    const retVal = await this.runRawSQL(statements[0]);
    let result = retVal.rows;
    if (result.length > rowLimit) {
      result = result.slice(0, rowLimit);
    }
    return { rows: result, totalRows: result.length };
  }

  public async *runSQLStream(
    sql: string,
    _options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    if (!this.connection) {
      throw new Error("duckdb-wasm not connected");
    }
    await this.setup();
    const statements = sql.split("-- hack: split on this");

    while (statements.length > 1) {
      await this.runDuckDBQuery(statements[0]);
      statements.shift();
    }

    for await (const chunk of await this.connection.send(statements[0])) {
      for (const row of chunk.toArray()) {
        yield unwrapRow(row);
      }
    }
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

    const result = await this.runRawSQL(infoQuery);
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
    return true;
  }

  canFetchSchemaAndRunStreamSimultaneously(): this is FetchSchemaAndRunStreamSimultaneously {
    return false;
  }

  public async test(): Promise<void> {
    await this.runRawSQL("SELECT 1");
  }

  async digestMessage(message: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex;
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = await this.digestMessage(sqlCommand);
    const tableName = `tt${hash}`;

    const cmd = `CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    // console.log(cmd);
    await this.runRawSQL(cmd);
    return tableName;
  }
}
