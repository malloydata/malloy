/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export {
  PostgresConnection,
  PooledPostgresConnection,
} from './postgres_connection';
export type {PostgresSSLConfig} from './postgres_connection';

import {
  queryOptionsFromConnectionConfig,
  registerConnectionType,
  ROW_LIMIT_CONNECTION_PROPERTY,
} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {PostgresConnection} from './postgres_connection';

registerConnectionType('postgres', {
  displayName: 'PostgreSQL',
  factory: async (config: ConnectionConfig) => {
    return new PostgresConnection(
      config,
      queryOptionsFromConnectionConfig(config)
    );
  },
  properties: [
    ROW_LIMIT_CONNECTION_PROPERTY,
    {name: 'host', displayName: 'Host', type: 'string', optional: true},
    {name: 'port', displayName: 'Port', type: 'number', optional: true},
    {name: 'username', displayName: 'Username', type: 'string', optional: true},
    {
      name: 'password',
      displayName: 'Password',
      type: 'password',
      optional: true,
    },
    {
      name: 'databaseName',
      displayName: 'Database Name',
      type: 'string',
      optional: true,
    },
    {
      name: 'connectionString',
      displayName: 'Connection String',
      type: 'string',
      optional: true,
      advanced: true,
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
      name: 'ssl',
      displayName: 'SSL',
      type: 'json',
      optional: true,
      advanced: true,
      description:
        'TLS/SSL options forwarded to pg, e.g. {"servername":"db.example.com","ca":"<PEM>"}. Passed through literally (json config is never reference-resolved), so do not place secret key/passphrase material in shared config.',
    },
  ],
});
