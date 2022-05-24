/* eslint-disable no-console */
/*
 * Copyright 2021 Google LLC
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

import { RuntimeList } from "./runtimes";

const runtimeList = new RuntimeList(["duckdb"]);
const runtime = runtimeList.runtimeMap.get("duckdb");
if (runtime === undefined) {
  throw new Error("Couldn't build runtime");
}

describe("duckdb tests", () => {
  it(`first_turtle`, async () => {
    const result = await runtime
      .loadQuery(
        `
        query: table('malloytest.airports') ->{
          where: state != null
          limit: 2
          group_by: state
          aggregate: airport_count is count()
          nest: by_fac_type is {
            group_by: fac_type
            aggregate: airport_count is count()
          }
        } -> {
          group_by: state, airport_count, by_fac_type.fac_type
          order_by: 2 desc
        }
        `
      )
      .run();
    console.log(result.sql);
    console.log(result.data.toObject());
    expect(result.data.value[0].state).toBe("TX");
    // );
  });
});
