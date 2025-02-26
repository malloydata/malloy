/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {compileModel, compileQuery, compileSource} from './sessioned';
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
    test('compile source basic test', () => {
      let result = compileSource({
        model_url: 'file://test.malloy',
        name: 'flights',
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
              contents: "source: flights is connection.table('flights')",
            },
          ],
        },
      });
      let expected: Malloy.CompileSourceResponse = {
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
      result = compileSource({
        model_url: 'file://test.malloy',
        name: 'flights',
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
        source: {
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
      };
      expect(result).toMatchObject(expected);
    });
  });
  describe('compile query', () => {
    test('compile query with table dependency', () => {
      const query: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source_reference: {name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'group_by',
                field: {
                  expression: {kind: 'field_reference', name: 'carrier'},
                },
              },
            ],
          },
        },
      };
      let result = compileQuery({
        model_url: 'file://test.malloy',
        query,
      });
      let expected: Malloy.CompileQueryResponse = {
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
            },
          ],
        },
      };
      expect(result).toMatchObject(expected);
      result = compileQuery({
        model_url: 'file://test.malloy',
        query,
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
      result = compileQuery({
        model_url: 'file://test.malloy',
        query,
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
        result: {
          sql: `SELECT \n\
   base."carrier" as "carrier"
FROM flights as base
GROUP BY 1
ORDER BY 1 asc NULLS LAST
`,
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
      };
      expect(result).toMatchObject(expected);
    });
  });
  describe('sessions', () => {
    describe('ttl', () => {
      test('making a different request should purge expired sessions', () => {
        let result = compileModel(
          {
            model_url: 'file://test.malloy',
          },
          {
            // This is in the past...
            ttl: new Date(Date.now() - 1000),
          }
        );
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
        compileModel({
          model_url: 'file://some_other_model.malloy',
        });
        result = compileModel({
          model_url: 'file://test.malloy',
        });
        expected = {
          compiler_needs: {
            files: [
              {
                url: 'file://test.malloy',
              },
            ],
          },
        };
        expect(result).toMatchObject(expected);
      });
    });
    test('sessions should be cleared when they successfully return a result', () => {
      let result = compileModel({
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
          files: [
            {
              url: 'file://test.malloy',
              contents: "source: flights is connection.table('flights')",
            },
          ],
          connections: [{name: 'connection', dialect: 'duckdb'}],
        },
      });
      let expected: Malloy.CompileModelResponse = {
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
      result = compileModel({
        model_url: 'file://test.malloy',
      });
      // Compiler should not know the contents of this file anymore because the session was cleared
      expected = {
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
            },
          ],
        },
      };
      expect(result).toMatchObject(expected);
    });
  });
});
