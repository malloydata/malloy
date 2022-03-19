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

import * as vscode from "vscode";
import { ConnectionBackend } from "../../common";
import { getDefaultIndex } from "../../common/connection_manager_types";
import connectionIcon from "../../media/database.svg";
import * as path from "path";
import { VSCodeConnectionManager } from "../connection_manager";

export class ConnectionsProvider
  implements vscode.TreeDataProvider<ConnectionItem>
{
  getTreeItem(element: ConnectionItem): vscode.TreeItem {
    return element;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    ConnectionItem | undefined
  > = new vscode.EventEmitter<ConnectionItem | undefined>();

  readonly onDidChangeTreeData: vscode.Event<ConnectionItem | undefined> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async getChildren(element?: ConnectionItem): Promise<ConnectionItem[]> {
    if (element === undefined) {
      const config = VSCodeConnectionManager.getConnectionsConfig();
      const defaultIndex = getDefaultIndex(config);
      return config.map(
        (config, index) =>
          new ConnectionItem(
            config.name,
            config.backend,
            index === defaultIndex
          )
      );
    } else {
      return [];
    }
  }
}

class ConnectionItem extends vscode.TreeItem {
  constructor(
    public name: string,
    public backend: string,
    public isDefault: boolean
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    const backendName =
      backend === ConnectionBackend.BigQuery ? "BigQuery" : "Postgres";
    this.description = `(${backendName}${isDefault ? ", default" : ""})`;

    this.iconPath = {
      light: path.join(__filename, "..", connectionIcon),
      dark: path.join(__filename, "..", connectionIcon),
    };
  }
}
