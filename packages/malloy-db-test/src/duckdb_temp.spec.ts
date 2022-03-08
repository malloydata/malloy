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

import { DuckDBTestConnection } from "./runtimes";

const duckDB = new DuckDBTestConnection("duckdb");

it(`silly test}`, async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const count = await duckDB.runSQL("SELECT COUNT(*) FROM 'airports';");
  console.log(count);
});
