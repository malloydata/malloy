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
  MalloyQueryData,
  PersistSQLResults,
  QueryValue,
  QueryData,
  QueryDataRow,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  TrinoDialect,
  StructDef,
  TableSourceDef,
  SQLSourceDef,
  AtomicTypeDef,
  ArrayDef,
  RepeatedRecordTypeDef,
  RecordTypeDef,
  arrayEachFields,
  isRepeatedRecord,
} from '@malloydata/malloy';

import {BaseConnection} from '@malloydata/malloy/connection';

import {PrestoClient, PrestoQuery} from '@prestodb/presto-js-client';
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
  port?: number;
  catalog?: string;
  schema?: string;
  user?: string;
  password?: string;
}

export type TrinoConnectionOptions = ConnectionConfig;

export interface BaseRunner {
  runSQL(
    sql: string,
    limit: number | undefined
  ): Promise<{
    rows: unknown[][];
    columns: {name: string; type: string; error?: string}[];
    error?: string;
  }>;
}

class PrestoRunner implements BaseRunner {
  client: PrestoClient;
  constructor(config: TrinoConnectionConfiguration) {
    this.client = new PrestoClient({
      catalog: config.catalog,
      host: config.server,
      port: config.port,
      schema: config.schema,
      timezone: 'America/Costa_Rica',
      user: config.user || 'anyone',
      extraHeaders: {'X-Presto-Session': 'legacy_unnest=true'},
    });
  }
  async runSQL(sql: string, limit: number | undefined) {
    let ret: PrestoQuery | undefined = undefined;
    const q = limit ? `SELECT * FROM(${sql}) LIMIT ${limit}` : sql;
    let error: string | undefined = undefined;
    try {
      ret = (await this.client.query(q)) || [];
      // console.log(ret);
    } catch (errorObj) {
      // console.log(error);
      error = errorObj.toString();
    }
    return {
      rows: ret && ret.data ? ret.data : [],
      columns:
        ret && ret.columns
          ? (ret.columns as {name: string; type: string}[])
          : [],
      error,
    };
  }
}

class TrinoRunner implements BaseRunner {
  client: Trino;
  constructor(config: TrinoConnectionConfiguration) {
    this.client = Trino.create({
      catalog: config.catalog,
      server: config.server,
      schema: config.schema,
      auth: new BasicAuth(config.user!, config.password || ''),
    });
  }
  async runSQL(sql: string, limit: number | undefined) {
    const result = await this.client.query(sql);
    let queryResult = await result.next();
    if (queryResult.value.error) {
      return {
        rows: [],
        columns: [],
        error: JSON.stringify(queryResult.value.error),
      };
    }
    const columns = queryResult.value.columns;

    const outputRows: unknown[][] = [];
    while (queryResult !== null && (!limit || outputRows.length < limit)) {
      const rows = queryResult.value.data ?? [];
      for (const row of rows) {
        if (!limit || outputRows.length < limit) {
          outputRows.push(row as unknown[]);
        }
      }
      if (!queryResult.done) {
        queryResult = await result.next();
      } else {
        break;
      }
    }
    // console.log(outputRows);
    // console.log(columns);
    return {rows: outputRows, columns};
  }
}

export abstract class TrinoPrestoConnection
  extends BaseConnection
  implements Connection, PersistSQLResults
{
  public name: string;
  private readonly dialect = new TrinoDialect();
  static DEFAULT_QUERY_OPTIONS: RunSQLOptions = {
    rowLimit: 10,
  };

  private queryOptions?: QueryOptionsReader;

  //private config: TrinoConnectionConfiguration;

  private client: BaseRunner;

  constructor(
    name: string,
    queryOptions?: QueryOptionsReader,
    pConfig?: TrinoConnectionConfiguration
  ) {
    super();
    const config = pConfig || {};
    this.name = name;
    if (name === 'trino') {
      this.client = new TrinoRunner(config);
    } else {
      this.client = new PrestoRunner(config);
    }
    this.queryOptions = queryOptions;
    //this.config = config;
  }

  get dialectName(): string {
    return this.name;
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

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public get supportsNesting(): boolean {
    return true;
  }

  public async manifestTemporaryTable(_sqlCommand: string): Promise<string> {
    throw new Error('not implemented 1');
  }

  unpackArray(data: unknown): unknown[] {
    return data as unknown[];
  }

  convertRow(structDef: StructDef, rawRow: unknown) {
    const retRow = {};
    const row = this.unpackArray(rawRow);
    for (let i = 0; i < structDef.fields.length; i++) {
      const field = structDef.fields[i];

      if (field.type === 'record') {
        retRow[field.name] = this.convertRow(field, row[i]);
      } else if (isRepeatedRecord(field)) {
        retRow[field.name] = this.convertNest(field, row[i]);
      } else if (field.type === 'array') {
        retRow[field.name] = this.convertNest(field, row[i]);
      } else {
        retRow[field.name] = row[i] ?? null;
      }
    }
    //console.log(retRow);
    return retRow;
  }

  convertNest(structDef: StructDef, _data: unknown) {
    const data = this.unpackArray(_data);
    const ret: unknown[] = [];
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
    const r = await this.client.runSQL(sqlCommand, options.rowLimit);

    if (r.error) {
      throw new Error(r.error);
    }
    const inputRows = r.rows;
    const columns = r.columns;

    const malloyColumns = columns.map(c =>
      this.malloyTypeFromTrinoType(c.name, c.type)
    );

    const malloyRows: QueryDataRow[] = [];
    const rows = inputRows ?? [];
    for (const row of rows) {
      const malloyRow: QueryDataRow = {};
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        const schemaColumn = malloyColumns[i];
        if (schemaColumn.type === 'record') {
          malloyRow[column.name] = this.convertRow(schemaColumn, row[i]);
        } else if (schemaColumn.type === 'array') {
          malloyRow[column.name] = this.convertNest(
            schemaColumn,
            row[i]
          ) as QueryValue;
        } else if (
          schemaColumn.type === 'number' &&
          typeof row[i] === 'string'
        ) {
          // decimal numbers come back as strings
          malloyRow[column.name] = Number(row[i]);
        } else if (
          schemaColumn.type === 'timestamp' &&
          typeof row[i] === 'string'
        ) {
          // timestamps come back as strings
          malloyRow[column.name] = new Date(row[i] as string);
        } else {
          malloyRow[column.name] = row[i] as QueryValue;
        }
      }

      malloyRows.push(malloyRow);
    }

    return {rows: malloyRows, totalRows: malloyRows.length};
  }

  public async runSQLBlockAndFetchResultSchema(
    _sqlBlock: SQLSourceDef,
    _options?: RunSQLOptions
  ): Promise<{data: MalloyQueryData; schema: StructDef}> {
    throw new Error('Not implemented 3');
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

    const schemaDesc = await this.loadSchemaForSqlBlock(
      `DESCRIBE ${tablePath}`,
      structDef,
      `table ${tablePath}`
    );
    structDef.fields = schemaDesc.fields;
    return structDef;
  }

  async fetchSelectSchema(sqlRef: SQLSourceDef): Promise<SQLSourceDef> {
    const structDef: SQLSourceDef = {...sqlRef, fields: []};
    await this.fillStructDefForSqlBlockSchema(sqlRef.selectStr, structDef);
    return structDef;
  }

  protected abstract fillStructDefForSqlBlockSchema(
    sql: string,
    structDef: StructDef
  ): Promise<void>;

  protected async executeAndWait(sqlBlock: string): Promise<void> {
    await this.client.runSQL(sqlBlock, undefined);
    // TODO: make sure failure is handled correctly.
    //while (!(await result.next()).done);
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

  public malloyTypeFromTrinoType(
    name: string,
    trinoType: string
  ): AtomicTypeDef {
    // Arrays look like `array(type)`
    const arrayMatch = trinoType.match(/^(([^,])+\s)?array\((.*)\)$/);

    // Structs look like `row(name type, name type)`
    const structMatch = trinoType.match(/^(([^,])+\s)?row\((.*)\)$/);

    if (arrayMatch) {
      const arrayType = arrayMatch[3];
      const innerType = this.malloyTypeFromTrinoType(name, arrayType);
      if (innerType.type === 'record') {
        const complexStruct: RepeatedRecordTypeDef = {
          type: 'array',
          name,
          elementTypeDef: {type: 'record_element'},
          dialect: this.dialectName,
          join: 'many',
          fields: innerType.fields,
        };
        return complexStruct;
      } else {
        const arrayStruct: ArrayDef = {
          type: 'array',
          name,
          elementTypeDef: innerType,
          dialect: this.dialectName,
          join: 'many',
          fields: arrayEachFields(innerType),
        };
        return arrayStruct;
      }
    } else if (structMatch) {
      // TODO: Trino doesn't quote or escape commas in field names,
      // so some magic is going to need to be applied before we get here
      // to avoid confusion if a field name contains a comma
      const innerTypes = this.splitColumns(structMatch[3]);
      const recordType: RecordTypeDef = {
        type: 'record',
        name,
        dialect: this.dialectName,
        join: 'one',
        fields: [],
      };
      for (let innerType of innerTypes) {
        // TODO: Handle time zone type annotation, which is an
        // exception to the types not containing spaces assumption
        innerType = innerType.replace(/ with time zone$/, '');
        let parts = innerType.match(/^(.+?)\s((array\(|row\().*)$/);
        if (parts === null) {
          parts = innerType.match(/^(.+)\s(\S+)$/);
        }
        if (parts) {
          // remove quotes from the name
          const innerName = parts[1].replace(/^"(.+(?="$))"$/, '$1');
          const innerTrinoType = parts[2];
          const innerMalloyType = this.malloyTypeFromTrinoType(
            innerName,
            innerTrinoType
          );
          recordType.fields.push({...innerMalloyType, name: innerName});
        }
      }
      return recordType;
    }
    return this.dialect.sqlTypeToMalloyType(trinoType);
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

  protected async loadSchemaForSqlBlock(
    sqlBlock: string,
    structDef: StructDef,
    element: string
  ): Promise<StructDef> {
    try {
      const queryResult = await this.client.runSQL(sqlBlock, undefined);

      if (queryResult.error) {
        // TODO: handle.
        throw new Error(queryResult.error);
      }

      const rows: string[][] = (queryResult.rows as string[][]) ?? [];
      this.structDefFromSchema(rows, structDef);
    } catch (e) {
      throw new Error(
        `Could not fetch schema for ${element} ${
          e instanceof Error ? e.message : e
        }`
      );
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

export class PrestoConnection extends TrinoPrestoConnection {
  constructor(
    name: string,
    queryOptions?: QueryOptionsReader,
    config?: TrinoConnectionConfiguration
  );
  constructor(
    option: TrinoConnectionOptions,
    queryOptions?: QueryOptionsReader
  );
  constructor(
    arg: string | TrinoConnectionOptions,
    queryOptions?: QueryOptionsReader,
    config: TrinoConnectionConfiguration = {}
  ) {
    super('presto', queryOptions, config);
  }

  protected async fillStructDefForSqlBlockSchema(
    sql: string,
    structDef: StructDef
  ): Promise<void> {
    const explainResult = await this.runSQL(`EXPLAIN ${sql}`, {});
    this.schemaFromExplain(explainResult, structDef);
  }

  private schemaFromExplain(
    explainResult: MalloyQueryData,
    structDef: StructDef
  ) {
    if (explainResult.rows.length === 0) {
      throw new Error(
        'Received empty explain result when trying to fetch schema.'
      );
    }

    const resultFirstRow = explainResult.rows[0];

    if (resultFirstRow['Query Plan'] === undefined) {
      throw new Error(
        "Explain result has rows but column 'Query Plan' is not present."
      );
    }

    const expResult = resultFirstRow['Query Plan'] as string;

    const lines = expResult.split('\n');
    if (lines?.length === 0) {
      throw new Error(
        'Received invalid explain result when trying to fetch schema.'
      );
    }

    let outputLine = lines[0];

    const namesIndex = outputLine.indexOf('][');
    outputLine = outputLine.substring(namesIndex + 2);

    const lineParts = outputLine.split('] => [');

    if (lineParts.length !== 2) {
      throw new Error('There was a problem parsing schema from Explain.');
    }

    const fieldNamesPart = lineParts[0];
    const fieldNames = fieldNamesPart.split(',').map(e => e.trim());

    let schemaData = lineParts[1];
    schemaData = schemaData.substring(0, schemaData.length - 1);
    const rawFieldsTarget = schemaData
      .split(',')
      .map(e => e.trim())
      .map(e => e.split(':'));

    if (rawFieldsTarget.length !== fieldNames.length) {
      throw new Error(
        'There was a problem parsing schema from Explain. Field names size do not match target fields with types.'
      );
    }

    for (let index = 0; index < fieldNames.length; index++) {
      const name = fieldNames[index];
      const type = rawFieldsTarget[index][1];
      structDef.fields.push({
        name,
        ...this.malloyTypeFromTrinoType(name, type),
      });
    }
  }

  unpackArray(data: unknown): unknown[] {
    return JSON.parse(data as string);
  }
}

export class TrinoConnection extends TrinoPrestoConnection {
  constructor(
    name: string,
    queryOptions?: QueryOptionsReader,
    config?: TrinoConnectionConfiguration
  );
  constructor(
    option: TrinoConnectionOptions,
    queryOptions?: QueryOptionsReader
  );
  constructor(
    arg: string | TrinoConnectionOptions,
    queryOptions?: QueryOptionsReader,
    config: TrinoConnectionConfiguration = {}
  ) {
    super('trino', queryOptions, config);
  }

  protected async fillStructDefForSqlBlockSchema(
    sql: string,
    structDef: StructDef
  ): Promise<void> {
    const tmpQueryName = `myMalloyQuery${randomUUID().replace(/-/g, '')}`;
    await this.executeAndWait(`PREPARE ${tmpQueryName} FROM ${sql}`);
    await this.loadSchemaForSqlBlock(
      `DESCRIBE OUTPUT ${tmpQueryName}`,
      structDef,
      `query ${sql.substring(0, 50)}`
    );
  }
}
