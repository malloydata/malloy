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

import { describeIfDatabaseAvailable } from "../../util";
import { RuntimeList } from "../../runtimes";

const [describe] = describeIfDatabaseAvailable(["bigquery"]);

const modelString = `
  sql: source_sql is {
    select: """
        SELECT *
        FROM UNNEST([
          STRUCT( JSON '{"class_name": "A", "class" : {"students" : [{"name" : "Jane"}]}}' as j, 1 as r),
          STRUCT( JSON '{"class_name": "B", "class" : {"students" : []}}', 2),
          STRUCT( JSON '{"class_name": "C", "class" : {"students" : [{"name" : "John"}, {"name": "Jamie"}]}}', 3)
      ]) AS t
    """
    connection: "bigquery"
  }

  source: s is from_sql(source_sql) {

  }

`;

describe("JSON tests", () => {
  const runtimes = new RuntimeList(["bigquery"]);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  runtimes.runtimeMap.forEach((runtime, databaseName) => {
    // Issue: #151
    it(`JSON Scalar  - ${databaseName}`, async () => {
      //it(`model: do filters force dependant joins? - ${databaseName}`, async () => {
      const result = await runtime
        .loadQuery(
          `
            ${modelString}

            query: s-> {
              group_by: class_name is JSON_EXTRACT_SCALAR(j, '$.class_name')
              order_by: 1 desc
            }
              `
        )
        .run();
      // console.log(result.data.toObject());
      expect(result.data.path(0, "class_name").value).toBe("C");
    });

    it(`Return Json  - ${databaseName}`, async () => {
      //it(`model: do filters force dependant joins? - ${databaseName}`, async () => {
      const result = await runtime
        .loadQuery(
          `
            ${modelString}

            query: s-> {
              project: j, r
              order_by: 2 desc
            }
              `
        )
        .run();
      // console.log(result.data.toObject());
      expect(result.data.path(0, "j").value).toContain("Jamie");
    });
  });
});
