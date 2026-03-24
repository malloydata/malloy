/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Connection, ConnectionConfig, LookupConnection} from './types';

/**
 * A factory function that creates a Connection from a config object.
 */
export type ConnectionTypeFactory = (
  config: ConnectionConfig
) => Promise<Connection>;

/**
 * The type of a connection property value.
 */
export type ConnectionPropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'password'
  | 'secret'
  | 'file'
  | 'json'
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
  displayName: string;
  factory: ConnectionTypeFactory;
  properties: ConnectionPropertyDefinition[];
}

/**
 * An environment variable reference in a config file.
 */
export type ValueRef = {env: string};

/**
 * A JSON-compatible value for structured config properties (e.g. SSL options).
 */
export type JsonConfigValue =
  | string
  | number
  | boolean
  | null
  | JsonConfigValue[]
  | {[key: string]: JsonConfigValue};

/**
 * The type of a config property value: a literal, an env reference, a JSON
 * object, or undefined.
 */
export type ConfigValue =
  | string
  | number
  | boolean
  | ValueRef
  | JsonConfigValue
  | undefined;

/**
 * Type guard for ValueRef.
 */
export function isValueRef(value: unknown): value is ValueRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    'env' in value &&
    typeof value.env === 'string'
  );
}

/**
 * Resolve a ValueRef to a string by looking up the environment variable.
 * Returns undefined if the env var is not set.
 */
export function resolveValue(vr: ValueRef): string | undefined {
  return process.env[vr.env];
}

/**
 * A single connection entry in a JSON config.
 */
export interface ConnectionConfigEntry {
  is: string;
  [key: string]: ConfigValue;
}

/**
 * Type guard for ConnectionConfigEntry.
 */
export function isConnectionConfigEntry(
  value: unknown
): value is ConnectionConfigEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ConnectionConfigEntry).is === 'string'
  );
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
 * Get the display name for a registered connection type.
 *
 * @param typeName The connection type name.
 * @returns The human-readable display name, or undefined if the type is not registered.
 */
export function getConnectionTypeDisplayName(
  typeName: string
): string | undefined {
  return registry.get(typeName)?.displayName;
}

/**
 * Get the names of all registered connection types.
 */
export function getRegisteredConnectionTypes(): string[] {
  return [...registry.keys()];
}

/**
 * Parse a JSON config string into a ConnectionsConfig.
 * Entries without a valid `is` field are silently dropped.
 */
export function readConnectionsConfig(jsonText: string): ConnectionsConfig {
  const parsed = JSON.parse(jsonText);
  const connections = Object.fromEntries(
    Object.entries(parsed.connections ?? {}).filter(([, v]) =>
      isConnectionConfigEntry(v)
    )
  );
  return {...parsed, connections};
}

/**
 * Serialize a ConnectionsConfig to a JSON string with 2-space indent.
 */
export function writeConnectionsConfig(config: ConnectionsConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * A LookupConnection with lifecycle management: close() shuts down all
 * cached connections, and an optional onConnectionCreated callback fires
 * once per connection after factory creation (before caching).
 */
export interface ManagedConnectionLookup extends LookupConnection<Connection> {
  close(): Promise<void>;
}

/**
 * Create a ManagedConnectionLookup from a ConnectionsConfig using registered
 * factories. Connections are cached per name for the lifetime of the returned
 * object. Call close() to shut down all cached connections.
 *
 * @param onConnectionCreated Optional callback invoked once per connection
 *   immediately after factory creation. Use this for post-creation setup
 *   (e.g., registering WASM file handlers).
 */
export function createConnectionsFromConfig(
  config: ConnectionsConfig,
  onConnectionCreated?: (name: string, connection: Connection) => void
): ManagedConnectionLookup {
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

      const jsonKeys = new Set(
        typeDef.properties.filter(p => p.type === 'json').map(p => p.name)
      );

      const connConfig: ConnectionConfig = {name: connectionName};
      for (const [key, value] of Object.entries(entry)) {
        if (key === 'is') continue;
        if (value !== undefined && value !== null) {
          if (!jsonKeys.has(key) && isValueRef(value)) {
            const resolved = resolveValue(value);
            if (resolved !== undefined) {
              connConfig[key] = resolved;
            }
          } else {
            connConfig[key] = value;
          }
        }
      }

      const connection = await typeDef.factory(connConfig);
      if (onConnectionCreated) {
        onConnectionCreated(connectionName, connection);
      }
      cache.set(connectionName, connection);
      return connection;
    },

    async close(): Promise<void> {
      const connections = [...cache.values()];
      cache.clear();
      for (const conn of connections) {
        await conn.close();
      }
    },
  };
}
