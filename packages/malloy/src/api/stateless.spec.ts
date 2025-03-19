/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {compileModel, compileQuery, compileSource} from './stateless';
import type * as Malloy from '@malloydata/malloy-interfaces';

describe('api', () => {
  describe('compile model', () => {
    test('compile model with table dependency', () => {
      const result = compileModel({
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
    test('compile model with model extension', () => {
      const result = compileModel({
        model_url: 'file://test.malloy',
        extend_model_url: 'file://base.malloy',
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
              url: 'file://base.malloy',
              contents: "source: flights_base is connection.table('flights')",
            },
            {
              url: 'file://test.malloy',
              contents: 'source: flights is flights_base',
            },
          ],
          connections: [{name: 'connection', dialect: 'duckdb'}],
        },
      });
      const expected: Malloy.CompileModelResponse = {
        model: {
          entries: [
            {
              kind: 'source',
              name: 'flights_base',
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
    test('compile model with sql dependency', () => {
      const result = compileModel({
        model_url: 'file://test.malloy',
        compiler_needs: {
          sql_schemas: [
            {
              connection_name: 'connection',
              sql: 'SELECT 1 as one',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'one',
                    type: {kind: 'number_type'},
                  },
                ],
              },
            },
          ],
          files: [
            {
              url: 'file://test.malloy',
              contents: "source: flights is connection.sql('SELECT 1 as one')",
            },
          ],
          connections: [{name: 'connection', dialect: 'duckdb'}],
        },
      });
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
                    name: 'one',
                    type: {kind: 'number_type'},
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
  test('compile model with turducken sql dependency', () => {
    const sql =
      '\n                SELECT carrier FROM (SELECT \n   base."carrier" as "carrier"\nFROM flights as base\nGROUP BY 1\nORDER BY 1 asc NULLS LAST\n)\n              ';
    const result = compileModel({
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
        sql_schemas: [
          {
            connection_name: 'connection',
            sql,
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
            contents: `
              source: flights is connection.table('flights')
              source: sql_source is connection.sql("""
                SELECT carrier FROM (%{
                  flights -> { group_by: carrier }
                })
              """)
            `,
          },
        ],
        connections: [{name: 'connection', dialect: 'duckdb'}],
      },
    });
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
          {
            kind: 'source',
            name: 'sql_source',
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
  describe('compile query', () => {
    test('compile query with table dependency', () => {
      const result = compileQuery({
        model_url: 'file://test.malloy',
        query: {
          annotations: [{value: '#(test) hello'}],
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
        },
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
      const expected: Malloy.CompileQueryResponse = {
        result: {
          connection_name: 'connection',
          annotations: [
            {value: '#(test) hello\n'},
            {value: '#(malloy) ordered_by = [{ carrier = asc }]\n'},
            {value: '#(malloy) source_name = flights\n'},
          ],
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
  describe('compiler errors', () => {
    test('parse error should come back as a log', () => {
      const result = compileModel({
        model_url: 'file://test.malloy',
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
              contents: 'run: flights -> { group_by: carrier }',
            },
          ],
        },
      });
      const expected: Malloy.CompileModelResponse = {
        logs: [
          {
            url: 'file://test.malloy',
            severity: 'error',
            message: "Reference to undefined object 'flights'",
            range: {
              start: {line: 0, character: 5},
              end: {line: 0, character: 12},
            },
          },
        ],
      };
      expect(result).toMatchObject(expected);
    });
    test('missing source should come back as a log', () => {
      const result = compileSource({
        model_url: 'file://test.malloy',
        name: 'flights',
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
              contents: '// nothing to see here',
            },
          ],
        },
      });
      const expected: Malloy.CompileModelResponse = {
        logs: [
          {
            url: 'file://test.malloy',
            severity: 'error',
            message: 'Model does not contain a source named flights',
            range: {
              start: {line: 0, character: 0},
              end: {line: 0, character: 0},
            },
          },
        ],
      };
      expect(result).toMatchObject(expected);
    });
  });
  describe('cached models', () => {
    test('set and then use a cached model', () => {
      let result = compileModel({
        model_url: 'file://ext.malloy/',
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
              url: 'file://base.malloy/',
              contents: "source: flights is connection.table('flights')",
            },
            {
              url: 'file://ext.malloy/',
              contents: `
                import { flights } from 'file://base.malloy/'
                source: flights_ext is flights extend { dimension: a is 1 }
              `,
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
              name: 'flights_ext',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                  {
                    kind: 'dimension',
                    name: 'a',
                    type: {kind: 'number_type'},
                  },
                ],
              },
            },
          ],
          anonymous_queries: [],
        },
      };
      expect(result).toMatchObject(expected);
      expect(result.compiled_models).toBeDefined();
      const extTranslation = result.compiled_models?.find(
        t => t.url === 'file://ext.malloy/'
      );
      const baseTranslation = result.compiled_models?.find(
        t => t.url === 'file://base.malloy/'
      );
      expect(extTranslation).toBeDefined();
      expect(baseTranslation).toBeDefined();
      result = compileModel({
        model_url: 'file://ext_ext.malloy/',
        compiler_needs: {
          translations: [extTranslation!, baseTranslation!],
          files: [
            {
              url: 'file://ext_ext.malloy/',
              contents: `
                import { flights } from 'file://base.malloy'
                import { flights_ext } from 'file://ext.malloy'
                source: flights_ext_ext is flights_ext extend { dimension: b is 1 }
                source: flights_ext_2 is flights extend { dimension: c is 1 }
              `,
            },
          ],
        },
      });
      expected = {
        model: {
          entries: [
            {
              kind: 'source',
              name: 'flights_ext_ext',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                  {
                    kind: 'dimension',
                    name: 'a',
                    type: {kind: 'number_type'},
                  },
                  {
                    kind: 'dimension',
                    name: 'b',
                    type: {kind: 'number_type'},
                  },
                ],
              },
            },
            {
              kind: 'source',
              name: 'flights_ext',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                  {
                    kind: 'dimension',
                    name: 'c',
                    type: {kind: 'number_type'},
                  },
                ],
              },
            },
          ],
          anonymous_queries: [],
        },
      };
    });
  });
});
