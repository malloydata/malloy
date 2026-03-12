/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

export type {BaseRunner} from './trino_connection';
export {
  PrestoConnection,
  TrinoConnection,
  TrinoPrestoConnection,
} from './trino_connection';
export {TrinoExecutor} from './trino_executor';

import {registerConnectionType} from '@malloydata/malloy';
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
    description: 'SQL statements to run when the connection is established',
  },
  {
    name: 'source',
    displayName: 'Source',
    type: 'string',
    optional: true,
    description: 'Source name for the Trino client',
  },
  {
    name: 'ssl',
    displayName: 'SSL',
    type: 'json',
    optional: true,
    description: 'TLS/SSL configuration (e.g. {"rejectUnauthorized": false})',
  },
  {
    name: 'session',
    displayName: 'Session',
    type: 'json',
    optional: true,
    description: 'Session properties as key-value pairs',
  },
  {
    name: 'extraCredential',
    displayName: 'Extra Credential',
    type: 'json',
    optional: true,
    description: 'Extra credentials as key-value pairs',
  },
  {
    name: 'extraHeaders',
    displayName: 'Extra Headers',
    type: 'json',
    optional: true,
    description: 'Additional HTTP headers as key-value pairs',
  },
];

const prestoProperties: ConnectionPropertyDefinition[] = [
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
    description: 'SQL statements to run when the connection is established',
  },
];

registerConnectionType('trino', {
  displayName: 'Trino',
  factory: async (config: ConnectionConfig) => {
    return new TrinoConnection(
      config.name,
      undefined,
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
      undefined,
      configToBaseConfig(config)
    );
  },
  properties: prestoProperties,
});
