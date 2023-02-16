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

import { RuntimeList } from "../runtimes";
import { describeIfDatabaseAvailable } from "../util";
import { HTMLView } from "@malloydata/render";
import { JSDOM } from "jsdom";

const [describe, databases] = describeIfDatabaseAvailable(["bigquery"]);
describe("rendering results", () => {
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  test("can render table", async () => {
    const runtime = runtimes.runtimeMap.get("bigquery");
    expect(runtime).toBeDefined();
    if (runtime) {
      const src = `
        query: table('malloy-data.faa.flights') -> {
          group_by: carrier
          aggregate: flight_count is count()
        }
      `;
      const result = await runtime.loadQuery(src).run();
      const document = new JSDOM().window.document;
      await new HTMLView(document).render(result.data, {
        "dataStyles": {}
      });
    }
  });

  test("can render unsupported types", async () => {
    const runtime = runtimes.runtimeMap.get("bigquery");
    expect(runtime).toBeDefined();
    if (runtime) {
      const src = `
        sql: geo_results is {
          select: """SELECT ST_GEOGFROMTEXT('LINESTRING(1 2, 3 4)') as geo"""
          connection: "bigquery"
        }
      `;
      const result = await runtime
        .loadModel(src)
        .loadSQLBlockByName("geo_results")
        .run();
      const document = new JSDOM().window.document;
      await new HTMLView(document).render(result.data, {
        "dataStyles": {}
      });
    }
  });
});
