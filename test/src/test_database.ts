/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import {EventEmitter} from 'events';
import type {
  Connection,
  ConnectionConfig,
  Dialect,
  LookupConnection,
} from '@malloydata/malloy';
import {
  InMemoryModelCache,
  MalloyConfig,
  Runtime,
  getConnectionProperties,
  getDialect,
  registerConnectionType,
} from '@malloydata/malloy';
import '@malloydata/db-bigquery';
import '@malloydata/db-duckdb/native';
import {DuckDBWASMConnection} from '@malloydata/db-duckdb/wasm';
import '@malloydata/db-mysql';
import '@malloydata/db-databricks';
import {PooledPostgresConnection} from '@malloydata/db-postgres';
import '@malloydata/db-snowflake';
import {SQLServerExecutor} from '@malloydata/db-sqlserver';
import '@malloydata/db-trino';
import {databases} from './databases';
import type {TestDatabase} from './core_database';
import {
  STAND_IN,
  TEST_CONNECTION_NAME,
  TestCacheManager,
  printFailingSQL,
  testFileSpace,
} from './core_database';

export {
  STAND_IN,
  TEST_CONNECTION_NAME,
  TestCacheManager,
  TestURLReader,
  coreDatabase,
  testFileSpace,
} from './core_database';
export type {CoreDatabase, TestDatabase} from './core_database';

// A setting only tests need, which `malloy-config.json` names as
// `{"test": "NAME"}`.
const testOverlayValues: Record<string, () => string> = {
  // The same string test/mssql/connection_string.ts builds for the loader.
  // `Server=host,port`: the extension reads no separate Port key.
  mssqlAttach: () => {
    const s = SQLServerExecutor.getConnectionOptionsFromEnv();
    if (s.server === undefined) {
      throw new Error('MSSQL_HOST is not set; see test/mssql/mssql_start.sh');
    }
    return [
      `ATTACH 'Server=${s.server},${s.port ?? 1433};Database=${s.database};User Id=${s.user};Password=${s.password};TrustServerCertificate=${s.trustServerCertificate ?? false}' AS msdb (TYPE mssql)`,
      `USE msdb.${s.database}`,
    ].join(';\n');
  },
};

function testOverlay(p: string[]): string | undefined {
  return testOverlayValues[p[0]]?.();
}

// The registered `postgres` type builds the unpooled PostgresConnection, which
// opens a session per query, so the temporary table model.search() makes
// (manifestTemporaryTable) is gone before the query that reads it. The tests
// use the pooled class: queries run one at a time reuse one session.
registerConnectionType('postgres', {
  displayName: 'PostgreSQL (pooled, tests only)',
  factory: async (config: ConnectionConfig) =>
    new PooledPostgresConnection(config),
  properties: getConnectionProperties('postgres') ?? [],
});

// The registered `duckdb_wasm` type builds the browser class. Under Node the
// tests run the Node class, which `@malloydata/db-duckdb/wasm` resolves to.
registerConnectionType('duckdb_wasm', {
  displayName: 'DuckDB WASM (Node, tests only)',
  factory: async (config: ConnectionConfig) => new DuckDBWASMConnection(config),
  properties: [
    {
      name: 'databasePath',
      displayName: 'Database Path',
      type: 'string',
      optional: true,
    },
    {
      name: 'motherDuckToken',
      displayName: 'MotherDuck Token',
      type: 'secret',
      optional: true,
    },
    {name: 'setupSQL', displayName: 'Setup SQL', type: 'text', optional: true},
  ],
});

let configEntries: Record<string, object> | undefined;

function configEntry(name: string): object {
  if (configEntries === undefined) {
    const text = fs.readFileSync(
      path.join(__dirname, 'malloy-config.json'),
      'utf-8'
    );
    configEntries = JSON.parse(text).connections;
  }
  const entry = configEntries?.[name];
  if (entry === undefined) {
    throw new Error(
      `Database "${name}" is in databases.ts but not in malloy-config.json`
    );
  }
  return entry;
}

class ConfiguredTestDatabase implements TestDatabase {
  private _runtime?: Runtime;
  private _config?: MalloyConfig;
  readonly dialect: Dialect;
  readonly canStream: boolean;
  readonly connectionName = TEST_CONNECTION_NAME;

  constructor(readonly name: string) {
    const entry = databases[name];
    if (entry === undefined) {
      throw new Error(unknownDatabaseMessage(name));
    }
    this.dialect = getDialect(entry.dialect);
    this.canStream = entry.canStream;
  }

  get runtime(): Runtime {
    if (this._runtime === undefined) {
      // The shared suites carry no `##! experimental.dialect.NAME` lines. A
      // dialect under test is accepted once, for the whole process, instead.
      this.dialect.acceptExperimental();
      const config = new MalloyConfig(
        {connections: {[TEST_CONNECTION_NAME]: configEntry(this.name)}},
        {overlays: {test: testOverlay}}
      );
      config.wrapConnections(base => this.checkedLookup(base));
      this._config = config;
      this._runtime = new Runtime({
        config,
        urlReader: testFileSpace,
        eventStream: new EventEmitter(),
        cacheManager: new TestCacheManager(new InMemoryModelCache()),
      });
    }
    return this._runtime;
  }

  private checkedLookup(
    base: LookupConnection<Connection>
  ): LookupConnection<Connection> {
    const checked = new WeakSet<Connection>();
    return {
      lookupConnection: async (connectionName?: string) => {
        const connection = await base.lookupConnection(connectionName);
        if (!checked.has(connection)) {
          checked.add(connection);
          if (connection.dialectName !== this.dialect.name) {
            throw new Error(
              `databases.ts says ${this.name} is dialect ${this.dialect.name}, but its connection reports ${connection.dialectName}`
            );
          }
          if (connection.canStream() !== this.canStream) {
            throw new Error(
              `databases.ts says ${this.name} canStream is ${this.canStream}, but its connection reports ${connection.canStream()}`
            );
          }
          printFailingSQL(connection);
        }
        return connection;
      },
    };
  }

  connection(): Promise<Connection> {
    return this.runtime.connections.lookupConnection(TEST_CONNECTION_NAME);
  }

  async shutdown(): Promise<void> {
    await this._config?.shutdown();
  }
}

/**
 * The test database with this name, for code that names its database itself:
 * a script that runs outside jest, or a test that needs particular databases.
 * A test that runs on this run's database uses `testDatabase`.
 */
export function testDatabaseNamed(name: string): TestDatabase {
  return new ConfiguredTestDatabase(name);
}

function unknownDatabaseMessage(name: string): string {
  return `"${name}" is not a database. The databases are: ${Object.keys(databases).join(', ')}`;
}

function chooseMessage(): string {
  const others = Object.keys(databases).filter(d => d !== STAND_IN);
  return `set environment variable MALLOY_DATABASE=${STAND_IN} (or another database: ${others.join(', ')}) to choose which database to test`;
}

/**
 * The database named by MALLOY_DATABASE, or undefined if it is unset. Throws
 * if it is a list, or names something which is not a database.
 */
export function selectedDatabase(): string | undefined {
  const selected = process.env['MALLOY_DATABASE'];
  if (selected === undefined || selected === '') {
    return undefined;
  }
  if (selected.includes(',')) {
    throw new Error(
      `MALLOY_DATABASE names one database, not a list: "${selected}"`
    );
  }
  if (databases[selected] === undefined) {
    throw new Error(unknownDatabaseMessage(selected));
  }
  return selected;
}

/** True for a file which runs on a database: its name has a `db-` part. */
export function isDatabaseFile(file: string): boolean {
  return /\.db-[^.]+\.spec\.[jt]sx?$/.test(path.basename(file));
}

function databaseForThisFile(): string {
  const testPath = expect.getState().testPath ?? '';
  if (!isDatabaseFile(testPath)) {
    return STAND_IN;
  }
  const selected = selectedDatabase();
  if (selected === undefined) {
    throw new Error(chooseMessage());
  }
  return selected;
}

let thisFilesDatabase: ConfiguredTestDatabase | undefined;

function current(): ConfiguredTestDatabase {
  if (thisFilesDatabase === undefined) {
    thisFilesDatabase = new ConfiguredTestDatabase(databaseForThisFile());
  }
  return thisFilesDatabase;
}

/**
 * This run's database: the stand-in in a plain spec, and MALLOY_DATABASE in
 * a database file.
 */
export const testDatabase: TestDatabase = {
  get name() {
    return current().name;
  },
  get dialect() {
    return current().dialect;
  },
  get canStream() {
    return current().canStream;
  },
  connectionName: TEST_CONNECTION_NAME,
  get runtime() {
    return current().runtime;
  },
  connection: () => current().connection(),
  shutdown: async () => {
    await thisFilesDatabase?.shutdown();
  },
};
