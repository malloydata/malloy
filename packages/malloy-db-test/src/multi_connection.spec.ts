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

import * as malloy from "@malloy-lang/malloy";
import { Connection, EmptyURLReader } from "@malloy-lang/malloy";
import { BigQueryTestConnection } from "./runtimes";

const bqConnection = new BigQueryTestConnection("bigquery", {}, "malloy-data");
// const postgresConnection = new PostgresTestConnection("postgres");
const files = new EmptyURLReader();

const connectionMap = new malloy.FixedConnectionMap(
  new Map<string, Connection>(
    Object.entries({
      bigquery: bqConnection,
      // postgres: postgresConnection,
    })
  ),
  "bigquery"
);

const runtime = new malloy.Runtime(files, connectionMap);

const expressionModelText = `
export define default_aircraft is (explore 'malloytest.aircraft'
  aircraft_count is count(DISTINCT tail_num)
);

export define bigquery_state_facts is (explore 'bigquery:malloytest.state_facts'
  state_count is count(DISTINCT state)+2
);

-- export define postgres_aircraft is (explore 'postgres:malloytest.aircraft'
--   aircraft_count is count(DISTINCT tail_num)+4
-- );
`;

const expressionModel = runtime.loadModel(expressionModelText);

it(`default query`, async () => {
  const result = await expressionModel
    .loadQuery(
      `
      explore default_aircraft | reduce
        aircraft_count
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
      explore bigquery_state_facts | reduce
        state_count
    `
    )
    .run();
  // console.log(result.sql);
  expect(result.data.path(0, "state_count").value).toBe(53);
});

it.skip(`postgres query`, async () => {
  const result = await expressionModel
    .loadQuery(
      `
      explore postgres_aircraft | reduce
        aircraft_count
    `
    )
    .run();
  expect(result.data.path(0, "aircraft_count").value).toBe(3603);
});

it.skip(`postgres raw query`, async () => {
  const result = await runtime
    .loadQuery(
      `
      explore 'postgres:malloytest.airports' | reduce
        version is version()
        code_count is count(distinct code)
        airport_count is count()
    `
    )
    .run();
  expect(result.data.path(0, "airport_count").value).toBe(19793);
  expect(result.data.path(0, "version").value).toMatch(/Postgre/);
  expect(result.data.path(0, "code_count").value).toBe(19793);
});
