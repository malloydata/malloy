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
  "postgres", //
];

type DialectNames = typeof dialects[number];

const runtimes = new RuntimeList(dialects);

afterAll(async () => {
  await runtimes.closeAll();
});

const basicTypes: Record<DialectNames, string> = {
  bigquery: `
    SELECT * FROM UNNEST([STRUCT(
      CAST('2021-02-24' as DATE) as t_date,
      CAST('2021-02-24 03:05:06' as TIMESTAMP) as t_timestamp
    )])`,
  postgres: `
    SELECT
      DATE('2021-02-24') as t_date,
      '2021-02-24 03:05:06':: timestamp with time zone as t_timestamp
  `,
};

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  it(`sql_block no explore- ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: basicTypes is || ${basicTypes[databaseName]} ;;

      query: from_sql(basicTypes) -> {
        project: [
          t_date
          t_timestamp
        ]
      }
      `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.path(0, "t_date").value).toEqual(new Date("2021-02-24"));
    expect(result.data.path(0, "t_timestamp").value).toEqual(
      new Date("2021-02-24T03:05:06.000Z")
    );
  });

  it(`dates and timestamps - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: basicTypes is || ${basicTypes[databaseName]} ;;

      query: from_sql(basicTypes) -> {
        aggregate: d1 is count() { where: t_date: @2021-02-24}
        aggregate: d2 is count() { where: t_date: @2021-02-23 for 2 days}

        // either this is legal or we need to convert the timestamp range into a date range...
        // aggregate: d3 is count() { where: t_date: @2021-02-23 00:00 for 2 days}


        aggregate: t1 is count() { where: t_timestamp: @2021-02-24}
        aggregate: t2 is count() { where: t_timestamp: @2021-02-23::date for 2 days}

        // aggregate: t3 is count() { where: t_timestamp: (@2021-02-23 00:00)::timestamp for 2 days}
      }
      `
      )
      .run();
    console.log(result.sql);

    result.resultExplore.allFields.forEach((field) => {
      expect(`${result.data.path(0, field.name).value} ${field.name}`).toBe(
        `1 ${field.name}`
      );
    });
  });
});
