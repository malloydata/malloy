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
  // "postgres", //
]);

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  // Issue: #151
  it(`unknonwn dialect  - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
        query: q is table('malloytest.aircraft')->{
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
        measure: avg_year is avg(year_built)
      }
      explore: m is table('malloytest.aircraft_models'){
        join_many: a on a.aircraft_model_code=aircraft_model_code
        measure: avg_seats is avg(seats)
      }
      query: m->{aggregate: [avg_seats, a.avg_year]}
      `
      )
      .run();
    console.log(result.data.toObject());

    expect(result.data.value[0].f_sum2).toBe(60462);
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
});
