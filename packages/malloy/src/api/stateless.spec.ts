/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  compileModel,
  compileQuery,
  compileSource,
  extractSourceDependencies,
} from './stateless';
import type * as Malloy from '@malloydata/malloy-interfaces';

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

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
  test('compile and get source annotations', () => {
    const result = compileQuery({
      model_url: 'file://test.malloy',
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
            contents: `
              # cool_source_annotation
              source: flights is connection.table('flights')
            `,
          },
        ],
        connections: [{name: 'connection', dialect: 'duckdb'}],
      },
    });
    const expected: DeepPartial<Malloy.CompileQueryResponse> = {
      result: {
        source_annotations: [{value: '# cool_source_annotation\n'}],
      },
    };
    expect(result).toMatchObject(expected);
  });
  test('source annotations from composite slice and composite are selected', () => {
    const result = compileQuery({
      model_url: 'file://test.malloy',
      query: {
        definition: {
          kind: 'arrow',
          source: {kind: 'source_reference', name: 'flights_cube'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'group_by',
                field: {
                  expression: {kind: 'field_reference', name: 'x'},
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
            contents: `
              ##! experimental.composite_sources
              source: flights is connection.table('flights')

              # slice_one
              source: slice_one is flights

              # slice_two
              source: slice_two is flights extend {
                dimension: x is 1
              }

              # composite
              source: flights_cube is compose(slice_one, slice_two)
            `,
          },
        ],
        connections: [{name: 'connection', dialect: 'duckdb'}],
      },
    });
    const expected: DeepPartial<Malloy.CompileQueryResponse> = {
      result: {
        source_annotations: [
          {value: '# composite\n'},
          {value: '# slice_two\n'},
        ],
      },
    };
    expect(result).toMatchObject(expected);
  });
  test('source annotations from nested composite slices and composite are selected', () => {
    const result = compileQuery({
      model_url: 'file://test.malloy',
      query: {
        definition: {
          kind: 'arrow',
          source: {kind: 'source_reference', name: 'flights_cube'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'group_by',
                field: {
                  expression: {kind: 'field_reference', name: 'x'},
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
            contents: `
                ##! experimental.composite_sources
                source: flights is connection.table('flights')

                # slice_one
                source: slice_one is flights

                # slice_two
                source: slice_two is flights

                # slice_three
                source: slice_three is flights extend {
                  dimension: x is 1
                }

                # nested_composite
                source: slices_two_and_three is compose(slice_two, slice_three)

                # composite
                source: flights_cube is compose(
                  slice_one,
                  slices_two_and_three
                )
              `,
          },
        ],
        connections: [{name: 'connection', dialect: 'duckdb'}],
      },
    });
    const expected: DeepPartial<Malloy.CompileQueryResponse> = {
      result: {
        source_annotations: [
          {value: '# composite\n'},
          {value: '# nested_composite\n'},
          {value: '# slice_three\n'},
        ],
      },
    };
    expect(result).toMatchObject(expected);
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
  describe('extract sql artifact dependencies from a source', () => {
    test('extended source with a single table dependency', () => {
      const flightsTable: Malloy.SQLTable = {
        connection_name: 'connection',
        name: 'flights',
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'origin',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'destination',
              type: {kind: 'string_type'},
            },
          ],
        },
      };

      const result = extractSourceDependencies({
        model_url: 'file://test.malloy',
        source_name: 'flights',
        compiler_needs: {
          table_schemas: [flightsTable],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                source: flights is connection.table('flights') extend {
                  rename: start is origin
                  except: carrier
                  where: destination = 'ohio'
                  dimension:
                    one is 1
                    two is destination
                    three is two
                    four is concat(two, '-', three)
                    trip is concat(start, '-', destination)
                }
              `,
            },
          ],
          connections: [{name: 'connection', dialect: 'presto'}],
        },
      });
      const expected: Malloy.ExtractSourceDependenciesResponse = {
        sql_sources: [
          {
            name: 'flights',
            columns: [{name: 'destination'}, {name: 'origin'}],
            filters: [],
          },
        ],
      };

      expect(result).toMatchObject(expected);
    });
    test('source with a sql query dependency', () => {
      const sql = 'SELECT carrier FROM flights';
      const carrierSQL: Malloy.SQLQuery = {
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
      };

      const result = extractSourceDependencies({
        model_url: 'file://test.malloy',
        source_name: 'sql_source',
        compiler_needs: {
          sql_schemas: [carrierSQL],
          connections: [{name: 'connection', dialect: 'presto'}],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                source: sql_source is connection.sql('SELECT carrier FROM flights')
              `,
            },
          ],
        },
      });

      const expected: Malloy.ExtractSourceDependenciesResponse = {
        sql_sources: [
          {
            sql,
            columns: [{name: 'carrier'}],
            filters: [],
          },
        ],
      };

      expect(result).toMatchObject(expected);
    });
    test('source with join', () => {
      const flightsTable: Malloy.SQLTable = {
        connection_name: 'connection',
        name: 'flights',
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'origin',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'destination',
              type: {kind: 'string_type'},
            },
          ],
        },
      };

      const sql = 'SELECT carrier, year_founded FROM carriers';
      const carrierSQL: Malloy.SQLQuery = {
        connection_name: 'connection',
        sql,
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'year_founded',
              type: {kind: 'number_type'},
            },
          ],
        },
      };

      const result = extractSourceDependencies({
        model_url: 'file://test.malloy',
        source_name: 'flights_with_carrier_dim',
        compiler_needs: {
          table_schemas: [flightsTable],
          sql_schemas: [carrierSQL],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                source: flights is connection.table('flights')
                source: carriers is connection.sql('${sql}')

                source: flights_with_carrier_dim is flights extend {
                  join_many: carriers on carrier = carriers.carrier
                }
              `,
            },
          ],
          connections: [{name: 'connection', dialect: 'presto'}],
        },
      });

      const expected: Malloy.ExtractSourceDependenciesResponse = {
        sql_sources: [
          {
            name: 'flights',
            columns: [
              {name: 'carrier'},
              {name: 'origin'},
              {name: 'destination'},
            ],
            filters: [],
          },
          {
            sql,
            columns: [{name: 'carrier'}, {name: 'year_founded'}],
          },
        ],
      };

      expect(result).toMatchObject(expected);
    });
    test('source with pipeline', () => {
      const flightsTable: Malloy.SQLTable = {
        connection_name: 'connection',
        name: 'flights',
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'origin',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'destination',
              type: {kind: 'string_type'},
            },
          ],
        },
      };

      const result = extractSourceDependencies({
        model_url: 'file://test.malloy',
        source_name: 'derived3',
        compiler_needs: {
          table_schemas: [flightsTable],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                source: flights is connection.table('flights')

                source: derived is flights -> {select: origin, destination} extend {
                  dimension: trip is concat(origin, '-', destination)
                }

                source: derived2 is flights -> {group_by: origin}

                source: derived3 is flights -> {select: start is origin, destination \n where: carrier = 'UA'} -> {select: start, destination } extend {
                  except: destination
                }

              `,
            },
          ],
          connections: [{name: 'connection', dialect: 'presto'}],
        },
      });

      const expected: Malloy.ExtractSourceDependenciesResponse = {
        sql_sources: [
          {
            name: 'flights',
            columns: [{name: 'origin'}, {name: 'destination'}],
            filters: [],
          },
        ],
      };

      expect(result).toMatchObject(expected);
    });
    test('composite source', () => {
      const flightsTable: Malloy.SQLTable = {
        connection_name: 'connection',
        name: 'flights',
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'origin',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'destination',
              type: {kind: 'string_type'},
            },
          ],
        },
      };

      const _result = extractSourceDependencies({
        model_url: 'file://test.malloy',
        source_name: 'flights',
        compiler_needs: {
          table_schemas: [flightsTable],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                ##! experimental { composite_sources }

                source: flights is connection.table('flights') -> {
                  group_by: carrier
                  aggregate: flights_by_carrier is count()
                }

                source: flights2 is flights extend {
                  measure: total_flights is flights_by_carrier.sum()
                }

                source: composite is compose(flights, flights2)
                source: composite2 is compose(flights, composite)
              `,
            },
          ],
          connections: [{name: 'connection', dialect: 'presto'}],
        },
      });
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
