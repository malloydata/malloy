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
 *
 * `default` accepts either a literal value or a single-key object that names an
 * overlay source: e.g. `{config: 'rootDirectory'}` or `{env: 'HOME'}`. Defaults
 * apply uniformly to every connection entry that doesn't specify the property —
 * both user-listed entries and entries fabricated by `includeDefaultConnections`.
 * Reference-shaped defaults are resolved through the same config overlays as
 * inline references.
 */
export interface ConnectionPropertyDefinition {
  name: string;
  displayName: string;
  type: ConnectionPropertyType;
  optional?: true;
  default?: string | number | boolean | {[source: string]: string | string[]};
  description?: string;
  /** For type 'file': extension filters for picker dialogs. */
  fileFilters?: Record<string, string[]>;
  /**
   * For security-sensitive string slots, preserve malformed/reference-shaped
   * raw values so registry lookup can fail closed instead of silently dropping
   * the property during generic compilation. Factories must not rely on this
   * metadata as their only validation layer.
   */
  requireLiteralString?: true;
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
 * A single connection entry passed to `createConnectionsFromConfig`. All
 * values here are already fully resolved — overlay references are expanded
 * by the config compiler/resolver before the registry ever sees them.
 */
export interface ConnectionConfigEntry {
  is: string;
  [key: string]: unknown;
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
 * Get the full definition (factory + properties + displayName) for a
 * registered connection type. Used by the foundation layer's connection
 * lookup to hand fully-resolved configs to the right factory.
 */
export function getConnectionTypeDef(
  typeName: string
): ConnectionTypeDef | undefined {
  return registry.get(typeName);
}

/**
 * Enforce registry-level literal-string requirements after overlay resolution
 * and before a connection factory sees the config.
 */
export function validateConnectionConfigProperties(
  connectionName: string,
  typeName: string,
  config: ConnectionConfig
): void {
  const props = registry.get(typeName)?.properties ?? [];
  for (const prop of props) {
    if (!prop.requireLiteralString) continue;
    const value = config[prop.name];
    if (value !== undefined && typeof value !== 'string') {
      throw new Error(
        `Connection "${connectionName}" property "${prop.name}" must be a literal string`
      );
    }
  }
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

      // Values are already resolved — the config compiler/resolver handles
      // overlay references, property defaults, and entry fabrication via
      // `includeDefaultConnections`. The registry's only job is to hand them
      // to the factory.
      const connConfig: ConnectionConfig = {name: connectionName};
      for (const [key, value] of Object.entries(entry)) {
        if (key === 'is') continue;
        if (value !== undefined && value !== null) {
          connConfig[key] = value as ConnectionConfig[string];
        }
      }

      validateConnectionConfigProperties(connectionName, entry.is, connConfig);
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
