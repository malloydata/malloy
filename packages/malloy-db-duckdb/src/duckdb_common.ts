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
  FetchSchemaAndRunSimultaneously,
  FetchSchemaAndRunStreamSimultaneously,
  MalloyQueryData,
  NamedStructDefs,
  parseTableURI,
  PersistSQLResults,
  FieldTypeDef,
  PooledConnection,
  RunSQLOptions,
  SQLBlock,
  StreamingConnection,
  StructDef,
  QueryDataRow,
} from "@malloydata/malloy";

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

export interface DuckDBQueryOptions {
  rowLimit: number;
}

export type QueryOptionsReader =
  | Partial<DuckDBQueryOptions>
  | (() => Partial<DuckDBQueryOptions>);

export abstract class DuckDBCommon
  implements Connection, PersistSQLResults, StreamingConnection
{
  static DEFAULT_QUERY_OPTIONS: DuckDBQueryOptions = {
    rowLimit: 10,
  };

  public readonly name: string = "duckdb_common";

  get dialectName(): string {
    return "duckdb";
  }

  private readQueryOptions(): DuckDBQueryOptions {
    const options = DuckDBCommon.DEFAULT_QUERY_OPTIONS;
    if (this.queryOptions) {
      if (this.queryOptions instanceof Function) {
        return { ...options, ...this.queryOptions() };
      } else {
        return { ...options, ...this.queryOptions };
      }
    } else {
      return options;
    }
  }

  constructor(private queryOptions?: QueryOptionsReader) {}

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  protected abstract setup(): Promise<void>;

  protected abstract runDuckDBQuery(
    sql: string
  ): Promise<{ rows: QueryDataRow[]; totalRows: number }>;

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
    const defaultOptions = this.readQueryOptions();
    const rowLimit = options.rowLimit ?? defaultOptions.rowLimit;

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

  public abstract runSQLStream(
    sql: string,
    _options: RunSQLOptions
  ): AsyncIterableIterator<QueryDataRow>;

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
   * (https://github.com/malloydata/malloy/issues/635)
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
            structDef.fields.push({
              name,
              type: "string",
              e: [`'DuckDB type "${duckDBType}" not supported by Malloy'`],
            });
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
    const { tablePath } = parseTableURI(tableURL);
    const structDef: StructDef = {
      type: "struct",
      name: tablePath,
      dialect: "duckdb",
      structSource: { type: "table", tablePath },
      structRelationship: {
        type: "basetable",
        connectionName: this.name,
      },
      fields: [],
    };

    const quotedTablePath = tablePath.match(/\//)
      ? `'${tablePath}'`
      : tablePath;
    const infoQuery = `DESCRIBE SELECT * FROM ${quotedTablePath}`;
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

  protected abstract createHash(sqlCommand: string): Promise<string>;

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = await this.createHash(sqlCommand);
    const tableName = `tt${hash}`;

    const cmd = `CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    // console.log(cmd);
    await this.runRawSQL(cmd);
    return tableName;
  }
}
