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
      'SELECT \n   base."two"+1 as "three"\nFROM myMaterializedQuery-6037d4be-8b92-5ea7-95a0-27bd26c240ca as base\n'
    );
    expect(pq.preparedResult.dependenciesToMaterialize).toStrictEqual({
      'myMaterializedQuery-6037d4be-8b92-5ea7-95a0-27bd26c240ca': {
        'id': '6037d4be-8b92-5ea7-95a0-27bd26c240ca',
        'path': 'internal://internal.malloy',
        'queryName': 'myMaterializedQuery',
        'source': undefined,
      },
    });
  });

  it('materialized multiple levels', async () => {
    const query = `
    # materialize
    query: myMaterializedQuery is duckdb.sql("select 1 as one, 'word' as word") -> {
      select:
          two is one + 1
    }

    # materialize
    query: secondLevelMaterializedQuery is myMaterializedQuery -> {
      select:
          three is two + 1
    }

    source: foo is secondLevelMaterializedQuery extend {
      view: fooview is {
        select:
          four is three + 1
      }
    }

    run: foo -> fooview;
    `;

    const qm = runtime.loadQuery(query);
    const pq = await qm.getPreparedQuery();

    expect(pq.preparedResult.sql).toBe(
      'SELECT \n   base."three"+1 as "four"\nFROM secondLevelMaterializedQuery-bd80d526-f867-587e-933e-89353d26d022 as base\n'
    );
    expect(pq.preparedResult.dependenciesToMaterialize).toStrictEqual({
      'secondLevelMaterializedQuery-bd80d526-f867-587e-933e-89353d26d022': {
        id: 'bd80d526-f867-587e-933e-89353d26d022',
        path: 'internal://internal.malloy',
        queryName: 'secondLevelMaterializedQuery',
        source: undefined,
      },
    });
  });
});

afterAll(async () => {
  await allDucks.closeAll();
});
