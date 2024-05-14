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
  PooledConnection,
  NamedStructDefs,
  FieldAtomicTypeDef,
} from '@malloydata/malloy';
import {
  AthenaExecutor,
  AthenaConnOptions,
  ColumnMetadata,
} from './athena_executor';
import {
  FetchSchemaOptions,
  TestableConnection,
} from '@malloydata/malloy/dist/runtime_types';
import * as dotenv from 'dotenv';

export interface ConnectionOptions {
  connOptions?: AthenaConnOptions;
  queryOptions?: RunSQLOptions;
}

export class AthenaConnection
  implements Connection, PersistSQLResults, TestableConnection
{
  private executor: AthenaExecutor;
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
      this.executor = AthenaExecutor.createFromEnv();
    } else {
      this.executor = new AthenaExecutor(connOptions);
    }
    this.queryOptions = options?.queryOptions ?? {};
  }

  // NOTE: copied from trino_connection
  trinoToMalloyTypes: {[key: string]: FieldAtomicTypeDef} = {
    'varchar': {type: 'string'},
    'integer': {type: 'number', numberType: 'integer'},
    'bigint': {type: 'number', numberType: 'integer'},
    'double': {type: 'number', numberType: 'float'},
    'decimal': {type: 'number', numberType: 'float'},
    'string': {type: 'string'},
    'date': {type: 'date'},
    'timestamp': {type: 'timestamp'},
    'boolean': {type: 'boolean'},

    // TODO(figutierrez0): cleanup.
    /* 'INT64': {type: 'number', numberType: 'integer'},
    'FLOAT': {type: 'number', numberType: 'float'},
    'FLOAT64': {type: 'number', numberType: 'float'},
    'NUMERIC': {type: 'number', numberType: 'float'},
    'BIGNUMERIC': {type: 'number', numberType: 'float'},
    'TIMESTAMP': {type: 'timestamp'},
    'BOOLEAN': {type: 'boolean'},
    'BOOL': {type: 'boolean'},
    'JSON': {type: 'json'},*/
    // TODO (https://cloud.google.com/bigquery/docs/reference/rest/v2/tables#tablefieldschema):
    // BYTES
    // DATETIME
    // TIME
    // GEOGRAPHY
  };

  // copied from redshift_connection
  // const redshiftToMalloyTypes: {[key: string]: FieldAtomicTypeDef} = {
  //   'smallint': {type: 'number', numberType: 'integer'},
  //   'integer': {type: 'number', numberType: 'integer'},
  //   'bigint': {type: 'number', numberType: 'integer'},
  //   'int': {type: 'number', numberType: 'integer'},
  //   'int2': {type: 'number', numberType: 'integer'},
  //   'int4': {type: 'number', numberType: 'integer'},
  //   'int8': {type: 'number', numberType: 'integer'},
  //   'numeric': {type: 'number', numberType: 'float'},
  //   'decimal': {type: 'number', numberType: 'float'},
  //   'real': {type: 'number', numberType: 'float'},
  //   'double precision': {type: 'number', numberType: 'float'},
  //   'float': {type: 'number', numberType: 'float'},
  //   'float4': {type: 'number', numberType: 'float'},
  //   'float8': {type: 'number', numberType: 'float'},
  //   'char': {type: 'string'},
  //   'character': {type: 'string'},
  //   'nchar': {type: 'string'},
  //   'bpchar': {type: 'string'},
  //   'varchar': {type: 'string'},
  //   'text': {type: 'string'},
  //   'character varying': {type: 'string'},
  //   'nvarchar': {type: 'string'},
  //   'bool': {type: 'boolean'},
  //   'boolean': {type: 'boolean'},
  //   'date': {type: 'date'},
  //   'timestamp': {type: 'timestamp'},
  //   'timestamp without time zone': {type: 'timestamp'},
  //   'timestamptz': {type: 'timestamp'},
  //   'timestamp with time zone': {type: 'timestamp'},
  //   'interval': {type: 'string'},
  // };

  private sqlToMalloyType(sqlType: string): FieldAtomicTypeDef | undefined {
    const baseSqlType = sqlType.match(/^(\w+)/)?.at(0) ?? sqlType;
    if (this.trinoToMalloyTypes[baseSqlType]) {
      return this.trinoToMalloyTypes[baseSqlType];
    }

    return undefined;
  }

  get dialectName(): string {
    return 'trino';
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
    columnsMetadata: ColumnMetadata[],
    structDef: StructDef
  ): Promise<void> {
    for (const columnMetadata of columnsMetadata) {
      const malloyType = this.sqlToMalloyType(columnMetadata.Type) ?? {
        type: 'unsupported',
        rawType: columnMetadata.Type,
      };
      structDef.fields.push({
        name: columnMetadata.Name,
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
      dialect: 'trino',
      name: tableKey,
      structSource: {type: 'table', tablePath},
      structRelationship: {
        type: 'basetable',
        connectionName: this.name,
      },
      fields: [],
    };
    // TODO: understand or fix
    const columnMetadata = await this.executor.describe_table(tablePath);
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
      dialect: 'trino',
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
