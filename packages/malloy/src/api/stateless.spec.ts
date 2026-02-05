/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {parseTag} from '@malloydata/malloy-tag';
import {compileModel, compileQuery, compileSource} from './stateless';
import type * as Malloy from '@malloydata/malloy-interfaces';
import {extractMalloyObjectFromTag} from '../to_stable';

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
    test('compile model exclude references', () => {
      const result = compileModel({
        model_url: 'file://test.malloy',
        exclude_references: true,
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
                source: flights is connection.table('flights') extend {
                  view: by_carrier is {
                    group_by: carrier
                    aggregate: flight_count is count()
                  }
                }
              `,
            },
          ],
          connections: [{name: 'connection', dialect: 'duckdb'}],
        },
      });
      expect(result.translations?.length).toBe(1);
      const modelDef = JSON.parse(result.translations![0].compiled_model_json!);
      expect(modelDef.references).toBe(undefined);
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
                    kind: 'date_literal',
                    date_value: '2020-01-01',
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
            {value: '#(malloy) drillable ordered_by = [{ carrier = asc }]\n'},
            {value: '#(malloy) source.name = flights\n'},
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
    test('compile query from query string', () => {
      const result = compileQuery({
        model_url: 'file://test.malloy',
        query_malloy: 'run: flights -> { group_by: carrier }',
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
            {value: '#(malloy) drillable ordered_by = [{ carrier = asc }]\n'},
            {value: '#(malloy) source.name = flights\n'},
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
            {
              value:
                '#(malloy) limit = 101 drillable ordered_by = [{ carrier = asc }]\n',
            },
            {value: '#(malloy) source.name = flights\n'},
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
    describe('drilling', () => {
      test('has enough info to produce valid drill', () => {
        const result = compileQuery({
          model_url: 'file://test.malloy',
          query: {
            definition: {
              kind: 'arrow',
              source: {kind: 'source_reference', name: 'flights'},
              view: {
                kind: 'view_reference',
                name: 'dashboard',
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
                  source: flights is connection.table('flights') extend {
                    view: by_carrier is {
                      group_by: carrier
                      group_by: expression is 1
                      aggregate: flight_count is count()
                    }
                    view: pipeline is {
                      group_by: carrier
                    } -> { select: * }
                    view: dashboard is {
                      group_by: carrier
                      group_by: expression is 1
                      nest: by_carrier
                      nest: by_carrier_2 is {
                        group_by: carrier
                        group_by: expression is 1
                        aggregate: flight_count is count()
                      }
                      nest: pipeline
                      nest: pipeline_2 is {
                        group_by: carrier
                      } -> { select: * }
                    }
                  }
                `,
              },
            ],
            connections: [{name: 'connection', dialect: 'duckdb'}],
          },
        });
        const expected: Malloy.CompileQueryResponse = {
          result: {
            connection_name: 'connection',
            schema: {
              fields: [
                {
                  kind: 'dimension',
                  name: 'carrier',
                  type: {kind: 'string_type'},
                },
                {
                  kind: 'dimension',
                  name: 'expression',
                  type: {kind: 'number_type', subtype: 'integer'},
                },
                {
                  kind: 'dimension',
                  name: 'by_carrier',
                  type: {
                    kind: 'array_type',
                    element_type: {
                      kind: 'record_type',
                      fields: [
                        {
                          name: 'carrier',
                          type: {kind: 'string_type'},
                        },
                        {
                          name: 'expression',
                          type: {kind: 'number_type', subtype: 'integer'},
                        },
                        {
                          name: 'flight_count',
                          type: {kind: 'number_type', subtype: 'integer'},
                        },
                      ],
                    },
                  },
                },
                {
                  kind: 'dimension',
                  name: 'by_carrier_2',
                  type: {
                    kind: 'array_type',
                    element_type: {
                      kind: 'record_type',
                      fields: [
                        {
                          name: 'carrier',
                          type: {kind: 'string_type'},
                        },
                        {
                          name: 'expression',
                          type: {kind: 'number_type', subtype: 'integer'},
                        },
                        {
                          name: 'flight_count',
                          type: {kind: 'number_type', subtype: 'integer'},
                        },
                      ],
                    },
                  },
                },
                {
                  kind: 'dimension',
                  name: 'pipeline',
                  type: {
                    kind: 'array_type',
                    element_type: {
                      kind: 'record_type',
                      fields: [
                        {
                          name: 'carrier',
                          type: {kind: 'string_type'},
                        },
                      ],
                    },
                  },
                },
                {
                  kind: 'dimension',
                  name: 'pipeline_2',
                  type: {
                    kind: 'array_type',
                    element_type: {
                      kind: 'record_type',
                      fields: [
                        {
                          name: 'carrier',
                          type: {kind: 'string_type'},
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        };
        expect(result).toMatchObject(expected);
        const carrier = result.result?.schema.fields[0];
        expect(drillExpressionFor(carrier)).toMatchObject({
          kind: 'field_reference',
          name: 'carrier',
          path: ['dashboard'],
        });
        const expression = result.result?.schema.fields[1];
        const expressionTag = tagFor(expression);
        expect(expressionTag?.text('drill_expression', 'code')).toBe('1');
        const byCarrier = result.result?.schema.fields[2];
        const byCarrierTag = tagFor(byCarrier);
        expect(byCarrierTag?.has('drillable')).toBe(true);
        const pipeline = result.result?.schema.fields[4];
        const pipelineTag = tagFor(pipeline);
        expect(pipelineTag?.has('drillable')).toBe(false);
        const resultTag = tagFor(result.result);
        expect(resultTag?.has('drillable')).toBe(true);
      });
      test('no source filters in output', () => {
        const result = compileQuery({
          model_url: 'file://test.malloy',
          query: {
            definition: {
              kind: 'arrow',
              source: {kind: 'source_reference', name: 'flights'},
              view: {
                kind: 'view_reference',
                name: 'by_carrier',
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
                  ##! experimental.drill
                  source: flights is connection.table('flights') extend {
                    where: carrier = 'WN'
                      and true
                    view: by_carrier is {
                      group_by: carrier
                      aggregate: flight_count is count()
                    }
                  }
                `,
              },
            ],
            connections: [{name: 'connection', dialect: 'duckdb'}],
          },
        });
        const expected: Malloy.CompileQueryResponse = {
          result: {
            'connection_name': 'connection',
            'schema': {
              fields: [
                {
                  kind: 'dimension',
                  name: 'carrier',
                  type: {kind: 'string_type'},
                },
                {
                  kind: 'dimension',
                  name: 'flight_count',
                  type: {kind: 'number_type'},
                },
              ],
            },
            'annotations': [
              {
                value:
                  '#(malloy) drillable ordered_by = [{ flight_count = desc }]\n',
              },
              {
                value: '#(malloy) source.name = flights\n',
              },
              {
                value: '#(malloy) query_name = by_carrier\n',
              },
            ],
          },
        };
        expect(result).toMatchObject(expected);
      });
    });
    test('coalesce across joined sources', () => {
      const result = compileQuery({
        model_url: 'file://test.malloy',
        query_malloy: `
          run: flights -> {
            select:
              result1 is flight_id ?? airports.city ?? carriers.name
          }
        `,
        compiler_needs: {
          table_schemas: [
            {
              connection_name: 'duckdb',
              name: 'malloytest.airports',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'code',
                    type: {kind: 'string_type'},
                  },
                  {
                    kind: 'dimension',
                    name: 'city',
                    type: {kind: 'string_type'},
                  },
                ],
              },
            },
            {
              connection_name: 'duckdb',
              name: 'malloytest.carriers',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'code',
                    type: {kind: 'string_type'},
                  },
                  {
                    kind: 'dimension',
                    name: 'name',
                    type: {kind: 'string_type'},
                  },
                ],
              },
            },
            {
              connection_name: 'duckdb',
              name: 'malloytest.flights',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'id2',
                    type: {kind: 'string_type'},
                  },
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
                ],
              },
            },
          ],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                source: airports is duckdb.table('malloytest.airports') extend {
                  primary_key: code
                  dimension: key is code
                  dimension: other_data is city
                }
                source: carriers is duckdb.table('malloytest.carriers') extend {
                  primary_key: code
                }
                source: flights is duckdb.table('malloytest.flights') extend {
                  dimension: flight_id is id2
                  join_one: airports on airports.key = origin
                  join_one: carriers on carriers.code = carrier
                }
              `,
            },
          ],
          connections: [{name: 'duckdb', dialect: 'duckdb'}],
        },
      });

      expect(result.compiler_needs).toBeUndefined();
      // Assert no errors and that we got a result with SQL
      expect(result.logs).toBeUndefined();
      expect(result.result).toBeDefined();
      expect(result.result?.sql).toBeDefined();
      expect(result.result?.connection_name).toBe('duckdb');
      expect(result.result?.sql).toContain('LEFT JOIN malloytest.airports');
      expect(result.result?.sql).toContain('LEFT JOIN malloytest.carriers');
      expect(result.result?.sql).toContain(
        'COALESCE((COALESCE((base."id2"),airports_0."city")),carriers_0."name")'
      );
    });
    test('coalesce with literal null across joined sources', () => {
      const result = compileQuery({
        model_url: 'file://test.malloy',
        query_malloy: `
          run: flights -> {
            select:
              result1 is null ?? airports.city
          }
        `,
        compiler_needs: {
          table_schemas: [
            {
              connection_name: 'duckdb',
              name: 'malloytest.airports',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'code',
                    type: {kind: 'string_type'},
                  },
                  {
                    kind: 'dimension',
                    name: 'city',
                    type: {kind: 'string_type'},
                  },
                ],
              },
            },
            {
              connection_name: 'duckdb',
              name: 'malloytest.flights',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'id2',
                    type: {kind: 'string_type'},
                  },
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
                ],
              },
            },
          ],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                source: airports is duckdb.table('malloytest.airports') extend {
                  primary_key: code
                  dimension: key is code
                  dimension: other_data is city
                }
                source: flights is duckdb.table('malloytest.flights') extend {
                  dimension: flight_id is id2
                  join_one: airports on airports.key = origin
                }
              `,
            },
          ],
          connections: [{name: 'duckdb', dialect: 'duckdb'}],
        },
      });

      expect(result.compiler_needs).toBeUndefined();
      expect(result.logs).toBeUndefined();
      expect(result.result).toBeDefined();
      expect(result.result?.sql).toBeDefined();
      expect(result.result?.connection_name).toBe('duckdb');
      expect(result.result?.sql).toContain('LEFT JOIN malloytest.airports');
      expect(result.result?.sql).toContain('airports_0."city"');
    });
    test('coalesce with parameter and constant', () => {
      const result = compileQuery({
        model_url: 'file://test.malloy',
        query_malloy: `
          run: flights(my_param is "some_value") -> {
            select:
              result1 is param_field ?? "default_value"
          }
        `,
        compiler_needs: {
          table_schemas: [
            {
              connection_name: 'duckdb',
              name: 'malloytest.flights',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'id2',
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
                source: flights(my_param::string is "default_value") is duckdb.table('malloytest.flights') extend {
                  dimension: param_field is my_param
                }
              `,
            },
          ],
          connections: [{name: 'duckdb', dialect: 'duckdb'}],
        },
      });

      expect(result.compiler_needs).toBeUndefined();
      expect(result.logs).toBeUndefined();
      expect(result.result).toBeDefined();
      expect(result.result?.sql).toBeDefined();
      expect(result.result?.connection_name).toBe('duckdb');
      expect(result.result?.sql).toContain(
        "COALESCE(('some_value'),'default_value')"
      );
    });
    test('coalesce with parameter and field', () => {
      const result = compileQuery({
        model_url: 'file://test.malloy',
        query_malloy: `
          run: flights -> {
            select:
              result1 is param_field ?? carrier
          }
        `,
        compiler_needs: {
          table_schemas: [
            {
              connection_name: 'duckdb',
              name: 'malloytest.flights',
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
                source: flights(my_param::string is "default_value") is duckdb.table('malloytest.flights') extend {
                  dimension: param_field is my_param
                }
              `,
            },
          ],
          connections: [{name: 'duckdb', dialect: 'duckdb'}],
        },
      });

      expect(result.compiler_needs).toBeUndefined();
      expect(result.logs).toBeUndefined();
      expect(result.result).toBeDefined();
      expect(result.result?.sql).toBeDefined();
      expect(result.result?.connection_name).toBe('duckdb');
      expect(result.result?.sql).toContain(
        'COALESCE((\'default_value\'),base."carrier")'
      );
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
  describe('timing_info', () => {
    test('compile model timing info', () => {
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
      expect(result).toMatchObject({
        timing_info: {
          name: 'compile_model',
          duration_ms: expect.any(Number),
          detailed_timing: [
            {
              name: 'parse_malloy',
              duration_ms: expect.any(Number),
            },
            {
              name: 'generate_ast',
              duration_ms: expect.any(Number),
              detailed_timing: [
                {
                  name: 'parse_compiler_flags',
                  duration_ms: expect.any(Number),
                },
              ],
            },
            {
              name: 'compile_malloy',
              duration_ms: expect.any(Number),
            },
          ],
        },
      });
    });
  });
  test('compile query', () => {
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
    expect(result).toMatchObject({
      timing_info: {
        name: 'compile_query',
        duration_ms: expect.any(Number),
        detailed_timing: [
          {
            name: 'compile_model',
            duration_ms: expect.any(Number),
            detailed_timing: [
              {
                name: 'parse_malloy',
                duration_ms: expect.any(Number),
              },
              {
                name: 'generate_ast',
                duration_ms: expect.any(Number),
                detailed_timing: [
                  {
                    name: 'parse_compiler_flags',
                    duration_ms: expect.any(Number),
                  },
                ],
              },
              {
                name: 'compile_malloy',
                duration_ms: expect.any(Number),
              },
            ],
          },
          {
            name: 'parse_compiler_flags',
            duration_ms: expect.any(Number),
          },
          {
            name: 'parse_malloy',
            duration_ms: expect.any(Number),
          },
          {
            name: 'generate_ast',
            duration_ms: expect.any(Number),
            detailed_timing: [
              {
                name: 'parse_compiler_flags',
                duration_ms: expect.any(Number),
              },
            ],
          },
          {
            name: 'compile_malloy',
            duration_ms: expect.any(Number),
          },
          {
            name: 'generate_sql',
            duration_ms: expect.any(Number),
          },
        ],
      },
    });
  });
});

interface HasAnnotations {
  annotations?: Malloy.Annotation[] | undefined;
}

function tagFor(field: HasAnnotations | undefined) {
  return parseTag(
    field?.annotations
      ?.filter(a => a.value.startsWith('#(malloy) '))
      .map(a => a.value) ?? []
  ).tag;
}

function drillExpressionFor(field: HasAnnotations | undefined) {
  const tag = tagFor(field)?.tag('drill_expression');
  if (tag === undefined) return undefined;
  return extractMalloyObjectFromTag(tag, 'Expression');
}
