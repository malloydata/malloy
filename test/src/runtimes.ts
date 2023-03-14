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

import {resolve} from '@malloydata/lib';
import {
  MalloyQueryData,
  QueryDataRow,
  Result,
  RunSQLOptions,
  SingleConnectionRuntime,
  URLReader,
} from '@malloydata/malloy';
import {BigQueryConnection} from '@malloydata/db-bigquery';
import {DuckDBConnection} from '@malloydata/db-duckdb';
import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';
import {PooledPostgresConnection} from '@malloydata/db-postgres';

export class BigQueryTestConnection extends BigQueryConnection {
  // we probably need a better way to do this.

  public async runSQL(
    sqlCommand: string,
    options?: RunSQLOptions
  ): Promise<MalloyQueryData> {
    try {
      return await super.runSQL(sqlCommand, options);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`Error in SQL:\n ${sqlCommand}`);
      throw e;
    }
  }
}

export class PostgresTestConnection extends PooledPostgresConnection {
  // we probably need a better way to do this.

  public async runSQL(
    sqlCommand: string,
    options?: RunSQLOptions
  ): Promise<MalloyQueryData> {
    try {
      return await super.runSQL(sqlCommand, options);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`Error in SQL:\n ${sqlCommand}`);
      throw e;
    }
  }
}

export class DuckDBTestConnection extends DuckDBConnection {
  // we probably need a better way to do this.

  constructor(name: string) {
    super(name, 'test/data/duckdb/duckdb_test.db');
  }

  public async runSQL(
    sqlCommand: string,
    options?: RunSQLOptions
  ): Promise<MalloyQueryData> {
    try {
      return await super.runSQL(sqlCommand, options);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`Error in SQL:\n ${sqlCommand}`);
      throw e;
    }
  }
}

export class DuckDBWASMTestConnection extends DuckDBWASMConnection {
  // we probably need a better way to do this.

  constructor(name: string) {
    super(name, 'test/data/duckdb/duckdb_test.db');
  }

  public async runSQL(
    sqlCommand: string,
    options?: RunSQLOptions
  ): Promise<MalloyQueryData> {
    try {
      return await super.runSQL(sqlCommand, options);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`Error in SQL:\n ${sqlCommand}`);
      throw e;
    }
  }
}

class MalloyLibURLReader implements URLReader {
  readURL(url: URL): Promise<string> {
    if (url.protocol === 'malloy:') {
      return Promise.resolve(resolve(url));
    }
    throw new Error('No such file');
  }
}

const files = new MalloyLibURLReader();

export function rows(qr: Result): QueryDataRow[] {
  return qr.data.value;
}

export const allDatabases = ['postgres', 'bigquery', 'duckdb', 'duckdb_wasm'];
type RuntimeDatabaseNames = typeof allDatabases[number];

export class RuntimeList {
  runtimeMap = new Map<string, SingleConnectionRuntime>();
  runtimeList: Array<[string, SingleConnectionRuntime]> = [];

  constructor(databaseList: RuntimeDatabaseNames[] | undefined = undefined) {
    for (const dbName of databaseList || allDatabases) {
      let connection;
      switch (dbName) {
        case 'bigquery':
          connection = new BigQueryTestConnection(
            dbName,
            {},
            {defaultProject: 'malloy-data'}
          );
          break;
        case 'postgres':
          connection = new PostgresTestConnection(dbName);
          break;
        case 'duckdb':
          connection = new DuckDBTestConnection(dbName);
          break;
        case 'duckdb_wasm':
          connection = new DuckDBWASMTestConnection(dbName);
          break;
        default:
          throw new Error(`Unknown runtime "${dbName}`);
      }
      this.runtimeMap.set(
        dbName,
        new SingleConnectionRuntime(files, connection)
      );
    }
    this.runtimeMap.forEach((runtime, name) =>
      this.runtimeList.push([name, runtime])
    );
  }

  async closeAll(): Promise<void> {
    for (const [_key, runtime] of this.runtimeMap) {
      await runtime.connection.close();
    }
    // Unfortunate hack to avoid slow to die background threads tripping
    // up jest
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
