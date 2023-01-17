/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as malloy from "@malloydata/malloy";
import { RuntimeList } from "../../runtimes";

// Chris, please rework.
it.skip("accessors are not too expensive", async () => {
  // If this test fails, consideration should be given to how much time using
  // the accessors costs.
  const runtime = new RuntimeList(["bigquery"]).runtimeMap.get("bigquery");

  expect(runtime).toBeDefined();
  if (runtime) {
    const result = await runtime
      .loadQuery(
        "explore 'malloy-data.faa.flights' | reduce inner is (reduce top 1000000 distance id2)"
      )
      .run();
    let noAccessorTime;
    let withAccessorTime;
    {
      const start = performance.now();
      const inner = result.data.value[0].inner;
      let total = 0;
      let count = 0;
      for (const row of inner as malloy.QueryData) {
        total += row.distance as number;
        count += 1;
      }
      noAccessorTime = performance.now() - start;
      expect(total).toBe(88560989);
      expect(count).toBe(1000000);
      // Rough bound, not using accessors should be no more 50 milleseconds / million rows
      expect(noAccessorTime).toBeLessThan(50);
    }
    {
      const start = performance.now();
      const inner = result.data.row(0).cell("inner").array;
      let total = 0;
      let count = 0;
      for (const row of inner) {
        total += row.cell("distance").number.value;
        count += 1;
      }
      withAccessorTime = performance.now() - start;
      expect(total).toBe(88560989);
      expect(count).toBe(1000000);
      // Rough bound, using accessors should be no more 70 milleseconds / million rows
      expect(withAccessorTime).toBeLessThan(150);
    }
  }
});
