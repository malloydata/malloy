/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Connection, ConnectionConfig, LookupConnection} from './types';

/**
 * A factory function that creates a Connection from a config object.
 */
export type ConnectionTypeFactory = (config: ConnectionConfig) => Connection;

/**
 * The type of a connection property value.
 */
export type ConnectionPropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'password'
  | 'file'
  | 'text';

/**
 * Describes a single configuration property for a connection type.
 */
export interface ConnectionPropertyDefinition {
  name: string;
  displayName: string;
  type: ConnectionPropertyType;
  optional?: true;
  default?: string;
  description?: string;
  /** For type 'file': extension filters for picker dialogs. */
  fileFilters?: Record<string, string[]>;
}

/**
 * A connection type definition: factory plus property metadata.
 */
export interface ConnectionTypeDef {
  factory: ConnectionTypeFactory;
  properties: ConnectionPropertyDefinition[];
}

/**
 * A single connection entry in a JSON config.
 */
export interface ConnectionConfigEntry {
  is: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * The editable intermediate representation of a connections config file.
 */
export interface ConnectionsConfig {
  connections: Record<string, ConnectionConfigEntry>;
}

// Module-level registry
const registry = new Map<string, ConnectionTypeDef>();

/**
 * Register a connection type with its factory and property definitions.
 *
 * @param typeName The connection type name (e.g. "duckdb", "bigquery").
 * @param def The connection type definition (factory + properties).
 */
export function registerConnectionType(
  typeName: string,
  def: ConnectionTypeDef
): void {
  registry.set(typeName, def);
}

/**
 * Get the property definitions for a registered connection type.
 *
 * @param typeName The connection type name.
 * @returns The property definitions, or undefined if the type is not registered.
 */
export function getConnectionProperties(
  typeName: string
): ConnectionPropertyDefinition[] | undefined {
  return registry.get(typeName)?.properties;
}

/**
 * Get the names of all registered connection types.
 */
export function getRegisteredConnectionTypes(): string[] {
  return [...registry.keys()];
}

/**
 * Parse a JSON config string into a ConnectionsConfig.
 * Validates that each connection entry has an `is` field.
 */
export function readConnectionsConfig(jsonText: string): ConnectionsConfig {
  const parsed = JSON.parse(jsonText);
  const connections = parsed.connections;
  if (connections === undefined || typeof connections !== 'object') {
    throw new Error('Invalid connections config: missing "connections" object');
  }
  for (const [name, entry] of Object.entries(connections)) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !(entry as ConnectionConfigEntry).is
    ) {
      throw new Error(`Connection "${name}" is missing required "is" property`);
    }
  }
  return parsed as ConnectionsConfig;
}

/**
 * Serialize a ConnectionsConfig to a JSON string with 2-space indent.
 */
export function writeConnectionsConfig(config: ConnectionsConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Create a LookupConnection from a ConnectionsConfig using registered factories.
 */
export function createConnectionsFromConfig(
  config: ConnectionsConfig
): LookupConnection<Connection> {
  const entries = Object.entries(config.connections);
  const firstConnectionName = entries.length > 0 ? entries[0][0] : undefined;

  const cache = new Map<string, Connection>();

  return {
    async lookupConnection(connectionName?: string): Promise<Connection> {
      if (connectionName === undefined) {
        connectionName = firstConnectionName;
      }
      if (connectionName === undefined) {
        throw new Error('No connections defined in config');
      }

      const cached = cache.get(connectionName);
      if (cached) return cached;

      const entry = config.connections[connectionName];
      if (!entry) {
        throw new Error(
          `No connection named "${connectionName}" found in config`
        );
      }

      const typeDef = registry.get(entry.is);
      if (!typeDef) {
        throw new Error(
          `No registered connection type "${entry.is}" for connection "${connectionName}". ` +
            'Did you forget to import the connection package?'
        );
      }

      const connConfig: ConnectionConfig = {name: connectionName};
      for (const [key, value] of Object.entries(entry)) {
        if (key === 'is') continue;
        if (value !== undefined) {
          connConfig[key] = value;
        }
      }

      const connection = typeDef.factory(connConfig);
      cache.set(connectionName, connection);
      return connection;
    },
  };
}
