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

const [describe] = describeIfDatabaseAvailable(["duckdb", "duckdb_wasm"]);

describe("duckdb", () => {
  let runtimeList: RuntimeList;

  beforeAll(() => {
    runtimeList = new RuntimeList(["duckdb", "duckdb_wasm"]);
  });

  afterAll(async () => {
    await runtimeList.closeAll();
  });

  describe.each(["duckdb", "duckdb_wasm"])("%s tables", (runtimeName) => {
    it("can open tables with wildcards", async () => {
      const runtime = runtimeList.runtimeMap.get(runtimeName) as Runtime;
      expect(runtime).not.toBeUndefined();
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
