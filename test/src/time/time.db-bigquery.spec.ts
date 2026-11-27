/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import {bqCompile, compileQuery} from '../bigquery/bigquery_compile';
import {test} from '@jest/globals';
import {testModel} from '../models/faa_model';
import '@malloydata/malloy/test/matchers';

afterAll(() => testDatabase.shutdown());

describe('BigQuery double truncation', () => {
  test('check for double truncation', async () => {
    const runtime = testDatabase.runtime;
    expect(runtime).toBeDefined();
    if (runtime) {
      const src = `
        run: db.table('malloydata-org.malloytest.flights') -> {
          group_by: takeoff_week is dep_time.week
        }
      `;
      const result = await runtime.loadQuery(src).run();
      // Check for either TIMESTAMP_TRUNC or DATETIME_TRUNC (civil time path)
      const truncs = (
        result.sql.match(/(TIMESTAMP_TRUNC|DATETIME_TRUNC)/gi) || []
      ).length;
      expect(truncs).toBe(1);
    }
  });
});

describe('BigQuery expression tests', () => {
  const faa = testDatabase.runtime.loadModel(testModel);

  it('timestamp', async () => {
    const sql = await compileQuery(
      faa,
      `
        run: flights -> {
          group_by:
            dep_year is dep_time.year
            dep_month is dep_time.month
            dep_week is dep_time.week
            dep_date is dep_time.day
            dep_hour is dep_time.hour
            dep_minute is dep_time.minute
            dep_second is dep_time.second
          aggregate: total_distance_ca is distance.sum() {
            where: origin.state = 'CA'
          }
          limit: 20
        }
      `
    );
    await bqCompile(sql);
  });

  it('timeframes aliased', async () => {
    const sql = await compileQuery(
      faa,
      `
      run: flights->{
        group_by: mon is dep_time.month
      }
    `
    );
    await bqCompile(sql);
  });
});
