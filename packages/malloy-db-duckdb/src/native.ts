/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {DuckDBConnection} from './duckdb_connection';

registerConnectionType('duckdb', {
  displayName: 'DuckDB',
  factory: async (config: ConnectionConfig) => {
    const options = {...config};
    // Map user-friendly "path" to the constructor's "databasePath"
    if ('path' in options && !('databasePath' in options)) {
      options['databasePath'] = options['path'];
      delete options['path'];
    }
    // Parse comma-separated extensions string into array
    if (typeof options['additionalExtensions'] === 'string') {
      options['additionalExtensions'] = options['additionalExtensions']
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }
    return new DuckDBConnection(options);
  },
  properties: [
    {
      name: 'databasePath',
      displayName: 'Database Path',
      type: 'file',
      optional: true,
      default: ':memory:',
      fileFilters: {DuckDB: ['db', 'duckdb', 'ddb']},
    },
    {
      name: 'workingDirectory',
      displayName: 'Working Directory',
      type: 'string',
      optional: true,
    },
    {
      name: 'motherDuckToken',
      displayName: 'MotherDuck Token',
      type: 'secret',
      optional: true,
    },
    {
      name: 'additionalExtensions',
      displayName: 'Additional Extensions',
      type: 'string',
      optional: true,
      description:
        'Comma-separated list of DuckDB extensions to load (e.g. "spatial,fts"). ' +
        'These are loaded in addition to the built-in extensions: json, httpfs, icu.',
    },
    {
      name: 'readOnly',
      displayName: 'Read Only',
      type: 'boolean',
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
