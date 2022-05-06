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

import { DuckDBConnection } from "@malloydata/db-duckdb";
import { DuckDBTestConnection } from "./runtimes";

const duckDB = new DuckDBTestConnection("duckdb") as DuckDBConnection;

it(`silly test}`, async () => {
  // // eslint-disable-next-line @typescript-eslint/nom-var-requires
  // // const count = await duckDB.runSQL("SELECT COUNT(*) FROM 'airports';");
  const count = await duckDB.runRawSQL(
`
select sum_distinct([{key:1, val: 2},{key:1, val: 2},{key:3, val: 4}]) as val ;
`
  );

  // const count = await duckDB.fetchSchemaForTables(["malloytest.airports"]);

  console.log(count);
});
