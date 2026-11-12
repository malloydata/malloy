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
  const support = runtime.dialect.arrayQueries;
  const supported = support !== undefined;
  // A query on an array with rows of its own returns them as an array.
  const arrays = support?.arrays === true;
  // A value which array functions cannot compute, such as one with a
  // `having:`, is a correlated subquery where the dialect has one: it
  // computes values that way, or it returns arrays.
  const anyValue = runtime.dialect.arrayQueryHasSubquery();
  // In place, one condition on both an element and an array inside it
  // needs a lambda inside a lambda which reads the outer one's parameter.
  const readsBoth =
    support !== undefined &&
    (support.value === 'subquery' || support.innerLambdaReadsOuter);
  // Queries on an array which return its rows; elsewhere each is a
  // translation error, so the model has them only where they compile.
  const withRows = `
        small_types is by_fac_type -> { select: *; where: airport_count < 50 }
        doubled is by_fac_type -> {
          select: fac_type, double_count is airport_count * 2
        }
        by_size is by_fac_type -> {
          group_by: big is airport_count > 100
          aggregate: n is airport_count.sum()
        }
        by_size_again is by_size
        busy_types is by_fac_type -> {
          group_by: fac_type
          aggregate: n is airport_count.sum()
        } -> {
          where: n > 50
          select: fac_type
        }
        none is by_fac_type -> { select: *; where: airport_count > 1000 }`;
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
        ${arrays ? withRows : ''}
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

    // One row per state, with its counties, each with its airports by
    // facility type: an array inside the elements.
    source: states is ${db}.table('malloytest.airports') -> {
      group_by: state
      aggregate: airport_count is count()
      nest: by_county is {
        group_by: county
        // Null for most counties
        aggregate: high is max(elevation) { where: elevation > 8000 }
        nest: by_fac_type is {
          group_by: fac_type
          aggregate: airport_count is count()
        }
        // Empty for most counties
        nest: heliports is {
          where: fac_type = 'HELIPORT'
          group_by: fac_type
          aggregate: airport_count is count()
        }
      }
    } extend {
      dimension:
        biggest_group is by_county -> {
          aggregate: n is by_fac_type.airport_count.max()
        }
        type_count is by_county -> {
          aggregate: n is count(by_fac_type.fac_type)
        }
        heliport_total is by_county -> {
          aggregate: n is heliports.airport_count.sum()
        }
        heliport_most is by_county -> {
          aggregate: n is heliports.airport_count.max()
        }
        high_sum is by_county -> { aggregate: n is high.sum() }
        high_max is by_county -> { aggregate: n is high.max() }
        high_avg is by_county -> { aggregate: n is high.avg() }
        nested_total is by_county -> {
          aggregate: n is by_fac_type.airport_count.sum()
        }
        a_heliports is by_county -> {
          where: county ~ 'A%'
          aggregate: n is by_fac_type.airport_count.sum() {
            where: by_fac_type.fac_type = 'HELIPORT'
          }
        }
        heliport_or_jefferson is by_county -> {
          aggregate: n is by_fac_type.count() {
            where: by_fac_type.fac_type = 'HELIPORT' or county = 'JEFFERSON'
          }
        }
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
        // Each database rounds 608 / 3 its own way; MySQL keeps four places.
        select: fewest, most, mean is round(mean, 4), types
      }
    `).toMatchResult(tm, {fewest: 30, most: 474, mean: 202.6667, types: 3});
  });

  // A fold's state has one type; a sum of integers must not be a DOUBLE.
  test.when(support?.value === 'lambdas')(
    'a sum of integers is not folded as a DOUBLE',
    async () => {
      const sql = await runtime
        .loadModel(model)
        .loadQuery(
          alaska('by_fac_type -> { aggregate: n is airport_count.sum() }')
        )
        .getSQL();
      expect(sql).not.toMatch(/0 AS DOUBLE\)|0::DOUBLE/i);
    }
  );

  test.when(supported)("the array query's own where:", async () => {
    const query = alaska(
      'by_fac_type -> { where: airport_count > 50; aggregate: n is airport_count.sum() }'
    );
    await expect(query).toEqualResult(tm, [{d: 578}]);
  });

  test.when(anyValue)("the array query's own having:", async () => {
    // Alaska has three facility types; a having: which no row passes leaves
    // no row, so no value
    await expect(
      alaska('by_fac_type -> { aggregate: n is count(); having: n > 3 }')
    ).toEqualResult(tm, [{d: null}]);
    await expect(
      alaska('by_fac_type -> { aggregate: n is count(); having: n > 2 }')
    ).toEqualResult(tm, [{d: 3}]);
  });

  test.when(supported && !anyValue)(
    'with only array functions, a having: is an error',
    async () => {
      await expect(
        runtime
          .loadModel(model)
          .loadQuery(
            alaska('by_fac_type -> { aggregate: n is count(); having: n > 3 }')
          )
          .getSQL()
      ).rejects.toThrow(/cannot query this array: it has a `having:`/);
    }
  );

  test.when(supported)('a where: and a filter with an or', async () => {
    // Of Alaska's facility types, only heliports number under 50. Read as
    // (n < 50 and heliport) or seaplane base, it would be 2.
    const query = alaska(`by_fac_type -> {
      where: airport_count < 50
      aggregate: n is count() {
        where: fac_type = 'HELIPORT' or fac_type = 'SEAPLANE BASE'
      }
    }`);
    await expect(query).toEqualResult(tm, [{d: 1}]);
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

  describe('an aggregate of an array inside the elements', () => {
    test.when(supported)('is over all the inner elements', async () => {
      // Each state's facility types, summed across its counties, are all
      // of its airports.
      await expect(`
        run: states -> {
          aggregate:
            total is nested_total.sum()
            mismatched is count() { where: nested_total != airport_count }
        }
      `).toEqualResult(tm, [{total: 19793, mismatched: 0}]);
    });

    test.when(supported)(
      'min, max and count(x) of the inner array',
      async () => {
        // Alaska's biggest county and facility type group is 41 airports,
        // of 3 facility types
        await expect(`
        run: states -> {
          where: state = 'AK'
          select: biggest_group, type_count
        }
      `).toEqualResult(tm, [{biggest_group: 41, type_count: 3}]);
      }
    );

    test.when(supported)('empty inner arrays and null values', async () => {
      // Most counties have no heliports, and no airport above 8,000 feet.
      // There are 5,135 heliports, at most 151 in one county; 4 states
      // have airports above 8,000 feet, the highest at 12,442.
      await expect(`
        run: states -> {
          aggregate:
            heliports is heliport_total.sum()
            most is heliport_most.max()
            high_total is high_sum.sum()
            highest is high_max.max()
            high_states is count() { where: high_avg is not null }
        }
      `).toEqualResult(tm, [
        {
          heliports: 5135,
          most: 151,
          high_total: 350120,
          highest: 12442,
          high_states: 4,
        },
      ]);
    });

    test.when(supported)(
      'with conditions on the outer and the inner elements',
      async () => {
        // 169 heliports are in counties whose names start with A
        await expect(
          'run: states -> { aggregate: n is a_heliports.sum() }'
        ).toEqualResult(tm, [{n: 169}]);
      }
    );

    test.when(readsBoth)(
      'a condition on both the outer and the inner element',
      async () => {
        // Of the 4,991 county and facility type groups, 1,590 are heliports
        // or in a county named Jefferson
        await expect(
          'run: states -> { aggregate: n is heliport_or_jefferson.sum() }'
        ).toEqualResult(tm, [{n: 1590}]);
      }
    );

    test.when(supported && !readsBoth)(
      'where an inner lambda cannot read the outer one, a condition on both is an error',
      async () => {
        await expect(
          runtime
            .loadModel(model)
            .loadQuery(
              'run: states -> { aggregate: n is heliport_or_jefferson.sum() }'
            )
            .getSQL()
        ).rejects.toThrow(
          /one condition reads both `by_fac_type` and the elements' own fields/
        );
      }
    );
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
        "run: states -> { select: nested_total; where: state = 'AK' }",
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
    test.when(supported && !arrays)(
      'where the dialect returns no arrays, a query with rows is an error',
      async () => {
        await expect(
          runtime
            .loadModel(model)
            .loadQuery(alaska('by_fac_type -> { select: fac_type }'))
            .getSQL()
        ).rejects.toThrow(/can only query an array for one value/);
      }
    );

    test.when(arrays)('select: with a where:', async () => {
      await expect(`
        run: a -> { where: state = 'AK'; select: small_types }
      `).toEqualResult(tm, [
        {small_types: [{fac_type: 'HELIPORT', airport_count: 30}]},
      ]);
    });

    test.when(arrays)('none selected is an empty array', async () => {
      await expect(`
        run: a -> { where: state = 'AK'; select: none }
      `).toEqualResult(tm, [{none: []}]);
    });

    test.when(arrays)('a path into the result', async () => {
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

    test.when(arrays)('select: of an expression', async () => {
      await expect(`
        run: a -> {
          where: state = 'AK'
          aggregate: n is doubled.double_count.sum()
        }
      `).toMatchResult(tm, {n: 1216});
    });

    test.when(arrays)('group_by:, through another dimension', async () => {
      await expect(`
        run: a -> {
          where: state = 'AK' and by_size_again.big = true
          aggregate: n is by_size_again.n.sum()
        }
      `).toMatchResult(tm, {n: 578});
    });

    test.when(arrays)('group_by:', async () => {
      // Alaska's airports and seaplane bases each number over 100
      await expect(`
        run: a -> {
          where: state = 'AK' and by_size.big = true
          aggregate: n is by_size.n.sum()
        }
      `).toMatchResult(tm, {n: 578});
    });

    test.when(arrays)('several stages', async () => {
      await expect(`
        run: a -> {
          where: state = 'AK'
          aggregate: n is busy_types.count()
        }
      `).toMatchResult(tm, {n: 2});
    });

    test.when(arrays)('group_by:, selected, in its order', async () => {
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

    test.when(arrays)(
      'group_by: with where:, having:, order_by: and limit:',
      async () => {
        // Alaska has 474 airports, 104 seaplane bases and 30 heliports
        await expect(
          alaska(`by_fac_type -> {
            where: fac_type != 'AIRPORT'
            group_by: fac_type
            aggregate: n is airport_count.sum()
            having: n > 50
          }`)
        ).toEqualResult(tm, [{d: [{fac_type: 'SEAPLANE BASE', n: 104}]}]);
        await expect(
          alaska(`by_fac_type -> {
            group_by: fac_type
            aggregate: n is airport_count.sum()
            order_by: n desc
            limit: 2
          }`)
        ).toEqualResult(tm, [
          {
            d: [
              {fac_type: 'AIRPORT', n: 474},
              {fac_type: 'SEAPLANE BASE', n: 104},
            ],
          },
        ]);
      }
    );

    test.when(arrays)('group_by:, queried again with ->', async () => {
      await expect(`
        run: a -> {
          where: state = 'AK'
          select: big is by_size -> { where: big = true; aggregate: t is n.sum() }
        }
      `).toEqualResult(tm, [{big: 578}]);
    });

    test.when(arrays)('several stages ending in one aggregate', async () => {
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
    });

    // Alaska's facility types, as a query on its array
    const alaskaTypes = (query: string) => `
      run: a extend { dimension: types is by_fac_type -> ${query} } -> {
        where: state = 'AK'
        select: types
      }
    `;

    test.when(arrays)('order_by: and limit:', async () => {
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

    test.when(arrays)('order_by: a position', async () => {
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

    test.when(arrays)('where: with order_by:', async () => {
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

    test.when(arrays)('order_by: keys in both directions', async () => {
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
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
