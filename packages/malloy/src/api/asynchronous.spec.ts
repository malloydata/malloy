/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {compileModel} from './asynchronous';
import * as Malloy from '@malloydata/malloy-interfaces';
import {InfoConnection, LookupConnection} from './connection';
import {URLReader} from '../runtime_types';

describe('api', () => {
  describe('compile model', () => {
    test('compile model with table dependency', async () => {
      const connection: InfoConnection = {
        dialectName: 'duckdb',
        fetchSchemaForTable: async (_name: string) => {
          return {
            fields: [
              {
                kind: 'dimension',
                name: 'carrier',
                type: {kind: 'string_type'},
              },
            ],
          };
        },
        fetchSchemaForSQLQuery: async (_sql: string) => {
          throw new Error('not implemented');
        },
      };
      const urls: URLReader = {
        readURL: async (_url: URL) => {
          return "source: flights is connection.table('flights')";
        },
      };
      const connections: LookupConnection<InfoConnection> = {
        lookupConnection: async (_name: string) => {
          return connection;
        },
      };
      const fetchers = {
        urls,
        connections,
      };
      const result = await compileModel(
        {
          model_url: 'file://test.malloy',
        },
        fetchers
      );
      const expected: Malloy.CompileModelResponse = {
        model: {
          entries: [
            {
              kind: 'source',
              name: 'flights',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                ],
              },
            },
          ],
          anonymous_queries: [],
        },
      };
      expect(result).toMatchObject(expected);
    });
  });
});
