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
import {makeDigest} from '@malloydata/malloy';
import {Type} from 'apache-arrow';
import type {StructRow, Table, Schema, Field, DataType} from 'apache-arrow';
import {DuckDBCommon} from './duckdb_common';

const TABLE_MATCH = /FROM\s*('([^']*)'|"([^"]*)")/gi;
const TABLE_FUNCTION_MATCH = /FROM\s+[a-z0-9_]+\(('([^']*)'|"([^"]*)")/gi;

const FILE_EXTS = ['.csv', '.tsv', '.parquet'] as const;

// ----------------------------------------------------------------------------
// Arrow value unwrapping functions
// These convert Arrow values to vanilla JS using schema type information.
// ----------------------------------------------------------------------------

/**
 * Convert an Arrow value to vanilla JS using the Arrow DataType.
 * Uses schema type info to correctly handle decimals and nested types.
 */
function unwrapValue(value: unknown, fieldType: DataType): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children = (fieldType as any).children as Field[] | null;

  switch (fieldType.typeId) {
    case Type.Decimal:
      return unwrapDecimal(value, fieldType);

    case Type.Date:
    case Type.Timestamp:
      if (typeof value === 'number') {
        return new Date(value);
      }
      if (value instanceof Date) {
        return value;
      }
      return unwrapPrimitive(value);

    case Type.List:
    case Type.FixedSizeList:
      if (children && children.length > 0) {
        return unwrapArray(value, children[0].type);
      }
      return unwrapPrimitive(value);

    case Type.Struct:
      if (children && children.length > 0) {
        return unwrapStruct(value, children);
      }
      return unwrapPrimitive(value);

    case Type.Map:
      // Maps have a single child which is a struct with key/value fields
      if (children && children.length > 0) {
        return unwrapArray(value, children[0].type);
      }
      return unwrapPrimitive(value);

    default:
      return unwrapPrimitive(value);
  }
}

function unwrapDecimal(value: unknown, fieldType: DataType): number | string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scale = (fieldType as any).scale ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = value as any;

  if (!obj || !obj[Symbol.toPrimitive]) {
    return value as number;
  }

  const raw = obj[Symbol.toPrimitive]();

  if (typeof raw === 'bigint') {
    // Check if the unscaled value exceeds safe integer range
    const absRaw = raw < BigInt(0) ? -raw : raw;
    if (absRaw > BigInt(Number.MAX_SAFE_INTEGER)) {
      // Too large for precise JS number - format as decimal string
      return formatBigDecimal(raw, scale);
    }
    if (scale > 0) {
      return Number(raw) / 10 ** scale;
    }
    return Number(raw);
  }

  if (typeof raw === 'string') {
    // Large decimals may come as strings - check if too large for Number
    const absStr = raw.startsWith('-') ? raw.slice(1) : raw;
    if (absStr.length > 15) {
      // String is likely too large for precise Number - format with decimal
      return formatBigDecimalFromString(raw, scale);
    }
  }

  const num = Number(raw);
  return scale > 0 ? num / 10 ** scale : num;
}

function unwrapArray(value: unknown, elementType: DataType): unknown[] {
  const arr = Array.isArray(value) ? value : [...(value as Iterable<unknown>)];
  return arr.map(v => unwrapValue(v, elementType));
}

function unwrapStruct(
  value: unknown,
  children: Field[]
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = value as any;
  const result: Record<string, unknown> = {};
  for (const field of children) {
    result[field.name] = unwrapValue(obj[field.name], field.type);
  }
  return result;
}

function unwrapPrimitive(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (typeof value === 'bigint') return safeNumber(value);
  if (typeof value !== 'object' || value === null) return value;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = value as any;
  if (obj[Symbol.toPrimitive]) {
    return safeNumber(obj[Symbol.toPrimitive]());
  }
  return value;
}

function safeNumber(value: number | bigint | string): number | string {
  if (typeof value === 'number') {
    return value;
  }
  const num = Number(value);
  if (
    Number.isSafeInteger(num) ||
    (Number.isFinite(num) && !Number.isInteger(num))
  ) {
    return num;
  }
  return String(value);
}

function formatBigDecimal(raw: bigint, scale: number): string {
  const isNegative = raw < BigInt(0);
  const str = (isNegative ? -raw : raw).toString();
  return formatDecimalString(str, scale, isNegative);
}

function formatBigDecimalFromString(raw: string, scale: number): string {
  const isNegative = raw.startsWith('-');
  const str = isNegative ? raw.slice(1) : raw;
  return formatDecimalString(str, scale, isNegative);
}

function formatDecimalString(
  str: string,
  scale: number,
  isNegative: boolean
): string {
  let result: string;
  if (scale <= 0) {
    result = str;
  } else if (scale >= str.length) {
    result = '0.' + '0'.repeat(scale - str.length) + str;
  } else {
    result = str.slice(0, -scale) + '.' + str.slice(-scale);
  }
  return isNegative ? '-' + result : result;
}

/**
 * Process a single Arrow result row into a Malloy QueryDataRow.
 */
function unwrapRow(row: StructRow, schema: Schema): QueryDataRow {
  const json = row.toJSON();
  const result: QueryDataRow = {};
  for (const field of schema.fields) {
    // Cast is safe: unwrapValue returns QueryValue-compatible types
    result[field.name] = unwrapValue(
      json[field.name],
      field.type
    ) as QueryDataRow[string];
  }
  return result;
}

/**
 * Process a DuckDB Table into an array of Malloy QueryDataRows.
 */
function unwrapTable(table: Table): QueryDataRow[] {
  return table.toArray().map(row => unwrapRow(row, table.schema));
}

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

  public getDigest(): string {
    return makeDigest(
      'duckdb-wasm',
      this.databasePath ?? ':memory:',
      this.workingDirectory
    );
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
          accessMode: duckdb.DuckDBAccessMode.AUTOMATIC,
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
        yield unwrapRow(row, chunk.schema);
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
