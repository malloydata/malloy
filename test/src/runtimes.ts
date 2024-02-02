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

import * as fs from 'fs';
import * as path from 'path';
import {
  Connection,
  ConnectionFactory,
  EmptyURLReader,
  MalloyQueryData,
  QueryDataRow,
  Result,
  RunSQLOptions,
  SingleConnectionRuntime,
  registerDialect,
} from '@malloydata/malloy';
import {BigQueryConnection} from '@malloydata/db-bigquery';
import {DuckDBConnection} from '@malloydata/db-duckdb';
import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';

// check for external drivers in "external-drivers" folder (sibling folder to this repo)
const externalDrivers = {};
const externalDriversPath = path.join('..', 'external-drivers');
if (fs.existsSync(externalDriversPath)) {
  const driverFolders = fs
    .readdirSync(externalDriversPath)
    .filter(file =>
      fs.statSync(path.join(externalDriversPath, file)).isDirectory()
    );

  for (const driverFolder of driverFolders) {
    const module = path.join('@external-drivers', driverFolder);
    try {
      const connectionFactory = require(module)
        .connectionFactory as ConnectionFactory;
      externalDrivers[connectionFactory.connectionName] = connectionFactory;
      registerDialect(connectionFactory.dialect);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e.message);
    }
  }
}

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

const files = new EmptyURLReader();

export function rows(qr: Result): QueryDataRow[] {
  return qr.data.value;
}

export function runtimeFor(dbName: string): SingleConnectionRuntime {
  let connection;

  if (externalDrivers[dbName]) {
    connection = (
      externalDrivers[dbName] as ConnectionFactory
    ).createConnection({name: dbName});
    return testRuntimeFor(connection);
  }

  switch (dbName) {
    case 'bigquery':
      connection = new BigQueryTestConnection(
        dbName,
        {},
        {projectId: 'malloy-data'}
      );
      break;
    case 'duckdb':
      connection = new DuckDBTestConnection(dbName);
      break;
    case 'duckdb_wasm':
      connection = new DuckDBWASMTestConnection(dbName);
      break;
    default:
      throw new Error(`Unknown runtime "${dbName}"`);
  }
  return testRuntimeFor(connection);
}

export function testRuntimeFor(connection: Connection) {
  return new SingleConnectionRuntime(files, connection);
}

export const allDatabases = ['bigquery', 'duckdb', 'duckdb_wasm'].concat(
  Object.keys(externalDrivers)
);
type RuntimeDatabaseNames = (typeof allDatabases)[number];

export class RuntimeList {
  runtimeMap = new Map<string, SingleConnectionRuntime>();
  runtimeList: Array<[string, SingleConnectionRuntime]> = [];

  constructor();
  constructor(databaseList: RuntimeDatabaseNames[]);
  constructor(externalConnections: SingleConnectionRuntime[]);
  constructor(
    ...args: (RuntimeDatabaseNames[] | undefined | SingleConnectionRuntime[])[]
  ) {
    const databases: RuntimeDatabaseNames[] | SingleConnectionRuntime[] =
      args.length > 0 && args[0] !== undefined ? args[0] : allDatabases;
    for (const database of databases) {
      const rt: SingleConnectionRuntime =
        database instanceof SingleConnectionRuntime
          ? database
          : runtimeFor(database);
      this.runtimeMap.set(rt.connection.name, rt);
      this.runtimeList.push([rt.connection.name, rt]);
    }
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
