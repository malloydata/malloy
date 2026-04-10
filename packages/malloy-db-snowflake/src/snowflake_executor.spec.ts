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

  async runBatch(
    sqlText: string,
    options?: RunSQLOptions,
    timeoutMs?: number
  ): Promise<QueryData> {
    let ret: QueryData = [];
    await (async () => {
      const rows = await this.executor_.batch(sqlText, options, timeoutMs);
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

  it('aborts batch immediately when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      db.runBatch('select 1 as one', {abortSignal: controller.signal})
    ).rejects.toThrow('Query aborted');
  });

  it('aborts stream immediately when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      db.runStreaming('select 1 as one', {abortSignal: controller.signal})
    ).rejects.toThrow('Query aborted');
  });

  it('cancels long-running batch on timeout and does not hang', async () => {
    // Use a long-running statement so the client-side timeout triggers
    // rather than the query finishing first.
    const longRunningSql = 'CALL SYSTEM$WAIT(60)';
    const start = Date.now();
    await expect(db.runBatch(longRunningSql, {}, 500)).rejects.toBeInstanceOf(
      Error
    );
    const elapsed = Date.now() - start;
    // Should fail well before the Jest 100s timeout; give a generous upper bound.
    expect(elapsed).toBeLessThan(30_000);
    // Subsequent queries should still work after a timeout-induced cancel.
    const rows = await db.runBatch('select 1 as one');
    expect(rows.length).toBe(1);
  });
});
