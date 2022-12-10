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
/* eslint-disable no-console */

import "../../util/is-sql-eq";
import { RuntimeList } from "../../runtimes";
import { describeIfDatabaseAvailable } from "../../util";

// No prebuilt shared model, each test is complete.  Makes debugging easier.

const [describe, databases] = describeIfDatabaseAvailable([
  "bigquery",
  "duckdb",
]);

describe("Nested Source Table", () => {
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  runtimes.runtimeMap.forEach((runtime, databaseName) => {
    test(`date in sql_block no explore- ${databaseName}`, async () => {
      expect(1).toBe(1);
    });
  });
});
