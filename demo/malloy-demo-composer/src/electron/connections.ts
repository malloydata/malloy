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
  Connection,
  FixedConnectionMap,
  LookupConnection,
} from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { DuckDBConnection } from "@malloydata/db-duckdb";
import { PostgresConnection } from "@malloydata/db-postgres";
import * as path from "path";

class ConnectionManager {
  private connectionLookups: Map<string, LookupConnection<Connection>> =
    new Map();
  private readonly bigqueryConnection = new BigQueryConnection("bigquery");
  private readonly postgresConnection = new PostgresConnection("postgres");

  public getConnectionLookup(url: URL): LookupConnection<Connection> {
    const workingDirectory = path.dirname(url.pathname);
    let connectionLookup = this.connectionLookups.get(workingDirectory);
    if (connectionLookup === undefined) {
      connectionLookup = new FixedConnectionMap(
        new Map<string, Connection>([
          ["bigquery", this.bigqueryConnection],
          ["postgres", this.postgresConnection],
          [
            "duckdb",
            new DuckDBConnection("duckdb", ":memory:", workingDirectory),
          ],
        ]),
        "bigquery"
      );
      this.connectionLookups.set(workingDirectory, connectionLookup);
    }
    return connectionLookup;
  }
}

export const CONNECTION_MANAGER = new ConnectionManager();