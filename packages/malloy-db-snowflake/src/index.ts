/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export {SnowflakeConnection} from './snowflake_connection';
export {buildPoolOptions} from './snowflake_pool_options';

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import type {ConnectionOptions} from 'snowflake-sdk';
import {SnowflakeConnection} from './snowflake_connection';
import {buildPoolOptions} from './snowflake_pool_options';

registerConnectionType('snowflake', {
  displayName: 'Snowflake',
  factory: async (config: ConnectionConfig) => {
    const {
      name,
      is: _,
      setupSQL,
      timeoutMs,
      schemaSampleTimeoutMs,
      schemaSampleRowLimit,
      schemaSampleFullScanMaxBytes,
      poolMin,
      poolMax,
      poolTestOnBorrow,
      ...props
    } = config;
    // ConnectionConfig values are trusted to match ConnectionOptions fields
    // because the property definitions below declare matching names/types.
    // The double cast bridges Malloy's generic config to snowflake-sdk's
    // external typed interface — unavoidable without enumerating every
    // ConnectionOptions field.
    const connOptions = props as unknown as ConnectionOptions;
    return new SnowflakeConnection(name, {
      connOptions,
      setupSQL: typeof setupSQL === 'string' ? setupSQL : undefined,
      timeoutMs:
        typeof timeoutMs === 'number'
          ? timeoutMs
          : typeof timeoutMs === 'string'
            ? parseInt(timeoutMs, 10)
            : undefined,
      schemaSampleTimeoutMs:
        typeof schemaSampleTimeoutMs === 'number'
          ? schemaSampleTimeoutMs
          : typeof schemaSampleTimeoutMs === 'string'
            ? parseInt(schemaSampleTimeoutMs, 10)
            : undefined,
      schemaSampleRowLimit:
        typeof schemaSampleRowLimit === 'number'
          ? schemaSampleRowLimit
          : typeof schemaSampleRowLimit === 'string'
            ? parseInt(schemaSampleRowLimit, 10)
            : undefined,
      schemaSampleFullScanMaxBytes:
        typeof schemaSampleFullScanMaxBytes === 'number'
          ? schemaSampleFullScanMaxBytes
          : typeof schemaSampleFullScanMaxBytes === 'string'
            ? parseInt(schemaSampleFullScanMaxBytes, 10)
            : undefined,
      poolOptions: buildPoolOptions({poolMin, poolMax, poolTestOnBorrow}),
    });
  },
  properties: [
    {name: 'account', displayName: 'Account', type: 'string'},
    {name: 'username', displayName: 'Username', type: 'string', optional: true},
    {
      name: 'password',
      displayName: 'Password',
      type: 'password',
      optional: true,
    },
    {name: 'role', displayName: 'Role', type: 'string', optional: true},
    {
      name: 'warehouse',
      displayName: 'Warehouse',
      type: 'string',
      optional: true,
    },
    {name: 'database', displayName: 'Database', type: 'string', optional: true},
    {name: 'schema', displayName: 'Schema', type: 'string', optional: true},
    {
      name: 'privateKeyPath',
      displayName: 'Private Key Path',
      type: 'file',
      optional: true,
      fileFilters: {
        'Private Key Files': ['pem', 'key', 'rsa'],
        'All Files': ['*'],
      },
    },
    {
      name: 'privateKey',
      displayName: 'Private Key',
      type: 'password',
      optional: true,
    },
    {
      name: 'privateKeyPass',
      displayName: 'Private Key Passphrase',
      type: 'password',
      optional: true,
    },
    {
      name: 'timeoutMs',
      displayName: 'Timeout (ms)',
      type: 'number',
      optional: true,
      advanced: true,
      default: 600000,
    },
    {
      name: 'schemaSampleTimeoutMs',
      displayName: 'Schema Sample Timeout (ms)',
      type: 'number',
      optional: true,
      advanced: true,
      default: 15000,
      description:
        'Timeout for the query that samples variant columns to detect their schema.',
    },
    {
      name: 'schemaSampleRowLimit',
      displayName: 'Schema Sample Row Limit',
      type: 'number',
      optional: true,
      advanced: true,
      default: 1000,
      description:
        'Row limit for the variant schema sample. Ignored for tables small enough to full-scan.',
    },
    {
      name: 'schemaSampleFullScanMaxBytes',
      displayName: 'Schema Full-Scan Max Bytes',
      type: 'number',
      optional: true,
      advanced: true,
      description:
        'Tables with BYTES at or below this value are full-scanned during variant schema inference instead of sampled. When unset, the connection uses an internal threshold; picking a value here is a policy choice tied to the size-probe behavior.',
    },
    {
      name: 'setupSQL',
      displayName: 'Setup SQL',
      type: 'text',
      optional: true,
      advanced: true,
      description: 'SQL statements to run when the connection is established',
    },
    {
      name: 'poolMin',
      displayName: 'Pool Min',
      type: 'number',
      optional: true,
      advanced: true,
      description:
        'Minimum number of pooled snowflake-sdk connections kept warm. Defaults to 1.',
    },
    {
      name: 'poolMax',
      displayName: 'Pool Max',
      type: 'number',
      optional: true,
      advanced: true,
      description:
        'Maximum number of pooled snowflake-sdk connections. Defaults to 1.',
    },
    {
      name: 'poolTestOnBorrow',
      displayName: 'Test On Borrow',
      type: 'boolean',
      optional: true,
      advanced: true,
      description:
        'If true, the pool validates each connection when checked out. Defaults to true.',
    },
  ],
});
