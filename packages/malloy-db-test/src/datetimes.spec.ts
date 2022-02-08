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
  bigquery: `SELECT * FROM UNNEST([STRUCT(CAST('2021-02-24' as DATE) as t_date)])`,
  postgres: `SELECT DATE('2021-02-24') as t_date`,
};

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  it(`sql_block no explore- ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: basicTypes is || ${basicTypes[databaseName]} ;;

      query: from_sql(basicTypes) -> { project: t_date }
      `
      )
      .run();
    console.log(result.sql);
    expect(result.data.path(0, "t_date").value).toEqual(new Date("2021-02-24"));
  });
});
