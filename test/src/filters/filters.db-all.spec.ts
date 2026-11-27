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
const testModel = wrapTestModel(testDatabase, modelText);

// having.
it('model: simple having', async () => {
  await expect(`
      run: aircraft->{
        having: aircraft_count >90
        group_by: state
        aggregate: aircraft_count
        order_by: 2
        limit: 2
      }
    `).toMatchResult(testModel, {aircraft_count: 91});
});

test.when(testDatabase.dialect.supportsNesting)(
  'model: having in a nest',
  async () => {
    await expect(`
      run: aircraft->{
        top: 10
        order_by: 1
        where: region is not null
        group_by: region
        nest: by_state is {
          top: 10
          order_by: 1 desc
          having: aircraft_count > 50
          group_by: state
          aggregate: aircraft_count
        }
      }
    `).toMatchPaths(testModel, {'by_state.state': 'VA'});
  }
);

test.when(testDatabase.dialect.supportsNesting)(
  'model: turtle having on main',
  async () => {
    await expect(`
      run: aircraft->{
        order_by: 2 asc
        having: aircraft_count ? >500
        group_by: region
        aggregate: aircraft_count
        nest: by_state is {
          order_by: 2 asc
          having: aircraft_count >45
          group_by: state
          aggregate: aircraft_count
          nest: by_city is {
            order_by: 2 asc
            having: aircraft_count ? >5
            group_by: city
            aggregate: aircraft_count
          }
        }
      }
    `).toMatchPaths(testModel, {
      'by_state.by_city.city': 'ALBUQUERQUE',
    });
  }
);

// bigquery doesn't like to partition by floats,
test.when(testDatabase.dialect.supportsNesting)(
  'model: having float group by partition',
  async () => {
    await expect(`
        run: aircraft_models->{
          order_by: 1
          where: seats_bucketed > 0
          having: aircraft_model_count > 400
          group_by: seats_bucketed
          aggregate: aircraft_model_count
          nest: foo is {
            group_by: engines
            aggregate: aircraft_model_count
          }
      }`).toMatchResult(testModel, {aircraft_model_count: 448});
  }
);

test.when(testDatabase.dialect.supportsNesting)(
  'model: having on just aggregation with a nest',
  async () => {
    await expect(`
      run: db.table('malloytest.state_facts') -> {
          having: count(airport_count) > 0
          aggregate: row_count is count()
          nest: state
      }`).toMatchResult(testModel, {row_count: 51});
  }
);

const orderByModel = wrapTestModel(
  testDatabase,
  `
    source: models is db.table('malloytest.aircraft_models') extend {
      measure: model_count is count()
    }`
);

// I'm not sure I have the syntax right here...
it('modeled having simple', async () => {
  await expect(`
      source: popular_names is models->{
        having: model_count > 100
        group_by: manufacturer
        aggregate: model_count
      }
      run: popular_names->{
        order_by: 2
        select: manufacturer, model_count
      }
    `).toMatchResult(orderByModel, {model_count: 102});
});

test.when(testDatabase.dialect.supportsNesting)(
  'modeled having complex',
  async () => {
    await expect(`
        source: popular_names is models->{
          having: model_count > 100
          group_by: manufacturer
          aggregate: model_count
          nest: l is {
            top: 5
            group_by: manufacturer
            aggregate: model_count
          }
        }
        run: popular_names->{
          order_by: 2
          select: manufacturer, model_count
        }
      `).toMatchResult(orderByModel, {model_count: 102});
  }
);
