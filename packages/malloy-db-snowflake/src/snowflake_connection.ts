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
  FieldTypeDef,
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

class StructMap {
  fieldMap = new Map<string, StructMap>();
  type = 'record';
  isArray = false;

  constructor(type: string, isArray: boolean) {
    this.type = type;
    this.isArray = isArray;
  }

  addChild(name: string, type: string): StructMap {
    const s = new StructMap(type, false);
    this.fieldMap.set(name, s);
    return s;
  }
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

  private getTempViewName(sqlCommand: string): string {
    const hash = crypto.createHash('md5').update(sqlCommand).digest('hex');
    return `tt${hash}`;
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
    await this.executor.batch('SELECT 1 as one');
  }

  private variantToMalloyType(type: string): string {
    if (type === 'integer') {
      return 'number';
    } else if (type === 'varchar') {
      return 'string';
    } else {
      return 'unsupported';
    }
  }

  private addFieldsToStructDef(
    structDef: StructDef,
    structMap: StructMap
  ): void {
    if (structMap.fieldMap.size === 0) return;
    for (const [field, value] of structMap.fieldMap) {
      const type = value.type;
      const name = field;

      // check for an array
      if (value.isArray && type !== 'object') {
        const malloyType = this.variantToMalloyType(type);
        if (malloyType) {
          const innerStructDef: StructDef = {
            type: 'struct',
            name,
            dialect: this.dialectName,
            structSource: {type: 'nested'},
            structRelationship: {
              type: 'nested',
              fieldName: name,
              isArray: true,
            },
            fields: [{type: malloyType, name: 'value'} as FieldTypeDef],
          };
          structDef.fields.push(innerStructDef);
        }
      } else if (type === 'object') {
        const innerStructDef: StructDef = {
          type: 'struct',
          name,
          dialect: this.dialectName,
          structSource: value.isArray ? {type: 'nested'} : {type: 'inline'},
          structRelationship: value.isArray
            ? {type: 'nested', fieldName: name, isArray: false}
            : {type: 'inline'},
          fields: [],
        };
        this.addFieldsToStructDef(innerStructDef, value);
        structDef.fields.push(innerStructDef);
      } else {
        const malloyType = this.dialect.sqlTypeToMalloyType(type) ?? {
          type: 'unsupported',
          rawType: type.toLowerCase(),
        };
        structDef.fields.push({name, ...malloyType} as FieldTypeDef);
      }
    }
  }

  private async schemaFromTablePath(
    tablePath: string,
    structDef: StructDef
  ): Promise<void> {
    const infoQuery = `DESCRIBE TABLE ${tablePath}`;
    const rows = await this.executor.batch(infoQuery);
    const variants: string[] = [];
    const notVariant = new Map<string, boolean>();
    for (const row of rows) {
      // data types look like `VARCHAR(1234)`
      let snowflakeDataType = row['type'] as string;
      snowflakeDataType = snowflakeDataType.toLocaleLowerCase().split('(')[0];
      const s = structDef;
      const malloyType = this.dialect.sqlTypeToMalloyType(snowflakeDataType);
      const name = row['name'] as string;

      if (snowflakeDataType === 'variant' || snowflakeDataType === 'array') {
        variants.push(name);
        continue;
      }

      notVariant.set(name, true);
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
    // if we have variants, sample the data
    if (variants.length > 0) {
      const sampleQuery = `
        SELECT regexp_replace(PATH, '\\\\[[0-9]*\\\\]', '') as PATH, lower(TYPEOF(value)) as type
        FROM (select object_construct(*) o from  ${tablePath} limit 100)
            ,table(flatten(input => o, recursive => true)) as meta
        GROUP BY 1,2
        ORDER BY PATH;
      `;
      const fieldPathRows = await this.executor.batch(sampleQuery);

      // take the schema in list form an convert it into a tree.

      const structMap = new StructMap('object', true);

      for (const f of fieldPathRows) {
        const pathString = f['PATH']?.valueOf().toString();
        const fieldType = f['TYPE']?.valueOf().toString();
        if (pathString === undefined || fieldType === undefined) continue;
        const path = pathString.split('.');
        let parent = structMap;

        // ignore the fields we've already added.
        if (path.length === 1 && notVariant.get(pathString)) continue;

        let index = 0;
        for (const segment of path) {
          let thisNode = parent.fieldMap.get(segment);
          if (thisNode === undefined) {
            thisNode = parent.addChild(segment, fieldType);
          }
          if (fieldType === 'array') {
            thisNode.isArray = true;
            // if this is the last
          } else if (index === path.length - 1) {
            thisNode.type = fieldType;
          }
          parent = thisNode;
          index += 1;
        }
      }
      this.addFieldsToStructDef(structDef, structMap);
    }
  }

  private async getTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<StructDef> {
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
    await this.schemaFromTablePath(tablePath, structDef);
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
    const tempTableName = this.getTempViewName(sqlRef.selectStr);
    this.runSQL(
      `
      CREATE OR REPLACE TEMP VIEW ${tempTableName} as ${sqlRef.selectStr};
      `
    );

    await this.schemaFromTablePath(tempTableName, structDef);
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
    const tableName = this.getTempViewName(sqlCommand);
    const cmd = `CREATE OR REPLACE TEMP TABLE ${tableName} AS (${sqlCommand});`;
    await this.runSQL(cmd);
    return tableName;
  }
}
