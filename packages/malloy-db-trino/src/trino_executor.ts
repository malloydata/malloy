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

import {TrinoConnectionConfiguration} from './trino_connection';

export class TrinoExecutor {
  public static getConnectionOptionsFromEnv():
    | TrinoConnectionConfiguration
    | undefined {
    const server = process.env['TRINO_SERVER'];
    if (server) {
      const user = process.env['TRINO_USER'];

      if (!user) {
        throw Error(
          'Trino server specified but no user was provided. Set TRINO_USER and TRINO_PASSWORD environment variables'
        );
      }

      const password = process.env['TRINO_PASSWORD'];
      // TODO(figutierrez): We may not need to support these.
      const catalog = process.env['TRINO_CATALOG'];
      const schema = process.env['TRINO_SCHEMA'];
      return {
        server,
        user,
        password,
        catalog,
        schema,
      };
    }

    return undefined;
  }
}
