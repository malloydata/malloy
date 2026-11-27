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

  // Join tests

  const joinTestModel = wrapTestModel(
    testDatabase,
    makeModel() +
      `
      source: model_aircraft is aircraft_models extend {
        join_many: aircraft on aircraft_model_code = aircraft.aircraft_model_code
      }
    `
  );

  it('hand query hand model', async () => {
    await expect(`
      run: aircraft -> {
        aggregate: total_seats is aircraft_models.seats.sum() {
          where: aircraft_models.manufacturer = 'BOEING'
        }
      }
    `).toMatchResult(testModel, {total_seats: 6244});
  });

  it('hand turtle', async () => {
    await expect(`
      run: aircraft -> {
        aggregate: aircraft_count
      }
    `).toMatchResult(testModel, {aircraft_count: 3599});
  });

  it('hand total', async () => {
    await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        aggregate: total_aircraft is all(aircraft_count)
      }
    `).toMatchResult(testModel, {total_aircraft: 3599});
  });

  it('hand turtle total', async () => {
    await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        nest: my_turtle is {
          group_by: county
          aggregate: aircraft_count
          aggregate: total_aircraft is all(aircraft_count)
        }
      }
    `).toMatchResult(testModel, {aircraft_count: 367});
  });

  // Hand model basic calculations for sum, filtered sum, without a join.
  it('hand: lots of kinds of sums', async () => {
    await expect(`
      run: aircraft->{
        aggregate:
          aircraft_models.total_seats,
          total_seats2 is sum(aircraft_models.seats),
          total_seats3 is aircraft_models.sum(aircraft_models.seats),
          aircraft_models.boeing_seats,
          boeing_seats2 is aircraft_models.sum(aircraft_models.seats) { where: aircraft_models.manufacturer ? 'BOEING'},
          boeing_seats3 is aircraft_models.boeing_seats { where: aircraft_models.manufacturer ? ~'B%'}
      }
    `).toMatchResult(testModel, {
      total_seats: 18294,
      total_seats2: 31209,
      total_seats3: 18294,
      boeing_seats: 6244,
      boeing_seats2: 6244,
      boeing_seats3: 6244,
    });
  });

  it('hand: bad root name for pathed sum', async () => {
    await expect(`
      run: aircraft -> {
        aggregate: total_seats3 is aircraft_models.sum(aircraft_models.seats)
      }
    `).toMatchResult(testModel, {total_seats3: 18294});
  });

  // WORKs: (hand coded model):
  // Model based version of sums.
  it('hand: expression fixups.', async () => {
    await expect(`
      run: aircraft -> {
        aggregate:
          aircraft_models.total_seats,
          aircraft_models.boeing_seats
      }
    `).toMatchResult(testModel, {total_seats: 18294, boeing_seats: 6244});
  });

  it('model: filtered measures', async () => {
    await expect(`
      run: aircraft -> {
        aggregate: boeing_seats is aircraft_models.total_seats {
          where: aircraft_models.manufacturer ? 'BOEING'
        }
      }
    `).toMatchResult(testModel, {boeing_seats: 6244});
  });

  // Works: Generate query using named alias.
  it('hand: filtered measures', async () => {
    await expect(`
      run: aircraft -> {
        aggregate: boeing_seats is aircraft_models.seats.sum() {
          where: aircraft_models.manufacturer = 'BOEING'
        }
      }
    `).toMatchResult(testModel, {boeing_seats: 6244});
  });

  it('hand join symmetric agg', async () => {
    await expect(`
      run: model_aircraft -> {
        aggregate: total_seats
        aggregate: aircraft.aircraft_count
      }
    `).toMatchResult(joinTestModel, {
      total_seats: 452415,
      aircraft_count: 3599,
    });
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

  it('step_0', async () => {
    const sql = await compileQuery(
      faa,
      `
      run: flights -> {
        group_by: carriers.name
        aggregate: flight_count
      }
      `
    );
    await bqCompile(sql);
  });

  it('simple_reduce', async () => {
    const sql = await compileQuery(
      faa,
      'run: flights -> { group_by: carrier; aggregate: flight_count }'
    );
    await bqCompile(sql);
  });

  it('two_sums', async () => {
    const sql = await compileQuery(
      faa,
      `
        run: flights -> {
          aggregate: aircraft.aircraft_models.total_seats
          aggregate: total_distance is distance.sum()
        }
      `
    );
    await bqCompile(sql);
  });

  it('sum_in_expr', async () => {
    const sql = await compileQuery(
      faa,
      `
        run: flights -> {
          group_by: carriers.name
          aggregate: total_distance is distance.sum()
        }
      `
    );
    await bqCompile(sql);
  });

  it('filtered_sum_in_expr', async () => {
    const sql = await compileQuery(
      faa,
      `
        run: flights -> {
          group_by: aircraft.aircraft_models.manufacturer
          aggregate: total_distance is distance.sum() {
            where: origin_code = 'SFO'
          }
        }
      `
    );
    await bqCompile(sql);
  });

  it('dynamic_measure', async () => {
    const sql = await compileQuery(
      faa,
      `
        run: flights -> {
          where: carriers.code = 'WN'
          group_by: origin.state
          aggregate: flight_count
          aggregate: total_distance is distance.sum() {
            where: origin_code = 'SFO'
          }
        }
      `
    );
    await bqCompile(sql);
  });

  it('count distinct', async () => {
    const sql = await compileQuery(
      faa,
      `
      run: flights->{
        aggregate: carrier_count is count(carrier)
      }
    `
    );
    // console.log(result.sql);
    await bqCompile(sql);
  });
});

describe('airport_tests', () => {
  let model: malloy.ModelMaterializer;
  beforeAll(async () => {
    model = testDatabase.runtime.loadModel(airportModelText);
  });

  it('airport_count', async () => {
    const result = await runQuery(
      model,
      `
      run: airports->{
        aggregate: a is count()
      }
    `
    );
    expect(result.data.value[0]['a']).toBe(19793);
  });
});
