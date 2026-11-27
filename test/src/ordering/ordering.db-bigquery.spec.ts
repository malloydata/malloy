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

  it('default sort order', async () => {
    await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        limit: 10
      }
    `).toMatchResult(testModel, {aircraft_count: 367});
  });

  it('default sort order by dir', async () => {
    await expect(`
      run: aircraft -> {
        group_by: state
        aggregate: aircraft_count
        order_by: 2
        limit: 10
      }
    `).toMatchResult(testModel, {aircraft_count: 1});
  });
});

describe('BigQuery expression tests', () => {
  const faa = testDatabase.runtime.loadModel(testModel);

  it('bucket_test', async () => {
    const sql = await compileQuery(
      faa,
      // TODO bucketFilter and bucketOther don't actually exist...
      // bucketFilter: 'AA,WN,DL',
      // bucketOther: 'Other Carrier',
      `
        run: flights -> {
          group_by: carrier
          aggregate: flight_count
          order_by: 2 asc
        }
      `
    );
    await bqCompile(sql);
  });
});
