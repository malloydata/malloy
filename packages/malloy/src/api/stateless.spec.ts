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
    test('compile model with parameterized source', () => {
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
              contents: `
                ##! experimental.parameters
                source: flights(
                  string_no_value::string,
                  string_1 is "foo",
                  string_2 is "\\"bar\\"",
                  number_1 is 1,
                  number_2 is 2.5,
                  number_3 is 2.5e10,
                  number_4 is 2.5e-10,
                  boolean_1 is true,
                  boolean_2 is false,
                  null_1::string is null,
                  timestamp_1 is @2020-01-01 10:00,
                  date_1 is @2020-01-01
                ) is connection.table('flights')
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
              parameters: [
                {
                  default_value: undefined,
                  name: 'string_no_value',
                  type: {
                    kind: 'string_type',
                  },
                },
                {
                  default_value: {
                    kind: 'string_literal',
                    string_value: 'foo',
                  },
                  name: 'string_1',
                  type: {
                    kind: 'string_type',
                  },
                },
                {
                  default_value: {
                    kind: 'string_literal',
                    string_value: '"bar"',
                  },
                  name: 'string_2',
                  type: {
                    kind: 'string_type',
                  },
                },
                {
                  default_value: {
                    kind: 'number_literal',
                    number_value: 1,
                  },
                  name: 'number_1',
                  type: {
                    kind: 'number_type',
                    subtype: undefined,
                  },
                },
                {
                  default_value: {
                    kind: 'number_literal',
                    number_value: 2.5,
                  },
                  name: 'number_2',
                  type: {
                    kind: 'number_type',
                    subtype: undefined,
                  },
                },
                {
                  default_value: {
                    kind: 'number_literal',
                    number_value: 25000000000,
                  },
                  name: 'number_3',
                  type: {
                    kind: 'number_type',
                    subtype: undefined,
                  },
                },
                {
                  default_value: {
                    kind: 'number_literal',
                    number_value: 2.5e-10,
                  },
                  name: 'number_4',
                  type: {
                    kind: 'number_type',
                    subtype: undefined,
                  },
                },
                {
                  default_value: {
                    boolean_value: true,
                    kind: 'boolean_literal',
                  },
                  name: 'boolean_1',
                  type: {
                    kind: 'boolean_type',
                  },
                },
                {
                  default_value: {
                    boolean_value: false,
                    kind: 'boolean_literal',
                  },
                  name: 'boolean_2',
                  type: {
                    kind: 'boolean_type',
                  },
                },
                {
                  default_value: {
                    kind: 'null_literal',
                  },
                  name: 'null_1',
                  type: {
                    kind: 'string_type',
                  },
                },
                {
                  default_value: {
                    kind: 'timestamp_literal',
                    timestamp_value: '2020-01-01 10:00:00',
                  },
                  name: 'timestamp_1',
                  type: {
                    kind: 'timestamp_type',
                    timeframe: undefined,
                  },
                },
                {
                  default_value: {
                    kind: 'timestamp_literal',
                    timestamp_value: '2020-01-01',
                  },
                  name: 'date_1',
                  type: {
                    kind: 'date_type',
                    timeframe: undefined,
                  },
                },
              ],
            },
          ],
          anonymous_queries: [],
        },
      };
      expect(result).toMatchObject(expected);
    });
    test('compile model with private and internal fields', () => {
      const result = compileModel({
        model_url: 'file://test.malloy',
        compiler_needs: {
          table_schemas: [
            {
              connection_name: 'connection',
              name: 'flights',
              schema: {
                fields: [],
              },
            },
          ],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                ##! experimental.parameters
                source: flights is connection.table('flights') extend {
                  private dimension: private_field is 1
                  internal dimension: internal_field is 2
                  public dimension: public_field is 3
                }
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
                    name: 'public_field',
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
    test('compile query with default row limit added', () => {
      const result = compileQuery({
        model_url: 'file://test.malloy',
        default_row_limit: 100,
        query: {
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
        default_row_limit_added: 100,
        result: {
          connection_name: 'connection',
          annotations: [
            {value: '#(malloy) ordered_by = [{ carrier = asc }]\n'},
            {value: '#(malloy) source_name = flights\n'},
          ],
          sql: `SELECT \n\
   base."carrier" as "carrier"
FROM flights as base
GROUP BY 1
ORDER BY 1 asc NULLS LAST
LIMIT 100
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
    test('compile query with default row limit not added', () => {
      const result = compileQuery({
        model_url: 'file://test.malloy',
        default_row_limit: 100,
        query: {
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
                {
                  kind: 'limit',
                  limit: 101,
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
        default_row_limit_added: undefined,
        result: {
          connection_name: 'connection',
          annotations: [
            {value: '#(malloy) limit = 101 ordered_by = [{ carrier = asc }]\n'},
            {value: '#(malloy) source_name = flights\n'},
          ],
          sql: `SELECT \n\
   base."carrier" as "carrier"
FROM flights as base
GROUP BY 1
ORDER BY 1 asc NULLS LAST
LIMIT 101
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
  describe('annotations in schemas', () => {
    test('annotations should be carried through the schema', () => {
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
                    annotations: [{value: '# hello'}],
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
                    annotations: [{value: '# hello'}],
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
    test.todo(
      'locations of annotations should match the location of the table call'
    );
  });
});
