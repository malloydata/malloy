/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import '../util/db-jest-matchers';

afterAll(() => testDatabase.shutdown());

const modelText = `
source: aircraft_models is db.table('malloytest.aircraft_models') extend {
  primary_key: aircraft_model_code
  measure:
    aircraft_model_count is count(),
    total_seats is sum(seats),
    boeing_seats is sum(seats) { where: manufacturer ? 'BOEING'},
    percent_boeing is boeing_seats / total_seats * 100,
    percent_boeing_floor is floor(boeing_seats / total_seats * 100),
  dimension: seats_bucketed is floor(seats/20)*20.0
}

source: aircraft is db.table('malloytest.aircraft') extend {
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count()
  view: by_manufacturer is {
    top: 5
    group_by: aircraft_models.manufacturer
    aggregate: aircraft_count
  }
}
`;

const expressionModel = testDatabase.runtime.loadModel(modelText);

it('named query metadata undefined', async () => {
  const result = await expressionModel
    .loadQuery(
      `
        run: aircraft->{
          aggregate: aircraft_count is count()
        }
        `
    )
    .run();
  // TODO The result explore should really be unnamed. This test currently
  //      inspects inner information because we have no way to have unnamed
  //       explores today.
  // expect(result.getResultExplore().name).toBe(undefined);
  expect(result._queryResult.queryName).toBe(undefined);
});

it('named query metadata named', async () => {
  const result = await expressionModel
    .loadQuery('run: aircraft->by_manufacturer')
    .run();
  expect(result.resultExplore.name).toBe('by_manufacturer');
});

it('named query metadata named head of pipeline', async () => {
  const result = await expressionModel
    .loadQuery(
      `
        run: aircraft->by_manufacturer->{ aggregate: c is count()}
        `
    )
    .run();
  // TODO Same as above -- this test should check the explore name
  // expect(result.resultExplore.name).toBe(undefined);
  expect(result._queryResult.queryName).toBe(undefined);
});

const joinModelText = `
  source: aircraft_models is db.table('malloytest.aircraft_models') extend {
    primary_key: aircraft_model_code
    measure: model_count is count()
    view: manufacturer_models is {
      group_by: manufacturer
      aggregate: num_models is count()
    }
    view: manufacturer_seats is {
      group_by: manufacturer
      aggregate: total_seats is seats.sum()
    }
  }

  source: aircraft is db.table('malloytest.aircraft') extend {
    primary_key: tail_num
    measure: aircraft_count is count()
  }

  source: funnel is aircraft_models->manufacturer_models extend {
    join_one: seats is aircraft_models->manufacturer_seats
        with manufacturer
  }
`;

const joinModel = wrapTestModel(testDatabase, joinModelText);

it('model: source based on query', async () => {
  await expect(`
      run: aircraft_models
        -> {
          group_by: m is manufacturer
          aggregate: num_models is count()
        } -> {
          select:
          m
          num_models
          order_by: 2 desc
          limit: 1
        }
    `).toMatchResult(joinModel, {num_models: 1147});
});

it('model: double_pipe', async () => {
  await expect(`
      run: aircraft_models->{
        group_by: manufacturer
        aggregate: f is count()
      }->{
        aggregate: f_sum is f.sum()
      }->{
        select: f_sum2 is f_sum+1
      }
  `).toMatchResult(joinModel, {f_sum2: 60462});
});
