/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {compileModel} from './sessioned';
import * as Malloy from '@malloydata/malloy-interfaces';

describe('api', () => {
  describe('compile model', () => {
    test('compile model with table dependency', () => {
      let result = compileModel({
        model_url: 'file://test.malloy',
      });
      let expected: Malloy.CompileModelResponse = {
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
            },
          ],
        },
      };
      expect(result).toMatchObject(expected);
      result = compileModel({
        model_url: 'file://test.malloy',
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
              contents: "source: flights is connection.table('flights')",
            },
          ],
        },
      });
      expected = {
        compiler_needs: {
          table_schemas: [
            {
              connection_name: 'connection',
              name: 'flights',
            },
          ],
          connections: [{name: 'connection'}],
        },
      };
      expect(result).toMatchObject(expected);
      result = compileModel({
        model_url: 'file://test.malloy',
        compiler_needs: {
          table_schemas: [
            {
              connection_name: 'connection',
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
          connections: [{name: 'connection', dialect: 'duckdb'}],
        },
      });
      expected = {
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
