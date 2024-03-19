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
  Connection,
  ConnectionConfig,
  FetchSchemaOptions,
  FieldTypeDef,
  Malloy,
  MalloyQueryData,
  FieldAtomicTypeDef,
  NamedStructDefs,
  PersistSQLResults,
  PooledConnection,
  QueryValue,
  QueryData,
  QueryDataRow,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  SQLBlock,
  StandardSQLDialect,
  StreamingConnection,
  StructDef,
} from '@malloydata/malloy';
import {Trino, BasicAuth} from 'trino-client';

export interface TrinoManagerOptions {
  credentials?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string | null;
  };
  projectId?: string | undefined;
  userAgent: string;
}

export interface TrinoConnectionConfiguration {
  server?: string;
  catalog?: string;
  schema?: string;
  user?: string;
  password?: string;
}

type TrinoConnectionOptions = ConnectionConfig;

// manage access to BQ, control costs, enforce global data/API limits
export class TrinoConnection implements Connection, PersistSQLResults {
  trinoToMalloyTypes: {[key: string]: FieldAtomicTypeDef} = {
    'varchar': {type: 'string'},
    'integer': {type: 'number', numberType: 'integer'},
    'bigint': {type: 'number', numberType: 'integer'},
    'double': {type: 'number', numberType: 'float'},
    'string': {type: 'string'},
    'date': {type: 'date'},

    // TODO: cleanup.
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

  private sqlToMalloyType(sqlType: string): FieldAtomicTypeDef | undefined {
    const baseSqlType = sqlType.match(/^(\w+)/)?.at(0) ?? sqlType;
    if (this.trinoToMalloyTypes[baseSqlType]) {
      return this.trinoToMalloyTypes[baseSqlType];
    }

    return undefined;
  }

  public readonly name: string;
  private readonly dialect = new StandardSQLDialect();
  static DEFAULT_QUERY_OPTIONS: RunSQLOptions = {
    rowLimit: 10,
  };

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

  private queryOptions?: QueryOptionsReader;

  private config: TrinoConnectionConfiguration;

  private trino: Trino;

  constructor(
    option: TrinoConnectionOptions,
    queryOptions?: QueryOptionsReader
  );
  constructor(
    name: string,
    queryOptions?: QueryOptionsReader,
    config?: TrinoConnectionConfiguration
  );
  constructor(
    arg: string | TrinoConnectionOptions,
    queryOptions?: QueryOptionsReader,
    config: TrinoConnectionConfiguration = {}
  ) {
    this.name = 'trino';
    /* if (typeof arg === 'string') {
      this.name = arg;
    } else {
      const {name, client_email, private_key, ...args} = arg;
      this.name = name;
      config = args;
      if (client_email || private_key) {
        config.credentials = {
          client_email,
          private_key,
        };
      }
    }*/
    // TODO: check user is set.
    this.trino = Trino.create({
      server: config.server,
      catalog: config.catalog,
      schema: config.schema,
      auth: new BasicAuth(config.user!, config.password),
    });

    this.queryOptions = queryOptions;
    this.config = config;
  }

  get dialectName(): string {
    return 'trino';
  }

  private readQueryOptions(): RunSQLOptions {
    const options = TrinoConnection.DEFAULT_QUERY_OPTIONS;
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

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canStream(): this is StreamingConnection {
    return false;
  }

  public get supportsNesting(): boolean {
    return true;
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    throw new Error('not impld 1');
  }

  /*  private async _runSQL(
    sqlCommand: string,
    {rowLimit, abortSignal}: RunSQLOptions = {},
    rowIndex = 0
  ): Promise<{
    data: MalloyQueryData;
    schema: Trino.ITableFieldSchema | undefined;
  }> {
    const defaultOptions = this.readQueryOptions();
    const pageSize = rowLimit ?? defaultOptions.rowLimit;

    try {
      const queryResultsOptions: QueryResultsOptions = {
        maxResults: pageSize,
        startIndex: rowIndex.toString(),
      };

      const jobResult = await this.createTrinoJobAndGetResults(
        sqlCommand,
        undefined,
        queryResultsOptions,
        abortSignal
      );

      const totalRows = +(jobResult[2]?.totalRows
        ? jobResult[2].totalRows
        : '0');

      // TODO even though we have 10 minute timeout limit, we still should confirm that resulting metadata has "jobComplete: true"
      const queryCostBytes = jobResult[2]?.totalBytesProcessed;
      const data: MalloyQueryData = {
        rows: jobResult[0],
        totalRows,
        runStats: {
          queryCostBytes: queryCostBytes ? +queryCostBytes : undefined,
        },
      };
      const schema = jobResult[2]?.schema;

      return {data, schema};
    } catch (e) {
      throw maybeRewriteError(e);
    }
  }*/

  public async runSQL(
    sqlCommand: string,
    options: RunSQLOptions = {},
    rowIndex = 0
  ): Promise<MalloyQueryData> {
    //sqlCommand = sqlCommand.replace(new RegExp('`', 'g'), '');
    // TODO: default row limit.
    sqlCommand = `SELECT * FROM (${sqlCommand}) limit ${
      options.rowLimit ?? 50
    }`;
    // TODO: fill in with options.
    const result = await this.trino.query(sqlCommand);


    let queryResult = await result.next();
    if (queryResult.value.error) {
      // TODO: handle.
      throw new Error(
        `Failed to execute sql: ${sqlCommand}. \n Error: ${JSON.stringify(
          queryResult.value.error
        )}`
      );
    }

    const malloyRows: QueryDataRow[] = [];
    while (queryResult !== null) {
      const rows = queryResult.value.data ?? [];
      for (const row of rows) {
        const malloyRow: QueryDataRow = {};
        for (let i = 0; i < queryResult.value.columns.length; i++) {
          const column = queryResult.value.columns[i];
          // TODO: handle arrays etc.
          if (column.type === 'json') {
            malloyRow[column.name] = JSON.parse(row[i]) as QueryValue;
          } else {
            malloyRow[column.name] = row[i] as QueryValue;
          }
        }

        malloyRows.push(malloyRow);
      }

      if (!queryResult.done) {
        queryResult = await result.next();
      } else {
        break;
      }
    }

    console.log(`ROWS: ${JSON.stringify(malloyRows)} ${malloyRows.length}`);
    // TODO: handle totalrows.
    return {rows: malloyRows, totalRows: malloyRows.length};
  }

  public async runSQLBlockAndFetchResultSchema(
    sqlBlock: SQLBlock,
    options?: RunSQLOptions
  ): Promise<{data: MalloyQueryData; schema: StructDef}> {
    /*const {data, schema: schemaRaw} = await this._runSQL(
      sqlBlock.selectStr,
      options
    );

    // TODO need to probably surface the cause of the schema not present error
    if (schemaRaw === undefined) {
      throw new Error('Schema not present');
    }

    const schema = this.structDefFromSQLSchema(sqlBlock, schemaRaw);
    return {data, schema};*/
    throw new Error('Not impld 3');
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
      const tablePath = missing[tableKey].replace(
        /malloytest/g,
        'malloy_demo.faa'
      );
      if (
        !inCache ||
        (refreshTimestamp && refreshTimestamp > inCache.timestamp)
      ) {
        const timestamp = refreshTimestamp ?? Date.now();
        try {
          const schema = await this.structDefFromTableSchema(
            tableKey,
            // TODO: remove.
            tablePath
          );
          inCache = {
            schema,
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

    return {schemas: schemas, errors: errors};
  }

  private async structDefFromTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<StructDef> {
    const structDef: StructDef = {
      type: 'struct',
      name: tableKey,
      dialect: this.dialectName,
      structSource: {
        type: 'table',
        tablePath,
      },
      structRelationship: {
        type: 'basetable',
        connectionName: this.name,
      },
      fields: [],
    };

    try {
      const result = await this.trino.query(`DESCRIBE ${tablePath}`);

      const queryResult = await result.next();

      if (queryResult.value.error) {
        // TODO: handle.
        throw new Error(
          `Failed to grab schema for table ${tablePath}: ${JSON.stringify(
            queryResult.value.error
          )}`
        );
      }

      const rows = queryResult.value.data ?? [];
      for (const row of rows) {
        const fieldName = row[0];
        const type = row[1];
        const malloyType = this.sqlToMalloyType(type) ?? {
          type: 'unsupported',
          rawType: type.toLowerCase(),
        };
        structDef.fields.push({name: fieldName, ...malloyType} as FieldTypeDef);
      }
    } catch (e) {
      throw new Error(`Could not fetch schema for table ${tablePath} ${e}`);
    }
    // TODO: handle repeated etc.
    return structDef;
  }

  public async fetchSchemaForSQLBlock(
    sqlRef: SQLBlock,
    {refreshTimestamp}: FetchSchemaOptions
  ): Promise<
    | {structDef: StructDef; error?: undefined}
    | {error: string; structDef?: undefined}
  > {
    throw new Error('Not impld 5');
  }

  /*  public async downloadMalloyQuery(
    sqlCommand: string
  ): Promise<ResourceStream<RowMetadata>> {
    const job = await this.createTrinoJob({
      query: sqlCommand,
    });

    return job.getQueryResultsStream();
  }*/

  public async estimateQueryCost(sqlCommand: string): Promise<QueryRunStats> {
    /*const dryRunResults = await this.dryRunSQLQuery(sqlCommand);
    return {
      queryCostBytes: Number(
        dryRunResults.metadata.statistics.totalBytesProcessed
      ),
    };*/
    throw new Error('Not impld 6');
  }

  public async executeSQLRaw(sqlCommand: string): Promise<QueryData> {
    /*const result = await this.createTrinoJobAndGetResults(sqlCommand);
    return result[0];*/
    throw new Error('Not impld 7');
  }

  public async test(): Promise<void> {
    // await this.dryRunSQLQuery('SELECT 1');
  }

  async close(): Promise<void> {
    return;
  }
}
