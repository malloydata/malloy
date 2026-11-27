/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The parts of the test harness the renderer's tests use. The renderer's
// build type-checks this file against its own rootDir, which admits no
// import of a file beside it, so everything here imports only packages.

import {EventEmitter} from 'events';
import type {
  Connection,
  Dialect,
  MalloyQueryData,
  ModelCache,
  RunSQLOptions,
} from '@malloydata/malloy';
import {
  CacheManager,
  InMemoryModelCache,
  InMemoryURLReader,
  Runtime,
  getDialect,
} from '@malloydata/malloy';
import {DuckDBConnection} from '@malloydata/db-duckdb';

/** The name every test's connection has, whichever database it is. */
export const TEST_CONNECTION_NAME = 'db';

/** The database plain specs run on. */
export const STAND_IN = 'duckdb';

export const DUCKDB_TEST_DATA = 'test/data/duckdb/duckdb_test.db';

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

/** The URL reader every test runtime shares. */
export const testFileSpace = new TestURLReader();

/**
 * A database a test runs on. `name`, `dialect` and `runtime` are usable while
 * the test file loads; no connection is made until the first query.
 */
export interface TestDatabase {
  /**
   * Which database this is: its key in `malloy-config.json` and
   * `databases.ts`, like `duckdb_wasm`. Not the connection's name in a model,
   * which is `connectionName`.
   */
  readonly name: string;
  readonly dialect: Dialect;
  /**
   * Whether its connection can stream rows (`runStream`), from
   * `databases.ts`, checked against the connection on the first query.
   */
  readonly canStream: boolean;
  /**
   * The connection's name in a model: always `db`, as in `db.table(...)`,
   * whichever database this is. Not the database's key, which is `name`.
   */
  readonly connectionName: string;
  /** A runtime whose one connection, named `db`, is this database. */
  readonly runtime: Runtime;
  /** The connection, for a test that runs SQL on it directly. */
  connection(): Promise<Connection>;
  /** Closes whatever connection was opened. */
  shutdown(): Promise<void>;
}

/** A `TestDatabase` which is DuckDB. */
export interface CoreDatabase extends TestDatabase {
  connection(): Promise<DuckDBConnection>;
}

// The test connections print the SQL of a query that fails.
export function printFailingSQL(connection: Connection): void {
  const runSQL = connection.runSQL.bind(connection);
  connection.runSQL = async (
    sql: string,
    options?: RunSQLOptions
  ): Promise<MalloyQueryData> => {
    try {
      return await runSQL(sql, options);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`Error in SQL:\n ${sql}`);
      throw e;
    }
  };
}

class DuckDBCoreDatabase implements CoreDatabase {
  readonly name = STAND_IN;
  readonly dialect = getDialect('duckdb');
  readonly canStream = true;
  readonly connectionName = TEST_CONNECTION_NAME;
  readonly runtime: Runtime;
  private readonly duckdb: DuckDBConnection;

  constructor() {
    this.duckdb = new DuckDBConnection({
      name: TEST_CONNECTION_NAME,
      databasePath: DUCKDB_TEST_DATA,
      readOnly: true,
    });
    printFailingSQL(this.duckdb);
    this.runtime = new Runtime({
      connection: this.duckdb,
      urlReader: testFileSpace,
      eventStream: new EventEmitter(),
      cacheManager: new TestCacheManager(new InMemoryModelCache()),
    });
  }

  async connection(): Promise<DuckDBConnection> {
    return this.duckdb;
  }

  async shutdown(): Promise<void> {
    await this.duckdb.close();
  }
}

/**
 * A new read-only DuckDB connection on the test data, the same data the
 * stand-in reads, for a run-once test that depends on DuckDB itself. It is
 * DuckDB, and its connection is named `db`.
 */
export function coreDatabase(): CoreDatabase {
  return new DuckDBCoreDatabase();
}
