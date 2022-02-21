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

const dialects = [
  "bigquery", //
  // "postgres", //
];

type DialectNames = typeof dialects[number];

const runtimes = new RuntimeList(dialects);

afterAll(async () => {
  await runtimes.closeAll();
});

const modelText = `
sql: t is ||
    SELECT 1 as a, 'lloyd' as name
    UNION ALL SELECT 2 as a, 'michael' as name
    UNION ALL SELECT 3 as a, 'lloyd' as name
    UNION ALL SELECT 4 as a, 'michael' as name
    UNION ALL SELECT 5 as a, 'ben' as name
    UNION ALL SELECT 6 as a, 'lloyd' as name
    UNION ALL SELECT 7 as a, 'chris' as name
    ;;

explore: test is from_sql(t) {
  measure: test_count is count()
  measure: min_a is min(a)
  dimension: up_name is upper(name)
  dimension: a1 is a+1
}
`;

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  it(`Where: modeled parameter - ${databaseName}`, async () => {
    const result = await runtime
      .loadModel(modelText)
      .loadQuery(
        `
        query: test-> {
          where: a1 > 4
          project: [a]
          order_by: a
        }
      `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.path(0, "a").value).toBe(4);
  });

  // make sure we aren't reading names from the query
  //  with where.
  it(`Where: only model - ${databaseName}`, async () => {
    const result = await runtime
      .loadModel(modelText)
      .loadQuery(
        `
        query: test-> {
          where: a1 > 4
          project: [
            a
            a1 is a -1
          ]
          order_by: a
        }
      `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.path(0, "a").value).toBe(4);
  });

  it(`Expect Error: Having can't be on dimension - ${databaseName}`, async () => {
    let caughtError = false;

    try {
      await runtime
        .loadModel(modelText)
        .loadQuery(
          `
          query: test-> {
            having: a1 = 1
            group_by: [a]
            order_by: a
          }
        `
        )
        .run();
    } catch (e) {
      caughtError = true;
    }
    expect(caughtError).toBe(true);
  });

  it(`Expect Error: Where on aggregate - ${databaseName}`, async () => {
    let caughtError = false;

    try {
      await runtime
        .loadModel(modelText)
        .loadQuery(
          `
          query: test-> {
            where: test_count = 1
            group_by: [a]
            order_by: a
          }
        `
        )
        .run();
    } catch (e) {
      caughtError = true;
    }
    expect(caughtError).toBe(true);
  });

  it(`Having: Query is scope first - ${databaseName}`, async () => {
    const result = await runtime
      .loadModel(modelText)
      .loadQuery(
        `
        query: test-> {
          having: min_a > 3   // should be the 'min_a' in the query, not the test.min_a
          group_by: [
            a
            min_a is min(a) * 100
          ]
          order_by: a
        }
      `
      )
      .run();
    expect(result.data.path(0, "a").value).toBe(1);
  });
});
