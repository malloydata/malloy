/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import type {
  RecordLiteralNode,
  ArrayLiteralNode,
  ArrayTypeDef,
  FieldDef,
  Expr,
  SQLSourceRequest,
} from '@malloydata/malloy';

afterAll(() => testDatabase.shutdown());

/*
 * `array -> { aggregate: ... }`: a query on the elements of an array of the
 * current row, whose value is a value of that row. Experimental.
 */
describe('array queries', () => {
  const support = testDatabase.dialect.arrayQueries;
  const supported = support !== undefined;
  // A query on an array with rows of its own returns them as an array.
  const arrays = support?.arrays === true;
  // A value which array functions cannot compute, such as one with a
  // `having:`, is a correlated subquery where the dialect has one: it
  // computes values that way, or it returns arrays.
  const anyValue = testDatabase.dialect.arrayQueryHasSubquery();
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
    source: a is db.table('malloytest.airports') -> {
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
    source: movies is db.table('malloytest.state_facts') -> {
      select: state, genres is [popular_name, 'any']
    } extend {
      dimension:
        genre_count is genres -> { aggregate: n is count() }
        isabella is genres -> { aggregate: n is count() { where: each = 'Isabella' } }
    }

    // One row per state, with its counties, each with its airports by
    // facility type: an array inside the elements.
    source: states is db.table('malloytest.airports') -> {
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
  const tm = wrapTestModel(testDatabase, model);

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
    const sql = await testDatabase.runtime
      .loadModel(model)
      .loadQuery(query)
      .getSQL();
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
      const sql = await testDatabase.runtime
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
        testDatabase.runtime
          .loadModel(model)
          .loadQuery(
            alaska('by_fac_type -> { aggregate: n is count(); having: n > 3 }')
          )
          .getSQL()
      ).rejects.toThrow(/cannot query this array: it has a `having:`/);
    }
  );

  // What only the compiler can tell, it reports at the array the arrow
  // queries.
  test.when(supported && !anyValue)(
    'with only array functions, a read of an inner array is an error at the arrow',
    async () => {
      const query = `run: states -> {
        where: state = 'AK'
        select: d is by_county -> {
          aggregate: n is count() { where: by_fac_type.fac_type = 'HELIPORT' }
        }
      }`;
      let problems: {code: string; at?: unknown}[] = [];
      try {
        await testDatabase.runtime.loadModel(model).loadQuery(query).getSQL();
      } catch (e) {
        problems = e.problems ?? [];
      }
      expect(problems).toEqual([
        expect.objectContaining({
          code: 'array-query-not-in-place',
          message: expect.stringMatching(
            /it reads `by_fac_type.fac_type`, from an array inside the elements/
          ),
          at: expect.objectContaining({range: expect.anything()}),
        }),
      ]);
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
          testDatabase.runtime
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
    const duckdb = testDatabase.name === 'duckdb';
    async function sqlOf(query: string): Promise<string> {
      return testDatabase.runtime.loadModel(model).loadQuery(query).getSQL();
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
      expect(sql).toMatch(/lambda __by_fac_type_element_0:/);
    });

    test.when(duckdb)('empty and null arrays', async () => {
      await expect(`
        source: lists is db.sql("""
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
          testDatabase.runtime
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

/*
 * Tests for the composite atomic data types "record", "array of values",
 * and "array of records". Each starts with a test that the dialect functions
 * for literals work, and then bases the rest of the tests on literals,
 * so fix that one first if the tests are failing.
 */

function literalNum(num: number): Expr {
  const literal = num.toString();
  return {node: 'numberLiteral', literal, sql: literal};
}

describe('compound atomic datatypes', () => {
  const testModel = wrapTestModel(testDatabase, '');
  const supportsNestedArrays = testDatabase.dialect.nestedArrays;
  const quote = (s: string) => testDatabase.dialect.sqlQuoteIdentifier(s);

  const empty = 'db.sql("SELECT 0 as z")';
  function arraySelectVal(...val: number[]): string {
    const literal: ArrayLiteralNode = {
      node: 'arrayLiteral',
      typeDef: {
        type: 'array',
        elementTypeDef: {type: 'number'},
      },
      kids: {values: val.map(v => literalNum(v))},
    };
    return testDatabase.dialect.sqlLiteralArray(literal);
  }
  function recordLiteral(fromObj: Record<string, number>): RecordLiteralNode {
    const kids: Record<string, Expr> = {};
    const fields: FieldDef[] = Object.keys(fromObj).map(name => {
      kids[name] = literalNum(fromObj[name]);
      return {
        type: 'number',
        name,
      };
    });
    const literal: RecordLiteralNode = {
      node: 'recordLiteral',
      typeDef: {
        type: 'record',
        fields,
      },
      kids,
    };
    literal.sql = testDatabase.dialect.sqlLiteralRecord(literal);
    return literal;
  }
  function recordSelectVal(fromObj: Record<string, number>): string {
    return testDatabase.dialect.sqlLiteralRecord(recordLiteral(fromObj));
  }
  const canReadCompoundSchema = testDatabase.dialect.compoundObjectInSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ab = recordSelectVal({a: 0, b: 1});

  const malloySizes = 'sizes is {s is 0, m is 1, l is 2, xl is 3}';
  const sizesObj = {s: 0, m: 1, l: 2, xl: 3};
  const sizesSQL = recordSelectVal(sizesObj);
  // Keeping the pipeline simpler makes debugging easier, so don't add
  // and extra stage unless you have to
  const sizes = canReadCompoundSchema
    ? `db.sql(""" SELECT ${sizesSQL} AS ${quote('sizes')} """)`
    : `db.sql('SELECT 0 AS O') -> { select: ${malloySizes}}`;
  const evensObj = [2, 4, 6, 8];
  const evensSQL = arraySelectVal(...evensObj);
  const evens = `db.sql("""
      SELECT ${evensSQL} AS ${quote('evens')}
    """)`;
  const d4 = [1, 2, 3, 4];
  const d4SQL = arraySelectVal(...d4);

  describe('simple arrays', () => {
    test('array literal dialect function', async () => {
      await expect(`
          run: ${evens}`).toMatchResult(testModel, {
        evens: evensObj,
      });
    });
    test('select array', async () => {
      await expect(`
          # test.verbose
          run: ${evens}->{select: nn is evens}
          `).toMatchResult(testModel, {nn: evensObj});
    });
    test.when(canReadCompoundSchema)(
      'schema read allows array-un-nest on each',
      async () => {
        await expect(`
          run: ${evens}->{ select: n is evens.each }
        `).toEqualResult(
          testModel,
          evensObj.map(n => ({n}))
        );
      }
    );
    test('array can be passed to !function', async () => {
      // Used as a standin for "unknown function user might call"
      const nameOfArrayLenFunction = {
        'duckdb': 'LEN',
        'standardsql': 'ARRAY_LENGTH',
        'postgres': 'JSONB_ARRAY_LENGTH',
        'presto': 'CARDINALITY',
        'trino': 'CARDINALITY',
        'mysql': 'JSON_LENGTH',
        'snowflake': 'ARRAY_SIZE',
        'databricks': 'SIZE',
      };
      const dialect = testDatabase.dialect.name;
      const missing = `Dialect '${dialect}' missing array length function in nameOfArrayLenFunction`;
      const fn = nameOfArrayLenFunction[dialect] ?? missing;
      expect(fn).not.toEqual(missing);
      await expect(
        `run: ${evens}->{ select: nby2 is ${fn}!number(evens); } `
      ).toMatchResult(testModel, {nby2: evensObj.length});
    });
    test('array.each in source', async () => {
      await expect(`
          run: ${empty}
          extend { dimension: d4 is [1,2,3,4] }
          -> { select: die_roll is d4.each }
        `).toEqualResult(testModel, [
        {die_roll: 1},
        {die_roll: 2},
        {die_roll: 3},
        {die_roll: 4},
      ]);
    });
    test('array.each in extend block', async () => {
      await expect(`
          run: ${empty} -> {
            extend: { dimension: d4 is [1,2,3,4] }
            select: die_roll is d4.each
          }
        `).toEqualResult(testModel, [
        {die_roll: 1},
        {die_roll: 2},
        {die_roll: 3},
        {die_roll: 4},
      ]);
    });
    test.when(canReadCompoundSchema)('cross join two arrays', async () => {
      await expect(`
          run: db.sql("""
            SELECT ${d4SQL} as ${quote('d1')}, ${d4SQL} as ${quote('d2')}
          """) -> { select: roll is d1.each + d2.each }
          -> {
            group_by: roll
            aggregate: n is count()
            order_by: roll asc
          }
          `).toMatchRows(testModel, [
        {roll: 2, n: 1},
        {roll: 3, n: 2},
        {roll: 4, n: 3},
        {roll: 5, n: 4},
        {roll: 6, n: 3},
        {roll: 7, n: 2},
        {roll: 8, n: 1},
      ]);
    });
    // can't use special chars in column names in bq
    test.when(testDatabase.name !== 'bigquery')(
      'array stored field with special chars in name',
      async () => {
        const special_chars = ["'", '"', '.', '`'];
        for (const c of special_chars) {
          const qname = '`_\\' + c + '_`';
          const malloySrc = `
            # test.verbose
            run: ${empty}
            ->{ select: ${qname} is [1]}
            -> { select: num is ${qname}.each }`;
          await expect(malloySrc).toMatchResult(testModel, {});
          const result = await testDatabase.runtime.loadQuery(malloySrc).run();
          const ok =
            result.data.path(0, 'num').value === 1
              ? 'ok'
              : `Array containing ${c} character is not ok`;
          expect(ok).toEqual('ok');
        }
      }
    );
    test.when(supportsNestedArrays && canReadCompoundSchema)(
      'Can read schema for array of arrays',
      async () => {
        // a lot of work to make [[1],[2]] on all dialects
        const aLit: ArrayLiteralNode = {
          node: 'arrayLiteral',
          typeDef: {type: 'array', elementTypeDef: {type: 'number'}},
          kids: {values: []},
        };
        const aOne = {...aLit};
        aOne.kids.values[0] = {node: 'numberLiteral', literal: '1', sql: '1'};
        aOne.sql = testDatabase.dialect.sqlLiteralArray(aOne);
        const aTwo = {...aLit, sql: '2'};
        aTwo.kids.values[0] = {node: 'numberLiteral', literal: '2', sql: '2'};
        aTwo.sql = testDatabase.dialect.sqlLiteralArray(aTwo);
        const aoa: ArrayLiteralNode = {
          node: 'arrayLiteral',
          typeDef: {type: 'array', elementTypeDef: aLit.typeDef},
          kids: {values: [aOne, aTwo]},
        };
        const sql_aoa = testDatabase.dialect.sqlLiteralArray(aoa);
        const asStruct: SQLSourceRequest = {
          connection: 'db',
          selectStr: `SELECT ${sql_aoa} AS aoa`,
        };
        const ret = await (
          await testDatabase.connection()
        ).fetchSchemaForSQLStruct(asStruct, {});
        expect(ret.structDef).toBeDefined();
        const aoa_ent = ret.structDef!.fields[0];
        expect(aoa_ent).toMatchObject(aoa.typeDef);
      }
    );
    test.when(supportsNestedArrays)('bare array of array', async () => {
      await expect(`
          run: ${empty} -> { select: aoa is [[1,2]] }
        `).toMatchResult(testModel, {aoa: [[1, 2]]});
    });
    test.when(supportsNestedArrays)('each.each array of array', async () => {
      await expect(`
          run: ${empty} extend { dimension: aoa is [[1,2]] } -> { select: aoa.each.each }
        `).toEqualResult(testModel, [{each: 1}, {each: 2}]);
    });
    test('group by array', async () => {
      const oddsObj = [1, 3, 5, 7];
      const oddsSql = arraySelectVal(...oddsObj);
      await expect(`
          run: db.sql("""
            SELECT ${evensSQL} as ${quote('nums')}, 1 as ${quote('n')}
            UNION ALL SELECT ${evensSQL}, 10
            UNION ALL SELECT ${oddsSql}, 100
            UNION ALL SELECT ${oddsSql}, 1000
          """) -> {
            group_by: nums
            aggregate: addem is n.sum()
            order_by: addem asc
          }`).toMatchRows(testModel, [
        {nums: evensObj, addem: 11},
        {nums: oddsObj, addem: 1100},
      ]);
    });
  });
  describe('record', () => {
    function rec_eq(as?: string): Record<string, unknown> {
      const name = as ?? 'sizes';
      return {
        [name]: {s: 0, m: 1, l: 2, xl: 3},
      };
    }
    test('record literal object', async () => {
      await expect(`
          run: db.sql("select 0 as o")
          -> { select: ${malloySizes}}
        `).toMatchResult(testModel, rec_eq());
    });
    // can't use special chars in column names in bq
    test.when(testDatabase.name !== 'bigquery')(
      'special character in record property name',
      async () => {
        const special_chars = ["'", '"', '.', '`'];
        for (const c of special_chars) {
          const qname = '_\\' + c + '_';
          const name = '_' + c + '_';
          const malloySrc = `run: ${empty} -> { select: \`${qname}\` is 'ok' }`;
          // no malloyResultMatches because it treats a special in an expect key
          const query = testDatabase.runtime.loadQuery(malloySrc);
          const result = await query.run();
          const p =
            result.data.path(0, name).value === 'ok'
              ? 'ok'
              : `Name containing the ${c} character was not ok`;
          expect(p).toEqual('ok');
        }
      }
    );
    // can't use special chars in column names in bq
    test.when(testDatabase.name !== 'bigquery')(
      'record stored in field with special chars in name',
      async () => {
        const special_chars = ["'", '"', '.', '`'];
        for (const c of special_chars) {
          const qname = '`_\\' + c + '_`';
          const malloySrc = `
            run: ${empty}
            ->{ select: ${qname} is {rnum is 1}}
            -> { select: num is ${qname}.rnum }`;
          const result = await testDatabase.runtime.loadQuery(malloySrc).run();
          const ok =
            result.data.path(0, 'num').value === 1
              ? 'ok'
              : `Array containing ${c} character is not ok`;
          expect(ok).toEqual('ok');
        }
      }
    );
    test.when(canReadCompoundSchema)(
      'can read schema of record object',
      async () => {
        await expect(`run: db.sql("""
              SELECT ${sizesSQL} AS ${quote('sizes')}
          """)`).toMatchResult(testModel, rec_eq());
      }
    );
    test('simple record.property access', async () => {
      await expect(`
          run: ${sizes} -> { select: small is sizes.s }`).toMatchResult(
        testModel,
        {small: 0}
      );
    });
    test('property accessed from aliased record dimension', async () => {
      await expect(`
          source: sx is ${sizes} extend {
            dimension: copy_sizes is sizes
          }
          run: sx -> {select: xl is copy_sizes.xl}
        `).toMatchResult(testModel, {xl: 3});
    });
    test('nested data looks like a record', async () => {
      await expect(`
          run: db.sql('SELECT 1 as ${quote('o')}') -> {
            group_by: row is 'one_row'
            nest: sizes is {
              aggregate:
                s is sum(o) - 1,
                m is sum(o),
                x is sum(o) + 1,
                xl is sum(o) + 2
            }
          } -> { select: small is sizes.s }`).toMatchResult(testModel, {
        small: 0,
      });
    });
    test('record can be selected', async () => {
      await expect(
        `
          run: ${sizes} -> { select: sizes }`
      ).toMatchResult(testModel, rec_eq());
    });
    test('record literal can be selected', async () => {
      await expect(`
          run: ${sizes} -> { select: record is sizes }
        `).toMatchResult(testModel, rec_eq('record'));
    });
    test('select record literal from a source', async () => {
      await expect(`
          run: ${empty} -> {
            extend: { dimension: ${malloySizes} }
            select: sizes
          }
        `).toMatchResult(testModel, rec_eq());
    });
    test('computed record.property from a source', async () => {
      await expect(`
          run: ${empty}
            extend { dimension: record is {s is 0, m is 1, l is 2, xl is 3} }
            -> { select: small is record.s }
        `).toMatchResult(testModel, {small: 0});
    });
    test('record.property from an extend block', async () => {
      await expect(`
          run: ${empty} -> {
            extend: { dimension: record is {s is 0, m is 1, l is 2, xl is 3} }
            select: small is record.s
          }
        `).toMatchResult(testModel, {small: 0});
    });
    test('simple each on array property inside record', async () => {
      await expect(`
          run: ${empty} -> { select: nums is { odds is [1,3], evens is [2,4]} }
          -> { select: odd is nums.odds.value }
        `).toEqualResult(testModel, [{odd: 1}, {odd: 3}]);
    });
    test('each on array property inside record from source', async () => {
      await expect(`
          run: ${empty} extend { dimension: nums is { odds is [1,3], evens is [2,4]} }
          -> { select: odd is nums.odds.each }
        `).toEqualResult(testModel, [{odd: 1}, {odd: 3}]);
    });
    // Both rows hold the same array, so the aggregates are only right if
    // each element's key includes the row the record belongs to.
    const twoRows = `db.sql("""
        SELECT 1 AS ${quote('id')} UNION ALL SELECT 2
      """)`;
    test('aggregate through array in a record column', async () => {
      await expect(`
          run: ${twoRows} -> { select: id, rec is {xs is [1, 2]} }
          -> { aggregate: total is rec.xs.each.sum(), n is rec.xs.count() }
        `).toMatchResult(testModel, {total: 6, n: 4});
    });
    test('aggregate through array in a record dimension', async () => {
      await expect(`
          run: ${twoRows} extend { dimension: rec is {xs is [1, 2]} }
          -> { aggregate: total is rec.xs.each.sum(), n is rec.xs.count() }
        `).toMatchResult(testModel, {total: 6, n: 4});
    });
    test('aggregate through array in a record in a record', async () => {
      await expect(`
          run: ${twoRows} -> { select: id, rec is {mid is {xs is [1, 2]}} }
          -> {
            aggregate:
              total is rec.mid.xs.each.sum()
              n is rec.mid.xs.count()
          }
        `).toMatchResult(testModel, {total: 6, n: 4});
    });
    const abc = "rec is {a is 'a', bc is {b is 'b', c is 'c'}}";
    test('record with a record property', async () => {
      await expect(`
          run: ${empty} -> { select: ${abc} }
          -> { select: rec.a, rec.bc.b, rec.bc.c }
        `).toMatchResult(testModel, {a: 'a', b: 'b', c: 'c'});
    });
    test('record in source with a record property', async () => {
      await expect(`
          run: ${empty} extend { dimension: ${abc} }
          -> { select: rec.a, rec.bc.b, rec.bc.c }
        `).toMatchResult(testModel, {a: 'a', b: 'b', c: 'c'});
    });
    test('record dref in source with a record property', async () => {
      await expect(`
          run: ${empty} extend { dimension: ${abc} }
          -> { select: b is pick rec.bc.b when true else 'b' }
        `).toMatchResult(testModel, {b: 'b'});
    });
    test.todo('array or record where first entries are null');
    // https://github.com/malloydata/malloy/issues/2206
    test.skip('dereference of literal record (causes stack overflow at one point)', async () => {
      await expect(`
          run: db.sql("""
            SELECT ${testDatabase.dialect.sqlLiteralString('Mark')} as first_name,
                   ${testDatabase.dialect.sqlLiteralString('Toy')} as last_name
          """) extend {
            dimension: owner is {first_name, last_name}
          } -> {
            group_by: x is owner.first_name
          }
        `).toMatchResult(testModel, {x: 'Mark'});
    });
    test('record in join references join fields', async () => {
      const id = quote('id');
      const x = quote('x');
      const y = quote('y');
      await expect(`
          source: joined_data is db.sql("""
            SELECT 1 as ${id}, 10 as ${x}, 20 as ${y}
          """) extend { dimension: rec is {xysum is x + y} }
          source: base is db.sql("""SELECT 1 as ${id} """) extend {
            join_one: jd is joined_data on jd.id = id
          }
          run: base -> { select: result is jd.rec.xysum }
        `).toMatchResult(testModel, {result: 30});
    });
  });
  describe('repeated record', () => {
    const abType: ArrayTypeDef = {
      type: 'array',
      elementTypeDef: {type: 'record_element'},
      fields: [
        {name: 'a', type: 'number'},
        {name: 'b', type: 'number'},
      ],
    };
    const values = [
      recordLiteral({a: 10, b: 11}),
      recordLiteral({a: 20, b: 21}),
    ];

    const ab = testDatabase.dialect.sqlLiteralArray({
      node: 'arrayLiteral',
      typeDef: abType,
      kids: {values},
    });
    const ab_eq = [
      {a: 10, b: 11},
      {a: 20, b: 21},
    ];
    function selectAB(n: string) {
      return `SELECT ${ab} AS ${quote(n)}`;
    }
    const abMalloy = '[{a is 10, b is 11}, {a is 20, b is 21}]';

    test('repeated record from nest', async () => {
      await expect(`
            run: db.sql("""
              SELECT
                10 as ${quote('a')},
                11 as ${quote('b')}
              UNION ALL SELECT 20 , 21
            """) -> { nest: ab is { select: a, b } }
                 -> { select: ab.a, ab.b ; order_by: a}
        `).toEqualResult(testModel, ab_eq);
    });
    test('select repeated record from literal dialect functions', async () => {
      await expect(`
          run: db.sql(""" ${selectAB('ab')} """)
        `).toMatchResult(testModel, {ab: ab_eq});
    });
    test('repeat record from malloy literal', async () => {
      await expect(`
          run: ${empty}
          -> { select: ab is ${abMalloy} }
        `).toMatchResult(testModel, {ab: ab_eq});
    });
    test('repeated record can be selected and renamed', async () => {
      const src = `
          run: db.sql("""
            ${selectAB('sqlAB')}
          """) -> { select: ab is sqlAB }
      `;
      await expect(src).toMatchResult(testModel, {ab: ab_eq});
    });
    test('select repeated record passed down pipeline', async () => {
      await expect(`
          run: ${empty}
          -> { select: pipeAb is ${abMalloy} }
          -> { select: ab is pipeAb }
        `).toMatchResult(testModel, {ab: ab_eq});
    });
    test('deref repeat record passed down pipeline', async () => {
      await expect(`
          run: ${empty}
          -> { select: pipeAb is ${abMalloy} }
          -> { select: pipeAb.a, pipeAb.b }
        `).toEqualResult(testModel, ab_eq);
    });
    test('select array of records from source', async () => {
      await expect(`
          run: ${empty}
          extend { dimension: abSrc is ${abMalloy} }
          -> { select: ab is abSrc }
        `).toMatchResult(testModel, {ab: ab_eq});
    });
    test('deref array of records from source', async () => {
      await expect(`
          run: ${empty}
          extend { dimension: ab is ${abMalloy} }
          -> { select: ab.a, ab.b }
        `).toEqualResult(testModel, ab_eq);
    });
    test('repeated record in source wth record property', async () => {
      await expect(`
          run: ${empty} extend { dimension: rec is [ {bc is  {b is 'b'}} ] }
          -> { select: rec.bc.b }
        `).toMatchResult(testModel, {b: 'b'});
    });
    test('piped repeated record containing an array', async () => {
      await expect(`
          run: ${empty} -> {
            select: rrec is [
              { val is 1, names is ['uno', 'one'] },
              { val is 2, names is ['due', 'two'] }
            ]
          } -> {
            select: val is rrec.val, name is rrec.names.each
            order_by: val desc, name asc
          }
        `).toEqualResult(testModel, [
        {val: 2, name: 'due'},
        {val: 2, name: 'two'},
        {val: 1, name: 'one'},
        {val: 1, name: 'uno'},
      ]);
    });
    test('source repeated record containing an array', async () => {
      await expect(`
          run: ${empty} extend {
            dimension: rrec is [
              { val is 1, names is ['uno', 'one'] },
              { val is 2, names is ['due', 'two'] }
            ]
          } -> {
            select: val is rrec.val, name is rrec.names.each
            order_by: val desc, name asc
          }
        `).toEqualResult(testModel, [
        {val: 2, name: 'due'},
        {val: 2, name: 'two'},
        {val: 1, name: 'one'},
        {val: 1, name: 'uno'},
      ]);
    });
    test('group_by repeated record', async () => {
      await expect(`
          run: db.sql(""" ${selectAB('ab')} """) -> { group_by: ab }
        `).toMatchResult(testModel, {ab: ab_eq});
    });
    // test for https://github.com/malloydata/malloy/issues/2065
    test('nest a group_by repeated record', async () => {
      await expect(`
          run: db.sql(""" ${selectAB('ab')} """)
          -> { nest: gab is {group_by: ab } }
          -> { select: gab.ab }
        `).toMatchResult(testModel, {ab: ab_eq});
    });
  });
});

const modelText = `
  source: aircraft_models is db.table('malloytest.aircraft_models') extend {
    primary_key: aircraft_model_code
    measure: model_count is count()
    view: manufacturer_models is {
      group_by: manufacturer
      aggregate: num_models is count()
    }
    view: manufacturer_seats is {
      group_by: manufacturer
      aggregate: total_seats is seats.sum()
    }
  }

  source: aircraft is db.table('malloytest.aircraft') extend {
    primary_key: tail_num
    measure: aircraft_count is count()
  }

  source: funnel is aircraft_models->manufacturer_models extend {
    join_one: seats is aircraft_models->manufacturer_seats
        with manufacturer
  }
`;

const joinModel = wrapTestModel(testDatabase, modelText);
const testModel = wrapTestModel(testDatabase, '');

test.when(
  testDatabase.dialect.supportsNesting &&
    testDatabase.dialect.supportsLeftJoinUnnest
)('model: unnest is left join', async () => {
  await expect(`
        // produce a table with 4 rows that has a nested element
        query: a_states is db.table('malloytest.state_facts')-> {
        where: state ? ~ 'A%'
          group_by: state
          nest: somthing is {group_by: state}
        }

        // join the 4 rows and reference the
        //  nested column. should return all the rows.
        //  If the unnest is an inner join, we'll get back just 4 rows.
        run: db.table('malloytest.state_facts') extend {
          join_one: a_states is a_states with state
        }
        -> {
          group_by: state
          aggregate: c is count()
          nest: a is  {
            group_by: a_states.somthing.state
          }
          limit: 5
        }
      `).toMatchRows(joinModel, [{}, {}, {}, {}, {}]);
});

it.when(testDatabase.dialect.nestedArrays)(
  'finds join dependency in non basic atomic fields',
  async () => {
    await expect(`
      run: db.sql("SELECT 1 as n")
        extend { dimension: a1 is [[1]], a2 is [[2]] }
        -> { select: pick_a1 is pick a1.each when true else a2.each }
      `).toMatchResult(testModel, {pick_a1: [1]});
  }
);

const runsHere = ['bigquery', 'duckdb'].includes(testDatabase.name);

const nestedSourceTableModelText = `
source: ga_sessions is db.table('malloytest.ga_sample') extend {

  measure:
    user_count is count(fullVisitorId)
    session_count is count()
    total_visits is totals.visits.sum()
    total_hits is totals.hits.sum()
    total_page_views is totals.pageviews.sum()
    t2 is totals.pageviews.sum()
    total_productRevenue is hits.product.productRevenue.sum()
    hits_count is hits.count()
    sold_count is hits.count() { where: hits.product.productQuantity > 0 }

  view: by_source is {
    where: trafficSource.\`source\` != '(direct)'
    group_by: trafficSource.\`source\`
    aggregate: hits_count
    limit: 10
  }
  view: by_adContent_bar_chart is {
    group_by: device.browser
    aggregate: user_count
    group_by: device.deviceCategory
  }
  view: by_region is {
    where: geoNetwork.region !~ '%demo%'
    group_by: geoNetwork.region
    aggregate: user_count
    limit: 10
  }
  view: by_device is {
    group_by: device.browser
    aggregate: user_count
    group_by: device.deviceCategory
  }
  view: by_category is {
    group_by: category is hits.product.v2ProductCategory
    aggregate: total_productRevenue
    aggregate: sold_count
    limit: 10
  }
  view: by_hour_of_day is {
    // group_by: gsession_hour is hour(start_time::timestamp)
    aggregate: session_count
    order_by: 1
  }

  view: page_load_times is {
    group_by: hits.page.pageTitle
    aggregate: hit_count is hits.count()
    nest: load_bar_chart is {
      group_by: hit_seconds is floor(hits.latencyTracking.pageLoadTime / 2) * 2
      aggregate: hits_count
    }
    limit: 10
  }

  view: by_page_title is { where: totals.transactionRevenue > 0
    group_by: hits.page.pageTitle
    aggregate: hits_count
    aggregate: sold_count
  }

  view: by_all is {
    nest: by_source
    nest: by_adContent_bar_chart
    nest: by_region
    nest: by_category
  }

  view: search_index is {
    index: *, hits.*, customDimensions.* totals.*, trafficSource.*, hits.product.*
    sample: 1%
  }
}

query: sessions_dashboard is ga_sessions -> {
  nest:
    by_region
    by_device
    by_source
    by_category is {
      group_by: category is hits.product.v2ProductCategory
      aggregate: total_productRevenue
      aggregate: sold_count
    }
}
`;

describe('Nested Source Table', () => {
  const gaModel = wrapTestModel(testDatabase, nestedSourceTableModelText);
  test.when(runsHere)('repeated child of record', async () => {
    await expect('run: ga_sessions->by_page_title').toMatchResult(gaModel, {
      pageTitle: 'Shopping Cart',
    });
  });
});

// No prebuilt shared model, each test is complete.  Makes debugging easier.
function rootDbPath(databaseName: string) {
  return databaseName === 'bigquery' ? 'malloydata-org.' : '';
}

// TODO: Figure out how to generalize this.
function getSplitFunction(db: string) {
  return {
    'bigquery': (column: string, splitChar: string) =>
      `split(${column}, '${splitChar}')`,
    'postgres': (column: string, splitChar: string) =>
      `string_to_array(${column}, '${splitChar}')`,
    'duckdb': (column: string, splitChar: string) =>
      `string_to_array(${column}, '${splitChar}')`,
    'mssql_via_duckdb': (column: string, splitChar: string) =>
      `string_to_array(${column}, '${splitChar}')`,
    'duckdb_wasm': (column: string, splitChar: string) =>
      `string_to_array(${column}, '${splitChar}')`,
    'motherduck': (column: string, splitChar: string) =>
      `string_to_array(${column}, '${splitChar}')`,
    'snowflake': (column: string, splitChar: string) =>
      `split(${column}, '${splitChar}')`,
    'trino': (column: string, splitChar: string) =>
      `split(${column}, '${splitChar}')`,
    'presto': (column: string, splitChar: string) =>
      `split(${column}, '${splitChar}')`,
  }[db];
}

const q = (x: TemplateStringsArray) =>
  testDatabase.dialect.sqlQuoteIdentifier(x.toString());

const runNestedTests =
  testDatabase.dialect.supportsNesting &&
  testDatabase.dialect.readsNestedData &&
  !['presto', 'trino', 'mssql_via_duckdb'].includes(testDatabase.name);

test.when(
  testDatabase.dialect.supportsNesting &&
    testDatabase.dialect.supportsArraysInData
)('array unnest', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  const splitFN = getSplitFunction(testDatabase.name);
  await expect(`
      run: db.sql("""
        SELECT
          ${q`city`},
          ${splitFN!(q`city`, ' ')} as ${q`words`}
        FROM ${rootDbPath(testDatabase.name)}malloytest.aircraft
      """) -> {
        where: words.value is not null
        group_by: words.value
        aggregate: c is count()
      }
      `).toMatchResult(testModel, {c: 145});
});

// make sure we can count the total number of elements when fanning out.
test.when(
  testDatabase.dialect.supportsNesting &&
    testDatabase.dialect.supportsArraysInData
)('array unnest x 2', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  const splitFN = getSplitFunction(testDatabase.name);
  await expect(`
      run: db.sql("""
        SELECT
          ${q`city`},
          ${splitFN!(q`city`, ' ')} as ${q`words`},
          ${splitFN!(q`city`, 'A')} as ${q`abreak`}
        FROM ${rootDbPath(testDatabase.name)}malloytest.aircraft
        WHERE ${q`city`} IS NOT null
      """) -> {
        aggregate:
          b is count()
          c is words.count()
          a is abreak.count()
      }`).toMatchResult(testModel, {b: 3552, c: 4586, a: 6601});
});

test.when(runNestedTests)('can unnest simply from file', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
        source: ga_sample is db.table('malloytest.ga_sample')
        run: ga_sample -> {
          aggregate:
            h is hits.count()
        }
      `).toMatchResult(testModel, {h: 13233});
});

test.when(runNestedTests)('can unnest from file', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
        source: ga_sample is db.table('malloytest.ga_sample')
        run: ga_sample -> {
          where: hits.product.productBrand is not null
          group_by:
            hits.product.productBrand
            hits.product.productSKU
          aggregate:
            h is hits.count()
            c is count()
            p is hits.product.count()
        }
      `).toMatchResult(testModel, {h: 1192, c: 681, p: 1192});
});

test.when(runNestedTests)('can double unnest', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
        source: ga_sample is db.table('malloytest.ga_sample')

        run: ga_sample -> {
          aggregate:
            p is floor(hits.product.productPrice.avg())
        }
      `).toMatchResult(testModel, {p: 23001594});
});

describe('compound type cast', () => {
  const testModel = wrapTestModel(testDatabase, '');
  const one = 'db.sql("SELECT 1 as n")';

  const compoundCasts: {
    name: string;
    castType: string;
    skip?: string[];
    // Databases where CAST(NULL AS this_type) returns [] instead of null
    emptyOn?: string[];
  }[] = [
    {
      name: 'number[]',
      castType: 'number[]',
      emptyOn: ['bigquery'],
    },
    {
      name: '{a :: number, b :: string}',
      castType: '{a :: number, b :: string}',
      skip: ['postgres'],
    },
    {
      name: '{a :: number, b :: string}[]',
      castType: '{a :: number, b :: string}[]',
      skip: ['postgres'],
      emptyOn: ['bigquery', 'trino', 'presto'],
    },
    {
      name: '{a :: number, b :: string[]}',
      castType: '{a :: number, b :: string[]}',
      skip: ['postgres'],
    },
  ];

  for (const {name, castType, skip, emptyOn} of compoundCasts) {
    const shouldRun = !skip?.includes(testDatabase.name);
    test.when(shouldRun)(`null::${name}`, async () => {
      const expected = emptyOn?.includes(testDatabase.name) ? [] : null;
      await expect(`
          run: ${one} -> { select: v is null::${castType} }
        `).toMatchResult(testModel, {v: expected});
    });
  }
});
