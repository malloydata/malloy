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
  ConnectionConfig,
  MalloyQueryData,
  PersistSQLResults,
  QueryValue,
  QueryData,
  QueryDataRow,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  StructDef,
  TableSourceDef,
  SQLSourceDef,
  AtomicTypeDef,
  RecordTypeDef,
  Dialect,
  FieldDef,
  TestableConnection,
  SQLSourceRequest,
} from '@malloydata/malloy';
import {
  TrinoDialect,
  mkFieldDef,
  isScalarArray,
  TinyParser,
  isRepeatedRecord,
  sqlKey,
} from '@malloydata/malloy';

import {BaseConnection} from '@malloydata/malloy/connection';

import type {PrestoClientConfig, PrestoQuery} from '@prestodb/presto-js-client';
import {PrestoClient} from '@prestodb/presto-js-client';
import {randomUUID} from 'crypto';
import type {ConnectionOptions} from 'trino-client';
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
  extraConfig?: Partial<
    Omit<ConnectionOptions, keyof TrinoConnectionConfiguration>
  >;
}

export type TrinoConnectionOptions = ConnectionConfig;

export interface BaseRunner {
  runSQL(
    sql: string,
    limit: number | undefined,
    abortSignal?: AbortSignal
  ): Promise<{
    rows: unknown[][];
    columns: {name: string; type: string; error?: string}[];
    error?: string;
    profilingUrl?: string;
  }>;
}

class PrestoRunner implements BaseRunner {
  client: PrestoClient;
  constructor(config: TrinoConnectionConfiguration) {
    const prestoClientConfig: PrestoClientConfig = {
      catalog: config.catalog,
      host: config.server,
      port: config.port,
      schema: config.schema,
      timezone: 'America/Costa_Rica',
      user: config.user || 'anyone',
      extraHeaders: {'X-Presto-Session': 'legacy_unnest=true'},
    };
    if (config.user && config.password) {
      prestoClientConfig.basicAuthentication = {
        user: config.user,
        password: config.password,
      };
    }
    this.client = new PrestoClient(prestoClientConfig);
  }
  async runSQL(
    sql: string,
    limit: number | undefined,
    _abortSignal?: AbortSignal
  ) {
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
      ...config.extraConfig,
      catalog: config.catalog,
      server: config.server,
      schema: config.schema,
      auth: new BasicAuth(config.user!, config.password || ''),
    });
  }
  async runSQL(
    sql: string,
    limit: number | undefined,
    _abortSignal?: AbortSignal
  ) {
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
  implements TestableConnection, PersistSQLResults
{
  protected readonly dialect = new TrinoDialect();
  static DEFAULT_QUERY_OPTIONS: RunSQLOptions = {
    rowLimit: 10,
  };

  constructor(
    public name: string,
    private client: BaseRunner,
    private queryOptions?: QueryOptionsReader
  ) {
    super();
    this.name = name;
    this.queryOptions = queryOptions;
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

  unpackArray(_fields: FieldDef[], data: unknown): unknown[] {
    return data as unknown[];
  }

  convertRow(fields: FieldDef[], rawRow: unknown) {
    const retRow = {};
    const row = this.unpackArray(fields, rawRow);
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      if (field.type === 'record') {
        retRow[field.name] = this.convertRow(field.fields, row[i]);
      } else if (isRepeatedRecord(field)) {
        retRow[field.name] = this.convertNest(field.fields, row[i]);
      } else if (field.type === 'array') {
        // mtoy todo don't understand this line actually
        retRow[field.name] = this.convertNest(field.fields.slice(0, 1), row[i]);
      } else {
        retRow[field.name] = row[i] ?? null;
      }
    }
    //console.log(retRow);
    return retRow;
  }

  convertNest(fields: FieldDef[], _data: unknown) {
    const data = this.unpackArray(fields, _data);
    const ret: unknown[] = [];
    const rows = (data === null || data === undefined ? [] : data) as unknown[];
    for (const row of rows) {
      ret.push(this.convertRow(fields, row));
    }
    return ret;
  }

  public async runSQL(
    sqlCommand: string,
    options: RunSQLOptions = {},
    // TODO(figutierrez): Use.
    _rowIndex = 0
  ): Promise<MalloyQueryData> {
    const r = await this.client.runSQL(
      sqlCommand,
      options.rowLimit,
      options.abortSignal
    );

    if (r.error) {
      throw new Error(r.error);
    }

    const {rows: inputRows, columns, profilingUrl} = r;

    const malloyColumns = columns.map(c =>
      mkFieldDef(this.malloyTypeFromTrinoType(c.type), c.name)
    );

    const malloyRows: QueryDataRow[] = [];
    const rows = inputRows ?? [];
    for (const row of rows) {
      const malloyRow: QueryDataRow = {};
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        const schemaColumn = malloyColumns[i];
        malloyRow[column.name] = this.resultRow(schemaColumn, row[i]);
      }

      malloyRows.push(malloyRow);
    }

    return {rows: malloyRows, totalRows: malloyRows.length, profilingUrl};
  }

  private resultRow(colSchema: AtomicTypeDef, rawRow: unknown) {
    if (colSchema.type === 'record') {
      return this.convertRow(colSchema.fields, rawRow);
    } else if (isRepeatedRecord(colSchema)) {
      return this.convertNest(colSchema.fields, rawRow) as QueryValue;
    } else if (isScalarArray(colSchema)) {
      const elType = colSchema.elementTypeDef;
      let theArray = this.unpackArray([], rawRow);
      if (elType.type === 'array') {
        theArray = theArray.map(el => this.resultRow(elType, el));
      }
      return theArray as QueryData;
    } else if (colSchema.type === 'number' && typeof rawRow === 'string') {
      // decimal numbers come back as strings
      return Number(rawRow);
    } else if (colSchema.type === 'timestamp' && typeof rawRow === 'string') {
      // timestamps come back as strings
      return new Date(rawRow as string);
    } else {
      return rawRow as QueryValue;
    }
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

  async fetchSelectSchema(sqlRef: SQLSourceRequest): Promise<SQLSourceDef> {
    const structDef: SQLSourceDef = {
      type: 'sql_select',
      ...sqlRef,
      dialect: this.dialectName,
      fields: [],
      name: sqlKey(sqlRef.connection, sqlRef.selectStr),
    };
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

  public malloyTypeFromTrinoType(trinoType: string): AtomicTypeDef {
    const typeParse = new TrinoPrestoSchemaParser(trinoType, this.dialect);
    return typeParse.typeDef();
  }

  structDefFromSchema(rows: string[][], structDef: StructDef): void {
    for (const row of rows) {
      const name = row[0];
      const type = row[4] || row[1];
      const malloyType = mkFieldDef(this.malloyTypeFromTrinoType(type), name);
      structDef.fields.push(mkFieldDef(malloyType, name));
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
    await this.runSQL('SELECT 1');
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
    super(
      typeof arg === 'string' ? arg : arg.name,
      new PrestoRunner(config),
      queryOptions
    );
  }

  override get dialectName(): string {
    return 'presto';
  }

  static schemaFromExplain(
    explainResult: MalloyQueryData,
    structDef: StructDef,
    dialect: Dialect
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

    const schemaDesc = new TrinoPrestoSchemaParser(lines[0], dialect);
    structDef.fields = schemaDesc.parseQueryPlan();
  }

  protected async fillStructDefForSqlBlockSchema(
    sql: string,
    structDef: StructDef
  ): Promise<void> {
    const explainResult = await this.runSQL(`EXPLAIN ${sql}`, {});
    PrestoConnection.schemaFromExplain(explainResult, structDef, this.dialect);
  }

  unpackArray(_fields: FieldDef[], data: unknown): unknown[] {
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
    super(
      typeof arg === 'string' ? arg : arg.name,
      new TrinoRunner(config),
      queryOptions
    );
  }

  override get dialectName(): string {
    return 'trino';
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

/**
 * A hand built parser for schema lines, it parses two things ...
 * A presto query plan
 * SCHEMA_LINE: - Output [PlanName N] [NAME_LIST] => [TYPE_LIST]
 * NAME_LIST: NAME (, NAME)*
 * TYPE_LIST: TYPE_SPEC (, TYPE_SPEC)*
 * TYPE_SPEC: exprN ':' TYPE
 *
 * And a presto/trino type
 * TYPE: REC_TYPE | ARRAY_TYPE | SQL_TYPE
 * ARRAY_TYPE: ARRAY '(' TYPE ')'
 * REC_TYPE: REC '(' "name" TYPE (, "name" TYPE)* ')'
 */
class TrinoPrestoSchemaParser extends TinyParser {
  constructor(
    readonly input: string,
    readonly dialect: Dialect
  ) {
    super(input, {
      space: /^\s+/,
      arrow: /^=>/,
      char: /^[,:[\]()-]/,
      id: /^\w+/,
      quoted_name: /^"(\\"|[^"])*"/,
    });
  }

  fieldNameList(): string[] {
    this.skipTo(']'); // Skip to end of plan
    this.next('['); // Expect start of name list
    const fieldNames: string[] = [];
    for (;;) {
      const nmToken = this.next('id');
      fieldNames.push(nmToken.text);
      const sep = this.next();
      if (sep.type === ',') {
        continue;
      }
      if (sep.type !== ']') {
        throw this.parseError(
          `Unexpected '${sep.text}' while getting field name list`
        );
      }
      break;
    }
    return fieldNames;
  }

  parseQueryPlan(): FieldDef[] {
    const fieldNames = this.fieldNameList();
    const fields: FieldDef[] = [];
    this.next('arrow', '[');
    for (let nameIndex = 0; ; nameIndex += 1) {
      const name = fieldNames[nameIndex];
      this.next('id', ':');
      const nextType = this.typeDef();
      fields.push(mkFieldDef(nextType, name));
      const sep = this.next();
      if (sep.text === ',') {
        continue;
      }
      if (sep.text !== ']') {
        throw this.parseError(`Unexpected '${sep.text}' between field types`);
      }
      break;
    }
    if (fields.length !== fieldNames.length) {
      throw new Error(
        `Presto schema error mismatched ${fields.length} types and ${fieldNames.length} fields`
      );
    }
    return fields;
  }

  typeDef(): AtomicTypeDef {
    const typToken = this.next();
    if (typToken.type === 'eof') {
      throw this.parseError(
        'Unexpected EOF parsing type, expected a type name'
      );
    } else if (typToken.text === 'row' && this.next('(')) {
      const fields: FieldDef[] = [];
      for (;;) {
        const name = this.next();
        if (name.type !== 'id' && name.type !== 'quoted_name') {
          throw this.parseError(`Expected property name, got '${name.type}'`);
        }
        const getDef = this.typeDef();
        fields.push(mkFieldDef(getDef, name.text));
        const sep = this.next();
        if (sep.text === ')') {
          break;
        }
        if (sep.text === ',') {
          continue;
        }
      }
      const def: RecordTypeDef = {
        type: 'record',
        fields,
      };
      return def;
    } else if (typToken.text === 'array' && this.next('(')) {
      const elType = this.typeDef();
      this.next(')');
      return elType.type === 'record'
        ? {
            type: 'array',
            elementTypeDef: {type: 'record_element'},
            fields: elType.fields,
          }
        : {type: 'array', elementTypeDef: elType};
    } else if (typToken.type === 'id') {
      const sqlType = typToken.text.toLowerCase();
      if (sqlType === 'varchar') {
        if (this.peek().type === '(') {
          this.next('(', 'id', ')');
        }
      } else if (sqlType === 'timestamp') {
        if (this.peek().text === '(') {
          this.next('(', 'id', ')');
        }
        if (this.peek().text === 'with') {
          this.nextText('with', 'time', 'zone');
        }
      }
      const typeDef = this.dialect.sqlTypeToMalloyType(sqlType);
      if (typeDef.type === 'number' && sqlType === 'decimal') {
        this.next('(', 'id');
        if (this.peek().type === ',') {
          this.next(',', 'id');
          typeDef.numberType = 'float';
        } else {
          typeDef.numberType = 'integer';
        }
        this.next(')');
      }
      if (typeDef === undefined) {
        throw this.parseError(`Can't parse presto type ${sqlType}`);
      }
      return typeDef;
    }
    throw this.parseError(
      `'${typToken.text}' unexpected while looking for a type`
    );
  }
}
