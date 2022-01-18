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
}

export interface BigQueryConnectionConfig {
  backend: ConnectionBackend.BigQuery;
  name: string;
  id: string;
  serviceAccountKeyPath?: string;
  projectName?: string;
  location?: string;
}

export interface PostgresConnectionConfig {
  backend: ConnectionBackend.Postgres;
  name: string;
  id: string;
  username?: string;
  password?: string;
  host?: string;
  port?: number;
  databaseName?: string;
  useKeychainPassword?: boolean;
}

export type ConnectionConfig =
  | BigQueryConnectionConfig
  | PostgresConnectionConfig;
