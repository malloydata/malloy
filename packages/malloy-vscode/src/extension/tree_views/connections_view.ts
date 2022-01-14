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
import { getConnectionsConfig } from "../state";

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
      const config = getConnectionsConfig();
      return [
        new ConnectionItem("bigquery", "bigquery"),
        new ConnectionItem("postgres", "postgres"),
        ...config.map(
          (config) => new ConnectionItem(config.name, config.backend)
        ),
      ];
    } else {
      return [];
    }
  }
}

class ConnectionItem extends vscode.TreeItem {
  constructor(public name: string, public backend: string) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.description = backend;

    // this.iconPath = {
    //   light: getIconPath(`struct_${subtype}`, false),
    //   dark: getIconPath(`struct_${subtype}`, false),
    // };
  }
}
