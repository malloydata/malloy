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

import {DateTime} from 'luxon';
import {RuntimeList} from '../../runtimes';
import '../../util/db-jest-matchers';
import {describeIfDatabaseAvailable} from '../../util';

const [describe, databases] = describeIfDatabaseAvailable(['bigquery']);
describe('BigQuery double truncation', () => {
  const runtimes = new RuntimeList(databases);
  const runtime = runtimes.runtimeMap.get('bigquery');

  afterAll(async () => {
    await runtimes.closeAll();
  });

  const utc_2020 = DateTime.fromObject({
    year: 2020,
    month: 2,
    day: 20,
    hour: 0,
    minute: 0,
    second: 0,
    zone: 'UTC',
  });
  // TODO: this test is not working in this file.
  test.skip('can use unsupported types', async () => {
    await expect(runtime).queryMatches(
      `sql: timeData is { connection: "bigquery" select: """
      SELECT DATETIME '2020-02-20 00:00:00' as t_datetime
      """}
    query: from_sql(timeData) -> {
      project: mex_220 is t_datetime::timestamp
    }`,
      {mex_220: utc_2020.toJSDate()}
    );
  });
});
