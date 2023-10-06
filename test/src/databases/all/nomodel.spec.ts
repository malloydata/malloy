/* eslint-disable no-console */
/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
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
import {databasesFromEnvironmentOr, testIf} from '../../util';
import '../../util/db-jest-matchers';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

// No prebuilt shared model, each test is complete.  Makes debugging easier.
function rootDbPath(databaseName: string) {
  return databaseName === 'bigquery' ? 'malloy-data.' : '';
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
  }[db];
}

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  // Issue: #1284
  it(`parenthesize output field values - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `run: table('malloytest.aircraft') -> {
          group_by:
            r is 1

          calculate:
            zero is 1 - rank()
            zero_bare  is 0 - zero
            zero_paren is 0 - (zero)
        }`
      )
      .run();
    const bare = result.data.path(0, 'zero_bare').number.value;
    const paren = result.data.path(0, 'zero_paren').number.value;
    expect(bare).toBe(0);
    expect(paren).toBe(0);
  });

  // Issue: #151
  it(`unknown dialect  - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        query: q is table('malloytest.aircraft')->{
          where: state != null
          group_by: state
        }

        source: r is from(->q){
          query: foo is {
            order_by: 1 desc
            group_by: state
          }
        }

        query: r->foo
    `
      )
      .run();
    // console.log(result.data.toObject());
    expect(result.data.path(0, 'state').value).toBe('WY');
  });

  // Issue #149
  it(`refine query from query  - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        query: from(
          table('malloytest.state_facts')->{group_by: state; order_by: 1 desc; limit: 1}
          )
          {
            dimension: lower_state is lower(state)
          }
          -> {select: lower_state}
        `
      )
      .run();
    // console.log(result.data.toObject());
    expect(result.data.path(0, 'lower_state').value).toBe('wy');
  });

  // issue #157
  it(`source- not -found  - ${databaseName}`, async () => {
    // console.log(result.data.toObject());
    let error;
    try {
      await runtime
        .loadQuery(
          `
        source: foo is table('malloytest.state_facts'){primary_key: state}
        query: foox->{aggregate: c is count()}
       `
        )
        .run();
    } catch (e) {
      error = e;
    }
    expect(error.toString()).not.toContain('Unknown Dialect');
  });

  it(`join_many - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      source: a is table('malloytest.aircraft'){
        measure: avg_year is floor(avg(year_built))
      }
      source: m is table('malloytest.aircraft_models'){
        join_many: a on a.aircraft_model_code=aircraft_model_code
        measure: avg_seats is floor(avg(seats))
      }
      query: m->{aggregate: avg_seats, a.avg_year}
      `
      )
      .run();
    expect(result.data.value[0]['avg_year']).toBe(1969);
    expect(result.data.value[0]['avg_seats']).toBe(7);
  });

  it(`join_many condition no primary key - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      source: a is table('malloytest.airports'){}
      source: b is table('malloytest.state_facts') {
        join_many: a on state=a.state
      }
      query: b->{aggregate: c is airport_count.sum()}
      `
      )
      .run();
    expect(result.data.value[0]['c']).toBe(19701);
  });

  it(`join_many filter multiple values - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      source: a is table('malloytest.airports'){
        where: state = 'NH' | 'CA'
      }
      source: b is table('malloytest.state_facts') {
        join_many: a on state=a.state
      }
      query: b->{
        aggregate: c is airport_count.sum()
        group_by: a.state
      }
      `
      )
      .run();
    expect(result.data.value[0]['c']).toBe(18605);
    expect(result.data.value[0]['state']).toBeNull();
    expect(result.data.value[1]['c']).toBe(984);
    expect(result.data.value[1]['state']).toBe('CA');
    expect(result.data.value[2]['c']).toBe(112);
    expect(result.data.value[2]['state']).toBe('NH');
  });

  it(`join_one condition no primary key - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      source: a is table('malloytest.state_facts'){}
      source: b is table('malloytest.airports') {
        join_one: a on state=a.state
      }
      query: b->{aggregate: c is a.airport_count.sum()}

      `
      )
      .run();
    expect(result.data.value[0]['c']).toBe(19701);
  });

  it(`join_one filter multiple values - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      source: a is table('malloytest.state_facts'){
        where: state = 'TX' | 'LA'
      }
      source: b is table('malloytest.airports') {
        join_one: a on state=a.state
      }
      query: b->{
        aggregate: c is a.airport_count.sum()
        group_by: a.state
      }
      `
      )
      .run();
    // https://github.com/malloydata/malloy/pull/501#discussion_r861022857
    expect(result.data.value).toHaveLength(3);
    expect(result.data.value).toContainEqual({c: 1845, state: 'TX'});
    expect(result.data.value).toContainEqual({c: 500, state: 'LA'});
    expect(result.data.value).toContainEqual({c: 0, state: null});
  });

  it(`join_many cross from  - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    const result = await runtime
      .loadQuery(
        `
      source: a is table('malloytest.state_facts')
      source: f is a{
        join_cross: a
      }
      query: f->{
        aggregate:
          row_count is count(concat(state,a.state))
          left_count is count()
          right_count is a.count()
          left_sum is airport_count.sum()
          right_sum is a.airport_count.sum()
      }
      `
      )
      .run();
    expect(result.data.value[0]['row_count']).toBe(51 * 51);
    expect(result.data.value[0]['left_sum']).toBe(19701);
    expect(result.data.value[0]['right_sum']).toBe(19701);
  });

  it(`join_one only  - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    const result = await runtime
      .loadQuery(
        `
      query: q is table('malloytest.state_facts')->{
        aggregate: r is airport_count.sum()
      }
      source: f is table('malloytest.state_facts'){
        join_one: a is from(->q)
      }
      query: f->{
        aggregate:
          row_count is count(concat(state,a.r))
          left_sum is airport_count.sum()
          right_sum is a.r.sum()
          sum_sum is sum(airport_count + a.r)
      }
      `
      )
      .run();
    expect(result.data.value[0]['row_count']).toBe(51);
    expect(result.data.value[0]['left_sum']).toBe(19701);
    expect(result.data.value[0]['right_sum']).toBe(19701);
    expect(result.data.value[0]['sum_sum']).toBe(19701 + 51 * 19701);
  });

  it(`join_many cross ON  - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    const result = await runtime
      .loadQuery(
        `
      source: a is table('malloytest.state_facts')
      source: f is a{
        join_cross: a on a.state = 'CA' | 'NY'
      }
      query: f->{
        aggregate:
          row_count is count(concat(state,a.state))
          left_sum is airport_count.sum()
          right_sum is a.airport_count.sum()
      }
      `
      )
      .run();
    expect(result.data.value[0]['row_count']).toBe(51 * 2);
    expect(result.data.value[0]['left_sum']).toBe(19701);
    expect(result.data.value[0]['right_sum']).toBe(1560);
  });

  it(`limit - provided - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    const result = await runtime
      .loadQuery(
        `
      query: table('malloytest.state_facts') -> {
        group_by: state
        aggregate: c is count()
        limit: 3
      }
      `
      )
      .run();
    expect(result.resultExplore.limit).toBe(3);
  });

  testIf(runtime.supportsNesting)(
    `number as null- ${databaseName}`,
    async () => {
      // a cross join produces a Many to Many result.
      // symmetric aggregate are needed on both sides of the join
      // Check the row count and that sums on each side work properly.
      const result = await runtime
        .loadQuery(
          `
        source: s is table('malloytest.state_facts') + {
        }
        query: s-> {
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

  // average should only include non-null values in the denominator
  it(`avg ignore null- ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is { select: """
        SELECT 2 as a
        UNION ALL SELECT 4
        UNION ALL SELECT null
      """}

      query: from_sql(one) -> {
        join_cross: b is from_sql(one)
        aggregate:
          avg_a is a.avg()
          avg_b is b.a.avg()
      }
      `
      )
      .run();
    expect(result.data.value[0]['avg_a']).toBe(3);
  });

  it(`limit - not provided - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    const result = await runtime
      .loadQuery(
        `
      query: table('malloytest.state_facts') -> {
        group_by: state
        aggregate: c is count()
      }
      `
      )
      .run();
    expect(result.resultExplore.limit).toBe(undefined);
  });

  it(`limit pipeline - provided - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    const result = await runtime
      .loadQuery(
        `
      query: table('malloytest.state_facts') -> {
        select: state
        limit: 10
      }
      -> {
        select: state
        limit: 3
      }
      `
      )
      .run();
    expect(result.resultExplore.limit).toBe(3);
  });

  it(`ungrouped top level - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
        }

        query:s-> {
          group_by: state
          aggregate: births_per_100k
        }
      `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.path(0, 'births_per_100k').value).toBe(9742);
  });

  testIf(runtime.supportsNesting)(
    `ungrouped top level with nested  - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
        }

        query:s-> {
          group_by: state
          aggregate: births_per_100k
          nest: by_name is {
            group_by: popular_name
            aggregate: total_births
          }
          limit: 1000
        }
      `
        )
        .run();
      // console.log(result.sql);
      expect(result.data.path(0, 'births_per_100k').value).toBe(9742);
    }
  );

  it(`ungrouped - eliminate rows  - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        source: s is table('malloytest.state_facts') + {
          measure: m is all(births.sum())
          where: state='CA' | 'NY'
        }

        query:s-> {
          group_by: state
          aggregate: m
        }
      `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.toObject().length).toBe(2);
  });

  testIf(runtime.supportsNesting)(
    `ungrouped nested with no grouping above - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
        }

        query: s-> {
          aggregate: total_births
          nest: by_name is {
            group_by: popular_name
            aggregate: births_per_100k
          }
        }

      `
        )
        .run();
      // console.log(result.sql);
      expect(result.data.path(0, 'by_name', 0, 'births_per_100k').value).toBe(
        66703
      );
    }
  );

  testIf(runtime.supportsNesting)(
    `ungrouped - partial grouping - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        source: airports is table('malloytest.airports') {
          measure: c is count()
        }


         query: airports -> {
          where: state = 'TX' | 'NY'
          group_by:
            faa_region
            state
          aggregate:
            c
            all_ is all(c)
            airport_count is c {? fac_type = 'AIRPORT'}
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

      `
        )
        .run();
      // console.log(result.sql);
      expect(result.data.path(0, 'fac_type', 0, 'all_').value).toBe(1845);
      expect(result.data.path(0, 'fac_type', 0, 'all_state_region').value).toBe(
        1845
      );
      expect(result.data.path(0, 'fac_type', 0, 'all_of_this_type').value).toBe(
        1782
      );
      expect(result.data.path(0, 'fac_type', 0, 'all_top').value).toBe(2421);
    }
  );

  testIf(runtime.supportsNesting)(
    `ungrouped - all nested - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        source: airports is table('malloytest.airports') {
          measure: c is count()
        }


         query: airports -> {
          where: state = 'TX' | 'NY'
          group_by:
            state
          aggregate:
            c
            all_ is all(c)
            airport_count is c {? fac_type = 'AIRPORT'}
          nest: fac_type is {
            group_by: fac_type, major
            aggregate:
              c
              all_ is all(c)
              all_major is all(c,major)
          }
        }


      `
        )
        .run();
      // console.log(result.sql);
      expect(result.data.path(0, 'fac_type', 0, 'all_').value).toBe(1845);
      expect(result.data.path(0, 'fac_type', 0, 'all_major').value).toBe(1819);
    }
  );

  testIf(runtime.supportsNesting)(
    `ungrouped nested  - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
        }

        query:s ->  {
          group_by: popular_name
          nest: by_state is {
            group_by: state
            aggregate: births_per_100k
          }
        }

      `
        )
        .run();
      // console.log(result.sql);
      expect(result.data.path(0, 'by_state', 0, 'births_per_100k').value).toBe(
        36593
      );
    }
  );

  testIf(runtime.supportsNesting)(
    `ungrouped nested expression  - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ all(total_births) * 100000)
        }

        query:s ->  {
          group_by: upper_name is upper(popular_name)
          nest: by_state is {
            group_by: state
            aggregate: births_per_100k
          }
        }

      `
        )
        .run();
      // console.log(result.sql);
      expect(result.data.path(0, 'by_state', 0, 'births_per_100k').value).toBe(
        36593
      );
    }
  );

  testIf(runtime.supportsNesting)(
    `ungrouped nested group by float  - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          measure: ug is all(total_births)
        }

        query:s ->  {
          group_by: f is floor(airport_count/300.0)
          nest: by_state is {
            group_by: state
            aggregate: ug
          }
        }

      `
        )
        .run();
      // console.log(result.sql);
      // console.log(JSON.stringify(result.data.toObject(), null, 2));
      expect(result.data.path(0, 'by_state', 0, 'ug').value).toBe(62742230);
    }
  );

  it(`simple sql is exactly as written - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery('run: conn.sql("select 1 as one")')
      .run();
    expect(result.sql).toBe('select 1 as one');
    expect(result.resultExplore).not.toBeUndefined();
  });

  it(`source from query defined as sql query - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        query: q is conn.sql("select 1 as one")
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
        run: s -> { select: * }
      `
      )
      .run();
    expect(result.data.path(0, 'carrier').string.value).toBe('AA');
  });

  it(`all with parameters - basic  - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
        }

        query: s -> {
          group_by: popular_name, state
          aggregate:
            total_births
            all_births is all(total_births)
            all_name is exclude(total_births, state)
        }

      `
      )
      .run();
    // console.log(result.sql);
    // console.log(JSON.stringify(result.data.toObject(), null, 2));
    expect(result.data.path(0, 'all_births').value).toBe(295727065);
    expect(result.data.path(0, 'all_name').value).toBe(197260594);
  });

  testIf(runtime.supportsNesting)(
    `all with parameters - nest  - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          dimension: abc is floor(airport_count/300)
        }

        query: s -> {
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

      `
        )
        .run();
      // console.log(result.sql);
      // console.log(JSON.stringify(result.data.toObject(), null, 2));
      expect(result.data.path(0, 'by_stuff', 0, 'all_births').value).toBe(
        119809719
      );
      expect(result.data.path(0, 'by_stuff', 0, 'all_name').value).toBe(
        61091215
      );
    }
  );

  testIf(runtime.supportsNesting)(
    `single value to udf - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
      source: f is  table('malloytest.state_facts') {
        query: fun is {
          aggregate: t is count()
        }
        -> {
          select: t1 is t+1
        }
      }
      query: f-> {
        nest: fun
      }
      `
        )
        .run();
      // console.log(result.sql);
      expect(result.data.path(0, 'fun', 0, 't1').value).toBe(52);
    }
  );

  testIf(runtime.supportsNesting)(
    `Multi value to udf - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
      source: f is  table('malloytest.state_facts') {
        query: fun is {
          group_by: one is 1
          aggregate: t is count()
        }
        -> {
          select: t1 is t+1
        }
      }
      query: f-> {
        nest: fun
      }
      `
        )
        .run();
      // console.log(result.sql);
      // console.log(result.data.toObject());
      expect(result.data.path(0, 'fun', 0, 't1').value).toBe(52);
    }
  );

  testIf(runtime.supportsNesting)(
    `Multi value to udf group by - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
      source: f is  table('malloytest.state_facts') {
        query: fun is {
          group_by: one is 1
          aggregate: t is count()
        }
        -> {
          group_by: t1 is t+1
        }
      }
      query: f-> {
        nest: fun
      }
      `
        )
        .run();
      // console.log(result.sql);
      // console.log(result.data.toObject());
      expect(result.data.path(0, 'fun', 0, 't1').value).toBe(52);
    }
  );

  const sql1234 = `
  sql: one is {select: """
    SELECT 1 as a, 2 as b
    UNION ALL SELECT 3, 4
  """}`;

  it(`sql_block - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      ${sql1234}
      source: eone is  from_sql(one) {}

      query: eone -> { select: a }
      `
      )
      .run();
    expect(result.data.value[0]['a']).toBe(1);
  });

  it(`sql_block no explore- ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
          ${sql1234}
          query: from_sql(one) -> { select: a }
      `
      )
      .run();
    expect(result.data.value[0]['a']).toBe(1);
  });

  it(`sql_block with turducken- ${databaseName}`, async () => {
    if (databaseName !== 'postgres') {
      const turduckenQuery = `
        sql: state_as_sql is {
          select: """
            SELECT
              ROW_NUMBER() OVER (ORDER BY state_count) as row_number,
              *
            FROM (%{
              table('malloytest.state_facts')
              -> {
                group_by: popular_name
                aggregate: state_count is count()
              }
            }%)
          """
        }
        query: from_sql(state_as_sql) -> {
          select: *; where: popular_name = 'Emma'
        }`;
      const result = await runtime.loadQuery(turduckenQuery).run();
      expect(result.data.value[0]['state_count']).toBe(6);
    }
  });

  // it(`sql_block version- ${databaseName}`, async () => {
  //   const result = await runtime
  //     .loadQuery(
  //       `
  //     sql: one is ||
  //       select version() as version
  //     ;;

  //     query: from_sql(one) -> { select: version }
  //     `
  //     )
  //     .run();
  //   expect(result.data.value[0].version).toBe("something");
  // });

  // local declarations
  it(`local declarations external query - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      ${sql1234}
      query: from_sql(one) -> {
        declare: c is a + 1
        select: c
      }
      `
      )
      .run();
    expect(result.data.value[0]['c']).toBe(2);
  });

  it(`local declarations named query - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      ${sql1234}
      source: foo is from_sql(one) + {
        query: bar is {
          declare: c is a + 1
          select: c
        }
      }

      query: foo-> bar
      `
      )
      .run();
    expect(result.data.value[0]['c']).toBe(2);
  });

  it(`local declarations refined named query - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      ${sql1234}
      source: foo is from_sql(one) + {
        query: bar is {
          declare: c is a + 1
          select: c
        }

        query: baz is bar + {
          declare: d is c + 1
          select: d
        }
      }

      query: foo-> baz
      `
      )
      .run();
    expect(result.data.value[0]['d']).toBe(3);
  });

  it(`regexp match- ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is { select: """
        SELECT 'hello mom' as a, 'cheese tastes good' as b
        UNION ALL SELECT 'lloyd is a bozo', 'michael likes poetry'
      """}

      query: from_sql(one) -> {
        aggregate: llo is count() {? a ~ r'llo'}
        aggregate: m2 is count() {? a !~ r'bozo'}
      }
      `
      )
      .run();
    expect(result.data.value[0]['llo']).toBe(2);
    expect(result.data.value[0]['m2']).toBe(1);
  });

  it(`substitution precidence- ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is {select: """
        SELECT 5 as a, 2 as b
        UNION ALL SELECT 3, 4
      """}

      query: from_sql(one) -> {
        declare: c is b + 4
        select: x is a * c
      }
      `
      )
      .run();
    expect(result.data.value[0]['x']).toBe(30);
  });

  it(`array unnest - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        sql: atitle is {select:"""
          SELECT
            city,
            ${getSplitFunction(databaseName)!('city', ' ')} as words
          FROM ${rootDbPath(databaseName)}malloytest.aircraft
          """}

        source: title is from_sql(atitle){}

        query: title ->  {
          where: words.value != null
          group_by: words.value
          aggregate: c is count()
        }
      `
      )
      .run();
    expect(result.data.value[0]['c']).toBe(145);
  });

  // make sure we can count the total number of elements when fanning out.
  it(`array unnest x 2 - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        sql: atitle is {select: """
          SELECT
            city,
            ${getSplitFunction(databaseName)!('city', ' ')} as words,
            ${getSplitFunction(databaseName)!('city', 'A')} as abreak
          FROM ${rootDbPath(databaseName)}malloytest.aircraft
          where city IS NOT null
        """}

        source: title is from_sql(atitle){}

        query: title ->  {
          aggregate:
            b is count()
            c is words.count()
            a is abreak.count()
        }
      `
      )
      .run();
    expect(result.data.value[0]['b']).toBe(3552);
    expect(result.data.value[0]['c']).toBe(4586);
    expect(result.data.value[0]['a']).toBe(6601);
  });

  testIf(runtime.supportsNesting)(`nest null - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        query: table('malloytest.airports') -> {
          where: faa_region = null
          group_by: faa_region
          aggregate: airport_count is count()
          nest: by_state is {
            where: state != null
            group_by: state
            aggregate: airport_count is count()
          }
          nest: by_state1 is {
            where: state != null
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
  });

  testIf(runtime.supportsNesting)(
    `number as null- ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        source: s is table('malloytest.state_facts') + {
        }
        query: s-> {
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

  describe('quoting and strings', () => {
    const tick = "'";
    const back = '\\';
    test('backslash quote', async () => {
      const result = await runtime
        .loadQuery(
          `
            query: table('malloytest.state_facts') -> {
              select: tick is '${back}${tick}'
            }
        `
        )
        .run();
      expect(result.data.value[0]['tick']).toBe(tick);
    });
    test('backslash backslash', async () => {
      const result = await runtime
        .loadQuery(
          `
            query: table('malloytest.state_facts') -> {
              select: back is '${back}${back}'
            }
        `
        )
        .run();
      expect(result.data.value[0]['back']).toBe(back);
    });

    testIf(runtime.supportsNesting)('spaces in names', async () => {
      const result = await runtime
        .loadQuery(
          `
            source: \`space race\` is table('malloytest.state_facts') {
              join_one: \`j space\` is table('malloytest.state_facts') on \`j space\`.state=state
              query: \`q u e r y\` is {
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

            query: \`space race\` -> \`q u e r y\`
        `
        )
        .run();
      expect(result.data.value[0]['c o u n t']).toBe(24);
    });
  });
});
