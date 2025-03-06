/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const NOTHING = 0;

import {runtimeFor} from '../runtimes';
import {getDataTree} from '@malloydata/render';
import {API} from '@malloydata/malloy';

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

        view: no_filter is {
          aggregate: flight_count
        }
      }
      query: top_carriers is flights -> top_carriers
      query: over_time is flights -> over_time
      query: by_origin is flights -> by_origin
      query: no_filter is flights -> no_filter
    `;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('can handle joined-in table fields', async () => {
    const result = await duckdb
      .loadModel(model)
      .loadQueryByName('top_carriers')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> { \n' +
      '  where: \n' +
      "    carriers.nickname = 'Southwest'" +
      '  \n' +
      '} + {select: *}\n';
    const row = table.rows[0];
    expect(row.getDrillQuery()).toEqual(expDrillQuery);
  });

  test('can handle expression fields', async () => {
    const result = await duckdb
      .loadModel(model)
      .loadQueryByName('over_time')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> { \n  where: \n    ' +
      'month(dep_time) = 8  \n} + {select: *}\n';
    const row = table.rows[0];
    expect(row.getDrillQuery()).toEqual(expDrillQuery);
  });

  test('can handle renamed and multi-word field names', async () => {
    const result = await duckdb
      .loadModel(model)
      .loadQueryByName('by_origin')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> { \n  where: \n    ' +
      "`Origin Code` = 'ATL'  \n} + {select: *}\n";
    const row = table.rows[0];
    expect(row.getDrillQuery()).toEqual(expDrillQuery);
  });

  test('can handle queries with no filter', async () => {
    const result = await duckdb
      .loadModel(model)
      .loadQueryByName('no_filter')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery = 'run: flights -> {select: *}';
    const row = table.rows[0];
    expect(row.getDrillQuery()).toEqual(expDrillQuery);
  });
});
