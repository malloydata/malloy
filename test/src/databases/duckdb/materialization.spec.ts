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

import {RuntimeList} from '../../runtimes';
import '../../util/db-jest-matchers';
import {describeIfDatabaseAvailable} from '../../util';

// TODO identify which tests need to run on wasm and move them into their own file
const runtimes = ['duckdb', 'duckdb_wasm'];

const [describe, databases] = describeIfDatabaseAvailable(runtimes);
const allDucks = new RuntimeList(databases);

describe.each(allDucks.runtimeList)('duckdb:%s', (dbName, runtime) => {
  it('materialized top level query is replaced and added to queries to materialize', async () => {
    const query = `
    # materialize
    query: myMaterializedQuery is duckdb.sql("select 1 as one, 'word' as word") -> {
      select:
          two is one + 1
    }

    source: foo is myMaterializedQuery extend {
      view: fooview is {
        select:
          three is two + 1
      }
    }

    run: foo -> fooview;
    `;

    const qm = runtime.loadQuery(query);
    const pq = await qm.getPreparedQuery();

    expect(pq.preparedResult.sql).toBe(
      'SELECT \n   base."two"+1 as "three"\nFROM myMaterializedQuerya6d1014e-c96c-5615-950d-49c0a8fae58a as base\n'
    );
    expect(pq.preparedResult.queriesToMaterialize).toStrictEqual({
      'myMaterializedQuerya6d1014e-c96c-5615-950d-49c0a8fae58a':
        'SELECT \n   base."one"+1 as "two"\nFROM (select 1 as one, \'word\' as word) as base\n',
    });
  });
});

afterAll(async () => {
  await allDucks.closeAll();
});
