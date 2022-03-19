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

import * as malloy from "@malloydata/malloy";
import { EmptyURLReader } from "@malloydata/malloy";
import { BigQueryTestConnection, PostgresTestConnection } from "./runtimes";

const bqConnection = new BigQueryTestConnection(
  "bigquery",
  {},
  { defaultProject: "malloy-data" }
);
const postgresConnection = new PostgresTestConnection("postgres");
const files = new EmptyURLReader();

const connectionMap = new malloy.FixedConnectionMap(
  new Map(
    Object.entries({
      bigquery: bqConnection,
      postgres: postgresConnection,
    })
  ),
  "bigquery"
);

const runtime = new malloy.Runtime(files, connectionMap);

afterAll(async () => {
  await postgresConnection.drain();
});

const expressionModelText = `
explore: default_aircraft is table('malloytest.aircraft'){
  measure: aircraft_count is count(DISTINCT tail_num)
}

explore: bigquery_state_facts is table('malloytest.state_facts'){
  measure: state_count is count(DISTINCT state)+2
}

explore: postgres_aircraft is table('postgres:malloytest.aircraft'){
  measure: aircraft_count is count(DISTINCT tail_num)+4
}
`;

const expressionModel = runtime.loadModel(expressionModelText);

it(`default query`, async () => {
  const result = await expressionModel
    .loadQuery(
      `
      query: default_aircraft-> {
        aggregate: aircraft_count
      }
    `
    )
    .run();
  // console.log(result.sql);
  expect(result.data.path(0, "aircraft_count").value).toBe(3599);
});

it(`bigquery query`, async () => {
  const result = await expressionModel
    .loadQuery(
      `
      query: bigquery_state_facts-> {
        aggregate: state_count
      }
    `
    )
    .run();
  // console.log(result.sql);
  expect(result.data.path(0, "state_count").value).toBe(53);
});

it(`postgres query`, async () => {
  const result = await expressionModel
    .loadQuery(
      `
      query: postgres_aircraft-> {
        aggregate: aircraft_count
      }
    `
    )
    .run();
  expect(result.data.path(0, "aircraft_count").value).toBe(3603);
});

it(`postgres raw query`, async () => {
  const result = await runtime
    .loadQuery(
      `
      query: table('postgres:malloytest.airports')->{
        group_by:
          version is version()
        aggregate:
          code_count is count(distinct code)
          airport_count is count()
      }
    `
    )
    .run();
  expect(result.data.path(0, "airport_count").value).toBe(19793);
  expect(result.data.path(0, "version").value).toMatch(/Postgre/);
  expect(result.data.path(0, "code_count").value).toBe(19793);
});
