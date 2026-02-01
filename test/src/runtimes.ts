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
  Connection,
  MalloyQueryData,
  QueryDataRow,
  Result,
  RunSQLOptions,
  ModelCache,
} from '@malloydata/malloy';
import {
  SingleConnectionRuntime,
  InMemoryURLReader,
  InMemoryModelCache,
  CacheManager,
} from '@malloydata/malloy';
import {createTestRuntime} from '@malloydata/malloy/test';
import {BigQueryConnection} from '@malloydata/db-bigquery';
import {DuckDBConnection} from '@malloydata/db-duckdb';
import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';
import {SnowflakeConnection} from '@malloydata/db-snowflake';
import {PooledPostgresConnection} from '@malloydata/db-postgres';
import {TrinoConnection, TrinoExecutor} from '@malloydata/db-trino';
import {SnowflakeExecutor} from '@malloydata/db-snowflake/src/snowflake_executor';
import {PrestoConnection} from '@malloydata/db-trino/src/trino_connection';
import {
  MySQLConnection,
  MySQLExecutor,
} from '@malloydata/db-mysql/src/mysql_connection';
import {EventEmitter} from 'events';

export class SnowflakeTestConnection extends SnowflakeConnection {
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

export class MySQLTestConnection extends MySQLConnection {
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

export class DuckDBROTestConnection extends DuckDBTestConnection {
  constructor(name: string, databasePath?: string, workingDirectory?: string) {
    super({
      name,
      databasePath,
      workingDirectory,
      readOnly: true,
    });
  }
}

export class DuckDBWASMTestConnection extends DuckDBWASMConnection {
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

export class TestCacheManager extends CacheManager {
  constructor(readonly _modelCache: ModelCache) {
    super(_modelCache);
  }
}

export class TestURLReader extends InMemoryURLReader {
  constructor() {
    super(new Map());
  }

  setFile(url: URL, contents: string) {
    this.files.set(url.toString(), contents);
  }

  deleteFile(url: URL) {
    this.files.delete(url.toString());
  }
}

export const testFileSpace = new TestURLReader();

export function rows(qr: Result): QueryDataRow[] {
  return qr.data.value;
}

export function runtimeFor(dbName: string): SingleConnectionRuntime {
  let connection: Connection;
  try {
    switch (dbName) {
      case 'bigquery':
        connection = new BigQueryTestConnection(
          dbName,
          {},
          {projectId: 'malloydata-org'}
        );
        break;
      case 'postgres':
        connection = new PostgresTestConnection(dbName);
        break;
      case 'duckdb':
        connection = new DuckDBROTestConnection(
          dbName,
          'test/data/duckdb/duckdb_test.db'
        );
        break;
      case 'duckdb_rw':
        connection = new DuckDBTestConnection(
          dbName,
          'test/data/duckdb/duckdb_test.db'
        );
        break;
      case 'duckdb_wasm':
        connection = new DuckDBWASMTestConnection(
          dbName,
          'test/data/duckdb/duckdb_test.db'
        );
        break;
      case 'motherduck':
        connection = new DuckDBTestConnection({
          name: dbName,
          databasePath: 'md:my_db',
          motherDuckToken: process.env['TEST_MD_TOKEN'],
        });
        break;
      case 'snowflake':
        {
          const connOptions = SnowflakeExecutor.getConnectionOptionsFromEnv();
          connection = new SnowflakeTestConnection(dbName, {connOptions});
        }
        break;
      case 'trino':
        connection = new TrinoConnection(
          dbName,
          {},
          TrinoExecutor.getConnectionOptionsFromEnv(dbName)
        );
        break;
      case 'mysql':
        connection = new MySQLConnection(
          dbName,
          MySQLExecutor.getConnectionOptionsFromEnv(),
          {}
        );
        break;
      case 'presto':
        connection = new PrestoConnection(
          dbName,
          {},
          TrinoExecutor.getConnectionOptionsFromEnv(dbName) // they share configs.
        );
        break;
      default:
        throw new Error(`Unknown runtime "${dbName}`);
    }
    return testRuntimeFor(connection);
  } catch (error) {
    throw new Error(
      `Failed to create connection \`${dbName}\`: ${error.message}`
    );
  }
}

export function testRuntimeFor(connection: Connection) {
  return createTestRuntime(connection, {
    urlReader: testFileSpace,
    eventStream: new EventEmitter(),
    cacheManager: new TestCacheManager(new InMemoryModelCache()),
  });
}

/**
 * All databases which should be tested by default. Experimental dialects
 * should not be in this list. Use MALLOY_DATABASE=dialect_name to test those
 */
export const allDatabases = [
  'postgres',
  'bigquery',
  'duckdb',
  'duckdb_wasm',
  'snowflake',
  'trino',
  'mysql',
];

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
      rt.isTestRuntime = true;
      this.runtimeMap.set(rt.connection.name, rt);
      this.runtimeList.push([rt.connection.name, rt]);
    }
  }

  async closeAll(): Promise<void> {
    for (const [_key, runtime] of this.runtimeMap) {
      await runtime.connection.close();
    }
    // TODO delete this line if it turns out not to be needed.
    // At one time duckdb_wasm needed this
    // await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
