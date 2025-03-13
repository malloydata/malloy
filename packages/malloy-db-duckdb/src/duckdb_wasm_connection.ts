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

import * as duckdb from '@duckdb/duckdb-wasm';
import Worker from 'web-worker';
import type {
  FetchSchemaOptions,
  QueryDataRow,
  QueryOptionsReader,
  RunSQLOptions,
  SQLSourceDef,
  ConnectionConfig,
  TableSourceDef,
  SQLSourceRequest,
} from '@malloydata/malloy';
import type {StructRow, Table} from 'apache-arrow';
import {DuckDBCommon} from './duckdb_common';

const TABLE_MATCH = /FROM\s*('([^']*)'|"([^"]*)")/gi;
const TABLE_FUNCTION_MATCH = /FROM\s+[a-z0-9_]+\(('([^']*)'|"([^"]*)")/gi;

const FILE_EXTS = ['.csv', '.tsv', '.parquet'] as const;

const isIterable = (x: object): x is Iterable<unknown> => Symbol.iterator in x;

/**
 * Arrow's toJSON() doesn't really do what I'd expect, since
 * it still includes Arrow objects like DecimalBigNums and Vectors,
 * so we need this fairly gross function to unwrap those.
 *
 * @param value Element from an Arrow StructRow.
 * @return Vanilla Javascript value
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unwrapArrow = (value: unknown): any => {
  if (value === null) {
    return value;
  } else if (value instanceof Date) {
    return value;
  } else if (typeof value === 'bigint') {
    return Number(value);
  } else if (typeof value === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = value as Record<string | symbol, any>;
    // DecimalBigNums appear as Uint32Arrays, but can be identified
    // because they have a Symbol.toPrimitive method
    if (obj[Symbol.toPrimitive]) {
      // There seems to be a bug in [Symbol.toPrimitive]("number") so
      // convert to string first and then to number.
      return Number(obj[Symbol.toPrimitive]());
    } else if (Array.isArray(value)) {
      return value.map(unwrapArrow);
    } else if (isIterable(value)) {
      // Catch Arrow Vector objects
      return [...value].map(unwrapArrow);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string | symbol, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          result[key] = unwrapArrow(obj[key]);
        }
      }
      return result;
    }
  }
  return value;
};

/**
 * Process a single Arrow result row into a Malloy QueryDataRow
 * Unfortunately simply calling JSONParse(JSON.stringify(row)) even
 * winds up converting DecimalBigNums to strings instead of numbers.
 * For some reason a custom replacer only sees DecimalBigNums as
 * strings, as well.
 */
export const unwrapRow = (row: StructRow): QueryDataRow => {
  return unwrapArrow(row.toJSON());
};

/**
 * Process a duckedb Table into an array of Malloy QueryDataRows
 */
const unwrapTable = (table: Table): QueryDataRow[] => {
  return table.toArray().map(unwrapRow);
};

const isNode = () => typeof navigator === 'undefined';

type RemoteFileCallback = (
  tableName: string
) => Promise<Uint8Array | undefined>;

export interface DuckDBWasmOptions extends ConnectionConfig {
  additionalExtensions?: string[];
  databasePath?: string;
  motherDuckToken: string | undefined;
  workingDirectory?: string;
}
export abstract class DuckDBWASMConnection extends DuckDBCommon {
  private additionalExtensions: string[] = [];
  public readonly name: string;
  private databasePath: string | null = null;
  protected workingDirectory = '/';
  connecting: Promise<void>;
  protected _connection: duckdb.AsyncDuckDBConnection | null = null;
  protected _database: duckdb.AsyncDuckDB | null = null;
  protected isSetup: Promise<void> | undefined;
  private worker: Worker | null = null;

  private remoteFileCallbacks: RemoteFileCallback[] = [];
  private remoteFileStatus: Record<string, Promise<number>> = {};

  constructor(options: DuckDBWasmOptions, queryOptions?: QueryOptionsReader);
  constructor(
    name: string,
    databasePath?: string | null,
    workingDirectory?: string,
    queryOptions?: QueryOptionsReader
  );
  constructor(
    public readonly arg: string | DuckDBWasmOptions,
    arg2?: string | QueryOptionsReader | null,
    workingDirectory?: string,
    queryOptions?: QueryOptionsReader
  ) {
    super();
    if (typeof arg === 'string') {
      this.name = arg;
      if (typeof arg2 === 'string') {
        this.databasePath = arg2;
      }
      if (typeof workingDirectory === 'string') {
        this.workingDirectory = workingDirectory;
      }
      if (queryOptions) {
        this.queryOptions = queryOptions;
      }
    } else {
      this.name = arg.name;
      if (arg2) {
        this.queryOptions = arg2 as QueryOptionsReader;
      }
      if (typeof arg.databasePath === 'string') {
        this.databasePath = arg.databasePath;
      }
      if (typeof arg.workingDirectory === 'string') {
        this.workingDirectory = arg.workingDirectory;
      }
      if (typeof arg.motherDuckToken === 'string') {
        this.motherDuckToken = arg.motherDuckToken;
      }
      if (Array.isArray(arg.additionalExtensions)) {
        this.additionalExtensions = arg.additionalExtensions;
      }
    }
    this.isMotherDuck =
      this.databasePath?.startsWith('md:') ||
      this.databasePath?.startsWith('motherduck:') ||
      false;
    this.connecting = this.init();
  }

  protected async init(): Promise<void> {
    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(this.getBundles());

    if (bundle.mainWorker) {
      const workerUrl = isNode()
        ? bundle.mainWorker
        : URL.createObjectURL(
            new Blob([`importScripts("${bundle.mainWorker}");`], {
              type: 'text/javascript',
            })
          );

      // Instantiate the asynchronous version of DuckDB-wasm
      this.worker = new Worker(workerUrl);
      const logger = new duckdb.VoidLogger();
      this._database = new duckdb.AsyncDuckDB(logger, this.worker);
      await this._database.instantiate(bundle.mainModule, bundle.pthreadWorker);
      if (this.databasePath) {
        await this._database.open({
          path: this.databasePath,
        });
      }
      URL.revokeObjectURL(workerUrl);
      this._connection = await this._database.connect();
    } else {
      throw new Error('Unable to instantiate duckdb-wasm');
    }
  }

  abstract getBundles(): duckdb.DuckDBBundles;

  get connection(): duckdb.AsyncDuckDBConnection | null {
    return this._connection;
  }

  get database(): duckdb.AsyncDuckDB | null {
    return this._database;
  }

  async loadExtension(ext: string) {
    try {
      await this.runDuckDBQuery(`INSTALL '${ext}'`);
      await this.runDuckDBQuery(`LOAD '${ext}'`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Unable to load ${ext} extension`, error);
    }
  }

  protected async setup(): Promise<void> {
    const doSetup = async () => {
      if (this.workingDirectory) {
        await this.runDuckDBQuery(
          `SET FILE_SEARCH_PATH='${this.workingDirectory}'`
        );
      }
      const extensions = ['json', 'icu', ...this.additionalExtensions];

      for (const ext of extensions) {
        await this.loadExtension(ext);
      }
      const setupCmds = ["SET TimeZone='UTC'"];
      for (const cmd of setupCmds) {
        try {
          await this.runDuckDBQuery(cmd);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`duckdb setup ${cmd} => ${error}`);
        }
      }
    };
    await this.connecting;
    if (!this.isSetup) {
      this.isSetup = doSetup();
    }
    await this.isSetup;
  }

  protected async runDuckDBQuery(
    sql: string,
    abortSignal?: AbortSignal
  ): Promise<{rows: QueryDataRow[]; totalRows: number}> {
    const cancel = () => {
      this.connection?.cancelSent();
    };
    abortSignal?.addEventListener('abort', cancel);
    const table = await this.connection?.query(sql);
    abortSignal?.removeEventListener('abort', cancel);
    if (!table) {
      throw new Error('Table is undefined.');
    }
    if (table?.numRows !== null) {
      const rows = unwrapTable(table);
      // console.log(rows);
      return {
        // Normalize the data from its default proxied form
        rows,
        totalRows: table.numRows,
      };
    } else {
      throw new Error('Boom');
    }
  }

  public async *runSQLStream(
    sql: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    if (!this.connection) {
      throw new Error('duckdb-wasm not connected');
    }
    const defaultOptions = this.readQueryOptions();
    rowLimit ??= defaultOptions.rowLimit;
    await this.setup();
    const statements = sql.split('-- hack: split on this');

    let done = false;
    const cancel = () => {
      done = true;
      this.connection?.cancelSent();
    };
    abortSignal?.addEventListener('abort', cancel);

    while (statements.length > 1) {
      await this.runDuckDBQuery(statements[0], abortSignal);
      statements.shift();
    }

    let index = 0;
    for await (const chunk of await this.connection.send(statements[0])) {
      if (done) {
        break;
      }
      for (const row of chunk.toArray()) {
        if (
          (rowLimit !== undefined && index >= rowLimit) ||
          abortSignal?.aborted
        ) {
          break;
        }
        yield unwrapRow(row);
        index++;
      }
    }
    abortSignal?.removeEventListener('abort', cancel);
  }

  private async findTables(
    tables: string[],
    {refreshTimestamp}: FetchSchemaOptions
  ): Promise<void> {
    const fetchRemoteFile = async (tablePath: string): Promise<number> => {
      for (const callback of this.remoteFileCallbacks) {
        const data = await callback(tablePath);
        if (data) {
          await this.database?.registerFileBuffer(tablePath, data);
          break;
        }
      }
      return refreshTimestamp ?? Date.now();
    };

    await this.setup();

    for (const tablePath of tables) {
      if (
        this.isMotherDuck &&
        !tables.includes('/') &&
        !FILE_EXTS.some(ext => tablePath.endsWith(ext))
      ) {
        continue;
      }
      // http and s3 urls are handled by duckdb-wasm
      if (tablePath.match(/^https?:\/\//)) {
        continue;
      }
      if (tablePath.match(/^s3:\/\//)) {
        continue;
      }
      // If we're not trying to fetch start trying
      const mapped = this.remoteFileStatus[tablePath];
      if (!mapped || (refreshTimestamp && refreshTimestamp > (await mapped))) {
        this.remoteFileStatus[tablePath] = fetchRemoteFile(tablePath);
      }
      // Wait for response
      await this.remoteFileStatus[tablePath];
    }
  }

  public async fetchSchemaForSQLStruct(
    sqlRef: SQLSourceRequest,
    options: FetchSchemaOptions
  ): Promise<
    | {structDef: SQLSourceDef; error?: undefined}
    | {error: string; structDef?: undefined}
  > {
    const tables: string[] = [];
    for (const match of sqlRef.selectStr.matchAll(TABLE_MATCH)) {
      tables.push(match[2] || match[3]);
    }
    for (const match of sqlRef.selectStr.matchAll(TABLE_FUNCTION_MATCH)) {
      tables.push(match[2] || match[3]);
    }
    await this.findTables(tables, options);
    return super.fetchSchemaForSQLStruct(sqlRef, options);
  }

  async fetchSchemaForTables(
    missing: Record<string, string>,
    options: FetchSchemaOptions
  ): Promise<{
    schemas: Record<string, TableSourceDef>;
    errors: Record<string, string>;
  }> {
    const tables = Object.values(missing);
    await this.findTables(tables, options);
    return super.fetchSchemaForTables(missing, options);
  }

  async close(): Promise<void> {
    if (this._connection) {
      await this._connection.close();
      this._connection = null;
    }
    if (this._database) {
      await this._database.terminate();
      this._database = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  registerRemoteTableCallback(callback: RemoteFileCallback): void {
    this.remoteFileCallbacks.push(callback);
  }

  async registerRemoteTable(tableName: string, url: string): Promise<void> {
    this.remoteFileStatus[tableName] = Promise.resolve(Number.MIN_SAFE_INTEGER);
    this.database?.registerFileURL(
      tableName,
      url,
      duckdb.DuckDBDataProtocol.HTTP,
      true
    );
  }
}
