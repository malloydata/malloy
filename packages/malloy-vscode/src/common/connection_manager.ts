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

import * as path from "path";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { PostgresConnection } from "@malloydata/db-postgres";
import { DuckDBConnection } from "@malloydata/db-duckdb";
import { isDuckDBAvailable } from "../common/duckdb_availability";
import {
  Connection,
  LookupConnection,
  TestableConnection,
} from "@malloydata/malloy";
import {
  ConnectionBackend,
  ConnectionConfig,
} from "./connection_manager_types";
import { getPassword } from "keytar";

const DEFAULT_CONFIG = Symbol("default-config");

interface ConfigOptions {
  workingDirectory: string;
  rowLimit?: number;
  useCache?: boolean;
}

const getConnectionForConfig = async (
  connectionCache: Record<string, TestableConnection>,
  connectionConfig: ConnectionConfig,
  { workingDirectory, rowLimit, useCache }: ConfigOptions = {
    workingDirectory: "/",
  }
): Promise<TestableConnection> => {
  let connection: TestableConnection;
  if (useCache && connectionCache[connectionConfig.name]) {
    return connectionCache[connectionConfig.name];
  }
  switch (connectionConfig.backend) {
    case ConnectionBackend.BigQuery:
      connection = new BigQueryConnection(
        connectionConfig.name,
        () => ({ rowLimit }),
        {
          defaultProject: connectionConfig.projectName,
          serviceAccountKeyPath: connectionConfig.serviceAccountKeyPath,
          location: connectionConfig.location,
        }
      );
      if (useCache) {
        connectionCache[connectionConfig.name] = connection;
      }
      break;
    case ConnectionBackend.Postgres: {
      const configReader = async () => {
        let password;
        if (connectionConfig.password !== undefined) {
          password = connectionConfig.password;
        } else if (connectionConfig.useKeychainPassword) {
          password =
            (await getPassword(
              "com.malloy-lang.vscode-extension",
              `connections.${connectionConfig.id}.password`
            )) || undefined;
        }
        return {
          username: connectionConfig.username,
          host: connectionConfig.host,
          password,
          port: connectionConfig.port,
          databaseName: connectionConfig.databaseName,
        };
      };
      connection = new PostgresConnection(
        connectionConfig.name,
        () => ({ rowLimit }),
        configReader
      );
      if (useCache) {
        connectionCache[connectionConfig.name] = connection;
      }
      break;
    }
    case ConnectionBackend.DuckDB: {
      if (!isDuckDBAvailable) {
        throw new Error("DuckDB is not available.");
      }
      try {
        connection = new DuckDBConnection(
          connectionConfig.name,
          ":memory:",
          connectionConfig.workingDirectory || workingDirectory
        );
      } catch (error) {
        console.log("Could not create DuckDB connection:", error);
        throw error;
      }
      break;
    }
  }

  // Retain async signature for future reference
  return Promise.resolve(connection);
};

export class DynamicConnectionLookup implements LookupConnection<Connection> {
  connections: Record<string | symbol, Promise<Connection>> = {};

  constructor(
    private connectionCache: Record<string, TestableConnection>,
    private configs: Record<string | symbol, ConnectionConfig>,
    private options: ConfigOptions
  ) {}

  async lookupConnection(
    connectionName?: string | undefined
  ): Promise<Connection> {
    const connectionKey = connectionName || DEFAULT_CONFIG;
    if (!this.connections[connectionKey]) {
      const connectionConfig = this.configs[connectionKey];
      if (connectionConfig) {
        this.connections[connectionKey] = getConnectionForConfig(
          this.connectionCache,
          connectionConfig,
          { useCache: true, ...this.options }
        );
      } else {
        throw `No connection found with name ${connectionName}`;
      }
    }
    return this.connections[connectionKey];
  }
}

export class ConnectionManager {
  private connectionLookups: Record<string, DynamicConnectionLookup> = {};
  configs: Record<string | symbol, ConnectionConfig> = {};
  connectionCache: Record<string | symbol, TestableConnection> = {};

  constructor(configs: ConnectionConfig[]) {
    this.buildConfigMap(configs);
  }

  public setConnectionsConfig(connectionsConfig: ConnectionConfig[]): void {
    // Force existing connections to be regenerated
    this.connectionLookups = {};
    this.connectionCache = {};
    this.buildConfigMap(connectionsConfig);
  }

  public async connectionForConfig(
    connectionConfig: ConnectionConfig
  ): Promise<TestableConnection> {
    return getConnectionForConfig(this.connectionCache, connectionConfig);
  }

  public getConnectionLookup(url: URL): LookupConnection<Connection> {
    const workingDirectory = path.dirname(url.pathname);
    if (!this.connectionLookups[workingDirectory]) {
      this.connectionLookups[workingDirectory] = new DynamicConnectionLookup(
        this.connectionCache,
        this.configs,
        {
          workingDirectory,
          rowLimit: this.getCurrentRowLimit(),
        }
      );
    }
    return this.connectionLookups[workingDirectory];
  }

  public getCurrentRowLimit(): number | undefined {
    return undefined;
  }

  protected static filterUnavailableConnectionBackends(
    connectionsConfig: ConnectionConfig[]
  ): ConnectionConfig[] {
    return connectionsConfig.filter(
      (config) =>
        isDuckDBAvailable || config.backend !== ConnectionBackend.DuckDB
    );
  }

  buildConfigMap(configs: ConnectionConfig[]): void {
    if (configs.length === 0) {
      configs = [
        {
          name: "bigquery",
          backend: ConnectionBackend.BigQuery,
          id: "bigquery-default",
          isDefault: true,
        },
      ];
    }

    // Create a default duckdb connection if one isn't configured
    if (!configs.find((config) => config.name === "duckdb")) {
      configs.push({
        name: "duckdb",
        backend: ConnectionBackend.DuckDB,
        id: "duckdb-default",
        isDefault: false,
      });
    }

    configs.forEach((config) => {
      if (config.isDefault) {
        this.configs[DEFAULT_CONFIG] = config;
      }
      this.configs[config.name] = config;
    });
  }
}
