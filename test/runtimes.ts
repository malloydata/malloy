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
  SingleConnectionRuntime,
} from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { PooledPostgresConnection } from "@malloydata/db-postgres";
import { DuckDBConnection } from "@malloydata/db-duckdb";
import { RunSQLOptions } from "@malloydata/malloy/src/malloy";

// https://github.com/duckdb/duckdb/issues/3721
//  computes symmetric aggregates incorrectly.  When we have a fix,
//  set this to false to test and then remove.
export const duckdbBug3721 = true;

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
    super(name);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rows(qr: Result): any[] {
  return qr.data.value;
}

const allDatabases = ["postgres", "bigquery", "duckdb"];
type RuntimeDatabaseNames = typeof allDatabases[number];

export class RuntimeList {
  bqConnection = new BigQueryTestConnection(
    "bigquery",
    {},
    { defaultProject: "malloy-data" }
  );

  runtimeMap = new Map<string, SingleConnectionRuntime>();

  constructor(databaseList: RuntimeDatabaseNames[] | undefined = undefined) {
    for (const dbName of databaseList || allDatabases) {
      switch (dbName) {
        case "bigquery":
          this.runtimeMap.set(
            "bigquery",
            new SingleConnectionRuntime(
              files,
              new BigQueryTestConnection(
                "bigquery",
                {},
                { defaultProject: "malloy-data" }
              )
            )
          );
          break;
        case "postgres":
          {
            const pg = new PostgresTestConnection("postgres");
            this.runtimeMap.set(
              "postgres",
              new SingleConnectionRuntime(files, pg)
            );
          }
          break;
        case "duckdb": {
          const duckdb = new DuckDBTestConnection("duckdb");
          this.runtimeMap.set(
            "duckdb",
            new SingleConnectionRuntime(files, duckdb)
          );
        }
      }
    }
  }

  async closeAll(): Promise<void> {
    for (const [_key, runtime] of this.runtimeMap) {
      if (runtime.connection.isPool()) runtime.connection.drain();
    }
  }
}
