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

import { ConnectionConfig, ConnectionManager } from "../common";
import * as vscode from "vscode";

const DEFAULT_ROW_LIMIT = 50;

export class VSCodeConnectionManager extends ConnectionManager {
  constructor() {
    super(VSCodeConnectionManager.getConnectionsConfig());
  }

  static getConnectionsConfig(): ConnectionConfig[] {
    return vscode.workspace
      .getConfiguration("malloy")
      .get("connections") as ConnectionConfig[];
  }

  onConfigurationUpdated(): Promise<void> {
    return this.setConnectionsConfig(
      VSCodeConnectionManager.getConnectionsConfig()
    );
  }

  getCurrentRowLimit(): number {
    // We get the `rowLimit` setting in this subclass instead of in the base class,
    // because the Language Server doesn't actually care about row limits, because it never
    // runs queries, and because it's slightly harder to get settings from within the language
    // server.
    const rowLimitRaw = vscode.workspace
      .getConfiguration("malloy")
      .get("rowLimit");
    if (rowLimitRaw === undefined) {
      return DEFAULT_ROW_LIMIT;
    }
    if (typeof rowLimitRaw === "string") {
      try {
        return parseInt(rowLimitRaw);
      } catch (_error) {
        return DEFAULT_ROW_LIMIT;
      }
    }
    if (typeof rowLimitRaw !== "number") {
      return DEFAULT_ROW_LIMIT;
    }
    return rowLimitRaw;
  }
}
