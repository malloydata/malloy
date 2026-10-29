/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TrinoConnectionConfiguration} from './trino_connection';

// Differences:
// Trino uses TRINO_SERVER
// Presto users PRESTO_HOST/PRESTO_PORT
// Trino requires TRINO_USER

export class TrinoExecutor {
  public static getConnectionOptionsFromEnv(
    dialectName: 'trino' | 'presto'
  ): TrinoConnectionConfiguration | undefined {
    const envPrefix = dialectName.toUpperCase();
    const user = process.env[`${envPrefix}_USER`];
    let server;
    let port: number | undefined = undefined;
    if (dialectName === 'trino') {
      server = process.env['TRINO_SERVER'];
      if (!user && server) {
        throw Error(
          'Trino server specified but no user was provided. Set TRINO_USER and TRINO_PASSWORD environment variables'
        );
      }
    } else {
      server = process.env['PRESTO_HOST'];
      port = Number(process.env['PRESTO_PORT']) || 8080;
    }

    if (!server) {
      return undefined;
    }

    const password = process.env[`${envPrefix}_PASSWORD`];
    // TODO(figutierrez): We may not need to support these.
    const catalog = process.env[`${envPrefix}_CATALOG`];
    const schema = process.env[`${envPrefix}_SCHEMA`];
    const ret = {
      server,
      user,
      port,
      password,
      catalog,
      schema,
    };
    return ret;
  }
}
