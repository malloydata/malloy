/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {parseTag} from '@malloydata/malloy-tag';
import type {Tag} from '@malloydata/malloy-tag';
import type {Connection, ConnectionConfig, LookupConnection} from './types';

/**
 * A factory function that creates a Connection from a config object.
 */
export type ConnectionTypeFactory = (config: ConnectionConfig) => Connection;

/**
 * Options for parseConnections().
 */
export interface ParseConnectionsOptions {
  /** Mode name for mode overrides (e.g. "staging", "production"). */
  mode?: string;
  /** Working directory injected into all connection configs. */
  workingDirectory?: string;
}

// Module-level registry
const registry = new Map<string, ConnectionTypeFactory>();

/**
 * Register a connection type factory.
 *
 * @param typeName The connection type name (e.g. "duckdb", "bigquery").
 * @param factory A function that creates a Connection from a ConnectionConfig.
 */
export function registerConnectionType(
  typeName: string,
  factory: ConnectionTypeFactory
): void {
  registry.set(typeName, factory);
}

/**
 * Substitute `${VAR}` patterns in a string with environment variable values.
 */
function substituteEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
    return process.env[varName] ?? '';
  });
}

/**
 * Extract a ConnectionConfig from a Tag, applying env var substitution
 * to all string values.
 */
function extractValue(
  propTag: Tag
): string | number | boolean | undefined {
  // Try typed values first, then fall back to text
  const boolVal = propTag.boolean();
  if (boolVal !== undefined) return boolVal;
  const numVal = propTag.numeric();
  if (numVal !== undefined) return numVal;
  const textVal = propTag.text();
  if (textVal !== undefined) return substituteEnvVars(textVal);
  return undefined;
}

function tagToConfig(name: string, connTag: Tag): ConnectionConfig {
  const config: ConnectionConfig = {name};
  for (const [key, propTag] of connTag.entries()) {
    if (key === 'is') continue;
    const value = extractValue(propTag);
    if (value !== undefined) {
      config[key] = value;
    }
  }
  return config;
}

/**
 * Merge mode overrides into a base config. If the mode override has an `is`
 * property, it fully replaces the base config. Otherwise, it partially merges.
 */
function applyModeOverride(
  base: {typeName: string; config: ConnectionConfig},
  modeConnTag: Tag
): {typeName: string; config: ConnectionConfig} {
  const modeType = modeConnTag.text('is');
  if (modeType !== undefined) {
    // Full replacement
    return {
      typeName: modeType,
      config: tagToConfig(base.config.name, modeConnTag),
    };
  }
  // Partial merge: start with base config, overlay mode properties
  const merged: ConnectionConfig = {...base.config};
  for (const [key, propTag] of modeConnTag.entries()) {
    const value = extractValue(propTag);
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return {typeName: base.typeName, config: merged};
}

/**
 * Parse a MOTLY config string and return a LookupConnection that lazily
 * creates connections using registered factories.
 *
 * @param configText MOTLY config text defining Connections and optional Modes.
 * @param options Options including mode selection and working directory.
 * @returns A LookupConnection that creates connections on demand.
 */
export function parseConnections(
  configText: string,
  options?: ParseConnectionsOptions
): LookupConnection<Connection> {
  const {tag, log} = parseTag(configText);
  if (log.length > 0) {
    throw new Error(
      `Error parsing connection config: ${log.map(e => e.message).join('; ')}`
    );
  }

  const connectionsTag = tag.tag('Connections');

  // Build the resolved connection specs: {typeName, config} per connection name
  const specs = new Map<string, {typeName: string; config: ConnectionConfig}>();
  let firstConnectionName: string | undefined;

  if (connectionsTag) {
    for (const [name, connTag] of connectionsTag.entries()) {
      if (firstConnectionName === undefined) {
        firstConnectionName = name;
      }
      const typeName = connTag.text('is');
      if (typeName === undefined) {
        throw new Error(
          `Connection "${name}" is missing required "is" property`
        );
      }
      const config = tagToConfig(name, connTag);
      specs.set(name, {typeName, config});
    }
  }

  // Apply mode overrides if a mode is specified
  if (options?.mode) {
    const modeConnectionsTag = tag.tag('Modes', options.mode, 'Connections');
    if (modeConnectionsTag) {
      for (const [name, modeConnTag] of modeConnectionsTag.entries()) {
        const base = specs.get(name);
        if (base) {
          specs.set(name, applyModeOverride(base, modeConnTag));
        } else {
          // Mode defines a new connection not in base
          const typeName = modeConnTag.text('is');
          if (typeName === undefined) {
            throw new Error(
              `Mode connection "${name}" is missing required "is" property (no base connection to merge with)`
            );
          }
          specs.set(name, {typeName, config: tagToConfig(name, modeConnTag)});
        }
      }
    }
  }

  // Inject workingDirectory into all configs
  if (options?.workingDirectory) {
    for (const spec of specs.values()) {
      spec.config['workingDirectory'] = options.workingDirectory;
    }
  }

  // Cache of created connections
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

      const spec = specs.get(connectionName);
      if (!spec) {
        throw new Error(
          `No connection named "${connectionName}" found in config`
        );
      }

      const factory = registry.get(spec.typeName);
      if (!factory) {
        throw new Error(
          `No registered connection type "${spec.typeName}" for connection "${connectionName}". ` +
            `Did you forget to import the connection package?`
        );
      }

      const connection = factory(spec.config);
      cache.set(connectionName, connection);
      return connection;
    },
  };
}
