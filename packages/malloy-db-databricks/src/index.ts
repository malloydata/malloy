/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export {DatabricksConnection} from './databricks_connection';

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {DatabricksConnection} from './databricks_connection';

registerConnectionType('databricks', {
  displayName: 'Databricks',
  factory: async (config: ConnectionConfig) => {
    const host = typeof config['host'] === 'string' ? config['host'] : '';
    const path = typeof config['path'] === 'string' ? config['path'] : '';

    return new DatabricksConnection(config.name, {
      host,
      path,
      token: typeof config['token'] === 'string' ? config['token'] : undefined,
      oauthClientId:
        typeof config['oauthClientId'] === 'string'
          ? config['oauthClientId']
          : undefined,
      oauthClientSecret:
        typeof config['oauthClientSecret'] === 'string'
          ? config['oauthClientSecret']
          : undefined,
      defaultCatalog:
        typeof config['defaultCatalog'] === 'string'
          ? config['defaultCatalog']
          : undefined,
      defaultSchema:
        typeof config['defaultSchema'] === 'string'
          ? config['defaultSchema']
          : undefined,
      setupSQL:
        typeof config['setupSQL'] === 'string' ? config['setupSQL'] : undefined,
    });
  },
  properties: [
    {name: 'host', displayName: 'Host', type: 'string'},
    {
      name: 'path',
      displayName: 'HTTP Path',
      type: 'string',
      description: 'SQL warehouse HTTP path',
    },
    {
      name: 'token',
      displayName: 'Access Token',
      type: 'secret',
      optional: true,
      description: 'Personal access token',
    },
    {
      name: 'oauthClientId',
      displayName: 'OAuth Client ID',
      type: 'string',
      optional: true,
      description: 'OAuth M2M client ID',
    },
    {
      name: 'oauthClientSecret',
      displayName: 'OAuth Client Secret',
      type: 'secret',
      optional: true,
      description: 'OAuth M2M client secret',
    },
    {
      name: 'defaultCatalog',
      displayName: 'Default Catalog',
      type: 'string',
      optional: true,
    },
    {
      name: 'defaultSchema',
      displayName: 'Default Schema',
      type: 'string',
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
