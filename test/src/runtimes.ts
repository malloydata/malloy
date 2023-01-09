/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import {
  EmptyURLReader,
  Result,
  MalloyQueryData,
  RunSQLOptions,
  SingleConnectionRuntime,
  QueryDataRow,
} from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { PooledPostgresConnection } from "@malloydata/db-postgres";
import { DuckDBConnection, DuckDBWASMConnection } from "@malloydata/db-duckdb";

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
    super(name, "test/data/duckdb/duckdb_test.db");
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
    super(name, "test/data/duckdb/duckdb_test.db");
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

export const allDatabases = ["postgres", "bigquery", "duckdb"]; //, "duckdb_wasm"];
type RuntimeDatabaseNames = typeof allDatabases[number];

export class RuntimeList {
  runtimeMap = new Map<string, SingleConnectionRuntime>();

  constructor(databaseList: RuntimeDatabaseNames[] | undefined = undefined) {
    for (const dbName of databaseList || allDatabases) {
      let connection;
      switch (dbName) {
        case "bigquery":
          connection = new BigQueryTestConnection(
            dbName,
            {},
            { defaultProject: "malloy-data" }
          );
          break;
        case "postgres":
          connection = new PostgresTestConnection(dbName);
          break;
        case "duckdb":
          connection = new DuckDBTestConnection(dbName);
          break;
        case "duckdb_wasm":
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
  }

  async closeAll(): Promise<void> {
    for (const [_key, runtime] of this.runtimeMap) {
      await runtime.connection.close();
    }
    // Unfortunate hack to avoid slow to die background threads tripping
    // up jest
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}
