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

import {test} from '@jest/globals';
import * as malloy from '@malloydata/malloy';
import {Query} from '@malloydata/malloy';
import {testModel} from '../../models/faa_model';
import {BigQueryTestConnection, RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable, fStringEq} from '../../util';
import '../../util/db-jest-matchers';

const runtimeList = new RuntimeList(['bigquery']);
const runtime = runtimeList.runtimeMap.get('bigquery');
if (runtime === undefined) {
  throw new Error("Couldn't build runtime");
}
const bq = runtime.connection as BigQueryTestConnection;

function compileQueryFromQueryDef(
  model: malloy.ModelMaterializer,
  query: Query
) {
  return model._loadQueryFromQueryDef(query).getSQL();
}

async function compileQuery(model: malloy.ModelMaterializer, query: string) {
  return await model.loadQuery(query).getSQL();
}

async function runQuery(model: malloy.ModelMaterializer, query: string) {
  return await model.loadQuery(query).run();
}

async function bqCompile(sql: string): Promise<boolean> {
  try {
    await bq.executeSQLRaw(`WITH test AS(\n${sql}) SELECT 1`);
  } catch (e) {
    malloy.Malloy.log.error(`SQL: didn't compile\n=============\n${sql}`);
    throw e;
  }
  return true;
}

const [describe] = describeIfDatabaseAvailable(['bigquery']);

describe('BigQuery expression tests', () => {
  const faa = runtime._loadModelFromModelDef(testModel);

  it('simple_pipeline', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      pipeHead: {name: 'flights_by_carrier'},
      pipeline: [{fields: ['name', 'flight_count'], type: 'reduce'}],
    });
    await bqCompile(sql);
  });

  // EXPLORE flights
  //  ->{
  //       carrier,
  //       flight_count,
  //       routes is { origin_code, destination_code, route_flights is flight_count
  //         ORDER BY route_flights DESC
  //         LIMIT 5 )
  //   | PROJECT
  //       carrier,
  //       routes.origin_code,
  //       routes.route_flights,
  //         flight_count / routes.route_flights as percent_of_carrier_flights
  it('turtle_requery', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      pipeline: [
        // top 5 routes per carrier
        {
          type: 'reduce',
          fields: [
            'carrier',
            'flight_count',
            {
              type: 'turtle',
              name: 'routes',
              pipeline: [
                {
                  type: 'reduce',
                  fields: [
                    'origin_code',
                    'destination_code',
                    'flight_count',
                    {
                      type: 'number',
                      name: 'route_flights',
                      expressionType: 'aggregate',
                      e: [
                        {
                          type: 'aggregate',
                          function: 'count',
                          e: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
          limit: 5,
          orderBy: [{dir: 'desc', field: 'carrier'}],
        },
        // carrier top routes
        {
          type: 'project',
          fields: [
            'carrier',
            'flight_count',
            'routes.origin_code',
            'routes.route_flights',
          ],
        },
      ],
    });
    await bqCompile(sql);
  });

  it('step_0', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      pipeline: [{type: 'reduce', fields: ['carriers.name', 'flight_count']}],
    });
    await bqCompile(sql);
  });

  it('filtered_measures', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      filterList: [
        fStringEq('origin.state', 'CA'),
        fStringEq('destination.state', 'NY'),
      ],
      pipeline: [{type: 'reduce', fields: ['carriers.name', 'flight_count']}],
    });
    await bqCompile(sql);
  });

  it('timestamp', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      pipeline: [
        {
          fields: [
            {
              as: 'dep_year',
              name: 'dep_time',
              timeframe: 'year',
              type: 'timestamp',
            },
            {
              as: 'dep_month',
              name: 'dep_time',
              timeframe: 'month',
              type: 'timestamp',
            },
            {
              as: 'dep_week',
              name: 'dep_time',
              timeframe: 'week',
              type: 'timestamp',
            },
            {
              as: 'dep_date',
              name: 'dep_time',
              timeframe: 'day',
              type: 'timestamp',
            },
            {
              as: 'dep_hour',
              name: 'dep_time',
              timeframe: 'hour',
              type: 'timestamp',
            },
            {
              as: 'dep_minute',
              name: 'dep_time',
              timeframe: 'minute',
              type: 'timestamp',
            },
            {
              as: 'dep_second',
              name: 'dep_time',
              timeframe: 'second',
              type: 'timestamp',
            },
            {
              type: 'number',
              name: 'total_distance_ca',
              expressionType: 'aggregate',
              e: [
                {
                  type: 'filterExpression',
                  filterList: [fStringEq('origin.state', 'CA')],
                  e: [
                    {
                      type: 'aggregate',
                      function: 'sum',
                      e: [{type: 'field', path: 'distance'}],
                    },
                  ],
                },
              ],
            },
          ],
          limit: 20,
          type: 'reduce',
        },
      ],
    });
    await bqCompile(sql);
  });

  it('bucket_test', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      pipeline: [
        {
          fields: [
            {
              bucketFilter: 'AA,WN,DL',
              bucketOther: 'Other Carrier',
              name: 'carrier',
              type: 'string',
            },
            'flight_count',
          ],
          orderBy: [{dir: 'asc', field: 2}],
          type: 'reduce',
        },
      ],
      structRef: 'flights',
    });
    await bqCompile(sql);
  });

  it('flights_by_carrier', async () => {
    const sql = await compileQuery(faa, 'query: flights->flights_by_carrier');
    await bqCompile(sql);
  });

  it('simple_reduce', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      pipeline: [{type: 'reduce', fields: ['carrier', 'flight_count']}],
    });
    await bqCompile(sql);
  });

  it('two_sums', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      pipeline: [
        {
          type: 'reduce',
          fields: [
            {
              type: 'number',
              expressionType: 'aggregate',
              name: 'total_distance',
              e: [
                {
                  type: 'aggregate',
                  function: 'sum',
                  e: [{type: 'field', path: 'distance'}],
                },
              ],
            },
            'aircraft.aircraft_models.total_seats',
          ],
        },
      ],
    });
    await bqCompile(sql);
  });

  it('first_fragment', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      pipeline: [
        {
          type: 'reduce',
          fields: [
            {
              type: 'string',
              name: 'carrier',
              e: ['UPPER(', {type: 'field', path: 'carriers.nickname'}, ')'],
            },
            'flight_count',
          ],
        },
      ],
    });
    await bqCompile(sql);
  });

  it('sum_in_expr', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      pipeline: [
        {
          fields: [
            'carriers.name',
            {
              type: 'number',
              expressionType: 'aggregate',
              name: 'total_distance',
              e: [
                {
                  type: 'aggregate',
                  function: 'sum',
                  e: [{type: 'field', path: 'distance'}],
                },
              ],
            },
          ],
          type: 'reduce',
        },
      ],
    });
    await bqCompile(sql);
  });

  it('filtered_sum_in_expr', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      pipeline: [
        {
          type: 'reduce',
          fields: [
            'aircraft.aircraft_models.manufacturer',
            {
              type: 'number',
              expressionType: 'aggregate',
              name: 'total_distance',
              e: [
                {
                  type: 'filterExpression',
                  filterList: [fStringEq('origin_code', 'SFO')],
                  e: [
                    {
                      type: 'aggregate',
                      function: 'sum',
                      e: [{type: 'field', path: 'distance'}],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    await bqCompile(sql);
  });

  it('dynamic_measure', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      pipeline: [
        {
          type: 'reduce',
          fields: [
            'origin.state',
            'flight_count',
            {
              type: 'number',
              expressionType: 'aggregate',
              name: 'total_distance',
              e: [
                {
                  type: 'filterExpression',
                  filterList: [fStringEq('origin_code', 'SFO')],
                  e: [
                    {
                      type: 'aggregate',
                      function: 'sum',
                      e: [{type: 'field', path: 'distance'}],
                    },
                  ],
                },
              ],
            },
          ],
          filterList: [fStringEq('carriers.code', 'WN')],
        },
      ],
    });
    await bqCompile(sql);
  });

  it('add_filter_to_named_query', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      filterList: [fStringEq('destination_code', 'AL')],
      pipeHead: {name: 'flights_by_city_top_5'},
      pipeline: [],
    });
    await bqCompile(sql);
  });

  it('flights.flights_by_model', async () => {
    const sql = await compileQuery(faa, 'query: flights->flights_by_model');
    await bqCompile(sql);
  });

  it('flights.aircraft_facts_test', async () => {
    const sql = await compileQuery(faa, 'query: flights->aircraft_facts_test');
    await bqCompile(sql);
  });

  it('flights.measures_first', async () => {
    const sql = await compileQuery(faa, 'query:flights->measures_first');
    await bqCompile(sql);
  });

  it('flights.carriers_by_total_engines', async () => {
    const sql = await compileQuery(
      faa,
      'query: flights->carriers_by_total_engines'
    );
    await bqCompile(sql);
  });

  it('flights.first_turtle', async () => {
    const sql = await compileQuery(faa, 'query: flights->first_turtle');
    await bqCompile(sql);
  });

  it('flights.top_5_routes_carriers', async () => {
    const sql = await compileQuery(
      faa,
      'query: flights->top_5_routes_carriers'
    );
    await bqCompile(sql);
  });

  it('flights.new_york_airports', async () => {
    const sql = await compileQuery(faa, 'query: flights->new_york_airports');
    await bqCompile(sql);
  });

  it('flights.flights_by_carrier_with_totals', async () => {
    const sql = await compileQuery(
      faa,
      'query: flights->flights_by_carrier_with_totals'
    );
    await bqCompile(sql);
  });

  it('lotsoturtles', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      pipeline: [
        {
          fields: [
            'origin.state',
            'flight_count',
            'flights_by_model',
            'flights_by_carrier',
            'measures_first',
            'first_turtle',
          ],
          type: 'reduce',
        },
      ],
    });
    await bqCompile(sql);
  });

  it('add_filter_to_def', async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: 'flights',
      filterList: [fStringEq('destination_code', 'AL')],
      pipeHead: {name: 'flights_by_carrier_with_totals'},
      pipeline: [
        {
          type: 'reduce',
          fields: [
            'main.name',
            'main.flight_count',
            {
              name: 'total_flights',
              type: 'number',
              expressionType: 'scalar',
              e: [{type: 'field', path: 'totals.flight_count'}],
            },
          ],
        },
      ],
    });
    await bqCompile(sql);
  });

  it('flights.search_index', async () => {
    const sql = await compileQuery(faa, 'query: flights->search_index');
    await bqCompile(sql);
  });

  it('turtle_turtle_filter', async () => {
    const result = await runQuery(
      faa,
      `
      run: bigquery.table('malloytest.airports')->{
        where: faa_region ? ~'A%'
        order_by: 1
        group_by: faa_region
        aggregate: airport_count is count()
        nest: state is {
          where: state ?'CA'|'NY'
          group_by: state
          nest: code is {
            where: major='Y'
            top: 10
            order_by: 1
            group_by: code
          }
        }
      }
      -> {
        where: state.code.code != null
        group_by: state.code.code
      }
    `
    );
    expect(result.data.value[0]['code']).toBe('ACV');
  });

  it('flights.search_index', async () => {
    const sql = await compileQuery(faa, 'query: flights->search_index');
    await bqCompile(sql);
  });

  it('medicare_test.turtle_city_zip', async () => {
    const sql = await compileQuery(
      faa,
      'query: medicare_test->turtle_city_zip'
    );
    await bqCompile(sql);
  });

  it('medicare_test.triple_turtle', async () => {
    const sql = await compileQuery(faa, 'query: medicare_test->triple_turtle');
    await bqCompile(sql);
  });

  it('medicare_test.rollup_by_location', async () => {
    const sql = await compileQuery(
      faa,
      'query: medicare_test->rollup_by_location'
    );
    await bqCompile(sql);
  });

  it('flights.flights_routes_sessionized', async () => {
    const sql = await compileQuery(
      faa,
      'query: flights->flights_routes_sessionized'
    );
    await bqCompile(sql);
  });

  it('flights.flights_aircraft_sessionized', async () => {
    const sql = await compileQuery(
      faa,
      'query: flights->flights_aircraft_sessionized'
    );
    await bqCompile(sql);
  });

  it('flights.flights_by_manufacturer', async () => {
    const sql = await compileQuery(
      faa,
      'query: flights->flights_by_manufacturer'
    );
    await bqCompile(sql);
  });

  it('flights.flights_by_carrier_2001_2002', async () => {
    const sql = await compileQuery(
      faa,
      'query: flights->flights_by_carrier_2001_2002'
    );
    await bqCompile(sql);
  });

  it('timeframes aliased', async () => {
    const sql = await compileQuery(
      faa,
      `
      query: flights->{
        group_by: mon is dep_time.month
      }
    `
    );
    await bqCompile(sql);
  });

  it('count distinct', async () => {
    const sql = await compileQuery(
      faa,
      `
      query: flights->{
        aggregate: carrier_count is count(carrier)
      }
    `
    );
    // console.log(result.sql);
    await bqCompile(sql);
  });

  it('table_base_on_query', async () => {
    const result = await faa
      ._loadQueryFromQueryDef({
        structRef: 'medicare_state_facts',
        pipeline: [
          {
            type: 'reduce',
            fields: ['provider_state', 'num_providers'],
            orderBy: [{dir: 'desc', field: 2}],
          },
        ],
      })
      .run();
    expect(result.data.value[0]['num_providers']).toBe(296);
  });

  // const faa2: TestDeclaration[] = [

  it('table_base_on_query2', async () => {
    const result = await faa
      ._loadQueryFromQueryDef({
        structRef: {
          type: 'struct',
          name: 'malloy-data.malloytest.bq_medicare_test',
          dialect: 'standardsql',
          as: 'mtest',
          structRelationship: {
            type: 'basetable',
            connectionName: 'bigquery',
          },
          structSource: {
            type: 'table',
            tablePath: 'malloy-data.malloytest.bq_medicare_test',
          },
          fields: [
            {
              type: 'number',
              name: 'c',
              expressionType: 'aggregate',
              e: [{type: 'aggregate', function: 'count', e: []}],
            },
            {
              type: 'turtle',
              name: 'get_count',
              pipeline: [{type: 'reduce', fields: ['c']}],
            },
          ],
        },
        pipeHead: {name: 'get_count'},
        pipeline: [],
      })
      .run();
    expect(result.data.value[0]['c']).toBe(202656);
  });
});

const airportModelText = `
source: airports is bigquery.table('malloy-data.malloytest.airports'){
  primary_key: code
  measure: airport_count is count()

  query: by_fac_type is {
    group_by: fac_type
    aggregate: airport_count
  }

  query: by_state is {
    group_by: state
    aggregate: airport_count
  }

  query: by_county is {
    group_by: county
    aggregate: airport_count
  }
}

query: ca_airports is airports->by_fac_type{ where: state ? 'CA' | 'NY'}
`;

describe('airport_tests', () => {
  let model: malloy.ModelMaterializer;
  beforeAll(async () => {
    model = runtime.loadModel(airportModelText);
  });

  it('airport_count', async () => {
    const result = await runQuery(
      model,
      `
      query: airports->{
        aggregate: a is count()
      }
    `
    );
    expect(result.data.value[0]['a']).toBe(19793);
  });

  it('turtle_from_hell', async () => {
    const result = await runQuery(
      model,
      `
      query: airports-> {
        nest: zero is {
          nest: by_faa_region_i is { where: county ~'I%' and  state != NULL
            group_by: faa_region
            aggregate: airport_count
            nest: by_state is {
              group_by: state
              aggregate: airport_count
              nest: by_county is {
                group_by: county
                aggregate: airport_count
              }
            }
          }
          nest: by_faa_region_Z is { where: county ~'Z%' and state !=NULL
            group_by: faa_region
            aggregate: airport_count
            nest: by_state is {
              group_by: state
              aggregate: airport_count
              nest: by_county is {
                group_by: county
                aggregate: airport_count
              }
            }
          }
        }
      } -> { limit: 1
        select: zero.by_faa_region_Z.by_state.by_county.county
      }

    `
    );
    expect(result.data.value[0]['county']).toBe('ZAVALA');
  });

  it('nested_project', async () => {
    const result = await runQuery(
      model,
      `
    query: airports -> {
      group_by: county
      nest: stuff is {
        select: elevation
        order_by: 1 desc
        limit: 10
      }
      order_by: 1
    } -> {
      select: stuff.elevation
      limit: 1
    }
    `
    );
    expect(result.data.value[0]['elevation']).toBe(1836);
  });

  it('nested_sums', async () => {
    const result = await runQuery(
      model,
      `
      query: airports->{
        aggregate: airport_count
        nest: by_state is {
          group_by: state
          aggregate: airport_count
          nest: by_fac_type is {
            group_by: fac_type
            aggregate: airport_count
          }
        }
      } -> {
        group_by: airport_count
        aggregate:
          sum_state is by_state.sum(by_state.airport_count),
          sum_fac is by_state.by_fac_type.sum(by_state.by_fac_type.airport_count)
      }
    `
    );
    // console.log(result.sql);
    expect(result.data.value[0]['sum_state']).toBe(19793);
    expect(result.data.value[0]['sum_fac']).toBe(19793);
  });

  it('pipeline_as_declared_turtle', async () => {
    const result = await runQuery(
      model,
      `
        source: my_airports is airports {
          query: pipe_turtle is {
            aggregate: a is airport_count
          } -> {
            select: a
          }
        }
        query: my_airports->pipe_turtle
    `
    );
    expect(result.data.value[0]['a']).toBe(19793);
  });

  it('pipeline Turtle', async () => {
    const result = await runQuery(
      model,
      `
      run: bigquery.table('malloytest.airports')->{
        aggregate: airport_count is count()
        nest: pipe_turtle is {
          group_by:
            state
            county
          aggregate: a is count()
        } -> {
          select:
            state is upper(state)
            a
        } -> {
          group_by: state
          aggregate: total_airports is a.sum()
        }
      }
      `
    );

    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result.data.value[0] as any).pipe_turtle[0].total_airports
    ).toBe(1845);
  });

  it.skip('crossjoined turtles', async () => {
    // const result = await runQuery(model,`
    //     explore airports
    //    ->{
    //       top_seaplane is { limit 5 : [fac_type: 'SEAPLANE BASE']
    //         state
    //         airport_count
    //       )
    //       by_state is {
    //         state
    //         airport_count
    //       )
    //     | project : [top_seaplane.state = by_state.state]
    //       by_state.*
    // `);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // expect((result.data.value[0] as any).pipe_turtle[0].total_airports).toBe(1845);
  });

  it.skip('crossjoined turtles as turtle', async () => {
    // const result = await runQuery(model,`
    //     explore airports
    //    ->{
    //       airport_count
    //       tp is {
    //         top_seaplane is { limit 5 : [fac_type: 'SEAPLANE BASE']
    //           state
    //           airport_count
    //         )
    //         by_state is {
    //           state
    //           airport_count
    //         )
    //       | project : [top_seaplane.state = by_state.state]
    //         by_state.*
    //       )
    // `);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // expect((result.data.value[0] as any).pipe_turtle[0].total_airports).toBe(1845);
  });

  it('string_expressions', async () => {
    const result = await runQuery(
      model,
      `
      query: airports->{
        group_by: lower_state is lower(state)
        order_by: 1 DESC
        limit: 10
      }
    `
    );
    expect(result.data.value[0]['lower_state']).toBe('wy');
  });

  it('half_count', async () => {
    const result = await runQuery(
      model,
      `
      query: airports->{
        aggregate: half is airport_count/2.0
      }
    `
    );
    expect(result.data.value[0]['half']).toBe(9896.5);
  });
});

describe('sql injection tests', () => {
  const model = runtime._loadModelFromModelDef(testModel);
  jest.setTimeout(100000);

  test('string literal escapes quotes', async () => {
    const result = await runQuery(
      model,
      `
      run: bigquery.table('malloytest.state_facts')->{ group_by: test is 'foo\\''
      }
    `
    );
    expect(result.data.value[0]['test']).toBe("foo'");
  });

  test('string filter escapes quotes', async () => {
    const result = await runQuery(
      model,
      `
      run: bigquery.table('malloytest.state_facts')->{ aggregate: test is count() { where: state ? 'foo\\'' } }
    `
    );
    expect(result.data.value[0]['test']).toBe(0);
  });

  test('string literal escapes backslashes', async () => {
    const result = await runQuery(
      model,
      `
      run: bigquery.table('malloytest.state_facts')->{ group_by: test is 'foo\\\\\\''
      }
    `
    );
    expect(result.data.value[0]['test']).toBe("foo\\'");
  });

  test('string filter escapes backslashes', async () => {
    const result = await runQuery(
      model,
      `
      run: bigquery.table('malloytest.state_facts')->{ aggregate: test is count() { where: state ? 'foo\\\\\\'' }}
    `
    );
    expect(result.data.value[0]['test']).toBe(0);
  });

  test('comment in string', async () => {
    const result = await runQuery(
      model,
      `
      run: bigquery.table('malloytest.state_facts')->{ group_by: test is 'foo \\\\'--'
      }
    `
    );
    expect(result.data.value[0]['test']).toBe('foo \\');
  });

  test('comment in string filter', async () => {
    let error;
    try {
      await runQuery(
        model,
        `
        run: bigquery.table('malloytest.state_facts')->{ aggregate: test is count() { where: state ? 'foo \\\\' THEN 0 else 1 END) as test--'
        }}      `
      );
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeUndefined();
  });

  test.todo("'malloytest\\'.tables' produces the wrong error...");

  test('comment in literal', async () => {
    const result = await runQuery(
      model,
      `
      query: flights->{ group_by: test is 'foo \\\\'--'
      }
    `
    );
    expect(result.data.value[0]['test']).toBe('foo \\');
  });
});

describe('unsupported type tests', () => {
  it('can read unsupported types in schema', async () => {
    const result = await runtime
      .loadQuery(
        `run:
          bigquery.sql("SELECT ST_GEOGFROMTEXT('LINESTRING(1 2, 3 4)') as geo")
          -> { select: geo }
      `
      )
      .run();
    expect(result.data.value[0]['geo']).toBeDefined();
  });
});
