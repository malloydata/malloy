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

import {runtimeFor} from '../runtimes';
import {getDrillQuery} from '@malloydata/render';

const duckdb = runtimeFor('duckdb');

describe('drill query', () => {
  const model = `
      source: carriers is duckdb.table('test/data/duckdb/carriers.parquet') extend {
        primary_key: code
        measure: carrier_count is count()
      }
      source: flights is duckdb.table('test/data/duckdb/flights/part.*.parquet') extend {
        primary_key: id2
        // rename some fields as from their physical names
        rename: \`Origin Code\` is origin
        measure: flight_count is count()
        join_one: carriers with carrier

        view: top_carriers is {
          group_by: carriers.nickname
          aggregate:
            flight_count
          limit: 1
        }

        view: over_time is {
          group_by: dep_month is month(dep_time)
          aggregate: flight_count
          limit: 1
        }

        view: by_origin is {
          group_by: \`Origin Code\`
          aggregate: flight_count
          limit: 1
        }
      }
      query: top_carriers is flights -> top_carriers
      query: over_time is flights -> over_time
      query: by_origin is flights -> by_origin
    `;
  test('can handle joined-in table fields', async () => {
    const result = duckdb
      .loadModel(model)
      .loadQueryByName('top_carriers')
      .run();
    const table = (await result).data;
    const expDrillQuery =
      'run: flights -> { \n' +
      '  where: \n' +
      "    carriers.nickname = 'Southwest'" +
      '  \n' +
      '} + {select: *}\n';
    const row = table.row(0);
    expect(getDrillQuery(row).drillQuery).toEqual(expDrillQuery);
  });

  test('can handle expression fields', async () => {
    const result = duckdb.loadModel(model).loadQueryByName('over_time').run();
    const table = (await result).data;
    const expDrillQuery =
      'run: flights -> { \n  where: \n    ' +
      'month(dep_time) = 8  \n} + {select: *}\n';
    const row = table.row(0);
    expect(getDrillQuery(row).drillQuery).toEqual(expDrillQuery);
  });

  test('can handle renamed and multi-word field names', async () => {
    const result = duckdb.loadModel(model).loadQueryByName('by_origin').run();
    const table = (await result).data;
    const expDrillQuery =
      'run: flights -> { \n  where: \n    ' +
      "`Origin Code` = 'ATL'  \n} + {select: *}\n";
    const row = table.row(0);
    expect(getDrillQuery(row).drillQuery).toEqual(expDrillQuery);
  });
});
