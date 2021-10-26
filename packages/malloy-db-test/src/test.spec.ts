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

import { Malloy, Runtime, NoFiles, SingleConnection } from "malloy";
import { BigQueryConnection } from "malloy-db-bigquery";
import { PostgresConnection } from "malloy-db-postgres";

it("runs Malloy against BQ connection", async () => {
  const files = new NoFiles();
  // TODO should connections need to know their own name?
  const bqConnection = new BigQueryConnection("bigquery");
  const connections = new SingleConnection(bqConnection);
  const runtime = new Runtime(connections, files);
  const malloy = new Malloy(runtime);
  const model = await malloy.compileModel(
    "define flights is (explore 'examples.flights');"
  );
  const result = await malloy.runQuery({
    model,
    query: "flights | reduce flight_count is count()",
  });
  expect(result.result[0].flight_count).toBe(37561525);
});

it("runs Malloy against Postgres connection", async () => {
  const files = new NoFiles();
  const postgresConnection = new PostgresConnection("postgres");
  const connections = new SingleConnection(postgresConnection);
  const runtime = new Runtime(connections, files);
  const malloy = new Malloy(runtime);
  const result = await malloy.runQuery({
    query: "'public.flights' | reduce flight_count is count()",
  });
  expect(result.result[0].flight_count).toBe(37561525);
});

const files = new NoFiles();
const postgresConnection = new SingleConnection(
  new PostgresConnection("postgres")
);
const bqConnection = new SingleConnection(new BigQueryConnection("bigquery"));
const bqMalloy = new Malloy(new Runtime(bqConnection, files));
const postgresMalloy = new Malloy(new Runtime(postgresConnection, files));

it("runs Malloy against multiple connections", async () => {
  for (const malloy of [bqMalloy, postgresMalloy]) {
    const result = await malloy.runQuery({
      query: "'public.flights' | reduce flight_count is count()",
    });
    expect(result.result[0].flight_count).toBe(37561525);
  }
});
