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
import '../../util/db-jest-matchers';

const [describe] = describeIfDatabaseAvailable(['trino']);

describe('Trino tests', () => {
  const runtimes = new RuntimeList(['trino']);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  runtimes.runtimeMap.forEach((runtime, databaseName) => {
    // Issue: #151
    it(`Basic trino  - ${databaseName}`, async () => {
      await expect(`
        run: trino.table('sample.burstbank.customer') -> {
          group_by: city
          aggregate: avgIncome is avg(estimated_income)
          aggregate: counti is count()
          nest: foo is {
            select: estimated_income
            order_by: estimated_income
            limit: 5
          }
          order_by: counti desc
          limit: 5
        }
      `).malloyResultMatches(runtime, {custkey: '1000001'});
    });
  });
});
