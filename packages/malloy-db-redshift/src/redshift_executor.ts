/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export interface RedshiftConnectionOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  connectionString?: string;
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid REDSHIFT_PORT: ${value}`);
  }
  return port;
}

export class RedshiftExecutor {
  public static getConnectionOptionsFromEnv(): RedshiftConnectionOptions {
    const connectionString = process.env['REDSHIFT_CONNECTION_STRING'];
    if (connectionString) {
      return {connectionString};
    }
    return {
      host: process.env['REDSHIFT_HOST'],
      port: parsePort(process.env['REDSHIFT_PORT']),
      username: process.env['REDSHIFT_USER'],
      password: process.env['REDSHIFT_PASSWORD'],
      databaseName: process.env['REDSHIFT_DATABASE'],
    };
  }
}
