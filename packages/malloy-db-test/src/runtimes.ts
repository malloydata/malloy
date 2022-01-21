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
  Runtime,
  EmptyURLReader,
  Result,
  MalloyQueryData,
} from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { PooledPostgresConnection } from "@malloydata/db-postgres";

export class BigQueryTestConnection extends BigQueryConnection {
  // we probably need a better way to do this.

  public async runSQL(sqlCommand: string): Promise<MalloyQueryData> {
    try {
      return await super.runSQL(sqlCommand);
    } catch (e) {
      console.log(`Error in SQL:\n ${sqlCommand}`);
      throw e;
    }
  }
}

export class PostgresTestConnection extends PooledPostgresConnection {
  // we probably need a better way to do this.

  public async runSQL(sqlCommand: string): Promise<MalloyQueryData> {
    try {
      return await super.runSQL(sqlCommand);
    } catch (e) {
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

const allDatabases = ["postgres", "bigquery"];
type RuntimeDatabaseNames = typeof allDatabases[number];

export class RuntimeList {
  bqConnection = new BigQueryTestConnection(
    "bigquery",
    {},
    { defaultProject: "malloy-data" }
  );
  postgresConnection = new PostgresTestConnection("postgres");
  runtimeMap = new Map<string, Runtime>();
  closeFunctions: (() => void)[] = [];

  constructor(databaseList: RuntimeDatabaseNames[] | undefined = undefined) {
    for (const dbName of databaseList || allDatabases) {
      switch (dbName) {
        case "bigquery":
          this.runtimeMap.set(
            "bigquery",
            new Runtime(
              files,
              new BigQueryTestConnection(
                "bigquery",
                {},
                { defaultProject: "malloy-data" }
              )
            )
          );
          break;
        case "postgres": {
          const pg = new PostgresTestConnection("postgres");
          this.runtimeMap.set("postgres", new Runtime(files, pg));
          this.closeFunctions.push(async () => {
            await pg.drain();
          });
        }
      }
    }
  }

  async closeAll(): Promise<void> {
    for (const fn of this.closeFunctions) {
      await fn();
    }
  }
}
