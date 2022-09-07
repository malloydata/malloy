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

import { RuntimeList } from "../../runtimes";
import { describeIfDatabaseAvailable } from "../../util";

const [describe, databases] = describeIfDatabaseAvailable(["bigquery"]);
describe("BigQuery double truncation", () => {
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  test("check for double truncation", async () => {
    const runtime = runtimes.runtimeMap.get("bigquery");
    expect(runtime).toBeDefined();
    if (runtime) {
      const src = `
        query: table('malloy-data.faa.flights') -> {
          group_by: takeoff_week is dep_time.week
        }
      `;
      const result = await runtime.loadQuery(src).run();
      const truncs = (result.sql.match(/TIMESTAMP_TRUNC/gi) || []).length;
      if (truncs != 1) {
        fail(`Expected 1 TIMESTAMP_TRUNC, got ${truncs}\n${result.sql}`);
      }
    }
  });
});
