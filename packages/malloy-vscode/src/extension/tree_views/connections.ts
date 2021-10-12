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
import * as vscode from "vscode";
import { Malloy, FieldDef, MalloyTranslator, NamedMalloyObject } from "malloy";
import numberIcon from "../../media/number.svg";
import numberAggregateIcon from "../../media/number-aggregate.svg";
import booleanIcon from "../../media/boolean.svg";
import timeIcon from "../../media/time.svg";
import structIcon from "../../media/struct.svg";
import turtleIcon from "../../media/turtle.svg";
import stringIcon from "../../media/string.svg";
import oneToManyIcon from "../../media/one_to_many.svg";
import manyToOneIcon from "../../media/many_to_one.svg";
import oneToOneIcon from "../../media/one_to_one.svg";
import { MALLOY_EXTENSION_STATE } from "../state";
import { Connection } from "../../webview/query/types";

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
    if (element) {
      return [];
    } else {
      const config = vscode.workspace.getConfiguration("malloy");
      const connections = config.get("connections") as Connection[];

      return connections.map(
        (connection: Connection) =>
          new ConnectionItem(connection.name, connection.type)
      );
    }
  }
}

class ConnectionItem extends vscode.TreeItem {
  constructor(public name: string, public type: "bigquery" | "postgres") {
    super(name);
    this.tooltip = name;

    this.iconPath = {
      light: path.join(__filename, "..", "struct.svg"),
      dark: path.join(__filename, "..", "struct.svg"),
    };
  }
}
