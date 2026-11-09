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
  const supported = runtime.dialect.supportsArrayQueries;
  // A query which is not computed in place needs a correlated subquery.
  const correlated =
    supported && runtime.dialect.supportsCorrelatedArrayQueries;
  // The rows a correlated subquery made can be unnested, to reach into
  // them with a path.
  const unnestsSubquery =
    correlated && runtime.dialect.supportsReadingCorrelatedArrayRows;
  // An order_by: inside the arrow is sorted in place, or by the subquery.
  const sorts =
    supported && (correlated || runtime.dialect.supportsArraySortInPlace);
  // Queries on an array which only a correlated subquery can run; without
  // one, each is a translation error, so the model has them only with one.
  const needSubquery = `
        by_size is by_fac_type -> {
          group_by: big is airport_count > 100
          aggregate: n is airport_count.sum()
        }
        busy_types is by_fac_type -> {
          group_by: fac_type
          aggregate: n is airport_count.sum()
        } -> {
          where: n > 50
          select: fac_type
        }`;
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
        small_types is by_fac_type -> { select: *; where: airport_count < 50 }
        doubled is by_fac_type -> {
          select: fac_type, double_count is airport_count * 2
        }
        ${correlated ? needSubquery : ''}
        none is by_fac_type -> { select: *; where: airport_count > 1000 }
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
        // Each database rounds the last digit of 608 / 3 its own way.
        select: fewest, most, mean is round(mean, 6), types
      }
    `).toMatchResult(tm, {fewest: 30, most: 474, mean: 202.666667, types: 3});
  });

  test.when(supported)("the array query's own where:", async () => {
    const query = alaska(
      'by_fac_type -> { where: airport_count > 50; aggregate: n is airport_count.sum() }'
    );
    await expect(query).toEqualResult(tm, [{d: 578}]);
  });

  test.when(correlated)("the array query's own having:", async () => {
    // Alaska has three facility types; a having: which no row passes leaves
    // no row, so no value
    await expect(
      alaska('by_fac_type -> { aggregate: n is count(); having: n > 3 }')
    ).toEqualResult(tm, [{d: null}]);
    await expect(
      alaska('by_fac_type -> { aggregate: n is count(); having: n > 2 }')
    ).toEqualResult(tm, [{d: 3}]);
  });

  test.when(supported && !correlated)(
    'without a correlated subquery, a having: is an error',
    async () => {
      await expect(
        runtime
          .loadModel(model)
          .loadQuery(
            alaska('by_fac_type -> { aggregate: n is count(); having: n > 3 }')
          )
          .getSQL()
      ).rejects.toThrow(/can only query an array/);
    }
  );

  test.when(db === 'trino' || db === 'presto' || db === 'databricks')(
    'a sum of integers stays an integer',
    async () => {
      const sql = await runtime
        .loadModel(model)
        .loadQuery(
          alaska('by_fac_type -> { aggregate: n is airport_count.sum() }')
        )
        .getSQL();
      expect(sql).toMatch(/CAST\(0 AS BIGINT\)/);
    }
  );

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
      expect(sql).toMatch(/__by_fac_type_element_0 ->/);
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

  /*
   * A query on an array with rows of its own returns them as an array of
   * records, which can be selected, or reached into with a path like any
   * other array.
   */
  describe('array results', () => {
    test.when(supported)('select: with a where:', async () => {
      await expect(`
        run: a -> { where: state = 'AK'; select: small_types }
      `).toEqualResult(tm, [
        {small_types: [{fac_type: 'HELIPORT', airport_count: 30}]},
      ]);
    });

    test.when(supported)('none selected is an empty array', async () => {
      await expect(`
        run: a -> { where: state = 'AK'; select: none }
      `).toEqualResult(tm, [{none: []}]);
    });

    test.when(supported)('a path into the result', async () => {
      // 167 groups of a state and a facility type have fewer than 50
      // airports, 1236 in all. One more has no state, and an element's
      // distinct key is made of its row's key, so it is left out.
      await expect(`
        run: a -> {
          where: state is not null
          aggregate:
            small_groups is small_types.count()
            small_total is small_types.airport_count.sum()
        }
      `).toMatchResult(tm, {small_groups: 167, small_total: 1236});
    });

    test.when(supported)('select: of an expression', async () => {
      await expect(`
        run: a -> {
          where: state = 'AK'
          aggregate: n is doubled.double_count.sum()
        }
      `).toMatchResult(tm, {n: 1216});
    });

    test.when(unnestsSubquery)('group_by:', async () => {
      // Alaska's airports and seaplane bases each number over 100
      await expect(`
        run: a -> {
          where: state = 'AK' and by_size.big = true
          aggregate: n is by_size.n.sum()
        }
      `).toMatchResult(tm, {n: 578});
    });

    test.when(unnestsSubquery)('several stages', async () => {
      await expect(`
        run: a -> {
          where: state = 'AK'
          aggregate: n is busy_types.count()
        }
      `).toMatchResult(tm, {n: 2});
    });

    test.when(correlated)('group_by:, selected, in its order', async () => {
      await expect(`
        run: a -> { where: state = 'AK'; select: by_size }
      `).toEqualResult(tm, [
        {
          by_size: [
            {big: true, n: 578},
            {big: false, n: 30},
          ],
        },
      ]);
    });

    test.when(unnestsSubquery)('group_by:, queried again with ->', async () => {
      await expect(`
        run: a -> {
          where: state = 'AK'
          select: big is by_size -> { where: big = true; aggregate: t is n.sum() }
        }
      `).toEqualResult(tm, [{big: 578}]);
    });

    test.when(correlated)(
      'several stages ending in one aggregate',
      async () => {
        await expect(`
        run: a -> {
          where: state = 'AK'
          select: busy is by_fac_type -> {
            group_by: fac_type
            aggregate: n is airport_count.sum()
          } -> {
            where: n > 50
            aggregate: c is count()
          }
        }
      `).toEqualResult(tm, [{busy: [{c: 2}]}]);
      }
    );

    test.when(correlated && !unnestsSubquery)(
      'rows a correlated subquery made can only be selected',
      async () => {
        const sqlOf = (query: string) =>
          runtime.loadModel(model).loadQuery(query).getSQL();
        await expect(
          sqlOf(
            "run: a -> { where: state = 'AK'; aggregate: n is by_size.n.sum() }"
          )
        ).rejects.toThrow(/cannot reach into its rows/);
        await expect(
          sqlOf(`run: a -> {
            where: state = 'AK'
            select: big is by_size -> { aggregate: t is n.sum() }
          }`)
        ).rejects.toThrow(/cannot query it with ->/);
      }
    );

    test.when(supported && !correlated)(
      'without a correlated subquery, a group_by: is an error',
      async () => {
        await expect(
          runtime
            .loadModel(model)
            .loadQuery(
              `run: a -> {
                where: state = 'AK'
                select: by_size is by_fac_type -> { group_by: big is airport_count > 100 }
              }`
            )
            .getSQL()
        ).rejects.toThrow(/can only query an array/);
      }
    );

    // Alaska's facility types, as a query on its array
    const alaskaTypes = (query: string) => `
      run: a extend { dimension: types is by_fac_type -> ${query} } -> {
        where: state = 'AK'
        select: types
      }
    `;

    test.when(supported && !sorts)(
      'without an in-place sort or a correlated subquery, an order_by: is an error',
      async () => {
        await expect(
          runtime
            .loadModel(model)
            .loadQuery(alaskaTypes('{ select: fac_type; order_by: fac_type }'))
            .getSQL()
        ).rejects.toThrow(/can only query an array.*order_by/);
      }
    );

    test.when(sorts)('order_by: and limit:', async () => {
      await expect(
        alaskaTypes(`{
          select: fac_type, airport_count
          order_by: airport_count desc
          limit: 1
        }`)
      ).toEqualResult(tm, [
        {types: [{fac_type: 'AIRPORT', airport_count: 474}]},
      ]);
      await expect(
        alaskaTypes(`{
          select: fac_type, airport_count
          order_by: airport_count
          limit: 2
        }`)
      ).toEqualResult(tm, [
        {
          types: [
            {fac_type: 'HELIPORT', airport_count: 30},
            {fac_type: 'SEAPLANE BASE', airport_count: 104},
          ],
        },
      ]);
    });

    test.when(sorts)('order_by: a position', async () => {
      await expect(
        alaskaTypes('{ select: fac_type, airport_count; order_by: 2 desc }')
      ).toEqualResult(tm, [
        {
          types: [
            {fac_type: 'AIRPORT', airport_count: 474},
            {fac_type: 'SEAPLANE BASE', airport_count: 104},
            {fac_type: 'HELIPORT', airport_count: 30},
          ],
        },
      ]);
    });

    test.when(sorts)('where: with order_by:', async () => {
      await expect(
        alaskaTypes(`{
          select: fac_type
          where: airport_count > 50
          order_by: fac_type desc
        }`)
      ).toEqualResult(tm, [
        {types: [{fac_type: 'SEAPLANE BASE'}, {fac_type: 'AIRPORT'}]},
      ]);
    });

    test.when(sorts)('order_by: keys in both directions', async () => {
      await expect(
        alaskaTypes(`{
          select: fac_type, big is airport_count > 50
          order_by: big desc, fac_type
        }`)
      ).toEqualResult(tm, [
        {
          types: [
            {fac_type: 'AIRPORT', big: true},
            {fac_type: 'SEAPLANE BASE', big: true},
            {fac_type: 'HELIPORT', big: false},
          ],
        },
      ]);
    });

    test.when(db === 'duckdb')(
      'DuckDB sorts in place, unless the keys go both ways',
      async () => {
        const sqlOf = (query: string) =>
          runtime.loadModel(model).loadQuery(alaskaTypes(query)).getSQL();
        const sorted = await sqlOf(
          '{ select: fac_type; order_by: fac_type desc; limit: 2 }'
        );
        expect(sorted).toMatch(/LIST_GRADE_UP/);
        expect(sorted).toMatch(/LIST_SLICE/);
        expect(sorted).not.toMatch(/SELECT UNNEST\(base\./);
        const ascending = await sqlOf(
          '{ select: fac_type, airport_count; order_by: fac_type, airport_count }'
        );
        expect(ascending).toMatch(/LIST_GRADE_UP/);
        // The filtered list is computed once, and sorted inside a lambda.
        const filtered = await sqlOf(
          '{ select: fac_type; where: airport_count > 50; order_by: fac_type desc }'
        );
        expect(filtered.match(/LIST_FILTER/g)).toHaveLength(1);
        expect(filtered).toMatch(/LIST_GRADE_UP/);
        const bothWays = await sqlOf(
          '{ select: fac_type, airport_count; order_by: fac_type, airport_count desc }'
        );
        expect(bothWays).toMatch(/SELECT UNNEST\(base\./);
      }
    );

    test.when(db === 'duckdb')(
      'DuckDB makes a select: in place, a group_by: as a subquery',
      async () => {
        const sqlOf = (dimension: string) =>
          runtime
            .loadModel(model)
            .loadQuery(
              `run: a -> { where: state = 'AK'; select: ${dimension} }`
            )
            .getSQL();
        const selected = await sqlOf('small_types');
        expect(selected).toMatch(/LIST_FILTER/);
        expect(selected).not.toMatch(/SELECT UNNEST\(base\./);
        const grouped = await sqlOf('by_size');
        expect(grouped).toMatch(/SELECT UNNEST\(base\./);
      }
    );
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
