/* eslint-disable no-console */
/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import { RuntimeList } from "./runtimes";

// No prebuilt shared model, each test is complete.  Makes debugging easier.

const runtimes = new RuntimeList([
  "bigquery", //
  "postgres", //
  "duckdb", //
]);

const splitFunction: Record<string, string> = {
  bigquery: "split",
  postgres: "string_to_array",
  duckdb: "string_to_array",
};

const rootDbPath: Record<string, string> = {
  bigquery: "malloy-data.",
  postgres: "",
  duckdb: "",
};

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  // Issue: #151
  it(`unknown dialect  - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        query: q is table('malloytest.aircraft')->{
          where: state != null
          group_by: state
        }

        explore: r is from(->q){
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
    expect(result.data.path(0, "state").value).toBe("WY");
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
          -> {project: lower_state}
        `
      )
      .run();
    // console.log(result.data.toObject());
    expect(result.data.path(0, "lower_state").value).toBe("wy");
  });

  // issue #157
  it(`explore - not -found  - ${databaseName}`, async () => {
    // console.log(result.data.toObject());
    let error;
    try {
      await runtime
        .loadQuery(
          `
        explore: foo is table('malloytest.state_facts'){primary_key: state}
        query: foox->{aggregate: c is count()}
       `
        )
        .run();
    } catch (e) {
      error = e;
    }
    expect(error.toString()).not.toContain("Unknown Dialect");
  });

  it(`join_many - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      explore: a is table('malloytest.aircraft'){
        measure: avg_year is floor(avg(year_built))
      }
      explore: m is table('malloytest.aircraft_models'){
        join_many: a on a.aircraft_model_code=aircraft_model_code
        measure: avg_seats is floor(avg(seats))
      }
      query: m->{aggregate: avg_seats, a.avg_year}
      `
      )
      .run();
    expect(result.data.value[0].avg_year).toBe(1969);
    expect(result.data.value[0].avg_seats).toBe(7);
  });
  it(`join_many condition no primary key - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      explore: a is table('malloytest.airports'){}
      explore: b is table('malloytest.state_facts') {
        join_many: a on state=a.state
      }
      query: b->{aggregate: c is airport_count.sum()}
      `
      )
      .run();
    expect(result.data.value[0].c).toBe(19701);
  });

  it(`join_many filter multiple values - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      explore: a is table('malloytest.airports'){
        where: state = 'NH' | 'CA'
      }
      explore: b is table('malloytest.state_facts') {
        join_many: a on state=a.state
      }
      query: b->{
        aggregate: c is airport_count.sum()
        group_by: a.state
      }
      `
      )
      .run();
    expect(result.data.value[0].c).toBe(18605);
    expect(result.data.value[0].state).toBeNull();
    expect(result.data.value[1].c).toBe(984);
    expect(result.data.value[1].state).toBe("CA");
    expect(result.data.value[2].c).toBe(112);
    expect(result.data.value[2].state).toBe("NH");
  });

  it(`join_one condition no primary key - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      explore: a is table('malloytest.state_facts'){}
      explore: b is table('malloytest.airports') {
        join_one: a on state=a.state
      }
      query: b->{aggregate: c is a.airport_count.sum()}

      `
      )
      .run();
    expect(result.data.value[0].c).toBe(19701);
  });

  it(`join_one filter multiple values - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      explore: a is table('malloytest.state_facts'){
        where: state = 'TX' | 'LA'
      }
      explore: b is table('malloytest.airports') {
        join_one: a on state=a.state
      }
      query: b->{
        aggregate: c is a.airport_count.sum()
        group_by: a.state
      }
      `
      )
      .run();
    // https://github.com/looker-open-source/malloy/pull/501#discussion_r861022857
    expect(result.data.value).toHaveLength(3);
    expect(result.data.value).toContainEqual({ c: 1845, state: "TX" });
    expect(result.data.value).toContainEqual({ c: 500, state: "LA" });
    expect(result.data.value).toContainEqual({ c: 0, state: null });
  });

  it(`join_many cross from  - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    const result = await runtime
      .loadQuery(
        `
      explore: a is table('malloytest.state_facts')
      explore: f is a{
        join_cross: a
      }
      query: f->{
        aggregate:
          row_count is count(distinct concat(state,a.state))
          left_count is count()
          right_count is a.count()
          left_sum is airport_count.sum()
          right_sum is a.airport_count.sum()
      }
      `
      )
      .run();
    expect(result.data.value[0].row_count).toBe(51 * 51);
    expect(result.data.value[0].left_sum).toBe(19701);
    expect(result.data.value[0].right_sum).toBe(19701);
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
      explore: f is table('malloytest.state_facts'){
        join_one: a is from(->q)
      }
      query: f->{
        aggregate:
          row_count is count(distinct concat(state,a.r))
          left_sum is airport_count.sum()
          right_sum is a.r.sum()
          sum_sum is sum(airport_count + a.r)
      }
      `
      )
      .run();
    expect(result.data.value[0].row_count).toBe(51);
    expect(result.data.value[0].left_sum).toBe(19701);
    expect(result.data.value[0].right_sum).toBe(19701);
    expect(result.data.value[0].sum_sum).toBe(19701 + 51 * 19701);
  });

  it(`join_many cross ON  - ${databaseName}`, async () => {
    // a cross join produces a Many to Many result.
    // symmetric aggregate are needed on both sides of the join
    // Check the row count and that sums on each side work properly.
    const result = await runtime
      .loadQuery(
        `
      explore: a is table('malloytest.state_facts')
      explore: f is a{
        join_cross: a on a.state = 'CA' | 'NY'
      }
      query: f->{
        aggregate:
          row_count is count(distinct concat(state,a.state))
          left_sum is airport_count.sum()
          right_sum is a.airport_count.sum()
      }
      `
      )
      .run();
    expect(result.data.value[0].row_count).toBe(51 * 2);
    expect(result.data.value[0].left_sum).toBe(19701);
    expect(result.data.value[0].right_sum).toBe(1560);
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
        project: state
        limit: 10
      }
      -> {
        project: state
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
          measure: births_per_100k is floor(total_births/ ungrouped(total_births) * 100000)
        }

        query:s-> {
          group_by: state
          aggregate: births_per_100k
        }
      `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.path(0, "births_per_100k").value).toBe(9742);
  });

  it(`ungrouped top level with nested  - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ ungrouped(total_births) * 100000)
        }

        query:s-> {
          group_by: state
          aggregate: births_per_100k
          nest: by_name is {
            group_by: popular_name
            aggregate: total_births
          }
        }
      `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.path(0, "births_per_100k").value).toBe(9742);
  });

  it(`ungrouped nested with no grouping above - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ ungrouped(total_births) * 100000)
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
    expect(result.data.path(0, "by_name", 0, "births_per_100k").value).toBe(
      66703
    );
  });

  it(`ungrouped nested  - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ ungrouped(total_births) * 100000)
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
    expect(result.data.path(0, "by_state", 0, "births_per_100k").value).toBe(
      36593
    );
  });

  it(`ungrouped nested expression  - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births/ ungrouped(total_births) * 100000)
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
    expect(result.data.path(0, "by_state", 0, "births_per_100k").value).toBe(
      36593
    );
  });

  it(`ungrouped nested group by float  - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        source: s is table('malloytest.state_facts') + {
          measure: total_births is births.sum()
          measure: ug is ungrouped(total_births)
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
    expect(result.data.path(0, "by_state", 0, "ug").value).toBe(62742230);
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
            all_name is all(total_births, popular_name)
        }

      `
      )
      .run();
    // console.log(result.sql);
    // console.log(JSON.stringify(result.data.toObject(), null, 2));
    expect(result.data.path(0, "all_births").value).toBe(295727065);
    expect(result.data.path(0, "all_name").value).toBe(197260594);
  });

  it(`all with parameters - nest  - ${databaseName}`, async () => {
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
              all_name is all(total_births, popular_name)
          }
        }

      `
      )
      .run();
    // console.log(result.sql);
    // console.log(JSON.stringify(result.data.toObject(), null, 2));
    expect(result.data.path(0, "by_stuff", 0, "all_births").value).toBe(
      119809719
    );
    expect(result.data.path(0, "by_stuff", 0, "all_name").value).toBe(61091215);
  });

  it(`single value to udf - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      source: f is  table('malloytest.state_facts') {
        query: fun is {
          aggregate: t is count()
        }
        -> {
          project: t1 is t+1
        }
      }
      query: f-> {
        nest: fun
      }
      `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.path(0, "fun", 0, "t1").value).toBe(52);
  });

  it(`Multi value to udf - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      source: f is  table('malloytest.state_facts') {
        query: fun is {
          group_by: one is 1
          aggregate: t is count()
        }
        -> {
          project: t1 is t+1
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
    expect(result.data.path(0, "fun", 0, "t1").value).toBe(52);
  });

  it(`Multi value to udf group by - ${databaseName}`, async () => {
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
    expect(result.data.path(0, "fun", 0, "t1").value).toBe(52);
  });

  it(`sql_block - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is ||
        SELECT 1 as a, 2 as b
        UNION ALL SELECT 3, 4
      ;;

      explore: eone is  from_sql(one) {}

      query: eone -> { project: a }
      `
      )
      .run();
    expect(result.data.value[0].a).toBe(1);
  });

  it(`sql_block no explore- ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is ||
        SELECT 1 as a, 2 as b
        UNION ALL SELECT 3, 4
      ;;

      query: from_sql(one) -> { project: a }
      `
      )
      .run();
    expect(result.data.value[0].a).toBe(1);
  });

  // it(`sql_block version- ${databaseName}`, async () => {
  //   const result = await runtime
  //     .loadQuery(
  //       `
  //     sql: one is ||
  //       select version() as version
  //     ;;

  //     query: from_sql(one) -> { project: version }
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
      sql: one is ||
        SELECT 1 as a, 2 as b
        UNION ALL SELECT 3, 4
      ;;

      query: from_sql(one) -> {
        declare: c is a + 1
        project: c
      }
      `
      )
      .run();
    expect(result.data.value[0].c).toBe(2);
  });

  it(`local declarations named query - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is ||
        SELECT 1 as a, 2 as b
        UNION ALL SELECT 3, 4
      ;;

      source: foo is from_sql(one) + {
        query: bar is {
          declare: c is a + 1
          project: c
        }
      }

      query: foo-> bar
      `
      )
      .run();
    expect(result.data.value[0].c).toBe(2);
  });

  it(`local declarations refined named query - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is ||
        SELECT 1 as a, 2 as b
        UNION ALL SELECT 3, 4
      ;;

      source: foo is from_sql(one) + {
        query: bar is {
          declare: c is a + 1
          project: c
        }

        query: baz is bar + {
          declare: d is c + 1
          project: d
        }
      }

      query: foo-> baz
      `
      )
      .run();
    expect(result.data.value[0].d).toBe(3);
  });

  it(`regexp match- ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is ||
        SELECT 'hello mom' as a, 'cheese tastes good' as b
        UNION ALL SELECT 'lloyd is a bozo', 'michael likes poetry'
      ;;

      query: from_sql(one) -> {
        aggregate: llo is count() {? a ~ r'llo'}
        aggregate: m2 is count() {? a !~ r'bozo'}
      }
      `
      )
      .run();
    expect(result.data.value[0].llo).toBe(2);
    expect(result.data.value[0].m2).toBe(1);
  });

  it(`substitution precidence- ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is ||
        SELECT 5 as a, 2 as b
        UNION ALL SELECT 3, 4
      ;;

      query: from_sql(one) -> {
        declare: c is b + 4
        project: x is a * c
      }
      `
      )
      .run();
    expect(result.data.value[0].x).toBe(30);
  });

  it(`array unnest - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        sql: atitle is ||
          SELECT
            city,
            ${splitFunction[databaseName]}(city,' ') as words
          FROM ${rootDbPath[databaseName]}malloytest.aircraft
        ;;

        source: title is from_sql(atitle){}

        query: title ->  {
          where: words.value != null
          group_by: words.value
          aggregate: c is count()
        }
      `
      )
      .run();
    expect(result.data.value[0].c).toBe(145);
  });

  // make sure we can count the total number of elements when fanning out.
  it(`array unnest x 2 - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        sql: atitle is ||
          SELECT
            city,
            ${splitFunction[databaseName]}(city,' ') as words,
            ${splitFunction[databaseName]}(city,'A') as abreak
          FROM ${rootDbPath[databaseName]}malloytest.aircraft
          where city IS NOT null
        ;;

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
    expect(result.data.value[0].b).toBe(3552);
    expect(result.data.value[0].c).toBe(4586);
    expect(result.data.value[0].a).toBe(6601);
  });

  it(`nest null - ${databaseName}`, async () => {
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
    expect(d[0]["by_state"]).not.toBe(null);
    expect(d[0]["by_state1"]).not.toBe(null);
  });
});
