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

export enum ConnectionBackend {
  BigQuery = "bigquery",
  Postgres = "postgres",
  DuckDB = "duckdb",
}

export interface BigQueryConnectionConfig {
  backend: ConnectionBackend.BigQuery;
  name: string;
  isDefault: boolean;
  id: string;
  serviceAccountKeyPath?: string;
  projectName?: string;
  location?: string;
}

export interface PostgresConnectionConfig {
  backend: ConnectionBackend.Postgres;
  name: string;
  isDefault: boolean;
  id: string;
  username?: string;
  password?: string;
  host?: string;
  port?: number;
  databaseName?: string;
  useKeychainPassword?: boolean;
}

export interface DuckDBConnectionConfig {
  backend: ConnectionBackend.DuckDB;
  name: string;
  isDefault: boolean;
  id: string;
  workingDirectory?: string;
}

export type ConnectionConfig =
  | BigQueryConnectionConfig
  | PostgresConnectionConfig
  | DuckDBConnectionConfig;

/**
 * Return the index of the connection that should be treated as
 * the default.
 *
 * @param connections
 * @returns The index of the first connection with `isDefault === true`,
 *          or else 0 (if there is any connection), or else `undefined`.
 */
export function getDefaultIndex(
  connections: ConnectionConfig[]
): number | undefined {
  const index = connections.findIndex((connection) => connection.isDefault);
  if (index === -1) {
    if (connections.length >= 1) {
      return 0;
    } else {
      return undefined;
    }
  }
  return index;
}
