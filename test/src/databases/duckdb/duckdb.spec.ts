/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without evenro the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { Runtime } from "@malloydata/malloy";
import { RuntimeList } from "../../runtimes";
import { describeIfDatabaseAvailable } from "../../util";

const [describe] = describeIfDatabaseAvailable(["duckdb"]);

describe("duckdb", () => {
  let runtimeList: RuntimeList;
  let runtime: Runtime;

  beforeAll(() => {
    runtimeList = new RuntimeList(["duckdb"]);
    runtime = runtimeList.runtimeMap.get("duckdb") as Runtime;
    if (runtime === undefined) {
      throw new Error("Couldn't build runtime");
    }
  });

  afterAll(async () => {
    await runtimeList.closeAll();
  });

  describe("tables", () => {
    it("can open tables with wildcards", async () => {
      const result = await runtime
        .loadQuery(
          `
          query: table('duckdb:test/data/duckdb/fl*.parquet') -> {
            top: 1
            group_by: carrier;
          }
        `
        )
        .run();
      expect(result.data.path(0, "carrier").value).toEqual("AA");
    });
  });
});
