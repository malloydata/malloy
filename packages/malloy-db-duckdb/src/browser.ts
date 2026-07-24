/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  queryOptionsFromConnectionConfig,
  registerConnectionType,
  ROW_LIMIT_CONNECTION_PROPERTY,
} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {DuckDBWASMConnection} from './duckdb_wasm_connection_browser';

registerConnectionType('duckdb_wasm', {
  displayName: 'DuckDB',
  factory: async (config: ConnectionConfig) =>
    new DuckDBWASMConnection(config, queryOptionsFromConnectionConfig(config)),
  properties: [
    ROW_LIMIT_CONNECTION_PROPERTY,
    {
      name: 'databasePath',
      displayName: 'Database Path',
      type: 'string',
      optional: true,
      default: ':memory:',
    },
    {
      name: 'workingDirectory',
      displayName: 'Working Directory',
      type: 'string',
      optional: true,
      // Binds to the project root (discovery ceiling) when the host has
      // populated `config.rootDirectory`. Symmetric with the native
      // DuckDB default — resolves to undefined in browser hosts that
      // don't wire a `config` overlay, which is fine.
      default: {config: 'rootDirectory'},
    },
    {
      name: 'motherDuckToken',
      displayName: 'MotherDuck Token',
      type: 'secret',
      optional: true,
    },
    {
      name: 'setupSQL',
      displayName: 'Setup SQL',
      type: 'text',
      optional: true,
      description: 'SQL statements to run when the connection is established',
    },
  ],
});
