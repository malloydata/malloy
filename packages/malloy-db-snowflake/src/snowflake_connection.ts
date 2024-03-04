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

import * as crypto from 'crypto';
import {
  RunSQLOptions,
  MalloyQueryData,
  QueryRunStats,
  Connection,
  PersistSQLResults,
  StreamingConnection,
  PooledConnection,
  SQLBlock,
  StructDef,
  QueryDataRow,
  SnowflakeDialect,
  NamedStructDefs,
} from '@malloydata/malloy';
import {SnowflakeExecutor} from './snowflake_executor';
import {
  FetchSchemaOptions,
  TestableConnection,
} from '@malloydata/malloy/dist/runtime_types';
import {ConnectionOptions} from 'snowflake-sdk';
import {Options as PoolOptions} from 'generic-pool';

type namespace = {database: string; schema: string};

export interface SnowflakeConnectionOptions {
  // snowflake sdk connection options
  connOptions?: ConnectionOptions;
  // generic pool options to help maintain a pool of connections to snowflake
  poolOptions?: PoolOptions;

  // the database and schema where we can perform temporary table operations.
  // for example, if we want to create a temp table for fetching schema of an sql block
  // we could use this database & schema instead of the main database & schema
  scratchSpace?: namespace;

  queryOptions?: RunSQLOptions;
}

export class SnowflakeConnection
  implements
    Connection,
    PersistSQLResults,
    StreamingConnection,
    TestableConnection
{
  private readonly dialect = new SnowflakeDialect();
  private executor: SnowflakeExecutor;
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

  // the database & schema where we do temporary operations like creating a temp table
  private scratchSpace?: namespace;
  private queryOptions: RunSQLOptions;

  constructor(
    public readonly name: string,
    options?: SnowflakeConnectionOptions
  ) {
    let connOptions = options?.connOptions;
    if (connOptions === undefined) {
      // try to get connection options from ~/.snowflake/connections.toml
      connOptions = SnowflakeExecutor.getConnectionOptionsFromToml();
    }
    this.executor = new SnowflakeExecutor(connOptions, options?.poolOptions);
    this.scratchSpace = options?.scratchSpace;
    this.queryOptions = options?.queryOptions ?? {};
  }

  get dialectName(): string {
    return 'snowflake';
  }

  // TODO: make it support nesting soon
  public get supportsNesting(): boolean {
    return false;
  }

  public isPool(): this is PooledConnection {
    return true;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canStream(): this is StreamingConnection {
    return true;
  }

  public async estimateQueryCost(_sqlCommand: string): Promise<QueryRunStats> {
    return {};
  }

  async close(): Promise<void> {
    await this.executor.done();
  }

  private getTempTableName(sqlCommand: string): string {
    const hash = crypto.createHash('md5').update(sqlCommand).digest('hex');
    let tableName = `tt${hash}`;
    if (this.scratchSpace) {
      tableName = `${this.scratchSpace.database}.${this.scratchSpace.schema}.${tableName}`;
    }
    return tableName;
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
    sqlCommand: string,
    options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    const streamQueryOptions = {
      ...this.queryOptions,
      ...options,
    };

    for await (const row of await this.executor.stream(
      sqlCommand,
      streamQueryOptions
    )) {
      yield row;
    }
  }

  public async test(): Promise<void> {
    await this.executor.batch('SELECT 1');
  }

  private async schemaFromQuery(
    infoQuery: string,
    structDef: StructDef
  ): Promise<void> {
    const rows = await this.executor.batch(infoQuery);
    for (const row of rows) {
      const snowflakeDataType = row['DATA_TYPE'] as string;
      const s = structDef;
      const malloyType = this.dialect.sqlTypeToMalloyType(snowflakeDataType);
      const name = row['COLUMN_NAME'] as string;
      if (malloyType) {
        s.fields.push({...malloyType, name});
      } else {
        s.fields.push({
          type: 'unsupported',
          rawType: snowflakeDataType,
          name,
        });
      }
    }
  }

  private async getTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<StructDef> {
    // looks like snowflake:schemaName.tableName
    tableKey = tableKey.toLowerCase();

    let [schema, tableName] = ['', tablePath];
    const schema_and_table = tablePath.split('.');
    if (schema_and_table.length === 2) {
      [schema, tableName] = schema_and_table;
    }

    const structDef: StructDef = {
      type: 'struct',
      dialect: 'snowflake',
      name: tableKey,
      structSource: {type: 'table', tablePath},
      structRelationship: {
        type: 'basetable',
        connectionName: this.name,
      },
      fields: [],
    };
    // This is how we get variant information

    // WITH tbl as (
    //   SELECT * FROM malloytest.ga_sample
    //  )
    //  SELECT regexp_replace(PATH, '\\[.*\\]', '[]') as PATH, lower(TYPEOF(value)) as type
    //  FROM (select object_construct(*) o from  tbl limit 100)
    //      ,table(flatten(input => o, recursive => true)) as meta
    //  WHERE lower(TYPEOF(value)) <> 'array'
    //  GROUP BY 1,2
    //  ORDER BY PATH

    const infoQuery = `
  SELECT
    column_name, -- LOWER(COLUMN_NAME) AS column_name,
    LOWER(DATA_TYPE) as data_type
  FROM
    INFORMATION_SCHEMA.COLUMNS
  WHERE
    table_schema = UPPER('${schema}')
    AND table_name = UPPER('${tableName}');
    `;

    await this.schemaFromQuery(infoQuery, structDef);
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
      dialect: 'snowflake',
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

    // create temp table with same schema as the query
    const tempTableName = this.getTempTableName(sqlRef.selectStr);
    this.runSQL(
      `
      CREATE OR REPLACE TEMP TABLE ${tempTableName} as SELECT * FROM (
        ${sqlRef.selectStr}
      ) as x WHERE false;
      `
    );

    const infoQuery = `
  SELECT
    column_name, -- LOWER(column_name) as column_name,
    LOWER(data_type) as data_type
  FROM
    INFORMATION_SCHEMA.COLUMNS
  WHERE
    table_name = UPPER('${tempTableName}');
  `;
    await this.schemaFromQuery(infoQuery, structDef);
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

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const tableName = this.getTempTableName(sqlCommand);
    const cmd = `CREATE OR REPLACE TEMP TABLE ${tableName} AS (${sqlCommand});`;
    await this.runSQL(cmd);
    return tableName;
  }
}
