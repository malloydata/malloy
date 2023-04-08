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

import crypto from 'crypto';
import {DuckDBCommon, QueryOptionsReader} from './duckdb_common';
import {Connection, Database, OPEN_READWRITE, Row} from 'duckdb';
import {QueryDataRow, RunSQLOptions} from '@malloydata/malloy';

export class DuckDBConnection extends DuckDBCommon {
  connecting: Promise<void>;
  protected connection: Connection | null = null;
  protected database: Database | null = null;
  protected isSetup: Promise<void> | undefined;

  constructor(
    public readonly name: string,
    private databasePath = ':memory:',
    private workingDirectory = '.',
    queryOptions?: QueryOptionsReader
  ) {
    super(queryOptions);
    this.connecting = this.init();
  }

  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.database = new Database(
        this.databasePath,
        OPEN_READWRITE, // databasePath === ":memory:" ? OPEN_READWRITE : OPEN_READONLY,
        err => {
          if (err) {
            reject(err);
          }
        }
      );
      this.connection = this.database.connect();
      resolve();
    });
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
    const doSetup = async () => {
      if (this.workingDirectory) {
        await this.runDuckDBQuery(
          `SET FILE_SEARCH_PATH='${this.workingDirectory}'`
        );
      }
      const setupCmds = [
        "INSTALL 'json'",
        "LOAD 'json'",
        "INSTALL 'httpfs'",
        "LOAD 'httpfs'",
        "INSTALL 'icu'",
        "LOAD 'icu'",
        "SET TimeZone='UTC'",
      ];
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
  ): Promise<{rows: Row[]; totalRows: number}> {
    return new Promise((resolve, reject) => {
      if (this.connection) {
        this.connection.all(sql, (err: Error, rows: Row[]) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              rows,
              totalRows: rows.length,
            });
          }
        });
      } else {
        reject(new Error('Connection not open'));
      }
    });
  }

  public async *runSQLStream(
    sql: string,
    _options: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    await this.setup();
    if (!this.connection) {
      throw new Error('Connection not open');
    }

    const statements = sql.split('-- hack: split on this');

    while (statements.length > 1) {
      await this.runDuckDBQuery(statements[0]);
      statements.shift();
    }

    for await (const row of this.connection.stream(statements[0])) {
      yield row;
    }
  }

  async createHash(sqlCommand: string): Promise<string> {
    return crypto.createHash('md5').update(sqlCommand).digest('hex');
  }

  async close(): Promise<void> {
    if (this.connection) {
      this.connection = null;
    }
    if (this.database) {
      this.database.close();
      this.database = null;
    }
  }
}
