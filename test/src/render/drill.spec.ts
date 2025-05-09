/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {runtimeFor} from '../runtimes';
import {getDataTree} from '@malloydata/render';
import {API} from '@malloydata/malloy';

const duckdb = runtimeFor('duckdb');

describe('drill query', () => {
  const model = `
    ##! experimental.drill
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

      view: cool_carriers is {
        where: carrier = 'AA' or carrier = 'WN'
        group_by: \`Origin Code\`
      }
    }
    query: top_carriers is flights -> top_carriers
    query: over_time is flights -> over_time
    query: by_origin is flights -> by_origin
    query: no_filter is flights -> no_filter
    query: cool_carriers is flights -> cool_carriers
    query: literal_with_nested_view_stable is flights -> {
      where:
        \`Origin Code\` ~ f'SFO, ORD',
        destination = 'SJC'
      group_by: carrier
      nest: cool_carriers
    }
    query: literal_with_nested_view_unstable is flights -> {
      where:
        carriers.nickname ~ '%A%',
        distance > 100,
        month(dep_time) = 7
      group_by: carrier
      nest: cool_carriers
      having: flight_count > 100
    }
    query: already_has_some_drills is flights -> {
      drill:
        \`Origin Code\` ~ f\`SFO, ORD\`,
        destination = "SJC",
        carrier = "AA",
        cool_carriers.\`Origin Code\` = "ORD"
    } + over_time
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
      'run: flights -> {\n' +
      '  drill:\n' +
      '    top_carriers.nickname = "Southwest"\n' +
      '} + { select: * }';
    const row = table.rows[0];
    expect(row.getDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle expression fields', async () => {
    const result = await duckdb
      .loadModel(model)
      .loadQueryByName('over_time')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> {\n  drill:\n    ' +
      'over_time.dep_month = 8\n} + { select: * }';
    const row = table.rows[0];
    expect(row.getDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle renamed and multi-word field names', async () => {
    const result = await duckdb
      .loadModel(model)
      .loadQueryByName('by_origin')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> {\n  drill:\n    ' +
      'by_origin.`Origin Code` = "ATL"\n} + { select: * }';
    const row = table.rows[0];
    expect(row.getDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle queries with no filter', async () => {
    const result = await duckdb
      .loadModel(model)
      .loadQueryByName('no_filter')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery = 'run: flights -> { select: * }';
    const row = table.rows[0];
    expect(row.getDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle view filters', async () => {
    const result = await duckdb
      .loadModel(model)
      .loadQueryByName('cool_carriers')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> {\n' +
      '  drill:\n' +
      '    cool_carriers.`Origin Code` = "ABQ"\n' +
      '} + { select: * }';
    const row = table.rows[0];
    expect(row.getDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle filters that are not in a view (not stable compatible)', async () => {
    const result = await duckdb
      .loadModel(model)
      .loadQueryByName('literal_with_nested_view_unstable')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery = `run: flights -> {
  drill:
    carriers.nickname ~ '%A%',
    distance > 100,
    month(dep_time) = 7,
    carrier = "AA"
} + { select: * }`;
    const row1 = table.rows[0];
    expect(row1.getDrillQueryMalloy()).toEqual(expDrillQuery);
    const nest = row1.column('cool_carriers');
    expect(nest.isRepeatedRecord()).toBe(true);
    if (nest.isRepeatedRecord()) {
      const expDrillQuery = `run: flights -> {
  drill:
    carriers.nickname ~ '%A%',
    distance > 100,
    month(dep_time) = 7,
    carrier = "AA",
    cool_carriers.\`Origin Code\` = "ABQ"
} + { select: * }`;
      const row = nest.rows[0];
      expect(row.getDrillQueryMalloy()).toEqual(expDrillQuery);
    }
  });

  test('can handle filters that are not in a view (stable compatible)', async () => {
    const result = await duckdb
      .loadModel(model)
      .loadQueryByName('literal_with_nested_view_stable')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery = `run: flights -> {
  drill:
    \`Origin Code\` ~ f\`SFO, ORD\`,
    destination = "SJC",
    carrier = "AA"
} + { select: * }`;
    const row1 = table.rows[0];
    expect(row1.getDrillQueryMalloy()).toEqual(expDrillQuery);
    const nest = row1.column('cool_carriers');
    expect(nest.isRepeatedRecord()).toBe(true);
    if (nest.isRepeatedRecord()) {
      const expDrillQuery = `run: flights -> {
  drill:
    \`Origin Code\` ~ f\`SFO, ORD\`,
    destination = "SJC",
    carrier = "AA",
    cool_carriers.\`Origin Code\` = "ORD"
} + { select: * }`;
      const row = nest.rows[0];
      expect(row.getDrillQueryMalloy()).toEqual(expDrillQuery);
    }
  });

  test('can handle drills that are already there', async () => {
    const result = await duckdb
      .loadModel(model)
      .loadQueryByName('already_has_some_drills')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery = `run: flights -> {
  drill:
    \`Origin Code\` ~ f\`SFO, ORD\`,
    destination = "SJC",
    carrier = "AA",
    cool_carriers.\`Origin Code\` = "ORD",
    over_time.dep_month = 5
} + { select: * }`;
    const row = table.rows[0];
    expect(row.getDrillQueryMalloy()).toEqual(expDrillQuery);
  });
});
