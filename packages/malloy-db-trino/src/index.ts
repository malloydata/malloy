/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export type {BaseRunner} from './trino_connection';
export {
  PrestoConnection,
  TrinoConnection,
  TrinoPrestoConnection,
} from './trino_connection';
export {TrinoExecutor} from './trino_executor';

import {
  queryOptionsFromConnectionConfig,
  registerConnectionType,
  ROW_LIMIT_CONNECTION_PROPERTY,
} from '@malloydata/malloy';
import type {
  ConnectionConfig,
  ConnectionPropertyDefinition,
} from '@malloydata/malloy';
import {TrinoConnection, PrestoConnection} from './trino_connection';
import type {
  TrinoConnectionConfiguration,
  TrinoExtraConfigKey,
} from './trino_connection';

const trinoPassThroughKeys: TrinoExtraConfigKey[] = [
  'ssl',
  'session',
  'extraCredential',
  'extraHeaders',
];

function configToBaseConfig(
  config: ConnectionConfig
): TrinoConnectionConfiguration {
  return {
    server: typeof config['server'] === 'string' ? config['server'] : undefined,
    port: typeof config['port'] === 'number' ? config['port'] : undefined,
    catalog:
      typeof config['catalog'] === 'string' ? config['catalog'] : undefined,
    schema: typeof config['schema'] === 'string' ? config['schema'] : undefined,
    user: typeof config['user'] === 'string' ? config['user'] : undefined,
    password:
      typeof config['password'] === 'string' ? config['password'] : undefined,
    setupSQL:
      typeof config['setupSQL'] === 'string' ? config['setupSQL'] : undefined,
    source: typeof config['source'] === 'string' ? config['source'] : undefined,
  };
}

function configToTrinoConfig(
  config: ConnectionConfig
): TrinoConnectionConfiguration {
  const base = configToBaseConfig(config);
  const extraConfig: Partial<Record<TrinoExtraConfigKey, unknown>> = {};
  for (const key of trinoPassThroughKeys) {
    if (config[key] !== undefined) {
      extraConfig[key] = config[key];
    }
  }
  if (Object.keys(extraConfig).length > 0) {
    base.extraConfig = extraConfig;
  }
  return base;
}

const trinoProperties: ConnectionPropertyDefinition[] = [
  ROW_LIMIT_CONNECTION_PROPERTY,
  {name: 'server', displayName: 'Server', type: 'string', optional: true},
  {name: 'port', displayName: 'Port', type: 'number', optional: true},
  {name: 'catalog', displayName: 'Catalog', type: 'string', optional: true},
  {name: 'schema', displayName: 'Schema', type: 'string', optional: true},
  {name: 'user', displayName: 'User', type: 'string', optional: true},
  {name: 'password', displayName: 'Password', type: 'password', optional: true},
  {
    name: 'setupSQL',
    displayName: 'Setup SQL',
    type: 'text',
    optional: true,
    advanced: true,
    description: 'SQL statements to run when the connection is established',
  },
  {
    name: 'source',
    displayName: 'Source',
    type: 'string',
    optional: true,
    advanced: true,
    description: 'Source name for the Trino client',
  },
  {
    name: 'ssl',
    displayName: 'SSL',
    type: 'json',
    optional: true,
    advanced: true,
    description: 'TLS/SSL configuration (e.g. {"rejectUnauthorized": false})',
  },
  {
    name: 'session',
    displayName: 'Session',
    type: 'json',
    optional: true,
    advanced: true,
    description: 'Session properties as key-value pairs',
  },
  {
    name: 'extraCredential',
    displayName: 'Extra Credential',
    type: 'json',
    optional: true,
    advanced: true,
    description: 'Extra credentials as key-value pairs',
  },
  {
    name: 'extraHeaders',
    displayName: 'Extra Headers',
    type: 'json',
    optional: true,
    advanced: true,
    description: 'Additional HTTP headers as key-value pairs',
  },
];

const prestoProperties: ConnectionPropertyDefinition[] = [
  ROW_LIMIT_CONNECTION_PROPERTY,
  {name: 'server', displayName: 'Server', type: 'string', optional: true},
  {name: 'port', displayName: 'Port', type: 'number', optional: true},
  {name: 'catalog', displayName: 'Catalog', type: 'string', optional: true},
  {name: 'schema', displayName: 'Schema', type: 'string', optional: true},
  {name: 'user', displayName: 'User', type: 'string', optional: true},
  {name: 'password', displayName: 'Password', type: 'password', optional: true},
  {
    name: 'setupSQL',
    displayName: 'Setup SQL',
    type: 'text',
    optional: true,
    advanced: true,
    description: 'SQL statements to run when the connection is established',
  },
];

registerConnectionType('trino', {
  displayName: 'Trino',
  factory: async (config: ConnectionConfig) => {
    return new TrinoConnection(
      config.name,
      queryOptionsFromConnectionConfig(config),
      configToTrinoConfig(config)
    );
  },
  properties: trinoProperties,
});

registerConnectionType('presto', {
  displayName: 'Presto',
  factory: async (config: ConnectionConfig) => {
    return new PrestoConnection(
      config.name,
      queryOptionsFromConnectionConfig(config),
      configToBaseConfig(config)
    );
  },
  properties: prestoProperties,
});
