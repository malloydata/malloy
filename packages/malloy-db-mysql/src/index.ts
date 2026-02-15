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

registerConnectionType('mysql', {
  factory: (config: ConnectionConfig) => {
    return new MySQLConnection(config.name, {
      host: typeof config['host'] === 'string' ? config['host'] : undefined,
      port: typeof config['port'] === 'number' ? config['port'] : undefined,
      database:
        typeof config['database'] === 'string' ? config['database'] : undefined,
      user: typeof config['user'] === 'string' ? config['user'] : undefined,
      password:
        typeof config['password'] === 'string' ? config['password'] : undefined,
      setupSQL:
        typeof config['setupSQL'] === 'string' ? config['setupSQL'] : undefined,
    });
  },
  properties: [
    {name: 'host', displayName: 'Host', type: 'string', optional: true},
    {
      name: 'port',
      displayName: 'Port',
      type: 'number',
      optional: true,
      default: '3306',
    },
    {name: 'database', displayName: 'Database', type: 'string', optional: true},
    {name: 'user', displayName: 'User', type: 'string', optional: true},
    {
      name: 'password',
      displayName: 'Password',
      type: 'password',
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
