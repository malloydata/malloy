/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

/*
 * `array -> { aggregate: ... }`: a query on the elements of an array of the
 * current row, whose value is a value of that row. Experimental.
 */
describe.each(runtimes.runtimeList)('array queries %s', (db, runtime) => {
  const model = `
    ##! experimental.array_queries

    // One row per state, with its airports by facility type nested inside.
    source: a is ${db}.table('malloytest.airports') -> {
      group_by: state
      aggregate: airport_count is count()
      nest: by_fac_type is {
        group_by: fac_type
        aggregate: airport_count is count()
      }
    } extend {
      dimension:
        state_airports is by_fac_type -> { aggregate: n is airport_count.sum() }
        seaplanes is by_fac_type -> {
          aggregate: n is airport_count.sum() { where: fac_type = 'SEAPLANE BASE' }
        }
    }

    // States as "movies", each with an array of genres: its most popular
    // name, and 'any'.
    source: movies is ${db}.table('malloytest.state_facts') -> {
      select: state, genres is [popular_name, 'any']
    } extend {
      dimension:
        genre_count is genres -> { aggregate: n is count() }
        isabella is genres -> { aggregate: n is count() { where: each = 'Isabella' } }
    }
  `;
  const tm = wrapTestModel(runtime, model);
  const supported = runtime.dialect.supportsArrayQueries;

  test.when(supported)('aggregates a record array per row', async () => {
    // Alaska has 608 airports, 104 of them seaplane bases
    await expect(`
      run: a -> {
        where: state = 'AK'
        select: state, state_airports, seaplanes
      }
    `).toEqualResult(tm, [{state: 'AK', state_airports: 608, seaplanes: 104}]);
  });

  test.when(supported)('in a where:, without fanning out', async () => {
    // 41 states have seaplane bases
    const query = `
      run: a -> {
        where: seaplanes > 0
        aggregate: state_count is count()
      }
    `;
    const sql = await runtime.loadModel(model).loadQuery(query).getSQL();
    expect(sql).not.toMatch(/COUNT\(DISTINCT/i);
    await expect(query).toMatchResult(tm, {state_count: 41});
  });

  test.when(supported)('aggregates an array of scalars per row', async () => {
    // Every movie has two genres; 24 of them have Isabella
    await expect(`
      run: movies -> {
        aggregate:
          genres_total is genre_count.sum()
          isabella_movies is isabella.sum()
      }
    `).toMatchResult(tm, {genres_total: 102, isabella_movies: 24});
  });

  test.when(supported)('in a group_by', async () => {
    await expect(`
      run: movies -> {
        group_by: genre_count
        aggregate: movie_count is count()
      }
    `).toEqualResult(tm, [{genre_count: 2, movie_count: 51}]);
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
