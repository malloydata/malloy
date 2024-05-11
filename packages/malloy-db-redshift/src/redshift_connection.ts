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
  RunSQLOptions,
  MalloyQueryData,
  QueryRunStats,
  Connection,
  PersistSQLResults,
  StreamingConnection,
  SQLBlock,
  StructDef,
  QueryDataRow,
  RedshiftDialect,
  PooledConnection,
  NamedStructDefs,
} from '@malloydata/malloy';
import {
  RedShiftAWSExecutor as RedshiftExecutor,
  RedShiftAWSConnOptions as RedshiftConnectionOptions,
} from './redshift_aws_executor';
import {
  FetchSchemaOptions,
  TestableConnection,
} from '@malloydata/malloy/dist/runtime_types';
import * as dotenv from 'dotenv';

export interface ConnectionOptions {
  connOptions?: RedshiftConnectionOptions;
  queryOptions?: RunSQLOptions;
}

export class RedshiftConnection
  implements Connection, PersistSQLResults, TestableConnection
{
  private readonly dialect = new RedshiftDialect();
  private executor: RedshiftExecutor;
  private schemaCache = new Map<
    string,
    | {schema: StructDef; error?: undefined; timestamp: number}
    | {error: string; schema?: undefined; timestamp: number}
  >();
  private sqlSchemaCache = new Map<
    string,
    | {
        structDef: StructDef;
        error?: undefined;
        timestamp: number;
      }
    | {error: string; structDef?: undefined; timestamp: number}
  >();

  private queryOptions: RunSQLOptions;

  constructor(
    public readonly name: string,
    options?: ConnectionOptions
  ) {
    const connOptions = options?.connOptions;
    if (connOptions === undefined) {
      dotenv.config();
      this.executor = RedshiftExecutor.createFromEnv();
    } else {
      this.executor = new RedshiftExecutor(connOptions);
    }
    this.queryOptions = options?.queryOptions ?? {};
  }

  get dialectName(): string {
    return 'redshift';
  }

  // TODO: make it support nesting soon
  public get supportsNesting(): boolean {
    return false;
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canStream(): this is StreamingConnection {
    return false;
  }

  public async estimateQueryCost(_sqlCommand: string): Promise<QueryRunStats> {
    return {};
  }

  async close(): Promise<void> {
    await this.executor.close();
  }

  public async runSQL(
    sql: string,
    options?: RunSQLOptions
  ): Promise<MalloyQueryData> {
    const rowLimit = options?.rowLimit ?? this.queryOptions?.rowLimit;
    let rows = await this.executor.batch(sql);
    if (rowLimit !== undefined && rows.length > rowLimit) {
      rows = rows.slice(0, rowLimit);
    }
    return {rows, totalRows: rows.length};
  }

  public async *runSQLStream(
    _sqlCommand: string,
    _options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    yield* [];
    throw new Error('Streaming not supported');
  }

  public async test(): Promise<void> {
    await this.executor.batch('SELECT 1 as one');
  }

  public async manifestTemporaryTable(_sqlCommand: string): Promise<string> {
    throw new Error('Not implemented');
  }

  private async schemaFromColumnMetadata(
    columnMetadata: Map<string, string>,
    structDef: StructDef
  ): Promise<void> {
    for (const [name, rawType] of columnMetadata) {
      const malloyType = this.dialect.sqlTypeToMalloyType(rawType) ?? {
        type: 'unsupported',
        rawType: rawType,
      };
      structDef.fields.push({
        name,
        ...malloyType,
      });
    }
  }

  private async getTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<StructDef> {
    const structDef: StructDef = {
      type: 'struct',
      dialect: 'redshift',
      name: tableKey,
      structSource: {type: 'table', tablePath},
      structRelationship: {
        type: 'basetable',
        connectionName: this.name,
      },
      fields: [],
    };
    // TODO: understand or fix
    const [schemaName, tableName] = tablePath.split('.');
    const columnMetadata = await this.executor.describe_table(
      tableName,
      schemaName
    );
    await this.schemaFromColumnMetadata(columnMetadata, structDef);
    return structDef;
  }

  public async fetchSchemaForTables(
    missing: Record<string, string>,
    {refreshTimestamp}: FetchSchemaOptions
  ): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    const schemas: NamedStructDefs = {};
    const errors: {[name: string]: string} = {};

    for (const tableKey in missing) {
      let inCache = this.schemaCache.get(tableKey);
      if (
        !inCache ||
        (refreshTimestamp && refreshTimestamp > inCache.timestamp)
      ) {
        const tablePath = missing[tableKey];
        const timestamp = refreshTimestamp || Date.now();
        try {
          inCache = {
            schema: await this.getTableSchema(tableKey, tablePath),
            timestamp,
          };
          this.schemaCache.set(tableKey, inCache);
        } catch (error) {
          inCache = {error: error.message, timestamp};
        }
      }
      if (inCache.schema !== undefined) {
        schemas[tableKey] = inCache.schema;
      } else {
        errors[tableKey] = inCache.error || 'Unknown schema fetch error';
      }
    }
    return {schemas, errors};
  }

  private async getSQLBlockSchema(sqlRef: SQLBlock): Promise<StructDef> {
    const structDef: StructDef = {
      type: 'struct',
      dialect: 'redshift',
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

    const columnMetadata = await this.executor.describe_clause(
      sqlRef.selectStr
    );
    await this.schemaFromColumnMetadata(columnMetadata, structDef);
    return structDef;
  }

  public async fetchSchemaForSQLBlock(
    sqlRef: SQLBlock,
    {refreshTimestamp}: FetchSchemaOptions
  ): Promise<
    | {structDef: StructDef; error?: undefined}
    | {error: string; structDef?: undefined}
  > {
    const key = sqlRef.name;
    let inCache = this.sqlSchemaCache.get(key);
    if (
      !inCache ||
      (refreshTimestamp && refreshTimestamp > inCache.timestamp)
    ) {
      const timestamp = refreshTimestamp ?? Date.now();
      try {
        inCache = {
          structDef: await this.getSQLBlockSchema(sqlRef),
          timestamp,
        };
      } catch (error) {
        inCache = {error: error.message, timestamp};
      }
      this.sqlSchemaCache.set(key, inCache);
    }
    return inCache;
  }
}
