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
]);

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  // Issue: #151
  it(`unknonwn dialect  - ${databaseName}`, async () => {
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
    expect(result.data.value[0].avg_seats).toBe(7);
    expect(result.data.value[0].avg_year).toBe(1969);
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
          project: c
        }
      }

      query: foo-> baz
      `
      )
      .run();
    expect(result.data.value[0].d).toBe(3);
  });
});
