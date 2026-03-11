/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const runtime = runtimeFor('duckdb');
const testModel = wrapTestModel(runtime, '');

describe('misc tests for regressions that have no better home', () => {
  test('rename a field in a join', async () => {
    // Previously the rename would cause an error in the prepare step, so any result is good
    await expect(`
      source: carriers is duckdb.table('malloytest.carriers') extend { rename: airline is name }
      run: duckdb.table('malloytest.flights') extend {
        join_one: carriers on carrier = carriers.code
      } -> { group_by: carriers.airline; limit: 1 }
    `).toMatchResult(testModel, {});
  });

  test('result data structure contains time zones for nested queries', async () => {
    const query = runtime.loadQuery(`
      run: duckdb.table('malloytest.flights') -> {
        nest: arrive_yekaterinburg is {
          timezone: 'Asia/Yekaterinburg'
          group_by: utc_time is arr_time::string, civil_time is arr_time
          limit: 5
        }
      }
    `);
    const result = await query.run();

    // Inspect the result schema to find timezone metadata
    const schema = result.resultExplore;

    // Find the nested field
    const nestedField = schema.getFieldByName('arrive_yekaterinburg');
    expect(nestedField).toBeDefined();

    if (nestedField?.isExploreField()) {
      // Check if timezone information is present in the result data structure
      const queryTimezone = nestedField.queryTimezone;

      // Verify timezone is accessible in the result structure
      expect(queryTimezone).toBe('Asia/Yekaterinburg');

      // The timezone info should be available for later serialization
      // (this is what gets turned into annotations during the to-stable process)
      expect(nestedField.queryTimezone).toBeDefined();
    }
  });

  describe('Object.prototype field name collisions', () => {
    test('source named constructor with a query', async () => {
      await expect(`
        source: constructor is duckdb.table('malloytest.flights')
        run: constructor -> { group_by: carrier; limit: 1 }
      `).toMatchResult(testModel, {});
    });

    test('dimension named constructor in group_by', async () => {
      await expect(`
        run: duckdb.table('malloytest.flights') extend {
          dimension: constructor is carrier
        } -> { group_by: constructor; limit: 1 }
      `).toMatchResult(testModel, {});
    });
  });

  test('view with joined dimension and calculate compiles', async () => {
    // Regression: a view using a joined field as a dimension and
    // calculate (e.g. rank()) stopped compiling.
    await expect(`
      source: model is duckdb.table('malloytest.flights') extend {
        join_many: carriers is duckdb.table('malloytest.carriers') on carriers.code = carrier
        dimension: airline is carriers.name
        measure: flight_count is count()
        view: ranking is {
          group_by: airline
          aggregate: flight_count
          calculate: rank is rank()
        }
      }
      run: model -> ranking
    `).toMatchResult(testModel, {});
  });

  test('index query piped to select compiles', async () => {
    // Regression: piping an index query into a select stage caused a
    // __distinct_key error in the compiler.
    await expect(`
      run: duckdb.table('malloytest.flights') extend {
        join_many: carriers is duckdb.table('malloytest.carriers') on carriers.code = carrier
        measure: total_flights is count()
      } -> {
        index:
          *
          carriers.*
        by total_flights
        sample: 5000
      } -> {
        select: *
        where: fieldValue ~ 'United%'
        order_by: weight desc
      }
    `).toMatchResult(testModel, {});
  });
});

afterAll(async () => {
  await runtime.connection.close();
});
