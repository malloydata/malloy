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

it('filtered explores basic', async () => {
  await expect(`
      run: aircraft extend { where: aircraft_models.manufacturer ? ~'B%' }
        -> {aggregate: m_count is count(aircraft_models.manufacturer) }
    `).toMatchResult(testModel, {m_count: 63});
});

// Issue: #151
it('bug 151 which used to throw unknown dialect is still fixed', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      query: q is db.table('malloytest.aircraft')->{
        where: state is not null
        group_by: state
      }
      run: q extend {
        view: foo is {
          order_by: 1 desc
          group_by: state
        }
      } -> foo
      `).toMatchResult(testModel, {state: 'WY'});
});

// Issue #149
it('refine query from query', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: db.table('malloytest.state_facts')
        -> {group_by: state; order_by: 1 desc; limit: 1}
        extend {
          dimension: lower_state is lower(state)
        } -> {select: lower_state}
    `).toMatchResult(testModel, {lower_state: 'wy'});
});

// issue #157
it('source- not -found', async () => {
  // console.log(result.data.toObject());
  let error;
  try {
    await testDatabase.runtime
      .loadQuery(
        `
        source: foo is db.table('malloytest.state_facts') extend {primary_key: state}
        run: foox->{aggregate: c is count()}
       `
      )
      .run();
  } catch (e) {
    error = e;
  }
  expect(error.toString()).not.toContain('Unknown Dialect');
});

it('source from query defined as other query', async () => {
  const result = await testDatabase.runtime
    .loadQuery(
      `
        query: q is db.table('malloytest.flights') -> { group_by: carrier }
        source: s is q
        run: s -> { select: *; order_by: carrier }
      `
    )
    .run();
  expect(result.data.path(0, 'carrier').string.value).toBe('AA');
});
