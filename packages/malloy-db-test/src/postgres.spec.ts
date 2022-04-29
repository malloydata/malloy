/* eslint-disable no-console */
/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without evenro the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { RuntimeList } from "./runtimes";

const runtimeList = new RuntimeList(["postgres"]);
const runtime = runtimeList.runtimeMap.get("postgres");
if (runtime === undefined) {
  throw new Error("Couldn't build runtime");
}

// Idempotently create schema and tables with capital letters to use in tests.
beforeAll(async () => {
  await runtime.connection.runSQL('create schema if not exists "UpperSchema";');
  await Promise.all([
    runtime.connection.runSQL(
      'create table if not exists "UpperSchema"."UpperSchemaUpperTable" as select 1 as one;'
    ),
    runtime.connection.runSQL(
      'create table if not exists "UpperTablePublic" as select 1 as one;'
    ),
  ]);
});

afterAll(async () => {
  await runtimeList.closeAll();
});

describe("postgres tests", () => {
  it(`raw date tests`, async () => {
    const result = await runtime
      .loadQuery(
        `
        sql: times is ||
          select '2020-03-02'::date as t_date,
          '2020-03-02 12:35:56'::timestamp without time zone as t_timestamp_no_tz,
          '2020-03-02 12:35:56'::timestamp with time zone as t_timestamp_w_tz
        ;;

        query: from_sql(times)->{
          group_by:
            t_date,
            t_date_month is t_date.month,
            t_date_year is t_date.year,
            t_timestamp_w_tz,
            t_timestamp_w_tz_date is t_timestamp_w_tz.day,
            t_timestamp_w_tz_hour is t_timestamp_w_tz.hour,
            t_timestamp_w_tz_minute is t_timestamp_w_tz.minute,
            t_timestamp_w_tz_second is t_timestamp_w_tz.second,
            t_timestamp_w_tz_month is t_timestamp_w_tz.month,
            t_timestamp_w_tz_year is t_timestamp_w_tz.year,
            // t_timestamp_no_tz,
            // t_timestamp_no_tz_date is t_timestamp_no_tz.day,
            // t_timestamp_no_tz_hour is t_timestamp_no_tz.hour,
            // t_timestamp_no_tz_minute is t_timestamp_no_tz.minute,
            // t_timestamp_no_tz_second is t_timestamp_no_tz.second,
            // t_timestamp_no_tz_month is t_timestamp_no_tz.month,
            // t_timestamp_no_tz_year is t_timestamp_no_tz.year,
        }
        `
      )
      .run();
    // console.log(result.sql);
    // console.log(result.data.toObject());
    expect(result.data.path(0, "t_date").value).toEqual(new Date("2020-03-02"));
    expect(result.data.path(0, "t_date_month").value).toEqual(
      new Date("2020-03-01")
    );
    expect(result.data.path(0, "t_date_year").value).toEqual(
      new Date("2020-01-01")
    );
    expect(result.data.path(0, "t_timestamp_w_tz").value).toEqual(
      new Date("2020-03-02T12:35:56.000Z")
    );
    expect(result.data.path(0, "t_timestamp_w_tz_second").value).toEqual(
      new Date("2020-03-02T12:35:56.000Z")
    );
    expect(result.data.path(0, "t_timestamp_w_tz_minute").value).toEqual(
      new Date("2020-03-02T12:35:00.000Z")
    );
    expect(result.data.path(0, "t_timestamp_w_tz_hour").value).toEqual(
      new Date("2020-03-02T12:00:00.000Z")
    );
    expect(result.data.path(0, "t_timestamp_w_tz_date").value).toEqual(
      new Date("2020-03-02")
    );
    expect(result.data.path(0, "t_timestamp_w_tz_month").value).toEqual(
      new Date("2020-03-01")
    );
    expect(result.data.path(0, "t_timestamp_w_tz_year").value).toEqual(
      new Date("2020-01-01")
    );
    // expect(result.data.path(0, "t_timestamp_no_tz").value).toEqual(
    //   new Date("2020-03-02T12:35:56.000Z")
    // );
    // expect(result.data.path(0, "t_timestamp_no_tz_second").value).toEqual(
    //   new Date("2020-03-02T12:35:56.000Z")
    // );
    // expect(result.data.path(0, "t_timestamp_no_tz_minute").value).toEqual(
    //   new Date("2020-03-02T12:35:00.000Z")
    // );
    // expect(result.data.path(0, "t_timestamp_no_tz_hour").value).toEqual(
    //   new Date("2020-03-02T12:00:00.000Z")
    // );
    // expect(result.data.path(0, "t_timestamp_no_tz_date").value).toEqual(
    //   new Date("2020-03-02")
    // );
    // expect(result.data.path(0, "t_timestamp_no_tz_month").value).toEqual(
    //   new Date("2020-03-01")
    // );
    // expect(result.data.path(0, "t_timestamp_no_tz_year").value).toEqual(
    //   new Date("2020-01-01")
    // );
  });

  it(`sql_block`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is ||
        SELECT 1 as n
       ;;

      query: from_sql(one) -> { project: n }
      `
      )
      .run();
    expect(result.data.value[0].n).toBe(1);
  });

  it(`quote field name`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is ||
        SELECT 1 as "upperLower"
       ;;

      query: from_sql(one) -> { project: upperLower }
      `
      )
      .run();
    expect(result.data.value[0].upperLower).toBe(1);
  });

  it(`quote keyword`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: one is ||
        SELECT 1 as "select"
       ;;

      query: from_sql(one) -> {
        project:
          select
          create is select + 1
      }
      `
      )
      .run();
    expect(result.data.value[0].select).toBe(1);
    expect(result.data.value[0].create).toBe(2);
  });

  it(`quote table name`, async () => {
    const result = await runtime
      .loadQuery(
        `
      query: table('public.UpperTablePublic') -> { project: one }
      `
      )
      .run();
    expect(result.data.value[0].one).toBe(1);
  });

  it(`quote schema name`, async () => {
    const result = await runtime
      .loadQuery(
        `
      query: table('UpperSchema.UpperSchemaUpperTable') -> { project: one }
      `
      )
      .run();
    expect(result.data.value[0].one).toBe(1);
  });

  it(`use public schema if not specified`, async () => {
    const result = await runtime
      .loadQuery(
        `
    query: table('UpperTablePublic') -> { project: one }
    `
      )
      .run();
    expect(result.data.value[0].one).toBe(1);
  });
});
