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
import {randomUUID} from 'crypto';
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
      catalog: 'malloy_demo', //config.catalog,
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

  public async manifestTemporaryTable(_sqlCommand: string): Promise<string> {
    throw new Error('not implemented 1');
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

  convertRow(structDef: StructDef, _row: unknown) {
    const retRow = {};
    const row = _row as [];
    for (let i = 0; i < structDef.fields.length; i++) {
      const field = structDef.fields[i];

      if (field.type === 'struct') {
        const struct = field as StructDef;
        if (struct.structSource.type === 'inline') {
          retRow[field.name] = this.convertRow(struct, row[i]);
        } else {
          retRow[field.name] = this.convertNest(struct, row[i]);
        }
      } else {
        retRow[field.name] = row[i] === undefined ? null : row[i];
      }
    }
    //console.log(retRow);
    return retRow;
  }

  convertNest(structDef: StructDef, data: unknown) {
    const ret: unknown[] = [];
    //console.log(
    //   `${JSON.stringify(structDef, null, 2)} ${JSON.stringify(data, null, 2)} `
    // );
    if (structDef.structSource.type === 'inline') {
      return this.convertRow(structDef, data);
    }
    const rows = (data === null || data === undefined ? [] : data) as unknown[];
    for (const row of rows) {
      ret.push(this.convertRow(structDef, row));
    }
    return ret;
  }

  public async runSQL(
    sqlCommand: string,
    options: RunSQLOptions = {},
    // TODO(figutierrez): Use.
    _rowIndex = 0
  ): Promise<MalloyQueryData> {
    const result = await this.trino.query(sqlCommand);
    let queryResult = await result.next();
    if (queryResult.value.error) {
      // TODO: handle.
      const {failureInfo: _, ...error} = queryResult.value.error;
      throw new Error(
        `Failed to execute sql: ${sqlCommand}. \n Error: ${JSON.stringify(
          error
        )}`
      );
    }

    const malloyColumns = queryResult.value.columns.map(c =>
      this.malloyTypeFromTrinoType(c.name, c.type)
    );

    // Debugging types
    // const _x = queryResult.value.columns.map(c => console.log(c.type));
    // console.log(JSON.stringify(malloyColumns, null, 2));
    // console.log(JSON.stringify(queryResult.value.data, null, 2));

    let maxRows = options.rowLimit ?? 50;
    const malloyRows: QueryDataRow[] = [];
    while (queryResult !== null && maxRows--) {
      const rows = queryResult.value.data ?? [];
      for (const row of rows) {
        const malloyRow: QueryDataRow = {};
        for (let i = 0; i < queryResult.value.columns.length; i++) {
          const column = queryResult.value.columns[i];
          if (malloyColumns[i].type === 'struct') {
            const structDef = malloyColumns[i] as StructDef;
            if (structDef.structSource.type === 'inline') {
              malloyRow[column.name] = this.convertRow(
                structDef,
                row[i]
              ) as QueryValue;
            } else {
              malloyRow[column.name] = this.convertNest(
                structDef,
                row[i]
              ) as QueryValue;
            }
            // console.log(
            //   column.name,
            //   JSON.stringify(malloyColumns[i], null, 2),
            //   JSON.stringify(row[i]),
            //   JSON.stringify(malloyRow[column.name])
            // );
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

    // TODO(figutierrez): Remove.
    // eslint-disable-next-line no-console
    // console.log(`ROWS: ${JSON.stringify(malloyRows)} ${malloyRows.length}`);
    // TODO: handle totalrows.
    return {rows: malloyRows, totalRows: malloyRows.length};
  }

  public async runSQLBlockAndFetchResultSchema(
    _sqlBlock: SQLBlock,
    _options?: RunSQLOptions
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
    throw new Error('Not implemented 3');
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
      const tablePath = missing[tableKey];

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

    return await this.loadSchemaForSqlBlock(
      `DESCRIBE ${tablePath}`,
      structDef,
      `table ${tablePath}`
    );
  }

  public async fetchSchemaForSQLBlock(
    sqlRef: SQLBlock,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          structDef: await this.structDefFromSqlBlock(sqlRef),
          timestamp,
        };
      } catch (error) {
        inCache = {error: error.message, timestamp};
      }
      this.sqlSchemaCache.set(key, inCache);
    }
    return inCache;
  }

  private async structDefFromSqlBlock(sqlRef: SQLBlock): Promise<StructDef> {
    const structDef: StructDef = {
      type: 'struct',
      name: sqlRef.name,
      dialect: this.dialectName,
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

    const tmpQueryName = `myMalloyQuery${randomUUID().replace(/-/g, '')}`;
    await this.executeAndWait(
      `PREPARE ${tmpQueryName} FROM ${sqlRef.selectStr}`
    );
    return await this.loadSchemaForSqlBlock(
      `DESCRIBE OUTPUT ${tmpQueryName}`,
      structDef,
      `query ${sqlRef.selectStr.substring(0, 50)}`
    );
  }

  private async executeAndWait(sqlBlock: string): Promise<void> {
    const result = await this.trino.query(sqlBlock);
    // TODO: make sure failure is handled correctly.
    while (!(await result.next()).done);
  }

  splitColumns(s: string) {
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

  malloyTypeFromTrinoType(
    name: string,
    trinoType: string
  ): FieldAtomicTypeDef | StructDef {
    let malloyType: FieldAtomicTypeDef | StructDef;
    // Arrays look like `array(type)`
    const arrayMatch = trinoType.match(/^(([^,])+\s)?array\((.*)\)$/);
    // console.log(`${trinoType} arrayMatch: ${arrayMatch}`);

    // Structs look like `row(name type, name type)`
    const structMatch = trinoType.match(/^(([^,])+\s)?row\((.*)\)$/);
    // console.log(`${trinoType} structMatch: ${structMatch}`);

    if (arrayMatch) {
      const arrayType = arrayMatch[3];
      const innerType = this.malloyTypeFromTrinoType(name, arrayType);
      if (innerType.type === 'struct') {
        malloyType = {...innerType, structSource: {type: 'nested'}};
        malloyType.structRelationship = {
          type: 'nested',
          fieldName: name,
          isArray: true,
        };
      } else {
        malloyType = {
          type: 'struct',
          name,
          dialect: this.dialectName,
          structSource: {type: 'nested'},
          structRelationship: {
            type: 'nested',
            fieldName: name,
            isArray: true,
          },
          fields: [{...innerType, name: 'value'} as FieldTypeDef],
        };
      }
    } else if (structMatch) {
      // TODO: Trino doesn't quote or escape commas in field names,
      // so some magic is going to need to be applied before we get here
      // to avoid confusion if a field name contains a comma
      const innerTypes = this.splitColumns(structMatch[3]);
      // console.log(`innerType: ${JSON.stringify(innerTypes)}`);
      malloyType = {
        type: 'struct',
        name,
        dialect: this.dialectName,
        structSource: {type: 'inline'},
        structRelationship: {
          type: 'inline',
        },
        fields: [],
      };
      for (let innerType of innerTypes) {
        // TODO: Handle time zone type annotation, which is an
        // exception to the types not containing spaces assumption
        innerType = innerType.replace(/ with time zone$/, '');
        let parts = innerType.match(/^(.*)\s((array\(|row\().*)$/);
        if (parts === null) {
          parts = innerType.match(/^(.*)\s(\S+)$/);
        }
        if (parts) {
          const innerName = parts[1];
          const innerTrinoType = parts[2];
          const innerMalloyType = this.malloyTypeFromTrinoType(
            innerName,
            innerTrinoType
          );
          malloyType.fields.push({...innerMalloyType, name: innerName});
        } else {
          malloyType.fields.push({
            name: 'unknown',
            type: 'unsupported',
            rawType: innerType.toLowerCase(),
          });
        }
      }
    } else {
      malloyType = this.sqlToMalloyType(trinoType) ?? {
        type: 'unsupported',
        rawType: trinoType.toLowerCase(),
      };
    }
    // console.log('>', trinoType, '\n<', malloyType);
    return malloyType;
  }

  structDefFromSchema(rows: string[][], structDef: StructDef): void {
    for (const row of rows) {
      const name = row[0];
      const type = row[4] || row[1];
      const malloyType = this.malloyTypeFromTrinoType(name, type);
      // console.log('>', row, '\n<', malloyType);
      structDef.fields.push({name, ...malloyType});
    }
  }

  private async loadSchemaForSqlBlock(
    sqlBlock: string,
    structDef: StructDef,
    element: string
  ): Promise<StructDef> {
    try {
      const result = await this.trino.query(sqlBlock);

      const queryResult = await result.next();

      if (queryResult.value.error) {
        // TODO: handle.
        throw new Error(
          `Failed to grab schema for ${element}: ${JSON.stringify(
            queryResult.value.error
          )}`
        );
      }

      const rows: string[][] = queryResult.value.data ?? [];
      this.structDefFromSchema(rows, structDef);
    } catch (e) {
      throw new Error(`Could not fetch schema for ${element} ${e}`);
    }

    return structDef;
  }

  /*  public async downloadMalloyQuery(
    sqlCommand: string
  ): Promise<ResourceStream<RowMetadata>> {
    const job = await this.createTrinoJob({
      query: sqlCommand,
    });

    return job.getQueryResultsStream();
  }*/

  public async estimateQueryCost(_sqlCommand: string): Promise<QueryRunStats> {
    // TODO(figutierrez): Implement.
    return {};
  }

  public async executeSQLRaw(_sqlCommand: string): Promise<QueryData> {
    /*const result = await this.createTrinoJobAndGetResults(sqlCommand);
    return result[0];*/
    throw new Error('Not implemented 7');
  }

  public async test(): Promise<void> {
    // await this.dryRunSQLQuery('SELECT 1');
  }

  async close(): Promise<void> {
    return;
  }
}
