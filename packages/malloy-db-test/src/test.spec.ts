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

import { Runtime, EmptyUriReader } from "malloy";
import { BigQueryConnection } from "malloy-db-bigquery";
import { PostgresConnection } from "malloy-db-postgres";

it("runs Malloy against BQ connection", async () => {
  const files = new EmptyUriReader();
  // TODO should connections need to know their own name?
  const bqConnection = new BigQueryConnection("bigquery");
  const runtime = new Runtime(files, bqConnection, bqConnection);
  const result = await runtime.executeQuery(
    { string: "flights | reduce flight_count is count()" },
    { string: "define flights is (explore 'examples.flights');" }
  );
  expect(result.result[0].flight_count).toBe(37561525);
});

it("runs Malloy against Postgres connection", async () => {
  const files = new EmptyUriReader();
  const postgresConnection = new PostgresConnection("postgres");
  const runtime = new Runtime(files, postgresConnection, postgresConnection);
  const result = await runtime.executeQuery({
    string: "'public.flights' | reduce flight_count is count()",
  });
  expect(result.result[0].flight_count).toBe(37561525);
});

const files = new EmptyUriReader();
const postgresConnection = new PostgresConnection("postgres");
const bqConnection = new BigQueryConnection("bigquery");
const bigquery = new Runtime(files, bqConnection, bqConnection);
const postgres = new Runtime(files, postgresConnection, postgresConnection);

it("runs Malloy against multiple connections", async () => {
  for (const runtime of [bigquery, postgres]) {
    const result = await runtime.executeQuery({
      string: "'examples.flights' | reduce flight_count is count()",
    });
    expect(result.result[0].flight_count).toBe(37561525);
  }
});
