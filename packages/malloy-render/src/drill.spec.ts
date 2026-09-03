/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {runtimeFor} from '../../../test/src/runtimes';
import {getDataTree} from './data_tree';
import {API} from '@malloydata/malloy';

const duckdb = runtimeFor('duckdb');

// Base model with common sources that all tests will use
const baseModel = `
  ##! experimental { parameters }
  source: carriers is duckdb.table('test/data/malloytest-parquet/carriers.parquet') extend {
    primary_key: code
    measure: carrier_count is count()
  }
  source: flights_base is duckdb.table('test/data/duckdb/flights/part.*.parquet') extend {
    primary_key: id2
    // rename some fields as from their physical names
    rename: \`Origin Code\` is origin
    measure: flight_count is count()
    join_one: carriers with carrier
  }
`;

describe('drill query', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('can handle joined-in table fields in literal query', async () => {
    const query = `
      run: flights_base -> {
        group_by: carriers.nickname
        aggregate: flight_count
        limit: 1
      }
    `;
    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights_base -> { drill: carriers.nickname = "Southwest" } + { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  // A filtered measure carries its own drill_filters. Drilling the CELL must
  // include them, or the drill lands on a superset of the rows behind the
  // number that was clicked.
  test('filtered measure contributes its own filter', async () => {
    const query = `
      run: flights_base -> {
        group_by: carriers.nickname
        aggregate: flight_count
        aggregate: wn_flights is flight_count { where: carrier = 'WN' }
        limit: 1
      }
    `;
    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const cell = table.rows[0].column('wn_flights');
    const expDrillQuery = `run: flights_base -> {
  drill:
    carriers.nickname = "Southwest",
    carrier = "WN"
} + { select: * }`;
    expect(cell.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  // The row-level drill must NOT pick up a sibling measure's filter — the leaf
  // branch only fires for the clicked cell.
  test('row drill is unaffected by a sibling filtered measure', async () => {
    const query = `
      run: flights_base -> {
        group_by: carriers.nickname
        aggregate: flight_count
        aggregate: wn_flights is flight_count { where: carrier = 'WN' }
        limit: 1
      }
    `;
    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights_base -> { drill: carriers.nickname = "Southwest" } + { select: * }';
    expect(table.rows[0].getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  // A drill clause reaching through a JOIN must bring that join along, even when
  // the view it lands on doesn't otherwise need it. Regression: the drill field's
  // refSummary carried only the field's own usage, so the join was omitted and
  // the SQL referenced an unjoined alias — it COMPILED, then failed at execution
  // with a binder error. Hence this runs the query rather than matching text.
  test('drill through a joined field pulls the join into the query', async () => {
    const model = `
      source: flights is flights_base extend {
        view: by_origin is { group_by: \`Origin Code\`; aggregate: flight_count }
        view: by_carrier is { group_by: carriers.nickname; aggregate: flight_count }
      }
    `;
    const result = await duckdb
      .loadModel(baseModel)
      .extendModel(model)
      .loadQuery(
        'run: flights -> by_origin + { drill: by_carrier.nickname = "Southwest" }'
      )
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    expect(table.rows.length).toBeGreaterThan(0);
  });

  // `a and b` decomposes into two independent drill clauses. Sound only for
  // `and`, since drill clauses are conjunctive.
  test('compound and filter decomposes into separate clauses', async () => {
    const query = `
      run: flights_base -> {
        group_by: carriers.nickname
        aggregate: flight_count
        aggregate: wn_short is flight_count { where: carrier = 'WN' and distance = 100 }
        limit: 1
      }
    `;
    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery = `run: flights_base -> {
  drill:
    carriers.nickname = "Southwest",
    carrier = "WN",
    distance = 100
} + { select: * }`;
    expect(
      table.rows[0].column('wn_short').getStableDrillQueryMalloy()
    ).toEqual(expDrillQuery);
  });

  // A bare boolean is an implicit `= true`.
  test('bare boolean filter is stable', async () => {
    const query = `
      run: flights_base extend { dimension: is_wn is carrier = 'WN' } -> {
        group_by: carriers.nickname
        aggregate: flight_count
        aggregate: wn is flight_count { where: is_wn }
        limit: 1
      }
    `;
    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery = `run: flights_base -> {
  drill:
    carriers.nickname = "Southwest",
    is_wn = true
} + { select: * }`;
    expect(table.rows[0].column('wn').getStableDrillQueryMalloy()).toEqual(
      expDrillQuery
    );
  });

  // `or` must NOT decompose — splitting it would widen the predicate. It stays
  // unstable and falls back to the raw filter code.
  test('or filter stays unstable', async () => {
    const query = `
      run: flights_base -> {
        group_by: carriers.nickname
        aggregate: flight_count
        aggregate: wn_or_aa is flight_count { where: carrier = 'WN' or carrier = 'AA' }
        limit: 1
      }
    `;
    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const cell = table.rows[0].column('wn_or_aa');
    expect(cell.getStableDrillQueryMalloy()).toBeUndefined();
    expect(cell.getDrillQueryMalloy()).toContain(
      "carrier = 'WN' or carrier = 'AA'"
    );
  });

  test('can time truncation field renamed', async () => {
    const query = `
      run: flights_base -> {
        group_by: dep_time.month
        aggregate: flight_count
      }
    `;
    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights_base -> { drill: dep_time.month = @2005-12 } + { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can time truncation field not renamed', async () => {
    const query = `
      run: flights_base -> {
        group_by: dep_month is dep_time.month,
        aggregate: flight_count
      }
    `;

    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights_base -> { drill: dep_time.month = @2005-12 } + { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('correct literal syntax for all date truncations', async () => {
    const query = `
      run: flights_base -> {
        group_by:
          dep_year is dep_time.year,
          dep_quarter is dep_time.quarter,
          dep_month is dep_time.month,
          dep_week is dep_time.week,
          dep_day is dep_time.day,
          dep_hour is dep_time.hour,
          dep_minute is dep_time.minute,
          dep_second is dep_time.second
        aggregate: flight_count
        order_by: dep_second
        limit: 1
      }
    `;

    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery = `run: flights_base -> {
  drill:
    dep_time.year = @2000,
    dep_time.quarter = @2000-Q1,
    dep_time.month = @2000-01,
    dep_time.week = @1999-12-26-WK,
    dep_time.day = @2000-01-01,
    dep_time.hour = @2000-01-01 00,
    dep_time.minute = @2000-01-01 00:00,
    dep_time.second = @2000-01-01 00:00:00
} + { select: * }`;
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle normal field in literal query', async () => {
    const query = `
      run: flights_base -> {
        group_by: carrier
        aggregate: flight_count
        limit: 1
      }
    `;

    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights_base -> { drill: carrier = "WN" } + { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle renamed joined-in table fields in literal query', async () => {
    const query = `
      run: flights_base -> {
        group_by: nick is carriers.nickname
        aggregate: flight_count
        limit: 1
      }
    `;

    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights_base -> { drill: carriers.nickname = "Southwest" } + { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle renamed table fields in literal query', async () => {
    const query = `
      run: flights_base -> {
        group_by: c is carrier
        aggregate: flight_count
        limit: 1
      }
    `;

    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights_base -> { drill: carrier = "WN" } + { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle joined-in table fields in view', async () => {
    const model = `
      source: flights is flights_base extend {
        view: top_carriers is {
          group_by: carriers.nickname
          aggregate: flight_count
          limit: 1
        }
      }
    `;

    const result = await duckdb
      .loadModel(baseModel)
      .extendModel(model)
      .loadQuery('run: flights -> top_carriers')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> { drill: top_carriers.nickname = "Southwest" } + { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle expression fields', async () => {
    const model = `
      source: flights is flights_base extend {
        view: over_time is {
          group_by: dep_month is month(dep_time)
          aggregate: flight_count
          limit: 1
        }
      }
    `;

    const result = await duckdb
      .loadModel(baseModel)
      .extendModel(model)
      .loadQuery('run: flights -> over_time')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> { drill: over_time.dep_month = 8 } + { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle renamed and multi-word field names', async () => {
    const model = `
      source: flights is flights_base extend {
        view: by_origin is {
          group_by: \`Origin Code\`
          aggregate: flight_count
          limit: 1
        }
      }
    `;

    const result = await duckdb
      .loadModel(baseModel)
      .extendModel(model)
      .loadQuery('run: flights -> by_origin')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> { drill: by_origin.`Origin Code` = "ATL" } + { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle queries with no filter', async () => {
    const model = `
      source: flights is flights_base extend {
        view: no_filter is {
          aggregate: flight_count
        }
      }
    `;

    const result = await duckdb
      .loadModel(baseModel)
      .extendModel(model)
      .loadQuery('run: flights -> no_filter')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery = 'run: flights -> { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle view filters', async () => {
    const model = `
      source: flights is flights_base extend {
        view: cool_carriers is {
          where: carrier = 'AA' or carrier = 'WN'
          group_by: \`Origin Code\`
        }
      }
    `;

    const result = await duckdb
      .loadModel(baseModel)
      .extendModel(model)
      .loadQuery('run: flights -> cool_carriers')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> { drill: cool_carriers.`Origin Code` = "ABQ" } + { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle filters that are not in a view (not stable compatible)', async () => {
    const query = `
      source: flights is flights_base extend {
        view: cool_carriers is {
          where: carrier = 'AA' or carrier = 'WN'
          group_by: \`Origin Code\`
        }
      }

      run: flights -> {
        where:
          carriers.nickname ~ '%A%',
          distance > 100,
          month(dep_time) = 7
        group_by: carrier
        nest: cool_carriers
        having: flight_count > 100
      }
    `;

    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
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

  test('can handle deeply nested', async () => {
    const model = `
      source: flights is flights_base extend {
        view: deeply_nested is {
          nest: level_one is {
            nest: level_two is {
              group_by: field is 1
            }
          }
        }
      }
    `;

    const result = await duckdb
      .loadModel(baseModel)
      .extendModel(model)
      .loadQuery('run: flights -> deeply_nested')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> { drill: deeply_nested.level_one.level_two.field = 1 } + { select: * }';
    const row1 = table.rows[0];
    const levelOne = row1.column('level_one');
    expect(levelOne.isRecord()).toBe(true);
    if (!levelOne.isRecord()) return;
    const levelTwo = levelOne.column('level_two');
    expect(levelTwo.isRepeatedRecord()).toBe(true);
    if (!levelTwo.isRepeatedRecord()) return;
    const row = levelTwo.rows[0];
    expect(row.getDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle nested reference', async () => {
    const query = `
      source: flights is flights_base extend {
        view: top_carriers is {
          group_by: carriers.nickname
          aggregate: flight_count
          limit: 1
        }
      }
      run: flights -> {
        nest: tc is top_carriers
      }
    `;

    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> { drill: tc.nickname = "Southwest" } + { select: * }';
    const row1 = table.rows[0];
    const levelOne = row1.column('tc');
    expect(levelOne.isRepeatedRecord()).toBe(true);
    if (!levelOne.isRepeatedRecord()) return;
    const row = levelOne.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('can handle filters that are not in a view (stable compatible)', async () => {
    const query = `
      source: flights is flights_base extend {
        view: cool_carriers is {
          where: carrier = 'AA' or carrier = 'WN'
          group_by: \`Origin Code\`
        }
      }
      run: flights -> {
        where:
          \`Origin Code\` ~ f'SFO, ORD',
          destination = 'SJC'
        group_by: carrier
        nest: cool_carriers
      }
    `;

    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery = `run: flights -> {
  drill:
    \`Origin Code\` ~ f\`SFO, ORD\`,
    destination = "SJC",
    carrier = "AA"
} + { select: * }`;
    const row1 = table.rows[0];
    expect(row1.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
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
      expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
    }
  });

  test('can handle drills that are already there', async () => {
    const query = `
      source: flights is flights_base extend {
        view: cool_carriers is {
          where: carrier = 'AA' or carrier = 'WN'
          group_by: \`Origin Code\`
        }
        view: over_time is {
          group_by: dep_month is month(dep_time)
          aggregate: flight_count
          // #3045: months 5 and 10 tie on flight_count under these drill
          // filters, and Malloy's default ordering does not break ties, so
          // \`limit: 1\` needs an explicit tiebreak to be deterministic.
          order_by: flight_count desc, dep_month
          limit: 1
        }
      }
      run: flights -> {
        drill:
          \`Origin Code\` ~ f\`SFO, ORD\`,
          destination = "SJC",
          carrier = "AA",
          cool_carriers.\`Origin Code\` = "ORD"
      } + over_time
    `;

    const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
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
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
  });

  test('negative number can be used in stable query filter', async () => {
    const model = `
      source: flights is flights_base extend {
        view: negative_value is {
          group_by: negative_one is -1
        }
      }
    `;

    const result = await duckdb
      .loadModel(baseModel)
      .extendModel(model)
      .loadQuery('run: flights -> negative_value')
      .run();
    const table = getDataTree(API.util.wrapResult(result));
    const expDrillQuery =
      'run: flights -> { drill: negative_value.negative_one = -1 } + { select: * }';
    const row = table.rows[0];
    expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
    expect(row.getStableDrillQuery()).toMatchObject({
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'flights',
        },
        view: {
          kind: 'segment',
          operations: [
            {
              filter: {
                expression: {
                  kind: 'field_reference',
                  name: 'negative_one',
                  path: ['negative_value'],
                },
                kind: 'literal_equality',
                value: {
                  kind: 'number_literal',
                  number_value: -1,
                },
              },
              kind: 'drill',
            },
          ],
        },
      },
    });
  });

  describe('source parameters', () => {
    test('can handle source parameters', async () => {
      const query = `
        source: flights_with_parameters(
          number_param is 1,
          string_param is 'foo',
          boolean_param is true,
          date_param is @2000,
          timestamp_param is @2004-01-01 10:00,
          filter_expression_param::filter<number> is f'> 3'
        ) is flights_base extend {
          view: top_carriers is {
            group_by: carriers.nickname
            aggregate: flight_count
            limit: 1
          }
        }
        run: flights_with_parameters(
          number_param is 1,
          string_param is 'foo',
          boolean_param is true,
          date_param is @2000,
          timestamp_param is @2004-01-01 10:00,
          filter_expression_param is f'> 3'
        ) -> top_carriers
      `;

      const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
      const table = getDataTree(API.util.wrapResult(result));
      const expDrillQuery = `run: flights_with_parameters(
  number_param is 1,
  string_param is "foo",
  boolean_param is true,
  date_param is @2000,
  timestamp_param is @2004-01-01 10:00,
  filter_expression_param is f\`> 3\`
) -> { drill: top_carriers.nickname = "Southwest" } + { select: * }`;
      const row = table.rows[0];
      expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
    });

    test('can handle timezone in source parameter', async () => {
      const query = `
        source: flights_with_timestamp_param(
          timestamp_param is @2004-01-01 10:00
        ) is flights_base extend {
          view: top_carriers is {
            group_by: carriers.nickname
            aggregate: flight_count
            limit: 1
          }
        }
        run: flights_with_timestamp_param(
          timestamp_param is @2004-01-01 10:00:00[America/Los_Angeles]
        ) -> top_carriers
      `;

      const result = await duckdb.loadModel(baseModel).loadQuery(query).run();
      const table = getDataTree(API.util.wrapResult(result));
      const expDrillQuery =
        'run: flights_with_timestamp_param(timestamp_param is @2004-01-01 10:00:00[America/Los_Angeles]) -> { drill: top_carriers.nickname = "Southwest" } + { select: * }';
      const row = table.rows[0];
      expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
    });

    test('default_params_are_not_included', async () => {
      const model = `
        source: flights_with_parameters(
          number_param is 1,
          string_param is 'foo',
          boolean_param is true,
          date_param is @2000,
          timestamp_param is @2004-01-01 10:00,
          filter_expression_param::filter<number> is f'> 3'
        ) is flights_base extend {
          view: top_carriers is {
            group_by: carriers.nickname
            aggregate: flight_count
            limit: 1
          }
        }
      `;

      const result = await duckdb
        .loadModel(baseModel)
        .extendModel(model)
        .loadQuery('run: flights_with_parameters -> top_carriers')
        .run();
      const table = getDataTree(API.util.wrapResult(result));
      const expDrillQuery =
        'run: flights_with_parameters -> { drill: top_carriers.nickname = "Southwest" } + { select: * }';
      const row = table.rows[0];
      expect(row.getStableDrillQueryMalloy()).toEqual(expDrillQuery);
    });
  });
});

afterAll(async () => {
  await duckdb.connection.close();
});
