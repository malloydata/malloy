/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import {bqCompile, compileQuery} from '../bigquery/bigquery_compile';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
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

  it('hand turtle malloy', async () => {
    await expect(`
      run: aircraft -> hand_turtle
    `).toMatchResult(testModel, {aircraft_count: 3599});
  });
});

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

  it('flights_by_carrier', async () => {
    const sql = await compileQuery(faa, 'run: flights->flights_by_carrier');
    await bqCompile(sql);
  });

  it('flights.flights_by_model', async () => {
    const sql = await compileQuery(faa, 'run: flights->flights_by_model');
    await bqCompile(sql);
  });

  it('flights.aircraft_facts_test', async () => {
    const sql = await compileQuery(faa, 'run: flights->aircraft_facts_test');
    await bqCompile(sql);
  });

  it('flights.measures_first', async () => {
    const sql = await compileQuery(faa, 'run:flights->measures_first');
    await bqCompile(sql);
  });

  it('flights.carriers_by_total_engines', async () => {
    const sql = await compileQuery(
      faa,
      'run: flights->carriers_by_total_engines'
    );
    await bqCompile(sql);
  });

  it('flights.first_turtle', async () => {
    const sql = await compileQuery(faa, 'run: flights->first_turtle');
    await bqCompile(sql);
  });

  it('flights.top_5_routes_carriers', async () => {
    const sql = await compileQuery(faa, 'run: flights->top_5_routes_carriers');
    await bqCompile(sql);
  });

  it('flights.new_york_airports', async () => {
    const sql = await compileQuery(faa, 'run: flights->new_york_airports');
    await bqCompile(sql);
  });

  it('flights.flights_by_carrier_with_totals', async () => {
    const sql = await compileQuery(
      faa,
      'run: flights->flights_by_carrier_with_totals'
    );
    await bqCompile(sql);
  });

  it('flights.flights_routes_sessionized', async () => {
    const sql = await compileQuery(
      faa,
      'run: flights->flights_routes_sessionized'
    );
    await bqCompile(sql);
  });

  it('flights.flights_aircraft_sessionized', async () => {
    const sql = await compileQuery(
      faa,
      'run: flights->flights_aircraft_sessionized'
    );
    await bqCompile(sql);
  });

  it('flights.flights_by_manufacturer', async () => {
    const sql = await compileQuery(
      faa,
      'run: flights->flights_by_manufacturer'
    );
    await bqCompile(sql);
  });

  it('flights.flights_by_carrier_2001_2002', async () => {
    const sql = await compileQuery(
      faa,
      'run: flights->flights_by_carrier_2001_2002'
    );
    await bqCompile(sql);
  });
});

describe('airport_tests', () => {
  const airportTestModel = wrapTestModel(testDatabase, airportModelText);

  it('pipeline_as_declared_turtle', async () => {
    await expect(`
      run: airports extend {
        view: pipe_turtle is {
          aggregate: a is airport_count
        } -> {
          select: a
        }
      } -> pipe_turtle
    `).toMatchResult(airportTestModel, {a: 19793});
  });
});
