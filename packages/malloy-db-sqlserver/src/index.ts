/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export {
  SQLServerConnection,
  SQLServerExecutor,
  driverConfig,
} from './sqlserver_connection';
export type {
  SQLServerConfiguration,
  SQLServerConnectionOptions,
  SQLServerAuthentication,
} from './sqlserver_connection';

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {SQLServerConnection} from './sqlserver_connection';
import type {SQLServerConnectionOptions} from './sqlserver_connection';

registerConnectionType('sqlserver', {
  displayName: 'SQL Server',
  factory: async (config: ConnectionConfig) => {
    return new SQLServerConnection(config as SQLServerConnectionOptions);
  },
  properties: [
    {name: 'server', displayName: 'Server', type: 'string', optional: true},
    {
      name: 'port',
      displayName: 'Port',
      type: 'number',
      optional: true,
      default: 1433,
    },
    {name: 'database', displayName: 'Database', type: 'string', optional: true},
    {
      name: 'authentication',
      displayName: 'Authentication',
      type: 'string',
      optional: true,
      default: 'sql',
      description:
        "'sql' (a SQL Server login), 'azure-default' (Microsoft Entra ID through the DefaultAzureCredential chain: managed identity, workload identity, environment service principal, az CLI), 'azure-service-principal', 'azure-msi', 'azure-access-token', or 'ntlm'",
    },
    {name: 'user', displayName: 'User', type: 'string', optional: true},
    {
      name: 'password',
      displayName: 'Password',
      type: 'password',
      optional: true,
    },
    {
      name: 'domain',
      displayName: 'Domain',
      type: 'string',
      optional: true,
      advanced: true,
      description: 'Windows domain, for ntlm authentication',
    },
    {
      name: 'clientId',
      displayName: 'Client ID',
      type: 'string',
      optional: true,
      advanced: true,
      description:
        'Entra application (client) id, for azure-service-principal and a user-assigned azure-msi identity',
    },
    {
      name: 'tenantId',
      displayName: 'Tenant ID',
      type: 'string',
      optional: true,
      advanced: true,
    },
    {
      name: 'clientSecret',
      displayName: 'Client Secret',
      type: 'secret',
      optional: true,
      advanced: true,
    },
    {
      name: 'accessToken',
      displayName: 'Access Token',
      type: 'secret',
      optional: true,
      advanced: true,
      description: 'An Entra access token the caller already holds',
    },
    {
      name: 'encrypt',
      displayName: 'Encrypt',
      type: 'boolean',
      optional: true,
      default: true,
      advanced: true,
    },
    {
      name: 'trustServerCertificate',
      displayName: 'Trust Server Certificate',
      type: 'boolean',
      optional: true,
      advanced: true,
      description:
        "Accept a certificate the client cannot verify, such as a local container's. Leave off for any server you do not control.",
    },
    {
      name: 'connectionString',
      displayName: 'Connection String',
      type: 'string',
      optional: true,
      advanced: true,
      description:
        'An ADO.NET-style connection string, instead of the server/port/database/credential fields',
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
      name: 'requestTimeoutMs',
      displayName: 'Request Timeout (ms)',
      type: 'number',
      optional: true,
      advanced: true,
    },
    {
      name: 'poolMin',
      displayName: 'Pool Min',
      type: 'number',
      optional: true,
      advanced: true,
    },
    {
      name: 'poolMax',
      displayName: 'Pool Max',
      type: 'number',
      optional: true,
      advanced: true,
    },
  ],
});
