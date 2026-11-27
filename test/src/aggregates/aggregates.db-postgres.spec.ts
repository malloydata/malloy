/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

import {testDatabase} from '../test_database';

describe('Postgres tests', () => {
  const testModel = wrapTestModel(testDatabase, '');

  afterAll(() => testDatabase.shutdown());

  it('can compute symmetric aggregates on double precisions numbers', async () => {
    await expect(`source: values is db.sql("""
        SELECT 1::DOUBLE PRECISION as val, 1 as id
      """) extend { measure: total_value is val.sum() }
    source: thing is db.sql(""" SELECT 1 as id """) extend {
      join_one: values on values.id = id
    }
    run: thing -> {
      group_by: id
      aggregate: tenx is 10 * values.total_value
    }
    `).toMatchResult(testModel, {tenx: 10});
  });
  it('keeps NUMERIC precision in symmetric aggregates', async () => {
    // The join_many makes amt.sum() a symmetric aggregate. Its exact total,
    // 1234567890123456.78, has more digits than a DOUBLE PRECISION holds; the
    // second stage keeps only the cents, so the result fits in a JS number.
    await expect(`
      source: big is db.sql("""
        SELECT 1 AS id, 1234567890123456.77::NUMERIC(18,2) AS amt
        UNION ALL SELECT 2, 0.01
      """) extend {
        primary_key: id
        join_many: dup is db.sql("""
          SELECT 1 AS id UNION ALL SELECT 1 UNION ALL SELECT 2
        """) on id = dup.id
      }
      run: big -> {
        aggregate: total is amt.sum(), dup_rows is dup.count()
      } -> {
        select: cents is (total - 1234567890123456) * 100, dup_rows
      }
    `).toMatchResult(testModel, {cents: 78, dup_rows: 3});
  });
});
