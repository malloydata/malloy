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
import { loadKeytar } from "./keytar/keytar_loader";

export class ConnectionManager {
  private _connections: FixedConnectionMap;

  constructor(initialConnectionsConfig: ConnectionConfig[]) {
    this._connections = new FixedConnectionMap(new Map());
    this.buildConnectionMap(initialConnectionsConfig).then((map) => {
      this._connections = map;
    });
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
      map.set("bigquery", new BigQueryConnection("bigquery", { pageSize: 20 }));
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
          {
            pageSize: 50,
          },
          {
            defaultProject: connectionConfig.projectName,
            serviceAccountKeyPath: connectionConfig.serviceAccountKeyPath,
          }
        );
      case ConnectionBackend.Postgres: {
        const configReader = async () => {
          let password;
          if (connectionConfig.password !== undefined) {
            password = connectionConfig.password;
          } else if (connectionConfig.useKeychainPassword) {
            const keytar = await loadKeytar();
            password =
              (await keytar.getPassword(
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
        return new PostgresConnection(connectionConfig.name, configReader);
      }
    }
  }
}
