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

export {SnowflakeConnection} from './snowflake_connection';

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import type {ConnectionOptions} from 'snowflake-sdk';
import {SnowflakeConnection} from './snowflake_connection';

registerConnectionType('snowflake', {
  factory: (config: ConnectionConfig) => {
    const {name, ...props} = config;
    // ConnectionConfig values are trusted to match ConnectionOptions fields
    // because the property definitions below declare matching names/types.
    // The double cast bridges Malloy's generic config to snowflake-sdk's
    // external typed interface — unavoidable without enumerating every
    // ConnectionOptions field.
    const connOptions = props as unknown as ConnectionOptions;
    return new SnowflakeConnection(name, {connOptions});
  },
  properties: [
    {name: 'account', displayName: 'Account', type: 'string'},
    {name: 'username', displayName: 'Username', type: 'string', optional: true},
    {name: 'password', displayName: 'Password', type: 'password', optional: true},
    {name: 'role', displayName: 'Role', type: 'string', optional: true},
    {name: 'warehouse', displayName: 'Warehouse', type: 'string', optional: true},
    {name: 'database', displayName: 'Database', type: 'string', optional: true},
    {name: 'schema', displayName: 'Schema', type: 'string', optional: true},
    {
      name: 'privateKeyPath',
      displayName: 'Private Key Path',
      type: 'file',
      optional: true,
      fileFilters: {
        'Private Key Files': ['pem', 'key', 'rsa'],
        'All Files': ['*'],
      },
    },
    {name: 'privateKeyPass', displayName: 'Private Key Passphrase', type: 'password', optional: true},
    {name: 'timeoutMs', displayName: 'Timeout (ms)', type: 'number', optional: true},
  ],
});
