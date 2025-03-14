/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {compileModel, compileQuery, compileSource} from './sessioned';
import type * as Malloy from '@malloydata/malloy-interfaces';

describe('api', () => {
  describe('compile model', () => {
    test('compile model with table dependency', () => {
      let result = compileModel({
        model_url: 'file://test.malloy',
      });
      let expected: Malloy.CompileModelResponse & {session_id?: string} = {
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
            },
          ],
        },
      };
      expect(result).toMatchObject(expected);
      result = compileModel(
        {
          model_url: 'file://test.malloy',
          compiler_needs: {
            files: [
              {
                url: 'file://test.malloy',
                contents: "source: flights is connection.table('flights')",
              },
            ],
          },
        },
        {session_id: result.session_id}
      );
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
        session_id: result.session_id,
      };
      expect(result).toMatchObject(expected);
      result = compileModel(
        {
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
        },
        {session_id: result.session_id}
      );
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
        session_id: result.session_id,
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
      let expected: Malloy.CompileSourceResponse & {session_id?: string} = {
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
      result = compileSource(
        {
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
        },
        {session_id: result.session_id}
      );
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
        session_id: result.session_id,
      };
      expect(result).toMatchObject(expected);
    });
  });
  describe('compile query', () => {
    test('compile query with table dependency', () => {
      const query: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {kind: 'source_reference', name: 'flights'},
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
      let expected: Malloy.CompileQueryResponse & {session_id?: string} = {
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
            },
          ],
        },
      };
      expect(result).toMatchObject(expected);
      result = compileQuery(
        {
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
        },
        {session_id: result.session_id}
      );
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
      result = compileQuery(
        {
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
        },
        {session_id: result.session_id}
      );
      expected = {
        result: {
          connection_name: 'connection',
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
        session_id: result.session_id,
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
        const session_id = result.session_id;
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
        result = compileModel({model_url: 'file://test.malloy'}, {session_id});
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
        // New session
        expect(result.session_id).not.toBe(session_id);
      });
      test('ttl should be updated if set in a subsequent request', () => {
        let result = compileModel(
          {
            model_url: 'file://test.malloy',
          },
          {
            // This is in the past...
            ttl: new Date(Date.now() - 1000),
          }
        );
        const session_id = result.session_id;
        let expected: Malloy.CompileModelResponse & {session_id?: string} = {
          compiler_needs: {
            files: [
              {
                url: 'file://test.malloy',
              },
            ],
          },
        };
        expect(result).toMatchObject(expected);
        result = compileModel(
          {
            model_url: 'file://test.malloy',
            compiler_needs: {
              files: [
                {
                  url: 'file://test.malloy',
                  contents: 'source: flights is connection.table("flights")',
                },
              ],
            },
          },
          {
            session_id,
            // Update TTL to be far in the future
            ttl: {seconds: 100000},
          }
        );
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
          session_id,
        };
        expect(result).toMatchObject(expected);
        // Now asking for a different file should NOT purge the original session
        compileModel({
          model_url: 'file://some_other_model.malloy',
        });
        result = compileModel({model_url: 'file://test.malloy'}, {session_id});
        expect(result).toMatchObject(expected);
      });
    });
    test('getting an error should kill session', () => {
      let result = compileModel({
        model_url: 'file://test.malloy',
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
              contents:
                "source: flights is connection.table('flights') extend { dimension: x is does_not_exist }",
            },
          ],
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
      let expected: Malloy.CompileModelResponse = {
        logs: [
          {
            url: 'file://test.malloy',
            severity: 'error',
            message: "'does_not_exist' is not defined",
            range: {
              start: {line: 0, character: 72},
              end: {line: 0, character: 86},
            },
          },
        ],
      };
      const session_id = result.session_id;
      expect(result).toMatchObject(expected);
      result = compileModel({model_url: 'file://test.malloy'}, {session_id});
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
      // Should be a new session
      expect(result.session_id).not.toBe(session_id);
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
      const session_id = result.session_id;
      expect(result).toMatchObject(expected);
      result = compileModel({model_url: 'file://test.malloy'}, {session_id});
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
      expect(result.session_id).not.toBe(session_id);
    });
  });
});
