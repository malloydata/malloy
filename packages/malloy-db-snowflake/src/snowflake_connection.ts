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
  SQLSourceDef,
  TableSourceDef,
  StructDef,
  QueryDataRow,
  SnowflakeDialect,
  TestableConnection,
  arrayEachFields,
  LeafAtomicTypeDef,
} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';

import {SnowflakeExecutor} from './snowflake_executor';
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
  extends BaseConnection
  implements
    Connection,
    PersistSQLResults,
    StreamingConnection,
    TestableConnection
{
  private readonly dialect = new SnowflakeDialect();
  private executor: SnowflakeExecutor;

  // the database & schema where we do temporary operations like creating a temp table
  private scratchSpace?: namespace;
  private queryOptions: RunSQLOptions;

  constructor(
    public readonly name: string,
    options?: SnowflakeConnectionOptions
  ) {
    super();
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
        // Apparently there can only be arrays of integers, strings, or unknowns?
        // TODO is this true or is this just all that got implemented?
        const malloyType: LeafAtomicTypeDef =
          type === 'integer'
            ? {type: 'number', numberType: 'integer'}
            : type === 'varchar'
            ? {type: 'string'}
            : {type: 'sql native', rawType: type};
        const innerStructDef: StructDef = {
          type: 'array',
          name,
          dialect: this.dialectName,
          join: 'many',
          elementTypeDef: malloyType,
          fields: arrayEachFields(malloyType),
        };
        structDef.fields.push(innerStructDef);
      } else if (type === 'object') {
        const structParts = {name, dialect: this.dialectName, fields: []};
        const innerStructDef: StructDef = value.isArray
          ? {
              ...structParts,
              type: 'array',
              elementTypeDef: {type: 'record_element'},
              join: 'many',
            }
          : {
              ...structParts,
              type: 'record',
              join: 'one',
            };
        this.addFieldsToStructDef(innerStructDef, value);
        structDef.fields.push(innerStructDef);
      } else {
        const malloyType = this.dialect.sqlTypeToMalloyType(type);
        structDef.fields.push({...malloyType, name});
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
          type: 'sql native',
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

  async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef> {
    const structDef: TableSourceDef = {
      type: 'table',
      dialect: 'snowflake',
      name: tableKey,
      tablePath,
      connection: this.name,
      fields: [],
    };
    await this.schemaFromTablePath(tablePath, structDef);
    return structDef;
  }

  async fetchSelectSchema(sqlRef: SQLSourceDef): Promise<SQLSourceDef> {
    const structDef = {...sqlRef, fields: []};
    // create temp table with same schema as the query
    const tempTableName = this.getTempViewName(sqlRef.selectStr);
    this.runSQL(
      `CREATE OR REPLACE TEMP VIEW ${tempTableName} AS (${sqlRef.selectStr});`
    );

    await this.schemaFromTablePath(tempTableName, structDef);
    return structDef;
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const tableName = this.getTempViewName(sqlCommand);
    const cmd = `CREATE OR REPLACE TEMP TABLE ${tableName} AS (${sqlCommand});`;
    await this.runSQL(cmd);
    return tableName;
  }
}
