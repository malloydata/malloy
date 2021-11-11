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

import { Runtime, EmptyURLReader } from "malloy";
import { BigQueryConnection } from "malloy-db-bigquery";
import { PostgresConnection } from "malloy-db-postgres";

it("runs Malloy against BQ connection", async () => {
  const files = new EmptyURLReader();
  // TODO should connections need to know their own name?
  const bqConnection = new BigQueryConnection("bigquery");
  const runtime = new Runtime({
    urls: files,
    schemas: bqConnection,
    connections: bqConnection,
  });
  const result = await runtime
    .makeModel("define flights is (explore 'examples.flights');")
    .makeQuery("flights | reduce flight_count is count()")
    .run();
  expect(result.getData().toObject()).toMatchObject([
    { flight_count: 37561525 },
  ]);
});

it("runs Malloy against Postgres connection", async () => {
  const files = new EmptyURLReader();
  const postgresConnection = new PostgresConnection("postgres");
  const runtime = new Runtime({
    urls: files,
    schemas: postgresConnection,
    connections: postgresConnection,
  });
  const result = await runtime
    .makeQuery("'public.flights' | reduce flight_count is count()")
    .run();
  expect(result.getData().toObject()).toMatchObject([
    { flight_count: 37561525 },
  ]);
});

const files = new EmptyURLReader();
const postgresConnection = new PostgresConnection("postgres");
const bqConnection = new BigQueryConnection("bigquery");
const bigquery = new Runtime({
  urls: files,
  schemas: bqConnection,
  connections: bqConnection,
});
const postgres = new Runtime({
  urls: files,
  schemas: postgresConnection,
  connections: postgresConnection,
});

it("runs Malloy against multiple connections", async () => {
  for (const runtime of [bigquery, postgres]) {
    const result = await runtime
      .makeQuery("'examples.flights' | reduce flight_count is count()")
      .run();
    expect(result.getData().toObject()).toMatchObject([
      { flight_count: 37561525 },
    ]);
  }
});
