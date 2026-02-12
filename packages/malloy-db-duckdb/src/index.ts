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

export {DuckDBConnection} from './duckdb_connection';

import {registerConnectionType} from '@malloydata/malloy';
import type {ConnectionConfig} from '@malloydata/malloy';
import {DuckDBConnection} from './duckdb_connection';

registerConnectionType('duckdb', {
  factory: (config: ConnectionConfig) => {
    const options = {...config};
    // Map user-friendly "path" to the constructor's "databasePath"
    if ('path' in options && !('databasePath' in options)) {
      options['databasePath'] = options['path'];
      delete options['path'];
    }
    return new DuckDBConnection(options);
  },
  properties: [
    {
      name: 'databasePath',
      displayName: 'Database Path',
      type: 'file',
      optional: true,
      default: ':memory:',
      fileFilters: {DuckDB: ['db', 'duckdb', 'ddb']},
    },
    {
      name: 'workingDirectory',
      displayName: 'Working Directory',
      type: 'string',
      optional: true,
    },
    {
      name: 'motherDuckToken',
      displayName: 'MotherDuck Token',
      type: 'password',
      optional: true,
    },
    {
      name: 'additionalExtensions',
      displayName: 'Additional Extensions',
      type: 'string',
      optional: true,
    },
    {
      name: 'readOnly',
      displayName: 'Read Only',
      type: 'boolean',
      optional: true,
    },
  ],
});
