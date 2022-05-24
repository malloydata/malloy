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
/** Default cache duration (seconds) */
const DEFAULT_CACHE_DURATION = 18000;

export class VSCodeConnectionManager extends ConnectionManager {
  constructor() {
    super(VSCodeConnectionManager.getConnectionsConfig());
  }

  static getConnectionsConfig(): ConnectionConfig[] {
    return getSetting("connections") as ConnectionConfig[];
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
    return getNumericSetting("rowLimit", DEFAULT_ROW_LIMIT);
  }

  getCurrentCacheDuration(): number {
    return getNumericSetting("cacheDuration", DEFAULT_CACHE_DURATION);
  }
}

const getSetting = (name: string) =>
  vscode.workspace.getConfiguration("malloy").get(name);

const getNumericSetting = (name: string, defaultValue: number) => {
  const rawValue = getSetting(name) ?? defaultValue;
  if (typeof rawValue === "string") {
    try {
      return parseInt(rawValue);
    } catch (_error) {
      return defaultValue;
    }
  }
  if (typeof rawValue !== "number") {
    return defaultValue;
  }
  return rawValue;
};
