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

import { BigQueryConnection } from "@malloydata/db-bigquery";
import { PostgresConnection } from "@malloydata/db-postgres";
import { Connection, FixedConnectionMap } from "@malloydata/malloy";
import {
  ConnectionBackend,
  ConnectionConfig,
  getDefaultIndex,
} from "./connection_manager_types";
import { getPassword } from "keytar";

export class ConnectionManager {
  private _connections: FixedConnectionMap;

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

  private async buildConnectionMap(
    connectionsConfig: ConnectionConfig[]
  ): Promise<FixedConnectionMap> {
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
  ): Promise<Connection> {
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
    }
  }
}
