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

  // Alaska's three facility types: 474 airports, 104 seaplane bases and 30
  // heliports.
  const alaska = (dimension: string) => `
    run: a extend { dimension: d is ${dimension} } -> {
      where: state = 'AK'
      select: d
    }
  `;

  test.when(supported)('min, max, avg and count of a value', async () => {
    await expect(`
      run: a extend {
        dimension:
          fewest is by_fac_type -> { aggregate: n is airport_count.min() }
          most is by_fac_type -> { aggregate: n is airport_count.max() }
          mean is by_fac_type -> { aggregate: n is airport_count.avg() }
          types is by_fac_type -> { aggregate: n is count(fac_type) }
      } -> {
        where: state = 'AK'
        select: fewest, most, mean, types
      }
    `).toMatchResult(tm, {fewest: 30, most: 474, mean: 608 / 3, types: 3});
  });

  test.when(supported)("the array query's own where:", async () => {
    const query = alaska(
      'by_fac_type -> { where: airport_count > 50; aggregate: n is airport_count.sum() }'
    );
    await expect(query).toEqualResult(tm, [{d: 578}]);
  });

  test.when(supported)('a where: and a filtered aggregate', async () => {
    const query = alaska(`by_fac_type -> {
      where: airport_count > 50
      aggregate: n is count() { where: fac_type != 'AIRPORT' }
    }`);
    await expect(query).toEqualResult(tm, [{d: 1}]);
  });

  test.when(supported)('when the query also unnests the array', async () => {
    // Grouped by facility type, the states with seaplane bases have 473
    const query = `
      run: a -> {
        where: by_fac_type.fac_type = 'SEAPLANE BASE'
        group_by: by_fac_type.fac_type
        aggregate: seaplane_bases is seaplanes.sum()
      }
    `;
    await expect(query).toEqualResult(tm, [
      {fac_type: 'SEAPLANE BASE', seaplane_bases: 473},
    ]);
  });

  /*
   * DuckDB computes a query on an array which is one aggregate with list
   * functions, in place, instead of a correlated subquery over UNNEST.
   */
  describe('DuckDB list functions', () => {
    const duckdb = db === 'duckdb';
    async function sqlOf(query: string): Promise<string> {
      return runtime.loadModel(model).loadQuery(query).getSQL();
    }

    test.when(duckdb)('an aggregate is computed in place', async () => {
      for (const query of [
        alaska('by_fac_type -> { aggregate: n is airport_count.sum() }'),
        alaska(
          'by_fac_type -> { where: airport_count > 50; aggregate: n is count() }'
        ),
        "run: movies -> { select: isabella; where: state = 'AL' }",
        alaska('by_fac_type -> { aggregate: n is count(fac_type) }'),
      ]) {
        const sql = await sqlOf(query);
        expect(sql).toMatch(/LIST_|LEN\(/);
        // The correlated form unnests a column of the row.
        expect(sql).not.toMatch(/SELECT UNNEST\(base\./);
      }
    });

    test.when(duckdb)('also while the query unnests the array', async () => {
      // The element gets a name of its own, which the unnested column of the
      // array cannot hide.
      const sql = await sqlOf(`
        run: a -> {
          group_by: by_fac_type.fac_type
          aggregate: seaplane_bases is seaplanes.sum()
        }
      `);
      expect(sql).toMatch(/LIST_SUM/);
      expect(sql).toMatch(/by_fac_type_element_0 ->/);
    });

    test.when(duckdb)('empty and null arrays', async () => {
      await expect(`
        source: lists is duckdb.sql("""
          SELECT 1 AS id, [1, 1, 2, NULL] AS xs
          UNION ALL SELECT 2, []::INTEGER[]
          UNION ALL SELECT 3, NULL::INTEGER[]
        """) extend {
          dimension:
            total is xs -> { aggregate: n is value.sum() }
            elements is xs -> { aggregate: n is count() }
            distinct_values is xs -> { aggregate: n is count(value) }
            mean is xs -> { aggregate: n is value.avg() }
            biggest is xs -> { aggregate: n is value.max() }
        }
        run: lists -> {
          select: id, total, elements, distinct_values, mean, biggest
          order_by: id
        }
      `).toEqualResult(tm, [
        {
          id: 1,
          total: 4,
          elements: 4,
          distinct_values: 2,
          mean: 4 / 3,
          biggest: 2,
        },
        {
          id: 2,
          total: 0,
          elements: 0,
          distinct_values: 0,
          mean: null,
          biggest: null,
        },
        {
          id: 3,
          total: 0,
          elements: 0,
          distinct_values: 0,
          mean: null,
          biggest: null,
        },
      ]);
    });
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
