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
 * A `where:` on an array of the query's own source, which nothing else in the
 * query reads, is a test of the source row: "it has an element where ...".
 * The array is not unnested, so the rows do not fan out, and an aggregate
 * needs no distinct key. Each test checks the answer, and the in-place tests
 * check that no distinct count was needed.
 */
describe.each(runtimes.runtimeList)('where: on an array %s', (db, runtime) => {
  const model = `
    // One row per state, with its airports by facility type nested inside.
    source: a is ${db}.table('malloytest.airports') -> {
      group_by: state
      aggregate: airport_count is count()
      nest: by_fac_type is {
        group_by: fac_type
        aggregate: airport_count is count()
      }
    }

    // States as "movies", each with an array of genres: its most popular
    // name, and 'any'.
    source: movies is ${db}.table('malloytest.state_facts') -> {
      select: state, genres is [popular_name, 'any']
    }
  `;
  const tm = wrapTestModel(runtime, model);
  const supported =
    runtime.supportsNesting && runtime.dialect.supportsArrayAnyMatch;
  async function sqlOf(query: string): Promise<string> {
    return runtime.loadModel(model).loadQuery(query).getSQL();
  }

  test.when(supported)('an array of scalars', async () => {
    // 24 states' most popular name is Isabella
    const query = `
      run: movies -> {
        where: genres.each = 'Isabella'
        aggregate: movie_count is count()
      }
    `;
    expect(await sqlOf(query)).not.toMatch(/COUNT\(DISTINCT/i);
    await expect(query).toMatchResult(tm, {movie_count: 24});
  });

  test.when(supported)('two conditions hold for the same element', async () => {
    // No genre is both Isabella and 'any', though every Isabella movie has
    // both genres.
    const query = `
        run: movies -> {
          where: genres.each = 'Isabella' and genres.each = 'any'
          aggregate: movie_count is count()
        }
      `;
    expect(await sqlOf(query)).not.toMatch(/COUNT\(DISTINCT/i);
    await expect(query).toMatchResult(tm, {movie_count: 0});
  });

  test.when(supported)('an array of records', async () => {
    // 41 states have seaplane bases, and 15430 airports in all
    const query = `
      run: a -> {
        where: by_fac_type.fac_type = 'SEAPLANE BASE'
        aggregate:
          state_count is count()
          state_airport_count is airport_count.sum()
      }
    `;
    expect(await sqlOf(query)).not.toMatch(/COUNT\(DISTINCT/i);
    await expect(query).toMatchResult(tm, {
      state_count: 41,
      state_airport_count: 15430,
    });
  });

  test.when(supported)('two fields of the same record', async () => {
    // Only 2 states have more than 50 seaplane bases
    const query = `
      run: a -> {
        where:
          by_fac_type.fac_type = 'SEAPLANE BASE'
          and by_fac_type.airport_count > 50
        aggregate: state_count is count()
      }
    `;
    expect(await sqlOf(query)).not.toMatch(/COUNT\(DISTINCT/i);
    await expect(query).toMatchResult(tm, {state_count: 2});
  });

  test.when(supported)('beside a condition on the row', async () => {
    const query = `
      run: a -> {
        where: state = 'AK' and by_fac_type.fac_type = 'SEAPLANE BASE'
        group_by: state
        aggregate: state_count is count()
      }
    `;
    expect(await sqlOf(query)).not.toMatch(/COUNT\(DISTINCT/i);
    await expect(query).toEqualResult(tm, [{state: 'AK', state_count: 1}]);
  });

  test.when(supported)('not when a group_by reads the array', async () => {
    const query = `
      run: movies -> {
        where: genres.each = 'Isabella'
        group_by: genres.each
        aggregate: movie_count is count()
      }
    `;
    await expect(query).toEqualResult(tm, [
      {each: 'Isabella', movie_count: 24},
    ]);
  });

  test.when(supported)('not for != , which matches nulls', async () => {
    // Every movie has the genre 'any', which is not Isabella
    const query = `
      run: movies -> {
        where: genres.each != 'Isabella'
        aggregate: movie_count is count()
      }
    `;
    await expect(query).toMatchResult(tm, {movie_count: 51});
  });

  test.when(supported)('not for an OR with the row', async () => {
    // Alaska is one of the 41 states with seaplane bases
    const query = `
      run: a -> {
        where: by_fac_type.fac_type = 'SEAPLANE BASE' or state = 'AK'
        aggregate: state_count is count()
      }
    `;
    await expect(query).toMatchResult(tm, {state_count: 41});
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
