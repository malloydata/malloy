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

import {SnowflakeExecutor} from './snowflake_executor';
import type {QueryData, RunSQLOptions} from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';

const [describe] = describeIfDatabaseAvailable(['snowflake']);

class SnowflakeExecutorTestSetup {
  private executor_: SnowflakeExecutor;
  constructor(executor: SnowflakeExecutor) {
    this.executor_ = executor;
  }

  async runBatch(sqlText: string): Promise<QueryData> {
    let ret: QueryData = [];
    await (async () => {
      const rows = await this.executor_.batch(sqlText);
      return rows;
    })().then((rows: QueryData) => {
      ret = rows;
    });
    return ret;
  }

  async runStreaming(sqlText: string, queryOptions?: RunSQLOptions) {
    const rows: QueryData = [];
    await (async () => {
      for await (const row of await this.executor_.stream(
        sqlText,
        queryOptions
      )) {
        rows.push(row);
      }
    })();
    return rows;
  }

  async done() {
    await this.executor_.done();
  }
}

describe('db:SnowflakeExecutor', () => {
  let db: SnowflakeExecutorTestSetup;
  let query: string;

  beforeAll(() => {
    const connOptions =
      SnowflakeExecutor.getConnectionOptionsFromEnv() ||
      SnowflakeExecutor.getConnectionOptionsFromToml();
    const executor = new SnowflakeExecutor(connOptions);
    db = new SnowflakeExecutorTestSetup(executor);
    query = `
    select
    *
  from
    (
      values
        (1, 'one'),
        (2, 'two'),
        (3, 'three'),
        (4, 'four'),
        (5, 'five')
    );
    `;
  });

  afterAll(async () => {
    await db.done();
  });

  it('verifies batch execute', async () => {
    const rows = await db.runBatch(query);
    expect(rows.length).toBe(5);
  });

  it('verifies stream iterable', async () => {
    const rows = await db.runStreaming(query, {rowLimit: 2});
    expect(rows.length).toBe(2);
  });
});
