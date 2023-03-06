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

/* eslint-disable no-console */

import {describeIfDatabaseAvailable} from '../../util';
import {RuntimeList} from '../../runtimes';

const [describe] = describeIfDatabaseAvailable(['bigquery']);

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

describe('JSON tests', () => {
  const runtimes = new RuntimeList(['bigquery']);

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
      expect(result.data.path(0, 'class_name').value).toBe('C');
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
      expect(result.data.path(0, 'j').value).toContain('Jamie');
    });
  });
});
