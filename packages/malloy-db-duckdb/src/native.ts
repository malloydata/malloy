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
      // Binds to the project root (discovery ceiling) when the host has
      // populated `config.rootDirectory`. Lets Malloy files use relative
      // data paths that stay stable regardless of where the config file
      // happens to live inside the project.
      default: {config: 'rootDirectory'},
    },
    {
      name: 'securityPolicy',
      displayName: 'Security Policy',
      type: 'string',
      optional: true,
      requireLiteralString: true,
    },
    {
      name: 'allowedDirectories',
      displayName: 'Allowed Directories',
      type: 'json',
      optional: true,
    },
    {
      name: 'enableExternalAccess',
      displayName: 'Enable External Access',
      type: 'boolean',
      optional: true,
    },
    {
      name: 'lockConfiguration',
      displayName: 'Lock Configuration',
      type: 'boolean',
      optional: true,
    },
    {
      name: 'autoloadKnownExtensions',
      displayName: 'Autoload Known Extensions',
      type: 'boolean',
      optional: true,
    },
    {
      name: 'autoinstallKnownExtensions',
      displayName: 'Autoinstall Known Extensions',
      type: 'boolean',
      optional: true,
    },
    {
      name: 'allowCommunityExtensions',
      displayName: 'Allow Community Extensions',
      type: 'boolean',
      optional: true,
    },
    {
      name: 'allowUnsignedExtensions',
      displayName: 'Allow Unsigned Extensions',
      type: 'boolean',
      optional: true,
    },
    {
      name: 'tempFileEncryption',
      displayName: 'Temp File Encryption',
      type: 'boolean',
      optional: true,
    },
    {
      name: 'threads',
      displayName: 'Threads',
      type: 'number',
      optional: true,
    },
    {
      name: 'memoryLimit',
      displayName: 'Memory Limit',
      type: 'string',
      optional: true,
    },
    {
      name: 'tempDirectory',
      displayName: 'Temp Directory',
      type: 'file',
      optional: true,
    },
    {
      name: 'extensionDirectory',
      displayName: 'Extension Directory',
      type: 'file',
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
