/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

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

  // does the filter force a join?
  it('model: do filters force dependant joins?', async () => {
    await expect(`
      run: aircraft -> {
        aggregate: boeing_aircraft is count() {
          where:aircraft_models.manufacturer ? 'BOEING'
        }
      }
    `).toMatchResult(testModel, {boeing_aircraft: 69});
  });

  it('hand join ON', async () => {
    await expect(`
      run: model_aircraft -> {
        group_by: aircraft.state
        aggregate: aircraft.aircraft_count
        aggregate: model_count
      }
    `).toMatchResult(joinTestModel, {
      state: 'CA',
      aircraft_count: 367,
      model_count: 277,
    });
  });
});

function sourceCodeWithFilter(filter: string) {
  return `
  source: aircraft_models is db.table('malloydata-org.malloytest.aircraft_models') extend {
    primary_key: aircraft_model_code
    where: ${filter}
  }

  source: aircraft is db.table('malloydata-org.malloytest.aircraft') extend {
    primary_key: tail_num
    measure: aircraft_count is count()
    join_one: aircraft_models with aircraft_model_code
  }

  run: aircraft -> {
    group_by: aircraft_models.aircraft_model_code
  }
`;
}

describe('Joined filters', () => {
  test('work with comma', async () => {
    const runtime = testDatabase.runtime;
    const src = sourceCodeWithFilter('1 = 1, 2 = 2');
    const result = await runtime.loadQuery(src).run();
    expect(result.sql).toContain('1=1');
    expect(result.sql).toContain('2=2');
  });

  test('work with and', async () => {
    const runtime = testDatabase.runtime;
    const src = sourceCodeWithFilter('1 = 1 and 2 = 2');
    const result = await runtime.loadQuery(src).run();
    expect(result.sql).toContain('1=1');
    expect(result.sql).toContain('2=2');
  });
});
