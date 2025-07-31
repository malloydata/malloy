/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import '../../util/db-jest-matchers';
import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';
import {API} from '@malloydata/malloy';
import type * as Malloy from '@malloydata/malloy-interfaces';

const [describe, databases] = describeIfDatabaseAvailable(['duckdb']);

function modelText(databaseName: string): string {
  return `
    ##! experimental.parameters

    source: aircraft_models is ${databaseName}.table('malloytest.aircraft_models') extend {
      primary_key: aircraft_model_code
      measure:
        aircraft_model_count is count(),
        total_seats is sum(seats),
        boeing_seats is sum(seats) { where: manufacturer ? 'BOEING'},
        percent_boeing is boeing_seats / total_seats * 100,
        percent_boeing_floor is floor(boeing_seats / total_seats * 100),
      dimension: seats_bucketed is floor(seats/20)*20.0

      view: by_seats is {
        group_by: num_seats is seats
      }

      view: by_seats_top_1 is {
        group_by: seats
        limit: 1
        order_by: seats desc
      }

      view: by_code is {
        group_by: code is aircraft_model_code
      }

      dimension: some_timestamp is @2025-07-31 12:26:01
    }

    source: aircraft is ${databaseName}.table('malloytest.aircraft') extend {
      primary_key: tail_num
      join_one: aircraft_models with aircraft_model_code
      measure: aircraft_count is count()
      view: by_manufacturer is {
        top: 5
        group_by: aircraft_models.manufacturer
        aggregate: aircraft_count
      }
    }

    query: aircraft_models_by_seats is aircraft_models -> {
      group_by: seats
      where: seats > 2
      limit: 1
    }

    source: aircraft_models_filtered(seats_filter::filter<string>) is aircraft_models extend {
      where: seats ~ seats_filter
    }
  `;
}

function extractData(result: Malloy.RunQueryResponse): unknown {
  expect(result.logs).toBeUndefined();
  expect(result).toMatchObject({result: {data: {}}});
  const fields = result.result!.schema.fields.filter(
    f => f.kind === 'dimension'
  ) as Malloy.DimensionInfo[];
  const data = API.util.dataToSimplifiedJSON(result.result!.data!, {
    kind: 'array_type',
    element_type: {
      kind: 'record_type',
      fields,
    },
  });
  return data;
}

const runtimes = new RuntimeList(databases);
describe.each(runtimes.runtimeList)(
  'Stable Query exhaustive feature tests - %s',
  (databaseName, runtime) => {
    const connection = API.util.wrapLegacyConnection(runtime.connection);
    const fetchers = {
      urls: {
        readURL(url: URL) {
          if (url.toString() === 'file://aircraft.malloy/') {
            return Promise.resolve(modelText(databaseName));
          }
          throw new Error('File missing');
        },
      },
      connections: {
        lookupConnection(name: string) {
          if (name === databaseName) return Promise.resolve(connection);
          throw new Error('Connection missing');
        },
      },
    };

    const needs: Malloy.CompilerNeeds = {};
    beforeAll(async () => {
      const model = await API.asynchronous.compileModel(
        {
          model_url: 'file://aircraft.malloy/',
        },
        fetchers
      );
      needs.translations = model.translations;
    });

    async function testQuery(query: Malloy.Query, data: unknown) {
      // Warm the cache...
      await API.asynchronous._runQueryInternal(
        {
          model_url: 'file://aircraft.malloy/',
          query,
          compiler_needs: needs,
        },
        fetchers
      );
      const result = await API.asynchronous._runQueryInternal(
        {
          model_url: 'file://aircraft.malloy/',
          query,
          compiler_needs: needs,
        },
        fetchers
      );
      const resultWithParsing = await API.asynchronous._runQueryInternal(
        {
          model_url: 'file://aircraft.malloy/',
          query,
          compiler_needs: needs,
          internal_options: {
            serialize_and_parse: true,
          },
        },
        fetchers
      );
      // const loc = Malloy.queryToMalloy(query).split('\n').length;
      // console.log({
      //   time_with_parsing: resultWithParsing.timing_info?.duration_ms,
      //   time_without_parsing: result.timing_info?.duration_ms,
      //   lines_of_code: loc,
      // });
      expect(extractData(result)).toEqual(data);
      expect(extractData(resultWithParsing)).toEqual(data);
    }

    test('query: {kind: arrow}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {kind: 'source_reference', name: 'aircraft_models'},
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {kind: 'field_reference', name: 'seats'},
                  },
                },
                {kind: 'limit', limit: 1},
              ],
            },
          },
        },
        [{seats: 0}]
      );
    });

    test('query: {kind: reference}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'query_reference',
            name: 'aircraft_models_by_seats',
          },
        },
        [{seats: 3}]
      );
    });

    test('query: {kind: refinement}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'refinement',
            base: {
              kind: 'query_reference',
              name: 'aircraft_models_by_seats',
            },
            refinement: {
              kind: 'segment',
              operations: [
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    filter: '> 10',
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
              ],
            },
          },
        },
        [{seats: 11}]
      );
    });

    test('view: {kind: arrow}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'arrow',
              source: {
                kind: 'view_reference',
                name: 'by_seats',
              },
              view: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    field: {
                      expression: {
                        kind: 'field_reference',
                        name: 'num_seats',
                      },
                    },
                  },
                  {
                    kind: 'where',
                    filter: {
                      kind: 'filter_string',
                      filter: '> 10',
                      expression: {
                        kind: 'field_reference',
                        name: 'num_seats',
                      },
                    },
                  },
                  {kind: 'limit', limit: 1},
                ],
              },
            },
          },
        },
        [{num_seats: 11}]
      );
    });

    test('view: {kind: refinement}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'by_seats',
              },
              refinement: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'where',
                    filter: {
                      kind: 'filter_string',
                      filter: '> 10',
                      expression: {
                        kind: 'field_reference',
                        name: 'seats',
                      },
                    },
                  },
                  {kind: 'limit', limit: 1},
                ],
              },
            },
          },
        },
        [{num_seats: 11}]
      );
    });

    test('view: {kind: segment}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {kind: 'limit', limit: 1},
              ],
            },
          },
        },
        [{seats: 0}]
      );
    });

    test('view: {kind: view_reference}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'view_reference',
              name: 'by_seats_top_1',
            },
          },
        },
        [{seats: 660}]
      );
    });

    test('view: {kind: view_reference}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'view_reference',
              name: 'by_seats_top_1',
            },
          },
        },
        [{seats: 660}]
      );
    });

    test('literal_value: {kind: boolean_literal} and expression: {kind: literal_value}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'by_seats',
              },
              refinement: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    name: 'value_true',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'boolean_literal',
                          boolean_value: true,
                        },
                      },
                    },
                  },
                  {
                    kind: 'group_by',
                    name: 'value_false',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'boolean_literal',
                          boolean_value: false,
                        },
                      },
                    },
                  },
                  {kind: 'limit', limit: 1},
                ],
              },
            },
          },
        },
        [{num_seats: 0, value_true: true, value_false: false}]
      );
    });

    test('literal_value: {kind: timestamp_literal}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'by_seats_top_1',
              },
              refinement: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    name: 'value_timestamp',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'timestamp_literal',
                          timestamp_value: '2020-01-01 01:01:01',
                          granularity: 'second',
                        },
                      },
                    },
                  },
                  {
                    kind: 'group_by',
                    name: 'value_minute',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'timestamp_literal',
                          timestamp_value: '2020-01-01 01:01:00',
                          granularity: 'minute',
                        },
                      },
                    },
                  },
                  {
                    kind: 'group_by',
                    name: 'value_hour',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'timestamp_literal',
                          timestamp_value: '2020-01-01 01:00:00',
                          granularity: 'hour',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        [
          {
            seats: 660,
            value_hour: '2020-01-01T01:00:00.000Z',
            value_minute: '2020-01-01T01:01:00.000Z',
            value_timestamp: '2020-01-01T01:01:01.000Z',
          },
        ]
      );
    });

    // TODO how should the timezone be reflected in the result?
    test.skip('literal_value: {kind: timestamp_literal, timezone}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'by_seats_top_1',
              },
              refinement: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    name: 'value_timestamp',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'timestamp_literal',
                          timestamp_value: '2020-01-01 01:01:01',
                          granularity: 'second',
                          timezone: 'America/Los_Angeles',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        [
          {
            seats: 660,
            value_timestamp: '2020-01-01T01:01:01.000Z',
          },
        ]
      );
    });

    test('literal_value: {kind: date_literal}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'by_seats_top_1',
              },
              refinement: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    name: 'value_date',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'date_literal',
                          date_value: '2020-02-02 00:00:00',
                          granularity: 'day',
                        },
                      },
                    },
                  },
                  {
                    kind: 'group_by',
                    name: 'value_week',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'date_literal',
                          date_value: '2020-02-02 00:00:00',
                          granularity: 'week',
                        },
                      },
                    },
                  },
                  {
                    kind: 'group_by',
                    name: 'value_month',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'date_literal',
                          date_value: '2020-02-01 00:00:00',
                          granularity: 'month',
                        },
                      },
                    },
                  },
                  {
                    kind: 'group_by',
                    name: 'value_quarter',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'date_literal',
                          date_value: '2020-01-01 00:00:00',
                          granularity: 'quarter',
                        },
                      },
                    },
                  },
                  {
                    kind: 'group_by',
                    name: 'value_year',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'date_literal',
                          date_value: '2020-01-01 00:00:00',
                          granularity: 'year',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        [
          {
            seats: 660,
            value_date: '2020-02-02T00:00:00.000Z',
            value_month: '2020-02-01T00:00:00.000Z',
            value_quarter: '2020-01-01T00:00:00.000Z',
            value_week: '2020-02-02T00:00:00.000Z',
            value_year: '2020-01-01T00:00:00.000Z',
          },
        ]
      );
    });

    test('literal_value: {kind: filter_expression_literal}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models_filtered',
              parameters: [
                {
                  name: 'seats_filter',
                  value: {
                    kind: 'filter_expression_literal',
                    filter_expression_value: '< 97',
                  },
                },
              ],
            },
            view: {
              kind: 'view_reference',
              name: 'by_seats_top_1',
            },
          },
        },
        [
          {
            seats: 96,
          },
        ]
      );
    });

    test('literal_value: {kind: null_literal} and filter: {kind: literal_equality}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'by_seats_top_1',
              },
              refinement: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'where',
                    filter: {
                      kind: 'literal_equality',
                      expression: {
                        kind: 'field_reference',
                        name: 'seats',
                      },
                      value: {
                        kind: 'null_literal',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        []
      );
    });

    test('literal_value: {kind: number_literal}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'by_seats_top_1',
              },
              refinement: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    name: 'value_integer',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'number_literal',
                          number_value: 42,
                        },
                      },
                    },
                  },
                  {
                    kind: 'group_by',
                    name: 'value_decimal',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'number_literal',
                          number_value: 42.13,
                        },
                      },
                    },
                  },
                  {
                    kind: 'group_by',
                    name: 'value_scientific',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'number_literal',
                          number_value: 1.023e23,
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        [
          {
            seats: 660,
            value_integer: 42,
            value_decimal: 42.13,
            value_scientific: 1.023e23,
          },
        ]
      );
    });

    test('literal_value: {kind: string_literal}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'refinement',
              base: {
                kind: 'view_reference',
                name: 'by_seats_top_1',
              },
              refinement: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    name: 'value_string',
                    field: {
                      expression: {
                        kind: 'literal_value',
                        literal_value: {
                          kind: 'string_literal',
                          string_value: '\'"`hello',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        [
          {
            seats: 660,
            value_string: '\'"`hello',
          },
        ]
      );
    });

    test('view_operation: {kind: aggregate}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'aggregate',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'total_seats',
                    },
                  },
                },
              ],
            },
          },
        },
        [{total_seats: 452415}]
      );
    });

    test('view_operation: {kind: calculate}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {
                  kind: 'calculate',
                  name: 'seats_moving_average',
                  field: {
                    expression: {
                      kind: 'moving_average',
                      field_reference: {
                        name: 'seats',
                      },
                      rows_preceding: 2,
                    },
                  },
                },
                {kind: 'limit', limit: 5},
              ],
            },
          },
        },
        [
          {seats: 0, seats_moving_average: 0},
          {seats: 1, seats_moving_average: 0.5},
          {seats: 2, seats_moving_average: 1},
          {seats: 3, seats_moving_average: 2},
          {seats: 4, seats_moving_average: 3},
        ]
      );
    });

    test('view_operation: {kind: group_by}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {kind: 'limit', limit: 1},
              ],
            },
          },
        },
        [{seats: 0}]
      );
    });

    test('view_operation: {kind: limit}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {kind: 'limit', limit: 4},
              ],
            },
          },
        },
        [{seats: 0}, {seats: 1}, {seats: 2}, {seats: 3}]
      );
    });

    test('view_operation: {kind: drill}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'aircraft_model_code',
                    },
                  },
                },
                {
                  kind: 'drill',
                  filter: {
                    kind: 'literal_equality',
                    expression: {
                      kind: 'field_reference',
                      name: 'code',
                      path: ['by_code'],
                    },
                    value: {
                      kind: 'string_literal',
                      string_value: '0563738',
                    },
                  },
                },
              ],
            },
          },
        },
        [{seats: 0, aircraft_model_code: '0563738'}]
      );
    });

    test('view_operation: {kind: where} and filter: {kind: filter_string}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                    filter: '> 10',
                  },
                },
                {kind: 'limit', limit: 1},
              ],
            },
          },
        },
        [{seats: 11}]
      );
    });

    test('view_operation: {kind: having}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {
                  kind: 'aggregate',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'total_seats',
                    },
                  },
                },
                {
                  kind: 'having',
                  filter: {
                    kind: 'filter_string',
                    expression: {
                      kind: 'field_reference',
                      name: 'total_seats',
                    },
                    filter: '> 10',
                  },
                },
                {kind: 'limit', limit: 1},
              ],
            },
          },
        },
        [{seats: 2, total_seats: 66876}]
      );
    });

    test('view_operation: {kind: order_by}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  name: 'num_seats',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {
                  kind: 'order_by',
                  field_reference: {
                    name: 'num_seats',
                  },
                },
                {kind: 'limit', limit: 2},
              ],
            },
          },
        },
        [{num_seats: 0}, {num_seats: 1}]
      );
    });

    test('view_operation: {kind: order_by} multiple adjacent', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  name: 'num_seats',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'aircraft_model_code',
                    },
                  },
                },
                {
                  kind: 'order_by',
                  field_reference: {
                    name: 'num_seats',
                  },
                },
                {
                  kind: 'order_by',
                  field_reference: {
                    name: 'aircraft_model_code',
                  },
                },
                {kind: 'limit', limit: 2},
              ],
            },
          },
        },
        [
          {num_seats: 0, aircraft_model_code: '0050101'},
          {num_seats: 0, aircraft_model_code: '0050103'},
        ]
      );
    });

    test('view_operation: {kind: order_by, direction: asc}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  name: 'num_seats',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {
                  kind: 'order_by',
                  field_reference: {
                    name: 'num_seats',
                  },
                  direction: 'asc',
                },
                {kind: 'limit', limit: 2},
              ],
            },
          },
        },
        [{num_seats: 0}, {num_seats: 1}]
      );
    });

    test('view_operation: {kind: order_by, direction: desc}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  name: 'num_seats',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {
                  kind: 'order_by',
                  field_reference: {
                    name: 'num_seats',
                  },
                  direction: 'desc',
                },
                {kind: 'limit', limit: 2},
              ],
            },
          },
        },
        [{num_seats: 660}, {num_seats: 550}]
      );
    });

    test('view_operation: {kind: nest}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'nest',
                  view: {
                    definition: {
                      kind: 'view_reference',
                      name: 'by_seats_top_1',
                    },
                  },
                },
              ],
            },
          },
        },
        [{by_seats_top_1: [{seats: 660}]}]
      );
    });

    test('expression: {kind: field_reference}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {kind: 'limit', limit: 1},
              ],
            },
          },
        },
        [{seats: 0}]
      );
    });

    test('expression: {kind: filtered_field}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'aggregate',
                  name: 'total_seats_zero',
                  field: {
                    expression: {
                      kind: 'filtered_field',
                      field_reference: {
                        name: 'total_seats',
                      },
                      where: [
                        {
                          filter: {
                            kind: 'filter_string',
                            filter: '0',
                            expression: {
                              kind: 'field_reference',
                              name: 'seats',
                            },
                          },
                        },
                      ],
                    },
                  },
                },
                {kind: 'limit', limit: 1},
              ],
            },
          },
        },
        [{total_seats_zero: 0}]
      );
    });
    test('expression: {kind: moving_average, rows_following}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft_models',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'seats',
                    },
                  },
                },
                {
                  kind: 'calculate',
                  name: 'seats_moving_average',
                  field: {
                    expression: {
                      kind: 'moving_average',
                      field_reference: {
                        name: 'seats',
                      },
                      rows_preceding: 0,
                      rows_following: 1,
                    },
                  },
                },
                {kind: 'limit', limit: 5},
              ],
            },
          },
        },
        [
          {seats: 0, seats_moving_average: 0.5},
          {seats: 1, seats_moving_average: 1.5},
          {seats: 2, seats_moving_average: 2.5},
          {seats: 3, seats_moving_average: 3.5},
          {seats: 4, seats_moving_average: 4.5},
        ]
      );
    });

    test('expression: {kind: moving_average, partition_fields}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {
              kind: 'source_reference',
              name: 'aircraft',
            },
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'manufacturer',
                      path: ['aircraft_models'],
                    },
                  },
                },
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'aircraft_model_code',
                    },
                  },
                },
                {
                  kind: 'aggregate',
                  field: {
                    expression: {
                      kind: 'field_reference',
                      name: 'aircraft_count',
                    },
                  },
                },
                {
                  kind: 'where',
                  filter: {
                    kind: 'filter_string',
                    filter: '05606KT,0050101,0050103,05626DA,0141104',
                    expression: {
                      kind: 'field_reference',
                      name: 'aircraft_model_code',
                    },
                  },
                },
                {
                  kind: 'calculate',
                  name: 'aircraft_count_moving_average',
                  field: {
                    expression: {
                      kind: 'moving_average',
                      field_reference: {
                        name: 'aircraft_count',
                      },
                      rows_preceding: 0,
                      rows_following: 1,
                      partition_fields: [
                        {
                          name: 'manufacturer',
                        },
                      ],
                    },
                  },
                },
                {kind: 'limit', limit: 5},
                {
                  kind: 'order_by',
                  field_reference: {
                    name: 'manufacturer',
                  },
                  direction: 'asc',
                },
                {
                  kind: 'order_by',
                  field_reference: {
                    name: 'aircraft_model_code',
                  },
                  direction: 'asc',
                },
              ],
            },
          },
        },
        [
          {
            aircraft_count: 1,
            aircraft_count_moving_average: 1,
            aircraft_model_code: '05606KT',
            manufacturer: 'AB SPORTINE AVIACIJA',
          },
          {
            aircraft_count: 1,
            aircraft_count_moving_average: 1.5,
            aircraft_model_code: '0050101',
            manufacturer: 'ADAMS BALLOON',
          },
          {
            aircraft_count: 2,
            aircraft_count_moving_average: 2,
            aircraft_model_code: '0050103',
            manufacturer: 'ADAMS BALLOON',
          },
          {
            aircraft_count: 1,
            aircraft_count_moving_average: 1,
            aircraft_model_code: '05626DA',
            manufacturer: 'ADAMS DAVID',
          },
          {
            aircraft_count: 1,
            aircraft_count_moving_average: 1,
            aircraft_model_code: '0141104',
            manufacturer: 'AERO COMMANDER',
          },
        ]
      );
    });

    test('expression: {kind: time_truncation}', async () => {
      await testQuery(
        {
          definition: {
            kind: 'arrow',
            source: {kind: 'source_reference', name: 'aircraft_models'},
            view: {
              kind: 'segment',
              operations: [
                {
                  kind: 'group_by',
                  field: {
                    expression: {
                      kind: 'time_truncation',
                      field_reference: {
                        name: 'some_timestamp',
                      },
                      truncation: 'day',
                    },
                  },
                },
                {kind: 'limit', limit: 1},
              ],
            },
          },
        },
        [{some_timestamp: '2025-07-31T00:00:00.000Z'}]
      );
    });
  }
);

afterAll(async () => {
  await runtimes.closeAll();
});
