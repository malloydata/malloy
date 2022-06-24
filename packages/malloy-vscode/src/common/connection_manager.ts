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
  FixedConnectionMap,
  LookupConnection,
  TestableConnection,
} from "@malloydata/malloy";
import {
  ConnectionBackend,
  ConnectionConfig,
  getDefaultIndex,
} from "./connection_manager_types";
import { getPassword } from "keytar";
import { DynamicConnectionManager } from "./dynamic_connection_manager";

export class ConnectionManager {
  private _connections: FixedConnectionMap;
  private _managers: Record<string, DynamicConnectionManager> = {};

  constructor(connections: ConnectionConfig[]) {
    this._connections = new FixedConnectionMap(new Map());
    this.buildConnectionMap(connections).then((map) => {
      this._connections = map;
    });
  }

  protected getCurrentRowLimit(): number | undefined {
    return undefined;
  }

  public get connections(): FixedConnectionMap {
    return this._connections;
  }

  protected static filterUnavailableConnectionBackends(
    connectionsConfig: ConnectionConfig[]
  ): ConnectionConfig[] {
    return connectionsConfig.filter(
      (config) =>
        isDuckDBAvailable || config.backend !== ConnectionBackend.DuckDB
    );
  }

  private async buildConnectionMap(
    connectionsConfig: ConnectionConfig[]
  ): Promise<FixedConnectionMap> {
    connectionsConfig =
      ConnectionManager.filterUnavailableConnectionBackends(connectionsConfig);
    const map = new Map<string, Connection>();
    let defaultName: string | undefined;
    if (connectionsConfig.length === 0) {
      map.set(
        "bigquery",
        new BigQueryConnection("bigquery", () => ({
          rowLimit: this.getCurrentRowLimit(),
        }))
      );
      defaultName = "bigquery";
    } else {
      for (const connectionConfig of connectionsConfig) {
        map.set(
          connectionConfig.name,
          await this.connectionForConfig(connectionConfig)
        );
      }
      const defaultIndex = getDefaultIndex(connectionsConfig);
      defaultName =
        defaultIndex !== undefined
          ? connectionsConfig[defaultIndex].name
          : undefined;
    }
    return new FixedConnectionMap(map, defaultName);
  }

  public async setConnectionsConfig(
    connectionsConfig: ConnectionConfig[]
  ): Promise<void> {
    this._connections = await this.buildConnectionMap(connectionsConfig);
  }

  public async connectionForConfig(
    connectionConfig: ConnectionConfig
  ): Promise<TestableConnection> {
    switch (connectionConfig.backend) {
      case ConnectionBackend.BigQuery:
        return new BigQueryConnection(
          connectionConfig.name,
          () => ({ rowLimit: this.getCurrentRowLimit() }),
          {
            defaultProject: connectionConfig.projectName,
            serviceAccountKeyPath: connectionConfig.serviceAccountKeyPath,
            location: connectionConfig.location,
          }
        );
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
        return new PostgresConnection(
          connectionConfig.name,
          () => ({ rowLimit: this.getCurrentRowLimit() }),
          configReader
        );
      }
      case ConnectionBackend.DuckDB: {
        if (!isDuckDBAvailable) {
          throw new Error("DuckDB is not available.");
        }
        try {
          return new DuckDBConnection(
            connectionConfig.name,
            ":memory:",
            connectionConfig.workingDirectory
          );
        } catch (error) {
          console.log("Could not create DuckDB connection:", error);
          throw error;
        }
      }
    }
  }

  getConnectionManager(url: URL): LookupConnection<Connection> {
    const dirname = path.dirname(url.pathname);
    if (!this._managers[dirname]) {
      this._managers[dirname] = new DynamicConnectionManager(
        this.connections,
        dirname
      );
    }
    return this._managers[dirname];
  }
}
