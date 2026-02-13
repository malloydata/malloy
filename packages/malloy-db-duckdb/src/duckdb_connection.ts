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

import {DuckDBCommon} from './duckdb_common';
import {DuckDBInstance} from '@duckdb/node-api';
import type {DuckDBConnection as DuckDBNodeConnection} from '@duckdb/node-api';
import type {
  ConnectionConfig,
  QueryDataRow,
  QueryOptionsReader,
  RunSQLOptions,
} from '@malloydata/malloy';
import {makeDigest} from '@malloydata/malloy';
import packageJson from '@malloydata/malloy/package.json';

export interface DuckDBConnectionOptions extends ConnectionConfig {
  additionalExtensions?: string[];
  databasePath?: string;
  motherDuckToken?: string;
  workingDirectory?: string;
  readOnly?: boolean;
}

interface ActiveDB {
  instance: DuckDBInstance;
  connections: DuckDBNodeConnection[];
}

export class DuckDBConnection extends DuckDBCommon {
  public readonly name: string;
  private additionalExtensions: string[] = [];
  private databasePath = ':memory:';
  private workingDirectory = '.';
  private readOnly = false;

  connecting: Promise<void>;
  protected connection: DuckDBNodeConnection | null = null;
  protected setupError: Error | undefined;
  protected isSetup: Promise<void> | undefined;

  static activeDBs: Record<string, ActiveDB> = {};

  public constructor(
    options: DuckDBConnectionOptions,
    queryOptions?: QueryOptionsReader
  );
  public constructor(
    name: string,
    databasePath?: string,
    workingDirectory?: string,
    queryOptions?: QueryOptionsReader
  );
  constructor(
    arg: string | DuckDBConnectionOptions,
    arg2?: string | QueryOptionsReader,
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
      if (typeof arg.readOnly === 'boolean') {
        this.readOnly = arg.readOnly;
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
    if (this.databasePath === ':memory:') {
      this.readOnly = false;
    }
    this.isMotherDuck =
      this.databasePath.startsWith('md:') ||
      this.databasePath.startsWith('motherduck:');
    this.connecting = this.init();
  }

  public getDigest(): string {
    const data = `duckdb:${this.databasePath}:${this.workingDirectory}`;
    return makeDigest(data);
  }

  private async init(): Promise<void> {
    try {
      if (this.databasePath in DuckDBConnection.activeDBs) {
        const activeDB = DuckDBConnection.activeDBs[this.databasePath];
        this.connection = await activeDB.instance.connect();
        activeDB.connections.push(this.connection);
      } else {
        const config: Record<string, string> = {
          custom_user_agent: `Malloy/${packageJson.version}`,
        };
        if (this.isMotherDuck) {
          if (
            !this.motherDuckToken &&
            !process.env['motherduck_token'] &&
            !process.env['MOTHERDUCK_TOKEN']
          ) {
            this.setupError = new Error('Please set your MotherDuck Token');
            return;
          }
          if (this.motherDuckToken) {
            config['motherduck_token'] = this.motherDuckToken;
          }
        }
        if (this.readOnly) {
          config['access_mode'] = 'READ_ONLY';
        }

        const instance = await DuckDBInstance.create(this.databasePath, config);
        this.connection = await instance.connect();

        const activeDB: ActiveDB = {
          instance,
          connections: [this.connection],
        };
        DuckDBConnection.activeDBs[this.databasePath] = activeDB;
      }
    } catch (err) {
      this.setupError = err instanceof Error ? err : new Error(String(err));
    }
  }

  async loadExtension(ext: string) {
    try {
      await this.runDuckDBQuery(`INSTALL '${ext}'`);
      await this.runDuckDBQuery(`LOAD '${ext}'`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Unable to load ${ext} extension', error);
    }
  }

  protected async setup(): Promise<void> {
    if (this.setupError) {
      throw this.setupError;
    }
    const doSetup = async () => {
      if (this.workingDirectory) {
        await this.runDuckDBQuery(
          `SET FILE_SEARCH_PATH='${this.workingDirectory}'`
        );
      }
      const extensions = [
        'json',
        'httpfs',
        'icu',
        ...this.additionalExtensions,
      ];
      if (this.databasePath.startsWith('md:')) {
        extensions.push('motherduck');
      }
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
    sql: string
  ): Promise<{rows: QueryDataRow[]; totalRows: number}> {
    if (!this.connection) {
      throw new Error('Connection not open');
    }

    const result = await this.connection.run(sql);
    // getRowObjectsJson() converts nested types (LIST, STRUCT) to JS arrays/objects
    const rows = (await result.getRowObjectsJson()) as QueryDataRow[];

    return {
      rows,
      totalRows: rows.length,
    };
  }

  public async *runSQLStream(
    sql: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    const defaultOptions = this.readQueryOptions();
    rowLimit ??= defaultOptions.rowLimit;
    await this.setup();
    if (!this.connection) {
      throw new Error('Connection not open');
    }

    const statements = sql.split('-- hack: split on this');

    while (statements.length > 1) {
      await this.runDuckDBQuery(statements[0]);
      statements.shift();
    }

    const result = await this.connection.stream(statements[0]);

    let index = 0;
    for await (const chunk of result.yieldRowObjectJson()) {
      for (const row of chunk) {
        if (
          (rowLimit !== undefined && index >= rowLimit) ||
          abortSignal?.aborted
        ) {
          return;
        }
        index++;
        yield row as QueryDataRow;
      }
    }
  }

  async close(): Promise<void> {
    const activeDB = DuckDBConnection.activeDBs[this.databasePath];
    if (activeDB) {
      activeDB.connections = activeDB.connections.filter(
        connection => connection !== this.connection
      );
      if (activeDB.connections.length === 0) {
        activeDB.instance.closeSync();
        delete DuckDBConnection.activeDBs[this.databasePath];
      }
    }
  }

  /**
   * Forcefully close all cached DuckDB instances. Useful for test cleanup
   * to release file locks between test runs.
   */
  static closeAllInstances(): void {
    for (const path of Object.keys(DuckDBConnection.activeDBs)) {
      try {
        DuckDBConnection.activeDBs[path].instance.closeSync();
      } catch {
        // Ignore errors during cleanup
      }
    }
    DuckDBConnection.activeDBs = {};
  }
}
