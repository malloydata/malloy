/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Connection,
  JsonConfigValue,
  LookupConnection,
  MalloyConfig,
} from '@malloydata/malloy';

export type UnresolvedConnectionConfigEntry = {
  is: string;
  [key: string]:
    | string
    | number
    | boolean
    | JsonConfigValue
    | {env: string}
    | {secretKey: string}
    | undefined;
};

export interface ConnectionConfigManager {
  getConnectionsConfig():
    | Record<string, UnresolvedConnectionConfigEntry>
    | undefined;
  onConfigurationUpdated(): Promise<void>;
}

export interface ConnectionManager {
  getConnectionLookup(fileURL: URL): Promise<LookupConnection<Connection>>;
  setConnectionsConfig(
    connectionsConfig: Record<string, UnresolvedConnectionConfigEntry>
  ): void;
  getConfigForFile(fileURL: URL): Promise<MalloyConfig>;
}
