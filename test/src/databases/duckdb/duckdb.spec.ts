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

import {Runtime} from '@malloydata/malloy';
import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';

const runtimes = ['duckdb', 'duckdb_wasm'];

const [describe, databases] = describeIfDatabaseAvailable(runtimes);

describe('duckdb', () => {
  let runtimeList: RuntimeList;

  beforeAll(() => {
    runtimeList = new RuntimeList(databases);
  });

  afterAll(async () => {
    await runtimeList.closeAll();
  });

  describe.each(databases)('%s tables', runtimeName => {
    it('can open tables with wildcards', async () => {
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
      expect(result.data.path(0, 'carrier').value).toEqual('AA');
    });
  });
});
