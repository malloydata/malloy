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

import { Connection, FixedConnectionMap } from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { DuckDBConnection } from "@malloydata/db-duckdb";
import { PostgresConnection } from "@malloydata/db-postgres";

const connections: [string, Connection][] = [
  ["bigquery", new BigQueryConnection("bigquery")],
  ["postgres", new PostgresConnection("postgres")],
  ["duckdb", new DuckDBConnection("duckdb", ":memory:")],
];

export const CONNECTIONS = new FixedConnectionMap(
  new Map(connections),
  "bigquery"
);
