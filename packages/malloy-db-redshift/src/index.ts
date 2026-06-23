/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export {
  RedshiftConnection,
  PooledRedshiftConnection,
} from './redshift_connection';
export {RedshiftExecutor} from './redshift_executor';
export type {RedshiftConnectionOptions} from './redshift_executor';

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {RedshiftConnection} from './redshift_connection';

registerConnectionType('redshift', {
  displayName: 'Amazon Redshift',
  factory: async (config: ConnectionConfig) => {
    return new RedshiftConnection(config);
  },
  properties: [
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
  ],
});
