/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export {MySQLConnection, MySQLExecutor} from './mysql_connection';

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {MySQLConnection} from './mysql_connection';

registerConnectionType('mysql', (config: ConnectionConfig) => {
  const {name, host, port, database, user, password} = config;
  return new MySQLConnection(name, {
    host: host as string | undefined,
    port: port as number | undefined,
    database: database as string | undefined,
    user: user as string | undefined,
    password: password as string | undefined,
  });
});
