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

export type {BaseRunner} from './trino_connection';
export {
  PrestoConnection,
  TrinoConnection,
  TrinoPrestoConnection,
} from './trino_connection';
export {TrinoExecutor} from './trino_executor';

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {TrinoConnection, PrestoConnection} from './trino_connection';

function configToTrinoConfig(config: ConnectionConfig) {
  const {name, server, port, catalog, schema, user, password, ...rest} = config;
  return {
    name,
    trinoConfig: {
      server: server as string | undefined,
      port: port as number | undefined,
      catalog: catalog as string | undefined,
      schema: schema as string | undefined,
      user: user as string | undefined,
      password: password as string | undefined,
      ...rest,
    },
  };
}

registerConnectionType('trino', (config: ConnectionConfig) => {
  const {name, trinoConfig} = configToTrinoConfig(config);
  return new TrinoConnection(name, undefined, trinoConfig);
});

registerConnectionType('presto', (config: ConnectionConfig) => {
  const {name, trinoConfig} = configToTrinoConfig(config);
  return new PrestoConnection(name, undefined, trinoConfig);
});
