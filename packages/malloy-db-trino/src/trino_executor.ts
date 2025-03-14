/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
