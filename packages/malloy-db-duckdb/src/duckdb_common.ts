/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
  AtomicFieldTypeInner,
  Connection,
  FieldTypeDef,
  MalloyQueryData,
  NamedStructDefs,
  PersistSQLResults,
  PooledConnection,
  QueryDataRow,
  RunSQLOptions,
  SQLBlock,
  StreamingConnection,
  StructDef,
  QueryCostEstimate,
  parseTableURI,
} from '@malloydata/malloy';

const duckDBToMalloyTypes: {[key: string]: AtomicFieldTypeInner} = {
  BIGINT: 'number',
  INTEGER: 'number',
  TINYINT: 'number',
  SMALLINT: 'number',
  UBIGINT: 'number',
  UINTEGER: 'number',
  UTINYINT: 'number',
  USMALLINT: 'number',
  HUGEINT: 'number',
  DOUBLE: 'number',
  VARCHAR: 'string',
  DATE: 'date',
  TIMESTAMP: 'timestamp',
  TIME: 'string',
  DECIMAL: 'number',
  BOOLEAN: 'boolean',
};

export interface DuckDBQueryOptions {
  rowLimit: number;
}

export type QueryOptionsReader =
  | Partial<DuckDBQueryOptions>
  | (() => Partial<DuckDBQueryOptions>);

const unquoteName = (name: string) => {
  const match = /^"(.*)"$/.exec(name);
  if (match) {
    return match[1].replace('""', '"');
  }
  return name;
};

export abstract class DuckDBCommon
  implements Connection, PersistSQLResults, StreamingConnection
{
  static DEFAULT_QUERY_OPTIONS: DuckDBQueryOptions = {
    rowLimit: 10,
  };

  private schemaCache = new Map<
    string,
    {schema: StructDef; error?: undefined} | {error: string; schema?: undefined}
  >();
  private sqlSchemaCache = new Map<
    string,
    | {structDef: StructDef; error?: undefined}
    | {error: string; structDef?: undefined}
  >();

  public readonly name: string = 'duckdb_common';

  get dialectName(): string {
    return 'duckdb';
  }

  private readQueryOptions(): DuckDBQueryOptions {
    const options = DuckDBCommon.DEFAULT_QUERY_OPTIONS;
    if (this.queryOptions) {
      if (this.queryOptions instanceof Function) {
        return {...options, ...this.queryOptions()};
      } else {
        return {...options, ...this.queryOptions};
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
  ): Promise<{rows: QueryDataRow[]; totalRows: number}>;

  public async runRawSQL(
    sql: string
  ): Promise<{rows: QueryDataRow[]; totalRows: number}> {
    await this.setup();
    return this.runDuckDBQuery(sql);
  }

  public async runSQL(
    sql: string,
    options: RunSQLOptions = {}
  ): Promise<MalloyQueryData> {
    const defaultOptions = this.readQueryOptions();
    const rowLimit = options.rowLimit ?? defaultOptions.rowLimit;

    const statements = sql.split('-- hack: split on this');

    while (statements.length > 1) {
      await this.runRawSQL(statements[0]);
      statements.shift();
    }

    const retVal = await this.runRawSQL(statements[0]);
    let result = retVal.rows;
    if (result.length > rowLimit) {
      result = result.slice(0, rowLimit);
    }
    return {rows: result, totalRows: result.length};
  }

  public abstract runSQLStream(
    sql: string,
    _options: RunSQLOptions
  ): AsyncIterableIterator<QueryDataRow>;

  private async getSQLBlockSchema(sqlRef: SQLBlock): Promise<StructDef> {
    const structDef: StructDef = {
      type: 'struct',
      dialect: 'duckdb',
      name: sqlRef.name,
      structSource: {
        type: 'sql',
        method: 'subquery',
        sqlBlock: sqlRef,
      },
      structRelationship: {
        type: 'basetable',
        connectionName: this.name,
      },
      fields: [],
    };

    await this.schemaFromQuery(
      `DESCRIBE SELECT * FROM (${sqlRef.selectStr})`,
      structDef
    );
    return structDef;
  }

  public async estimateQueryCost(
    _: string
  ): Promise<QueryCostEstimate> {
    return {};
  }

  /**
   * Split's a structs columns declaration into individual columns
   * to be fed back into fillStructDefFromTypeMap(). Handles commas
   * within nested STRUCT() declarations.
   *
   * (https://github.com/malloydata/malloy/issues/635)
   *
   * @param s struct's column declaration
   * @return Array of column type declarations
   */
  private splitColumns(s: string) {
    const columns: string[] = [];
    let parens = 0;
    let column = '';
    let eatSpaces = true;
    for (let idx = 0; idx < s.length; idx++) {
      const c = s.charAt(idx);
      if (eatSpaces && c === ' ') {
        // Eat space
      } else {
        eatSpaces = false;
        if (!parens && c === ',') {
          columns.push(column);
          column = '';
          eatSpaces = true;
        } else {
          column += c;
        }
        if (c === '(') {
          parens += 1;
        } else if (c === ')') {
          parens -= 1;
        }
      }
    }
    columns.push(column);
    return columns;
  }

  private stringToTypeMap(s: string): {[name: string]: string} {
    const ret: {[name: string]: string} = {};
    const columns = this.splitColumns(s);
    for (const c of columns) {
      //const [name, type] = c.split(" ", 1);
      const columnMatch = c.match(/^(?<name>[^\s]+) (?<type>.*)$/);
      if (columnMatch && columnMatch.groups) {
        ret[columnMatch.groups['name']] = columnMatch.groups['type'];
      } else {
        throw new Error(`Badly form Structure definition ${s}`);
      }
    }
    return ret;
  }

  private fillStructDefFromTypeMap(
    structDef: StructDef,
    typeMap: {[name: string]: string}
  ) {
    for (const fieldName in typeMap) {
      let duckDBType = typeMap[fieldName];
      // Remove quotes from field name
      const name = unquoteName(fieldName);
      // Remove DECIMAL(x,y) precision to simplify lookup
      duckDBType = duckDBType.replace(/^DECIMAL\(\d+,\d+\)/g, 'DECIMAL');
      let malloyType = duckDBToMalloyTypes[duckDBType];
      const arrayMatch = duckDBType.match(/(?<duckDBType>.*)\[\]$/);
      if (arrayMatch && arrayMatch.groups) {
        duckDBType = arrayMatch.groups['duckDBType'];
      }
      const structMatch = duckDBType.match(/^STRUCT\((?<fields>.*)\)$/);
      if (structMatch && structMatch.groups) {
        const newTypeMap = this.stringToTypeMap(structMatch.groups['fields']);
        const innerStructDef: StructDef = {
          type: 'struct',
          name,
          dialect: this.dialectName,
          structSource: {type: arrayMatch ? 'nested' : 'inline'},
          structRelationship: {
            type: arrayMatch ? 'nested' : 'inline',
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
            type: 'struct',
            name,
            dialect: this.dialectName,
            structSource: {type: 'nested'},
            structRelationship: {
              type: 'nested',
              field: name,
              isArray: true,
            },
            fields: [{type: malloyType, name: 'value'} as FieldTypeDef],
          };
          structDef.fields.push(innerStructDef);
        } else {
          if (malloyType) {
            structDef.fields.push({type: malloyType, name});
          } else {
            structDef.fields.push({
              type: 'unsupported',
              rawType: duckDBType.toLowerCase(),
              name,
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
    const typeMap: {[key: string]: string} = {};

    const result = await this.runRawSQL(infoQuery);
    for (const row of result.rows) {
      typeMap[row['column_name'] as string] = row['column_type'] as string;
    }
    this.fillStructDefFromTypeMap(structDef, typeMap);
  }

  public async fetchSchemaForSQLBlock(
    sqlRef: SQLBlock
  ): Promise<
    | {structDef: StructDef; error?: undefined}
    | {error: string; structDef?: undefined}
  > {
    const key = sqlRef.name;
    let inCache = this.sqlSchemaCache.get(key);
    if (!inCache) {
      try {
        inCache = {
          structDef: await this.getSQLBlockSchema(sqlRef),
        };
      } catch (error) {
        inCache = {error: error.message};
      }
      this.sqlSchemaCache.set(key, inCache);
    }
    return inCache;
  }

  public async fetchSchemaForTables(tables: string[]): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    const schemas: NamedStructDefs = {};
    const errors: {[name: string]: string} = {};

    for (const tableURL of tables) {
      let inCache = this.schemaCache.get(tableURL);
      if (!inCache) {
        try {
          inCache = {
            schema: await this.getTableSchema(tableURL),
          };
          this.schemaCache.set(tableURL, inCache);
        } catch (error) {
          inCache = {error: error.message};
        }
      }
      if (inCache.schema !== undefined) {
        schemas[tableURL] = inCache.schema;
      } else {
        errors[tableURL] = inCache.error;
      }
    }
    return {schemas, errors};
  }

  private async getTableSchema(tableURL: string): Promise<StructDef> {
    const {tablePath} = parseTableURI(tableURL);
    const structDef: StructDef = {
      type: 'struct',
      name: tablePath,
      dialect: 'duckdb',
      structSource: {type: 'table', tablePath},
      structRelationship: {
        type: 'basetable',
        connectionName: this.name,
      },
      fields: [],
    };

    const quotedTablePath = tablePath.match(/[:*/]/)
      ? `'${tablePath}'`
      : tablePath;
    const infoQuery = `DESCRIBE SELECT * FROM ${quotedTablePath}`;
    await this.schemaFromQuery(infoQuery, structDef);
    return structDef;
  }

  canStream(): this is StreamingConnection {
    return true;
  }

  public async test(): Promise<void> {
    await this.runRawSQL('SELECT 1');
  }

  abstract createHash(sqlCommand: string): Promise<string>;

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = await this.createHash(sqlCommand);
    const tableName = `tt${hash}`;

    const cmd = `CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    // console.log(cmd);
    await this.runRawSQL(cmd);
    return tableName;
  }

  public abstract close(): Promise<void>;
}
