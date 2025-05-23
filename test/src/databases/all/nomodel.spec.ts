/* eslint-disable no-console */
/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

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
    // TODO (vitor): Not sure about this
    'tsql': (column: string, splitChar: string) =>
      `split(${column}, '${splitChar}')`,
  }[db];
}

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  const q = runtime.getQuoter();

  // Issue: #1284
  it(`parenthesize output field values - ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.aircraft') -> {
        group_by: r is 1.0

        calculate:
          zero is 1 - rank()
          zero_bare  is 0 - zero
          zero_paren is 0 - (zero)
      }
    `).malloyResultMatches(runtime, {zero_bare: 0, zero_paren: 0});
  });

  // Issue: #151
  it(`bug 151 which used to throw unknown dialect is still fixed- ${databaseName}`, async () => {
    await expect(`
      query: q is ${databaseName}.table('malloytest.aircraft')->{
        where: state is not null
        group_by: state
      }
      run: q extend {
        view: foo is {
          order_by: 1 desc
          group_by: state
        }
      } -> foo
      `).malloyResultMatches(runtime, {state: 'WY'});
  });

  // Issue #149
  it(`refine query from query  - ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.state_facts')
        -> {group_by: state; order_by: 1 desc; limit: 1}
        extend {
          dimension: lower_state is lower(state)
        } -> {select: lower_state}
    `).malloyResultMatches(runtime, {lower_state: 'wy'});
  });

  // issue #157
  it(`source- not -found  - ${databaseName}`, async () => {
    // console.log(result.data.toObject());
    let error;
    try {
      await runtime
        .loadQuery(
          `
        source: foo is ${databaseName}.table('malloytest.state_facts') extend {primary_key: state}
        run: foox->{aggregate: c is count()}
       `
        )
        .run();
    } catch (e) {
      error = e;
    }
    expect(error.toString()).not.toContain('Unknown Dialect');
  });

  it(`join_many - ${databaseName}`, async () => {
    await expect(`
      source: m is ${databaseName}.table('malloytest.aircraft_models') extend {
        join_many:
          a is ${databaseName}.table('malloytest.aircraft') extend {
            measure: avg_year is floor(avg(year_built))
          } on a.aircraft_model_code=aircraft_model_code
        measure: avg_seats is floor(avg(seats))
      }
      run: m->{aggregate: avg_seats, a.avg_year}
      `).malloyResultMatches(runtime, {avg_year: 1969, avg_seats: 7});
  });

  it(`join_many condition no primary key - ${databaseName}`, async () => {
    await expect(`
      source: a is ${databaseName}.table('malloytest.airports')
      source: b is ${databaseName}.table('malloytest.state_facts') extend {
        join_many: a on state=a.state
      }
      run: b->{aggregate: c is airport_count.sum()}
    `).malloyResultMatches(runtime, {c: 19701});
  });

  it(`join_many filter multiple values - ${databaseName}`, async () => {
    await expect(`
      source: a is ${databaseName}.table('malloytest.airports') extend {
        where: state = 'NH' | 'CA'
      }
      run: ${databaseName}.table('malloytest.state_facts') extend {
        join_many: a on state=a.state
      } -> {
        aggregate: c is airport_count.sum()
        group_by: a.state
      }
    `).malloyResultMatches(runtime, [
      {state: null, c: 18605},
      {state: 'CA', c: 984},
      {state: 'NH', c: 112},
    ]);
  });

  it(`join_one condition no primary key - ${databaseName}`, async () => {
    await expect(`
      source: a is ${databaseName}.table('malloytest.state_facts')
      source: b is ${databaseName}.table('malloytest.airports') extend {
        join_one: a on state=a.state
      }
      run: b -> {
        aggregate: c is a.airport_count.sum()
      }
    `).malloyResultMatches(runtime, {c: 19701});
  });

  it(`join_one filter multiple values - ${databaseName}`, async () => {
    await expect(`
      source: a is ${databaseName}.table('malloytest.state_facts') extend {
        where: state = 'TX' | 'LA'
      }
      source: b is ${databaseName}.table('malloytest.airports') extend {
        join_one: a on state=a.state
      }
      run: b-> {
        aggregate: c is a.airport_count.sum()
        group_by: a.state
      }
    `).malloyResultMatches(runtime, [
      {state: 'TX', c: 1845},
      {state: 'LA', c: 500},
      {state: null, c: 0},
    ]);
  });

  it(`join_many cross from  - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    await expect(`
      source: a is ${databaseName}.table('malloytest.state_facts') extend {
        dimension: x is airport_count/10000
      }
      source: f is a extend {
        join_cross: a
      }
      run: f->{
        aggregate:
          row_count is count(concat(state,a.state))
          left_count is count()
          right_count is a.count()
          left_sum is airport_count.sum()
          right_sum is a.airport_count.sum()
          left_small_sum is round(x.sum() * 10000)
          right_small_sum is round(x.sum() * 10000)
      }
    `).malloyResultMatches(runtime, {
      row_count: 51 * 51,
      left_sum: 19701,
      right_sum: 19701,
      left_small_sum: 19701,
      right_small_sum: 19701,
    });
  });

  it(`join_one only  - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    await expect(`
      query: q is ${databaseName}.table('malloytest.state_facts')->{
        aggregate: r is airport_count.sum()
      }
      source: f is ${databaseName}.table('malloytest.state_facts') extend {
        join_one: a is q
      }
      run: f->{
        aggregate:
          row_count is count(concat(state,a.r::string))
          left_sum is airport_count.sum()
          right_sum is a.r.sum()
          sum_sum is sum(airport_count + a.r)
      }
    `).malloyResultMatches(runtime, {
      row_count: 51,
      left_sum: 19701,
      right_sum: 19701,
      sum_sum: 19701 + 51 * 19701,
    });
  });

  it(`join_many cross ON  - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    await expect(`
      source: a is ${databaseName}.table('malloytest.state_facts')
      source: f is a extend {
        join_cross: a on a.state = 'CA' | 'NY'
      }
      run: f->{
        aggregate:
          row_count is count(concat(state,a.state))
          left_sum is airport_count.sum()
          right_sum is a.airport_count.sum()
      }
    `).malloyResultMatches(runtime, {
      row_count: 51 * 2,
      left_sum: 19701,
      right_sum: 1560,
    });
  });

  it(`limit - provided - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    const result = await runtime
      .loadQuery(
        `
      run: ${databaseName}.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: c is count()
        limit: 3
      }
      `
      )
      .run();
    expect(result.resultExplore.limit).toBe(3);
  });

  const matrixModel = `
      ##! experimental.join_types
      source: am_states is ${databaseName}.table('malloytest.state_facts') -> {
        select: *
        where: state ~ r'^(A|M)'
      } extend {
        measure:
          am_count is count()
          am_sum is airport_count.sum()
      }

      query: ac_states_base is ${databaseName}.table('malloytest.state_facts') -> {
        select: *
        where: state ~ r'^(A|C)'
      }

      // mulitply the number of rows in ac_states so we have a many to one join
      source: ac_states is ac_states_base -> {
        extend: {
          join_cross: b is ac_states_base
        }
        select:
          b.state
          b.airport_count
      } extend {
        measure:
          ac_count is count()
          ac_sum is airport_count.sum()
      }
  `;

  it(`join inner- ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    await expect(`
      ${matrixModel}
      run: ac_states -> {
        extend: {
          join_one: am_states inner on state = am_states.state
        }
        aggregate:
          ac_count
          ac_sum
          am_states.am_sum
          am_states.am_count

      }
      `).malloyResultMatches(runtime, {
      ac_count: 28,
      ac_sum: 10402,
      am_count: 4,
      am_sum: 1486,
      //show_sql_fail: 1,
    });
  });

  it(`join left - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    await expect(`
      ${matrixModel}
      run: ac_states -> {
        extend: {
          join_one: am_states left on state = am_states.state
        }
        aggregate:
          ac_count
          ac_sum
          am_states.am_sum
          am_states.am_count

      }
      `).malloyResultMatches(runtime, {
      ac_count: 49,
      ac_sum: 21336,
      am_count: 4,
      am_sum: 1486,
      //show_sql_fail: 1,
    });
  });

  it(`join right - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    await expect(`
      ${matrixModel}
      run: ac_states -> {
        extend: {
          join_one: am_states right on state = am_states.state
        }
        aggregate:
          ac_count
          ac_sum
          am_states.am_sum
          am_states.am_count

      }
      `).malloyResultMatches(runtime, {
      ac_count: 28,
      ac_sum: 10402,
      am_count: 12,
      am_sum: 4139,
      //show_sql_fail: 1,
    });
  });

  it.when(runtime.dialect.supportsFullJoin)(
    `join full - ${databaseName}`,
    async () => {
      // a cross join produces a Many to Many result.
      // symmetric aggregate are needed on both sides of the join
      // Check the row count and that sums on each side work properly.
      await expect(`
      ${matrixModel}
      run: ac_states -> {
        extend: {
          join_one: am_states full on state = am_states.state
        }
        aggregate:
          ac_count
          ac_sum
          am_states.am_sum
          am_states.am_count

      }
      `).malloyResultMatches(runtime, {
        ac_count: 49,
        ac_sum: 21336,
        am_count: 12,
        am_sum: 4139,
      });
    }
  );

  it(`leafy count - ${databaseName}`, async () => {
    // in a joined table when the joined is leafiest
    //  we need to make sure we don't count rows that
    //  don't match the join.
    await expect(`
      source: am_states is ${databaseName}.table('malloytest.state_facts') -> {
        select: *
        where: state ~ r'^(A|M)'
      }

      source: states is ${databaseName}.table('malloytest.state_facts') extend {
        join_many: am_states on state=am_states.state
      }

      run: states -> {
        where: state = 'CA'
        aggregate:
          leafy_count is am_states.count()
          root_count is count()
      }
      `).malloyResultMatches(runtime, {
      leafy_count: 0,
      root_count: 1,
    });
  });

  it(`nest/unnest -basic - ${databaseName}`, async () => {
    // in a joined table when the joined is leafiest
    //  we need to make sure we don't count rows that
    //  don't match the join.
    await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: c is airport_count.sum()
        nest: p is {
          group_by: popular_name
          aggregate: d is airport_count.sum()
        }
      } -> {
        group_by: state, c
        aggregate: p.d.sum()
      }
      `).malloyResultMatches(runtime, {
      state: 'TX',
      c: 1845,
      d: 1845,
    });
  });

  it(`count at root should not use distinct key - ${databaseName}`, async () => {
    const q = await runtime
      .loadQuery(
        `
      source: states is ${databaseName}.table('malloytest.state_facts')

      run: states -> { aggregate: c is count() }
      `
      )
      .run();
    expect(q.sql.toLowerCase()).not.toContain('distinct');
  });

  it.when(runtime.dialect.supportsLeftJoinUnnest)(
    `leafy nested count - ${databaseName}`,
    async () => {
      // in a joined table when the joined is leafiest
      //  we need to make sure we don't count rows that
      //  don't match the join.
      await expect(`
      source: am_states is ${databaseName}.table('malloytest.state_facts') -> {
        group_by: state,popular_name
        where: state ~ r'^(A|M)'
        nest: nested_state is {
          group_by: state,popular_name
        }
      }

      source: states is ${databaseName}.table('malloytest.state_facts') extend {
        join_many: am_states on state=am_states.state
      }
      run: states -> {
        where: state = 'CA'
        group_by:
          state
          am_state is am_states.state
        aggregate:
          leafy_count is am_states.nested_state.count()
          root_count is count()
      }
      `).malloyResultMatches(runtime, {
        leafy_count: 0,
        root_count: 1,
        state: 'CA',
        am_state: null,
      });
    }
  );

  it(`basic index - ${databaseName}`, async () => {
    // Make sure basic indexing works.
    await expect(`
      run: ${databaseName}.table('malloytest.flights') -> {
        index: *
      }
      -> {
        select: *
        order_by: fieldValue
        where: fieldName = 'carrier'
      }
      `).malloyResultMatches(runtime, {
      fieldValue: 'AA',
    });
  });

  test.when(runtime.supportsNesting)(
    `number as null 2 - ${databaseName}`,
    async () => {
      // a cross join produces a Many to Many result.
      // symmetric aggregate are needed on both sides of the join
      // Check the row count and that sums on each side work properly.
      await expect(`
        # test.verbose
        run: ${databaseName}.table('malloytest.state_facts') -> {
          group_by: state
          nest: ugly is {
            group_by: popular_name
            aggregate: foo is NULLIF(sum(airport_count)*0,0)+1
          }
        }
      `).malloyResultMatches(runtime, {'ugly.foo': null});
    }
  );

  it(`sql block- ${databaseName}`, async () => {
    await expect(`
      source: one is ${databaseName}.sql("""
        SELECT 2 as ${q`a`}
      """)
      run: one -> {
        select: a
      }`).malloyResultMatches(runtime, {a: 2});
  });

  // average should only include non-null values in the denominator
  it(`avg ignore null- ${databaseName}`, async () => {
    await expect(`
      source: one is ${databaseName}.sql("""
        SELECT 2 as ${q`a`}
        UNION ALL SELECT 4
        UNION ALL SELECT null
      """)
      run: one -> {
        extend: { join_cross: x1 is one }
        aggregate:
          avg_a is a.avg()
          avg_b is x1.a.avg()
      }`).malloyResultMatches(runtime, {avg_a: 3});
  });

  it(`limit - not provided - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    const result = await runtime
      .loadQuery(
        `run: ${databaseName}.table('malloytest.state_facts') -> {
          group_by: state
          aggregate: c is count()
        }`
      )
      .run();
    expect(result.resultExplore.limit).toBe(undefined);
  });

  it(`ungrouped top level - ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.state_facts') extend {
        measure: total_births is births.sum()
        measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
      } -> {
        group_by: state
        aggregate: births_per_100k
      }`).malloyResultMatches(runtime, {births_per_100k: 9742});
  });

  test.when(runtime.supportsNesting)(
    `ungrouped top level with nested  - ${databaseName}`,
    async () => {
      await expect(`
      run: ${databaseName}.table('malloytest.state_facts') extend {
        measure: total_births is births.sum()
        measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
      } -> {
        group_by: state
        aggregate: births_per_100k
        nest: by_name is {
          group_by: popular_name
          aggregate: total_births
        }
        limit: 1000
      }`).malloyResultMatches(runtime, {births_per_100k: 9742});
    }
  );

  it(`ungrouped - eliminate rows  - ${databaseName}`, async () => {
    await expect(`
      run : ${databaseName}.table('malloytest.state_facts') extend {
        measure: m is all(births.sum())
        where: state='CA' | 'NY'
      } -> {
        order_by: state
        group_by: state
        aggregate: m
      }`).malloyResultMatches(runtime, [
      {state: 'CA', m: 52504699},
      {state: 'NY', m: 52504699},
    ]);
  });

  test.when(runtime.supportsNesting)(
    `ungrouped nested with no grouping above - ${databaseName}`,
    async () => {
      await expect(`
        // # test.debug
        run: ${databaseName}.table('malloytest.state_facts') extend {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
        } -> {
          aggregate: total_births
          nest: by_name is {
            group_by: popular_name
            aggregate: births_per_100k
          }
        }`).malloyResultMatches(runtime, {'by_name.births_per_100k': 66703});
    }
  );

  test.when(runtime.supportsNesting)(
    `ungrouped - partial grouping - ${databaseName}`,
    async () => {
      await expect(`
        run: ${databaseName}.table('malloytest.airports') extend {
          measure: c is count()
        } -> {
          where: state = 'TX' | 'NY'
          group_by:
            faa_region
            state
          aggregate:
            c
            all_ is all(c)
            airport_count is c { where: fac_type = 'AIRPORT'}
          nest: fac_type is {
            group_by: fac_type
            aggregate:
              c
              all_ is all(c)
              all_state_region is exclude(c,fac_type)
              all_of_this_type is exclude(c, state, faa_region)
              all_top is exclude(c, state, faa_region, fac_type)
          }
        }
      `).malloyResultMatches(runtime, {
        'fac_type.all_': 1845,
        'fac_type.all_state_region': 1845,
        'fac_type.all_of_this_type': 1782,
        'fac_type.all_top': 2421,
      });
    }
  );

  test.when(runtime.supportsNesting)(
    `ungrouped - all nested - ${databaseName}`,
    async () => {
      await expect(`
        run: ${databaseName}.table('malloytest.airports') extend {
          measure: c is count()
        } -> {
          where: state = 'TX' | 'NY'
          group_by:
            state
          aggregate:
            c
            all_ is all(c)
            airport_count is c { where: fac_type = 'AIRPORT'}
          nest: fac_type is {
            group_by: fac_type, major
            aggregate:
              c
              all_ is all(c)
              all_major is all(c,major)
          }
        }
      `).malloyResultMatches(runtime, {
        'fac_type.all_': 1845,
        'fac_type.all_major': 1819,
      });
    }
  );

  test.when(runtime.supportsNesting)(
    `ungrouped nested  - ${databaseName}`,
    async () => {
      await expect(`
        run: ${databaseName}.table('malloytest.state_facts') extend {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
        } -> {
          group_by: popular_name
          nest: by_state is {
            group_by: state
            aggregate: births_per_100k
          }
        }
      `).malloyResultMatches(runtime, {'by_state.births_per_100k': 36593});
    }
  );

  test.when(runtime.supportsNesting)(
    `ungrouped nested expression  - ${databaseName}`,
    async () => {
      await expect(`
        run: ${databaseName}.table('malloytest.state_facts') extend {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
        } -> {
          group_by: upper_name is upper(popular_name)
          nest: by_state is {
            group_by: state
            aggregate: births_per_100k
          }
        }
      `).malloyResultMatches(runtime, {'by_state.births_per_100k': 36593});
    }
  );

  test.when(runtime.supportsNesting)(
    `ungrouped nested group by float  - ${databaseName}`,
    async () => {
      await expect(`
        run: ${databaseName}.table('malloytest.state_facts') extend {
          measure: total_births is births.sum()
          measure: ug is all(total_births)
        } -> {
          group_by: f is floor(airport_count/300.0)
          nest: by_state is {
            group_by: state
            aggregate: ug
          }
        }
      `).malloyResultMatches(runtime, {'by_state.ug': 62742230});
    }
  );

  it(`run simple sql - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(`run: conn.sql('select 1 as ${q`one`}')`)
      .run();
    expect(result.data.value[0]['one']).toBe(1);
  });

  it(`simple sql is exactly as written - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(`run: conn.sql('select 1 as ${q`one`}')`)
      .run();
    if (databaseName === 'postgres') {
      expect(result.sql).toBe(`WITH __stage0 AS (
  select 1 as ${q`one`})
SELECT row_to_json(finalStage) as row FROM __stage0 AS finalStage`);
    } else {
      expect(result.sql).toBe(`select 1 as ${q`one`}`);
    }
    expect(result.resultExplore).not.toBeUndefined();
  });

  it(`source from query defined as sql query - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        query: q is conn.sql('select 1 as ${q`one`}')
        source: s is q
        run: s -> { select: * }
      `
      )
      .run();
    expect(result.data.path(0, 'one').number.value).toBe(1);
  });

  it(`source from query defined as other query - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        query: q is conn.table('malloytest.flights') -> { group_by: carrier }
        source: s is q
        run: s -> { select: *; order_by: carrier }
      `
      )
      .run();
    expect(result.data.path(0, 'carrier').string.value).toBe('AA');
  });

  it(`all with parameters - basic  - ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.state_facts') extend  {
        measure: total_births is births.sum()
      } -> {
        group_by: popular_name, state
        aggregate:
          total_births
          all_births is all(total_births)
          all_name is exclude(total_births, state)
      }
    `).malloyResultMatches(runtime, {
      all_births: 295727065,
      all_name: 197260594,
    });
  });

  test.when(runtime.supportsNesting)(
    `all with parameters - nest  - ${databaseName}`,
    async () => {
      await expect(`
        run: ${databaseName}.table('malloytest.state_facts') extend {
          measure: total_births is births.sum()
          dimension: abc is floor(airport_count/300)
        } -> {
          group_by: abc
          aggregate: total_births
          nest: by_stuff is {
            group_by: popular_name, state
            aggregate:
              total_births
              all_births is all(total_births)
              all_name is exclude(total_births, state)
          }
        }
      `).malloyResultMatches(runtime, {
        'by_stuff.all_births': 119809719,
        'by_stuff.all_name': 61091215,
      });
    }
  );

  test.when(
    runtime.supportsNesting && runtime.dialect.supportsPipelinesInViews
  )(`single value to udf - ${databaseName}`, async () => {
    await expect(`
        run: ${databaseName}.table('malloytest.state_facts') extend {
          view: fun is {
            aggregate: t is count()
          } -> { select: t1 is t+1 }
        } -> { nest: fun }
      `).malloyResultMatches(runtime, {'fun.t1': 52});
  });

  test.when(
    runtime.supportsNesting && runtime.dialect.supportsPipelinesInViews
  )(
    `Multi value to udf - ${databaseName}`,

    async () => {
      await expect(`
        run: ${databaseName}.table('malloytest.state_facts') extend {
          view: fun is {
            group_by: one is 1
            aggregate: t is count()
          } -> { select: t1 is t+1 }
        } -> {
          group_by: two is 2
          nest: fun
        }
      `).malloyResultMatches(runtime, {'fun.t1': 52});
    }
  );

  test.when(
    runtime.supportsNesting && runtime.dialect.supportsPipelinesInViews
  )(`Multi value to udf group by - ${databaseName}`, async () => {
    await expect(`
        run: ${databaseName}.table('malloytest.state_facts') extend {
          view: fun is {
            group_by: one is 1
            aggregate: t is count()
          } -> { group_by: t1 is t+1 }
        } -> {
          nest: fun
        }
      `).malloyResultMatches(runtime, {'fun.t1': 52});
  });

  const sql1234 = `${databaseName}.sql('SELECT 1 as ${q`a`}, 2 as ${q`b`} UNION ALL SELECT 3, 4')`;

  it(`sql as source - ${databaseName}`, async () => {
    await expect(`
      run: ${sql1234} -> {
        select: a
        order_by: 1
      }
    `).malloyResultMatches(runtime, {a: 1});
  });

  // have to add an order_by: otherwise it isn't deterministic.
  it(`sql directly - ${databaseName}`, async () => {
    await expect(
      `run: ${sql1234}->{
        select: *
        order_by: a asc
      }`
    ).malloyResultMatches(runtime, {a: 1});
  });

  // weirdly '*' must be the first thing in the select list in MySQL
  it(`sql with turducken- ${databaseName}`, async () => {
    const turduckenQuery = `
      run: ${databaseName}.sql("""
        SELECT
          *
          , 'something' as SOMETHING
        FROM %{
          ${databaseName}.table('malloytest.state_facts') -> {
            group_by: popular_name
            aggregate: state_count is count()
          }
        } AS by_name_query
      """) -> {
          select: *; where: popular_name = 'Emma'
          order_by: state_count DESC
        }`;
    await expect(turduckenQuery).malloyResultMatches(runtime, {state_count: 6});
  });

  // local declarations
  it(`local declarations external query - ${databaseName}`, async () => {
    await expect(`
      run: ${sql1234} -> {
        extend: { dimension: c is a + 1 }
        select: c
        order_by: 1
      }
    `).malloyResultMatches(runtime, {c: 2});
  });

  it(`local declarations named query - ${databaseName}`, async () => {
    await expect(`
      run: ${sql1234} extend {
        view: bar is {
          extend: { dimension: c is a + 1 }
          select: c
          order_by: 1
        }
      } -> bar
    `).malloyResultMatches(runtime, {c: 2});
  });

  it(`local declarations refined named query - ${databaseName}`, async () => {
    await expect(`
      run: ${sql1234} extend {
        view: bar is {
          extend: {dimension: c is a + 1}
          select: c
          order_by: 1
        }
        view: baz is bar +  {
          extend: {dimension: d is c + 1}
          select: d
          order_by: 1
        }
      } -> baz
    `).malloyResultMatches(runtime, {d: 3});
  });

  it(`regexp match- ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.sql("""
        SELECT 'hello mom' as ${q`a`}, 'cheese tastes good' as ${q`b`}
        UNION ALL SELECT 'lloyd is a bozo', 'michael likes poetry'
      """) -> {
        aggregate: llo is count() {where: a ~ r'llo'}
        aggregate: m2 is count() {where: a !~ r'bozo'}
      }
    `).malloyResultMatches(runtime, {llo: 2, m2: 1});
  });

  it(`substitution precedence- ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.sql("""
        SELECT 5 as ${q`a`}, 2 as ${q`b`}
        UNION ALL SELECT 3, 4
      """) -> {
        extend: {dimension:  c is b + 4}
        select: x is  a * c
        order_by: x desc
      }
      `).malloyResultMatches(runtime, {x: 30});
  });

  test.when(runtime.supportsNesting && runtime.dialect.supportsArraysInData)(
    `array unnest - ${databaseName}`,
    async () => {
      const splitFN = getSplitFunction(databaseName);
      await expect(`
      run: ${databaseName}.sql("""
        SELECT
          ${q`city`},
          ${splitFN!(q`city`, ' ')} as ${q`words`}
        FROM ${rootDbPath(databaseName)}malloytest.aircraft
      """) -> {
        where: words.value is not null
        group_by: words.value
        aggregate: c is count()
      }
      `).malloyResultMatches(runtime, {c: 145});
    }
  );

  // make sure we can count the total number of elements when fanning out.
  test.when(runtime.supportsNesting && runtime.dialect.supportsArraysInData)(
    `array unnest x 2 - ${databaseName}`,
    async () => {
      const splitFN = getSplitFunction(databaseName);
      await expect(`
      run: ${databaseName}.sql("""
        SELECT
          ${q`city`},
          ${splitFN!(q`city`, ' ')} as ${q`words`},
          ${splitFN!(q`city`, 'A')} as ${q`abreak`}
        FROM ${rootDbPath(databaseName)}malloytest.aircraft
        WHERE ${q`city`} IS NOT null
      """) -> {
        aggregate:
          b is count()
          c is words.count()
          a is abreak.count()
      }`).malloyResultMatches(runtime, {b: 3552, c: 4586, a: 6601});
    }
  );

  test.when(
    runtime.supportsNesting &&
      runtime.dialect.readsNestedData &&
      databaseName !== 'presto' &&
      databaseName !== 'trino'
  )(`can unnest simply from file - ${databaseName}`, async () => {
    await expect(`
        source: ga_sample is ${databaseName}.table('malloytest.ga_sample')
        run: ga_sample -> {
          aggregate:
            h is hits.count()
        }
      `).malloyResultMatches(runtime, {h: 13233});
  });

  test.when(
    runtime.supportsNesting &&
      runtime.dialect.readsNestedData &&
      databaseName !== 'presto' &&
      databaseName !== 'trino'
  )(`can unnest from file - ${databaseName}`, async () => {
    await expect(`
        source: ga_sample is ${databaseName}.table('malloytest.ga_sample')
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
      `).malloyResultMatches(runtime, {h: 1192, c: 681, p: 1192});
  });

  test.when(
    runtime.supportsNesting &&
      runtime.dialect.readsNestedData &&
      databaseName !== 'presto' &&
      databaseName !== 'trino'
  )(`can double unnest - ${databaseName}`, async () => {
    await expect(`
        source: ga_sample is ${databaseName}.table('malloytest.ga_sample')

        run: ga_sample -> {
          aggregate:
            p is floor(hits.product.productPrice.avg())
        }
      `).malloyResultMatches(runtime, {p: 23001594});
  });

  test.when(runtime.supportsNesting)(
    `nest null - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        run: ${databaseName}.table('malloytest.airports') -> {
          where: faa_region is null
          group_by: faa_region
          aggregate: airport_count is count()
          nest: by_state is {
            where: state is not null
            group_by: state
            aggregate: airport_count is count()
          }
          nest: by_state1 is {
            where: state is not null
            group_by: state
            aggregate: airport_count is count()
            limit: 1
          }
        }
      `
        )
        .run();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = result.data.toObject();
      expect(d[0]['by_state']).not.toBe(null);
      expect(d[0]['by_state1']).not.toBe(null);
    }
  );

  test.when(
    runtime.supportsNesting && runtime.dialect.supportsPipelinesInViews
  )(`Nested pipelines sort properly - ${databaseName}`, async () => {
    const doTrace = false; // Have to turn this on to debug this test
    const result = await runtime
      .loadQuery(
        `
        source: state_facts is ${databaseName}.table('malloytest.state_facts')
        extend {
            view: base_view is {
                group_by: state
                aggregate: airports is sum(airport_count)
                order_by: airports asc
            }
            ->
            {
                group_by: state
                aggregate: airports.sum()
                order_by: airports
            }
            view: base_view2 is {
                group_by: state
                aggregate: aircrafts is sum(aircraft_count)
                order_by: aircrafts asc
            }
            ->
            {
                group_by: state
                aggregate: aircrafts.sum()
                order_by: aircrafts
            }
            view: base_view3 is {
                group_by: state
                aggregate: aircrafts is sum(aircraft_count)
            }
            -> {
              group_by: state
              aggregate: aircrafts.sum()
            }
            view: sort_issue is {
                where: popular_name ~ r'I'
                group_by: popular_name
                nest: base_view
                nest: base_view2
                nest: base_view3
            }
        }
        run: state_facts -> sort_issue
      `
      )
      .run();
    if (doTrace) console.log(result.sql);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = result.data.toObject();
    const baseView: {state: string; airports: number}[] = d[0]['base_view'];
    if (doTrace) console.log(baseView);
    let baseMax = baseView[0];
    for (const b of baseView) {
      expect(b.airports).toBeGreaterThanOrEqual(baseMax.airports);
      baseMax = b;
    }

    const baseView2: {state: string; aircrafts: number}[] = d[0]['base_view2'];
    if (doTrace) console.log(baseView2);
    let baseMax2 = baseView2[0];
    for (const b of baseView2) {
      expect(b.aircrafts).toBeGreaterThanOrEqual(baseMax2.aircrafts);
      baseMax2 = b;
    }
    // implicit order by
    const baseView3: {state: string; aircrafts: number}[] = d[0]['base_view3'];
    if (doTrace) console.log(baseView3);
    let baseMax3 = baseView3[0];
    for (const b of baseView3) {
      expect(b.aircrafts).toBeLessThanOrEqual(baseMax3.aircrafts);
      baseMax3 = b;
    }
  });

  test.when(runtime.supportsNesting)(
    `number as null- ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        source: s is ${databaseName}.table('malloytest.state_facts') extend {
        }
        run: s-> {
          group_by: state
          nest: ugly is {
            group_by: popular_name
            aggregate: foo is NULLIF(sum(airport_count)*0,0)+1
          }
        }
      `
        )
        .run();
      expect(result.data.path(0, 'ugly', 0, 'foo').value).toBe(null);
    }
  );

  it(`removes surpuflous order_by - solo aggregates - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      run: ${databaseName}.table('malloytest.state_facts') -> {
        aggregate: airport_count.sum()
      }
      `
      )
      .run();
    expect(result.sql).not.toContain('ORDER BY');
  });

  it(`removes surpuflous order_by - pipeline - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      run: ${databaseName}.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: airport_count.sum()
        order_by: state desc
      }
      -> {
        aggregate: airport_count.sum()
      }
      `
      )
      .run();
    expect(result.sql).not.toContain('ORDER BY');
  });

  it(`removes surpuflous order_by - joined_query - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      query: foo is  ${databaseName}.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: airport_count.sum()
        order_by: state desc
      }

      run: ${databaseName}.table('malloytest.state_facts') -> {
        extend: {
          join_one: foo on state = foo.state
        }
        aggregate: x is foo.airport_count.sum()
      }
      `
      )
      .run();
    expect(result.sql).not.toContain('ORDER BY');
  });

  it(`removes surpuflous order_by - joined_query pipeline - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      query: foo is  ${databaseName}.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: airport_count.sum()
        order_by: state desc
      } -> {
        group_by: state
        aggregate: airport_count.sum()
        order_by: state desc
      }

      run: ${databaseName}.table('malloytest.state_facts') -> {
        extend: {
          join_one: foo on state = foo.state
        }
        aggregate: x is foo.airport_count.sum()
      }
      `
      )
      .run();
    expect(result.sql).not.toContain('ORDER BY');
  });

  describe('quoting and strings', () => {
    const tick = "'";
    const back = '\\';
    test('backslash quote', async () => {
      await expect(`
        run: ${databaseName}.sql('SELECT 1 as one') -> {
          select: tick is '${back}${tick}'
        }
      `).malloyResultMatches(runtime, {tick});
    });
    test('backslash backslash', async () => {
      await expect(`
        run: ${databaseName}.sql("SELECT 1 as one") -> {
          select: back is '${back}${back}'
        }
      `).malloyResultMatches(runtime, {back});
    });

    test('source with reserve word', async () => {
      await expect(`
        source: create is ${databaseName}.table('malloytest.state_facts')
        run: create -> {
          aggregate: c is count()
        }
      `).malloyResultMatches(runtime, {c: 51});
    });

    test.when(runtime.supportsNesting)('spaces in names', async () => {
      await expect(`
        source: \`space race\` is ${databaseName}.table('malloytest.state_facts') extend {
          join_one: \`j space\` is ${databaseName}.table('malloytest.state_facts') on \`j space\`.state=state
          view: \`q u e r y\` is {
            group_by:
              \`P O P\` is popular_name
              \`J P O P\` is \`j space\`.popular_name
            aggregate: \`c o u n t\` is count()
            calculate:
              \`R O W\` is row_number()
              \`l a g\` is lag(\`P O P\`, 1)
            nest: \`by state\` is {
              group_by: \`J S\` is \`j space\`.state
              aggregate: \`c o u n t\` is count()
            }
          }
        }
        run: \`space race\` -> \`q u e r y\`
      `).malloyResultMatches(runtime, {'c o u n t': 24});
    });
  });
});
