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

import type {
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  QueryRecord,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  StreamingConnection,
  StructDef,
  TestableConnection,
  SQLSourceDef,
  TableSourceDef,
  SQLSourceRequest,
} from '@malloydata/malloy';
import {
  DuckDBDialect,
  makeDigest,
  mkFieldDef,
  sqlKey,
} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';

export interface DuckDBQueryOptions {
  rowLimit: number;
}

const unquoteName = (name: string) => {
  const match = /^"(.*)"$/.exec(name);
  if (match) {
    return match[1].replace('""', '"');
  }
  return name;
};

export abstract class DuckDBCommon
  extends BaseConnection
  implements TestableConnection, PersistSQLResults, StreamingConnection
{
  protected isMotherDuck = false;
  protected motherDuckToken: string | undefined;

  private readonly dialect = new DuckDBDialect();
  static DEFAULT_QUERY_OPTIONS: DuckDBQueryOptions = {
    rowLimit: 10,
  };

  public readonly name: string = 'duckdb_common';

  get dialectName(): string {
    return this.dialect.name;
  }

  protected readQueryOptions(): DuckDBQueryOptions {
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

  constructor(protected queryOptions?: QueryOptionsReader) {
    super();
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public abstract getDigest(): string;

  protected abstract setup(): Promise<void>;

  protected abstract runDuckDBQuery(
    sql: string
  ): Promise<{rows: QueryRecord[]; totalRows: number}>;

  public async runRawSQL(
    sql: string
  ): Promise<{rows: QueryRecord[]; totalRows: number}> {
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
    options: RunSQLOptions
  ): AsyncIterableIterator<QueryRecord>;

  async fetchSelectSchema(
    sqlRef: SQLSourceRequest
  ): Promise<SQLSourceDef | string> {
    const sqlDef: SQLSourceDef = {
      type: 'sql_select',
      ...sqlRef,
      dialect: this.dialectName,
      fields: [],
      name: sqlKey(sqlRef.connection, sqlRef.selectStr),
    };
    await this.schemaFromQuery(
      `DESCRIBE SELECT * FROM (${sqlRef.selectStr})`,
      sqlDef
    );
    return sqlDef;
  }

  public async estimateQueryCost(_: string): Promise<QueryRunStats> {
    return {};
  }

  fillStructDefFromTypeMap(
    structDef: StructDef,
    typeMap: {[name: string]: string}
  ) {
    for (const fieldName in typeMap) {
      // Remove quotes from field name
      const name = unquoteName(fieldName);
      const dbType = typeMap[fieldName];
      const malloyType = this.dialect.parseDuckDBType(dbType);
      structDef.fields.push(mkFieldDef(malloyType, name));
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

  async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef> {
    const structDef: TableSourceDef = {
      type: 'table',
      name: tableKey,
      dialect: this.dialectName,
      tablePath,
      connection: this.name,
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

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = makeDigest(sqlCommand);
    const tableName = `tt${hash.slice(0, this.dialect.maxIdentifierLength - 2)}`;

    const cmd = `CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    // console.log(cmd);
    await this.runRawSQL(cmd);
    return tableName;
  }

  public abstract close(): Promise<void>;
}
