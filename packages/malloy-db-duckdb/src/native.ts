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
      advanced: true,
      requireLiteralString: true,
    },
    {
      name: 'allowedDirectories',
      displayName: 'Allowed Directories',
      type: 'json',
      optional: true,
      advanced: true,
    },
    {
      name: 'enableExternalAccess',
      displayName: 'Enable External Access',
      type: 'boolean',
      optional: true,
      advanced: true,
    },
    {
      name: 'lockConfiguration',
      displayName: 'Lock Configuration',
      type: 'boolean',
      optional: true,
      advanced: true,
    },
    {
      name: 'autoloadKnownExtensions',
      displayName: 'Autoload Known Extensions',
      type: 'boolean',
      optional: true,
      advanced: true,
    },
    {
      name: 'autoinstallKnownExtensions',
      displayName: 'Autoinstall Known Extensions',
      type: 'boolean',
      optional: true,
      advanced: true,
    },
    {
      name: 'allowCommunityExtensions',
      displayName: 'Allow Community Extensions',
      type: 'boolean',
      optional: true,
      advanced: true,
    },
    {
      name: 'allowUnsignedExtensions',
      displayName: 'Allow Unsigned Extensions',
      type: 'boolean',
      optional: true,
      advanced: true,
    },
    {
      name: 'tempFileEncryption',
      displayName: 'Temp File Encryption',
      type: 'boolean',
      optional: true,
      advanced: true,
    },
    {
      name: 'threads',
      displayName: 'Threads',
      type: 'number',
      optional: true,
      advanced: true,
    },
    {
      name: 'memoryLimit',
      displayName: 'Memory Limit',
      type: 'string',
      optional: true,
      advanced: true,
    },
    {
      name: 'tempDirectory',
      displayName: 'Temp Directory',
      type: 'file',
      optional: true,
      advanced: true,
    },
    {
      name: 'extensionDirectory',
      displayName: 'Extension Directory',
      type: 'file',
      optional: true,
      advanced: true,
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
      name: 'shareable',
      displayName: 'Shareable',
      type: 'boolean',
      optional: true,
      description:
        'When true, release the database file when the host idles this ' +
        'connection, or when another local shareable connection requests ' +
        'the same target. This lets tools such as malloy-cli and the DuckDB ' +
        'CLI use the file while the connection object remains reusable. ' +
        'Default false.',
    },
    {
      name: 'shareableAttachAlias',
      displayName: 'Shareable Attach Alias',
      type: 'string',
      optional: true,
      advanced: true,
      default: 'malloy_db',
      description:
        'Catalog alias used when shareable is true. The default is ' +
        '"malloy_db" for backward compatibility. Set to "auto" to preserve ' +
        "DuckDB's natural catalog name, or set another value for an explicit " +
        'custom alias.',
    },
    {
      name: 'shareableLockSafety',
      displayName: 'Shareable Lock Safety',
      type: 'string',
      optional: true,
      advanced: true,
      requireLiteralString: true,
      default: 'best-effort',
      description:
        'Use "strict" to reject filesystem types whose local lock semantics ' +
        'Malloy cannot conservatively accept. The default "best-effort" ' +
        'skips only that statfs preflight while retaining inode, hard-link, ' +
        'lifecycle, and in-process fencing; it is not a distributed lock. ' +
        'Creating a new file still requires atomic hard-link publication, so ' +
        'pre-create the database on filesystems that do not support it.',
    },
    {
      name: 'setupSQL',
      displayName: 'Setup SQL',
      type: 'text',
      optional: true,
      advanced: true,
      description: 'SQL statements to run when the connection is established',
    },
  ],
});
