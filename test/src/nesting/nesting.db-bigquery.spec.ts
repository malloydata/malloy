/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import {bqCompile, compileQuery} from '../bigquery/bigquery_compile';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import type * as malloy from '@malloydata/malloy';
import {testModel} from '../models/faa_model';

afterAll(() => testDatabase.shutdown());

describe('Used to be hand-written queries tests', () => {
  const makeModel = () => `
      source: aircraft_models is db.table('malloytest.aircraft_models') extend {
        measure: model_count is count()
        measure: total_seats is seats.sum()
        measure: boeing_seats is seats.sum() { where: manufacturer = 'BOEING' }
        measure: percent_boeing is (boeing_seats / total_seats) * 100
        measure: percent_boeing_floor is floor(percent_boeing)
        primary_key: aircraft_model_code
      }

      source: aircraft is db.table('malloytest.aircraft') extend {
        measure: aircraft_count is count()

        view: hand_turtle is { aggregate: aircraft_count }

        view: hand_turtle_pipeline is {
          aggregate: aircraft_count
        } -> {
          group_by: aircraft_count
        }

        join_one: aircraft_models
          on aircraft_model_code = aircraft_models.aircraft_model_code

        primary_key: tail_num
      }
    `;

  // BigQuery tests only on the Hand Coded models.
  const testModel = wrapTestModel(testDatabase, makeModel());

  it('hand turtle2', async () => {
    await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        nest: my_turtle is {
          group_by: county
          aggregate: aircraft_count
        }
      }
    `).toMatchResult(testModel, {aircraft_count: 367});
  });

  it('hand turtle3', async () => {
    await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        nest: hand_turtle
      }
    `).toMatchResult(testModel, {aircraft_count: 367});
  });

  it('hand: turtle is pipeline', async () => {
    await expect(`
      run: aircraft -> {
        aggregate: aircraft_count
        nest: pipe is {
          group_by: state, county
          aggregate: aircraft_count
        } -> {
          where: county ~ '2%'
          group_by: state
          aggregate: total_aircraft is aircraft_count.sum()
        }
      }
    `).toMatchPaths(testModel, {'pipe.total_aircraft': 61});
  });
});

async function runQuery(model: malloy.ModelMaterializer, query: string) {
  return await model.loadQuery(query).run();
}

const airportModelText = `
source: airports is db.table('malloydata-org.malloytest.airports') extend {
  primary_key: code
  measure: airport_count is count()

  view: by_fac_type is {
    group_by: fac_type
    aggregate: airport_count
  }

  view: by_state is {
    group_by: state
    aggregate: airport_count
  }

  view: by_county is {
    group_by: county
    aggregate: airport_count
  }
}

query: ca_airports is airports->by_fac_type + { where: state ? 'CA' | 'NY'}
`;

describe('BigQuery expression tests', () => {
  const faa = testDatabase.runtime.loadModel(testModel);

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
    const sql = await compileQuery(
      faa,
      `
      run: flights -> {
        group_by: carrier
        aggregate: flight_count
        nest: routes is {
          group_by:
            origin_code
            destination_code
          aggregate: flight_count
          aggregate: route_flights is count()
        }
        limit: 5
        order_by: carrier desc
      } -> {
        select:
          carrier
          flight_count
          routes.origin_code
          routes.route_flights
      }
      `
    );
    bqCompile(sql);
  });

  it('lotsoturtles', async () => {
    const sql = await compileQuery(
      faa,
      `
        run: flights -> {
          group_by: origin.state
          aggregate: flight_count
          nest:
            flights_by_model
            flights_by_carrier
            measures_first
            first_turtle
        }
      `
    );
    await bqCompile(sql);
  });

  it('turtle_turtle_filter', async () => {
    const result = await runQuery(
      faa,
      `
      run: db.table('malloytest.airports')->{
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
        where: state.code.code is not null
        group_by: state.code.code
      }
    `
    );
    expect(result.data.value[0]['code']).toBe('ACV');
  });
});

describe('airport_tests', () => {
  let model: malloy.ModelMaterializer;
  const airportTestModel = wrapTestModel(testDatabase, airportModelText);
  beforeAll(async () => {
    model = testDatabase.runtime.loadModel(airportModelText);
  });

  it('turtle_from_hell', async () => {
    const result = await runQuery(
      model,
      `
      run: airports-> {
        nest: zero is {
          nest: by_faa_region_i is { where: county ~'I%' and  state is not null
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
    await expect(`
      run: airports -> {
        group_by: county
        nest: stuff is {
          group_by: elevation
          order_by: 1 desc
          limit: 10
        }
        order_by: 1
        limit: 1
      } -> {
        select: stuff.elevation
        order_by: 1 desc
        limit: 1
      }
    `).toMatchResult(airportTestModel, {elevation: 1836});
  });

  it('nested_sums', async () => {
    await expect(`
      run: airports->{
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
    `).toMatchResult(airportTestModel, {sum_state: 19793, sum_fac: 19793});
  });

  it('pipeline Turtle', async () => {
    const result = await runQuery(
      model,
      `
      run: db.table('malloytest.airports')->{
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
    const row = result.data.value[0] as {
      pipe_turtle: {state: string; total_airports: number}[];
    };
    // The state with the most airports (first in desc order) has 1845 airports
    expect(row.pipe_turtle[0]).toMatchObject({total_airports: 1845});
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
    // expect((result.data.value[0] as any).pipe_turtle[0].total_airports).toBe(1845);
  });
});
