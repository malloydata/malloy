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
  QueryData,
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
  TinyParser,
  sqlKey,
  makeDigest,
} from '@malloydata/malloy';

import {BaseConnection} from '@malloydata/malloy/connection';
import type {PrestoClientConfig, PrestoQuery} from '@prestodb/presto-js-client';
import {PrestoClient} from '@prestodb/presto-js-client';
import {randomUUID} from 'crypto';
import type {ConnectionOptions} from 'trino-client';
import {Trino, BasicAuth} from 'trino-client';
import {resultRowToQueryRecord} from './result-to-querydata';

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
  setupSQL?: string;
  extraConfig?: Partial<
    Omit<ConnectionOptions, keyof TrinoConnectionConfiguration>
  >;
}

export type TrinoConnectionOptions = ConnectionConfig;

export interface BaseRunner {
  runSQL(
    sql: string,
    options: RunSQLOptions
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
      timezone: 'UTC',
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
  async runSQL(sql: string, options: RunSQLOptions = {}) {
    let ret: PrestoQuery | undefined = undefined;
    const q = options.rowLimit
      ? `SELECT * FROM(${sql}) LIMIT ${options.rowLimit}`
      : sql;
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
  async runSQL(sql: string, options: RunSQLOptions = {}) {
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
    while (
      queryResult !== null &&
      (!options.rowLimit || outputRows.length < options.rowLimit)
    ) {
      const rows = queryResult.value.data ?? [];
      for (const row of rows) {
        if (!options.rowLimit || outputRows.length < options.rowLimit) {
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

  protected setupSQL: string | undefined;
  private setupDone: Promise<void> | undefined;
  protected connectionConfig: TrinoConnectionConfiguration;

  constructor(
    public name: string,
    private client: BaseRunner,
    private queryOptions?: QueryOptionsReader,
    setupSQL?: string,
    connectionConfig?: TrinoConnectionConfiguration
  ) {
    super();
    this.name = name;
    this.queryOptions = queryOptions;
    this.setupSQL = setupSQL;
    this.connectionConfig = connectionConfig ?? {};
  }

  private async ensureSetup(): Promise<void> {
    if (!this.setupDone && this.setupSQL) {
      this.setupDone = this.runSetupStatements();
    }
    if (this.setupDone) {
      await this.setupDone;
    }
  }

  private async runSetupStatements(): Promise<void> {
    for (const stmt of this.setupSQL!.split(';\n')) {
      const trimmed = stmt.trim();
      if (trimmed) {
        const r = await this.client.runSQL(trimmed, {});
        if (r.error) {
          throw new Error(r.error);
        }
      }
    }
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

  public getDigest(): string {
    const {server, port, catalog, schema, user} = this.connectionConfig;
    return makeDigest(
      'trino',
      server ?? '',
      String(port ?? ''),
      catalog ?? '',
      schema ?? '',
      user ?? '',
      this.setupSQL ?? ''
    );
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

  public async runSQL(
    sqlCommand: string,
    options: RunSQLOptions = {},
    // TODO(figutierrez): Use.
    _rowIndex = 0
  ): Promise<MalloyQueryData> {
    await this.ensureSetup();
    const r = await this.client.runSQL(sqlCommand, options);

    if (r.error) {
      throw new Error(r.error);
    }

    const {rows: inputRows, columns, profilingUrl} = r;

    const malloyColumns = columns.map(c =>
      mkFieldDef(this.malloyTypeFromTrinoType(c.type), c.name)
    );

    const unpack = (data: unknown) => this.unpackArray([], data);
    const rows = inputRows ?? [];
    const malloyRows = rows.map(row =>
      resultRowToQueryRecord(malloyColumns, row as unknown[], unpack)
    );

    return {rows: malloyRows, totalRows: malloyRows.length, profilingUrl};
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
    await this.ensureSetup();
    await this.client.runSQL(sqlBlock, {});
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
      const type = row[4] && typeof row[4] === 'string' ? row[4] : row[1];
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
      await this.ensureSetup();
      const queryResult = await this.client.runSQL(sqlBlock, {});

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
    const setupSQL =
      typeof arg === 'string'
        ? config.setupSQL
        : typeof arg['setupSQL'] === 'string'
          ? arg['setupSQL']
          : undefined;
    super(
      typeof arg === 'string' ? arg : arg.name,
      new PrestoRunner(config),
      queryOptions,
      setupSQL,
      config
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
    const setupSQL =
      typeof arg === 'string'
        ? config.setupSQL
        : typeof arg['setupSQL'] === 'string'
          ? arg['setupSQL']
          : undefined;
    super(
      typeof arg === 'string' ? arg : arg.name,
      new TrinoRunner(config),
      queryOptions,
      setupSQL,
      config
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
    } else if (typToken.text === 'map' && this.next('(')) {
      const _keyType = this.typeDef();
      this.next(',');
      const _valType = this.typeDef();
      this.next(')');
      return {type: 'sql native'};
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
          return {type: 'timestamptz'};
        }
        return {type: 'timestamp'};
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
