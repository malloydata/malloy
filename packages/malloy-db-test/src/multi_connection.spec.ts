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
import { BigQueryTestConnection, PostgresTestConnection } from "./runtimes";

const bqConnection = new BigQueryTestConnection("bigquery");
const postgresConnection = new PostgresTestConnection("postgres");
const files = new EmptyURLReader();

const connectionMap = new malloy.FixedConnectionMap(
  new Map<string, Connection>(
    Object.entries({
      bigquery: bqConnection,
      postgres: postgresConnection,
    })
  ),
  "bigquery"
);

const runtime = new malloy.Runtime(files, connectionMap);

const expressionModelText = `
export define default_aircraft is (explore 'malloytest.aircraft_models'
  aircraft_count is count()
);

export define bigquery_aircraft is (explore 'bigquery:malloytest.aircraft_models'
  aircraft_count is count()+2
);

-- export define bigquery_aircraft is (explore 'postgres:malloytest.aircraft_models'
--   aircraft_count is count()+4
-- );
`;

const expressionModel = runtime.loadModel(expressionModelText);

// Floor is broken (doesn't compile because the expression returned isn't an aggregate.)
it(`default query`, async () => {
  const result = await expressionModel
    .loadQuery(
      `
      explore default_aircraft | reduce
        aircraft_count
    `
    )
    .run();
  expect(result.data.path(0, "aircraft_count").value).toBe(60461);
});

it(`bigquery query`, async () => {
  const result = await expressionModel
    .loadQuery(
      `
      explore bigquery_aircraft | reduce
        aircraft_count
    `
    )
    .run();
  expect(result.data.path(0, "aircraft_count").value).toBe(60463);
});
