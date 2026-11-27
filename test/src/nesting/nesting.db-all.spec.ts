/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel, runQuery} from '@malloydata/malloy/test';
import '../util/db-jest-matchers';

afterAll(() => testDatabase.shutdown());

const modelText = `
source: aircraft_models is db.table('malloytest.aircraft_models') extend {
  primary_key: aircraft_model_code
  measure:
    aircraft_model_count is count(),
    total_seats is sum(seats),
    boeing_seats is sum(seats) { where: manufacturer ? 'BOEING'},
    percent_boeing is boeing_seats / total_seats * 100,
    percent_boeing_floor is floor(boeing_seats / total_seats * 100),
  dimension: seats_bucketed is floor(seats/20)*20.0
}

source: aircraft is db.table('malloytest.aircraft') extend {
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count()
  view: by_manufacturer is {
    top: 5
    group_by: aircraft_models.manufacturer
    aggregate: aircraft_count
  }
}
`;
const testModel = wrapTestModel(testDatabase, modelText);

// simple turtle expressions
it('simple turtle', async () => {
  await expect(`
      // # test.debug
      run:  db.table('malloytest.state_facts') -> {
        group_by: popular_name
        aggregate: airport_count.sum()
        nest: by_state is {
          group_by: state
          aggregate: airport_count.sum()
          limit: 2
        }
        limit: 3
      }
    `).toMatchPaths(testModel, {
    'by_state.state': 'TX',
    'by_state.airport_count': 1845,
  });
});

it('double turtle', async () => {
  await expect(`
      run:  db.table('malloytest.state_facts') -> {
        aggregate: airport_count.sum()
        nest: o is {
          group_by: popular_name
          aggregate: airport_count.sum()
          nest: by_state is {
            group_by: state
            aggregate: airport_count.sum()
            limit: 2
          }
          limit: 3
          nest: inline is {
            aggregate: inline_sum is airport_count.sum()
          }
        }
      }
    `).toMatchPaths(testModel, {
    'o.by_state.state': 'TX',
    'o.by_state.airport_count': 1845,
    'o.airport_count': 11146,
    'o.inline.inline_sum': 11146,
    'airport_count': 19701,
  });
});

it('double turtle - pipeline', async () => {
  await expect(`
      run:  db.table('malloytest.state_facts') -> {
        aggregate: airport_count.sum()
        nest: o is {
          group_by: popular_name
          aggregate: airport_count.sum()
          nest: by_state is {
            group_by: state
            aggregate: airport_count.sum()
            limit: 2
          }
          limit: 3
        }
      } -> {
        aggregate: o.by_state.airport_count.sum()
      }
    `).toMatchResult(testModel, {
    'airport_count': 5023,
  });
});

test.when(testDatabase.dialect.supportsNesting)(
  'query with aliasname used twice',
  async () => {
    await expect(`
        run: aircraft->{
          group_by: first is substr(city,1,1)
          aggregate: aircraft_count is count()
          nest: aircraft is {
            group_by: first_two is substr(city,1,2)
            aggregate: aircraft_count is count()
            nest: aircraft is {
              group_by: first_three is substr(city,1,3)
              aggregate: aircraft_count is count()
            }
          }
        } -> {
          select:
            aircraft.aircraft.first_three
            aircraft_count
            order_by: 2 desc, 1
            limit: 3
        }
      `).toMatchResult(testModel, {first_three: 'SAB'});
  }
);

const havinglimitTestModel = testDatabase.runtime.loadModel('');

describe('limits', () => {
  test('limit nest one', async () => {
    const {data} = await runQuery(
      havinglimitTestModel,
      `
        run: db.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: c is count()
          limit: 3
          nest: one is {
            group_by: state
            limit: 2
          }
        }
        `
    );
    expect(data.length).toBe(3);
    expect(data[0]).toMatchObject({popular_name: 'Isabella'});
    expect(data[0]).toHaveProperty('one.length', 2);
    expect(data[0]).toHaveProperty('one.0.state', 'AZ');
  });

  test('limit nest with having', async () => {
    const {data} = await runQuery(
      havinglimitTestModel,
      `
        run: db.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: c is count()
          having: c % 2 = 1
          limit: 3
          nest: one is {
            group_by: state
            limit: 2
          }
        }
        `
    );
    expect(data.length).toBe(3);
    expect(data[0]).toMatchObject({popular_name: 'Sophia'});
    expect(data[0]).toHaveProperty('one.length', 2);
    expect(data[0]).toHaveProperty('one.0.state', 'AK');
  });

  test('limit two nests with having', async () => {
    const {data} = await runQuery(
      havinglimitTestModel,
      `
        run: db.table('malloytest.state_facts') -> {
          nest: name is {
            group_by: popular_name
            aggregate: c is count()
            having: c % 2 = 1
            limit: 3
          }
          nest: by_state is {
            group_by: state
            limit: 2
          }
        }
        `
    );
    expect(data.length).toBe(1);
    expect(data[0]).toHaveProperty('name.length', 3);
    expect(data[0]).toHaveProperty('name.0.popular_name', 'Sophia');
    expect(data[0]).toHaveProperty('by_state.length', 2);
    expect(data[0]).toHaveProperty('by_state.0.state', 'AK');
  });

  test('limit 2 stage second with nest with having', async () => {
    const {data} = await runQuery(
      havinglimitTestModel,
      `
        run: db.table('malloytest.state_facts') -> {
          select: *
        } -> {
          group_by: popular_name
          aggregate: c is count()
          having: c % 2 = 1
          limit: 3
          nest: one is {
            group_by: state
            limit: 2
          }
        }
        `
    );
    expect(data.length).toBe(3);
    expect(data[0]).toMatchObject({popular_name: 'Sophia'});
    expect(data[0]).toHaveProperty('one.length', 2);
    expect(data[0]).toHaveProperty('one.0.state', 'AK');
  });

  test('limit index 2 stage', async () => {
    const {data} = await runQuery(
      havinglimitTestModel,
      `
        run: db.table('malloytest.state_facts') -> {
          index: *
        } -> {
          group_by: fieldName
          aggregate: cardinality is count(fieldValue)
          limit: 2
          nest: values is {
            group_by: fieldValue
            aggregate: weight is weight.sum()
            limit: 3
          }
        }
        `
    );
    expect(data.length).toBe(2);
    expect(data[0]).toMatchObject({fieldName: 'state'});
    expect(data[0]).toHaveProperty('values.length', 3);
    expect(data[1]).toMatchObject({fieldName: 'popular_name'});
    expect(data[1]).toHaveProperty('values.length', 3);
    expect(data[1]).toHaveProperty('values.0.fieldValue', 'Isabella');
    expect(data[1]).toHaveProperty('values.0.weight', 24);
  });

  test.when(
    testDatabase.dialect.supportsNesting &&
      testDatabase.dialect.supportsPipelinesInViews &&
      testDatabase.name !== 'trino'
  )('limit select - nested pipeline', async () => {
    const {data} = await runQuery(
      havinglimitTestModel,
      `
        run: db.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: c is count()
          having: c % 2 = 1
          limit: 1
          nest: one is {
            group_by: state
            limit: 20
          } -> {
            select: state
            limit: 2
          }
        }
        `
    );
    expect(data.length).toBe(1);
    expect(data[0]).toHaveProperty('one.length', 2);
  });

  // Test for bug: multi-field order_by with limit should generate single ROW_NUMBER()
  // Previously generated duplicate __row_number__ columns causing BigQuery errors
  test.when(testDatabase.dialect.supportsNesting)(
    'limit nest with multi-field order_by',
    async () => {
      const {data} = await runQuery(
        havinglimitTestModel,
        `
          run: db.table('malloytest.state_facts') -> {
            group_by: popular_name
            aggregate: c is count()
            limit: 3
            nest: by_state is {
              group_by: state
              aggregate:
                state_count is count()
                total_births is births.sum()
              order_by: state_count desc, total_births desc
              limit: 2
            }
          }
          `
      );
      expect(data.length).toBe(3);
      expect(data[0]).toHaveProperty('by_state.length', 2);
    }
  );
});

// A nest is a column whose value is the result of a query. What that column
// contains, and in what order, is the subject here.
//
// The order is the order of the stage which produced it -- the order the user
// asked for, or the one Malloy picked. Reading the array back is the only way to
// see that, and the ordering is attached to the SQL which packs the array, which
// is a different expression for a one-stage nest than for a pipelined one.
//
// The ordering tests nest over the four 'N' states whose popular_name is
// Isabella, because their four candidate orderings are all distinct:
//   state desc    NY NV NM NJ
//   state asc     NJ NM NV NY
//   births desc   NY NJ NM NV
//   births asc    NV NM NJ NY
// A pipelined test orders its first stage the opposite way from its last, so an
// array carrying the wrong stage's order fails instead of coincidentally passing.

const model = wrapTestModel(
  testDatabase,
  `
    query: isabellaN is db.table('malloytest.state_facts') -> {
      where: popular_name = 'Isabella' and state ~ 'N%'
      group_by: popular_name
    }`
);

const stateDesc = [{st: 'NY'}, {st: 'NV'}, {st: 'NM'}, {st: 'NJ'}];
const birthsDesc = [{st: 'NY'}, {st: 'NJ'}, {st: 'NM'}, {st: 'NV'}];
const keywordStateDesc = [
  {'select': 'NY'},
  {'select': 'NV'},
  {'select': 'NM'},
  {'select': 'NJ'},
];

test.when(testDatabase.dialect.supportsNesting)(
  'one-stage nest is in the order it asked for',
  async () => {
    await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
            order_by: st desc
          }
        }`).toMatchResult(model, {n: stateDesc});
  }
);

test.when(testDatabase.dialect.supportsNesting)(
  'one-stage nest orders by a name which needs quoting',
  async () => {
    await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: \`select\` is state
            aggregate: b is births.sum()
            order_by: \`select\` desc
          }
        }`).toMatchResult(model, {n: keywordStateDesc});
  }
);

test.when(testDatabase.dialect.supportsNesting)(
  'one-stage nest with no order_by is largest first',
  async () => {
    await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
          }
        }`).toMatchResult(model, {n: birthsDesc});
  }
);

test.when(testDatabase.dialect.supportsPipelinesInViews)(
  'pipelined nest is in the order its last stage asked for',
  async () => {
    await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
            order_by: st asc
          } -> {
            group_by: st, b
            order_by: st desc
          }
        }`).toMatchResult(model, {n: stateDesc});
  }
);

test.when(testDatabase.dialect.supportsPipelinesInViews)(
  'pipelined nest orders by a name which needs quoting',
  async () => {
    await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: \`select\` is state
            aggregate: b is births.sum()
            order_by: \`select\` asc
          } -> {
            group_by: \`select\`, b
            order_by: \`select\` desc
          }
        }`).toMatchResult(model, {n: keywordStateDesc});
  }
);

// An ordinal order_by names an output field by number, counting from one.
test.when(testDatabase.dialect.supportsNesting)(
  'one-stage nest orders by an output field number',
  async () => {
    await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
            order_by: 1 desc
          }
        }`).toMatchResult(model, {n: stateDesc});
  }
);

test.when(testDatabase.dialect.supportsPipelinesInViews)(
  'pipelined nest orders by an output field number',
  async () => {
    await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
            order_by: st asc
          } -> {
            group_by: st, b
            order_by: 1 desc
          }
        }`).toMatchResult(model, {n: stateDesc});
  }
);

test.when(testDatabase.dialect.supportsPipelinesInViews)(
  'pipelined nest ending in select orders by an output field number',
  async () => {
    await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
            order_by: st asc
          } -> {
            select: st, b
            order_by: 2 desc
          }
        }`).toMatchResult(model, {n: birthsDesc});
  }
);

test.when(testDatabase.dialect.supportsPipelinesInViews)(
  'pipelined nest with no order_by is largest first',
  async () => {
    await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
          } -> {
            group_by: st
            aggregate: tot is b.sum()
          }
        }`).toMatchResult(model, {n: birthsDesc});
  }
);

test.when(testDatabase.dialect.supportsNesting)(
  'an aggregate which is null in a nest reads back as null',
  async () => {
    await expect(`
        run: db.table('malloytest.state_facts') -> {
          group_by: state
          nest: ugly is {
            group_by: popular_name
            aggregate: foo is NULLIF(sum(airport_count)*0,0)+1
          }
        }`).toMatchPaths(model, {'ugly.foo': null});
  }
);

// A null value in the grouping above a nest must not null out the nest.
test.when(testDatabase.dialect.supportsNesting)(
  'a nest under a null group is still a nest',
  async () => {
    const result = await testDatabase.runtime
      .loadQuery(
        `
        run: db.table('malloytest.airports') -> {
          where: faa_region is null
          group_by: faa_region
          aggregate: airport_count is count()
          nest: by_state is {
            where: state is not null
            group_by: state
            aggregate: airport_count is count()
          }
          nest: capped is {
            where: state is not null
            group_by: state
            aggregate: airport_count is count()
            limit: 1
          }
        }`
      )
      .run();
    const row = result.data.toObject()[0] as Record<string, unknown>;
    expect(row['by_state']).not.toBe(null);
    expect(row['capped']).not.toBe(null);
  }
);

// Alaska's three facility types: 474 airports, 104 seaplane bases and 30
// heliports.
const alaskaByFacType = (nest: string) => `
    run: db.table('malloytest.airports') -> {
      where: state = 'AK'
      group_by: state
      nest: by_fac_type is { ${nest} }
    }`;

// Counting a nest's elements reads each element's distinct key back out of
// the nest.
test.when(testDatabase.dialect.supportsNesting)(
  'the elements of a nest can be counted in the next stage',
  async () => {
    await expect(`
        ${alaskaByFacType('group_by: fac_type; aggregate: c is count()')} -> {
          aggregate:
            fac_types is by_fac_type.count()
            airports is by_fac_type.c.sum()
        }`).toMatchResult(model, {fac_types: 3, airports: 608});
  }
);

test.when(testDatabase.dialect.supportsNesting)(
  'a boolean read back out of a nest is a boolean',
  async () => {
    await expect(`
        ${alaskaByFacType("group_by: fac_type, is_airport is fac_type = 'AIRPORT'")} -> {
          where: by_fac_type.is_airport = true
          group_by: by_fac_type.fac_type
        }`).toEqualResult(model, [{fac_type: 'AIRPORT'}]);
  }
);

// A nested `select:` (projection nest) compiles to an array-aggregate. These
// exercise depth (the inner projection used to pin to group_set 0 and return
// []), `limit:` (used to reference a column swallowed into the aggregate),
// `where:`, and the multi-stage case. `limit:` on a projection nest is a
// dialect capability (`supportsNestedProjectionLimit`); a multi-stage nest
// needs `supportsPipelinesInViews`. The matchers print the generated SQL on
// failure, which is how cross-dialect issues get diagnosed.
const tm = wrapTestModel(testDatabase, '');
const table = "db.table('malloytest.state_facts')";

describe('nested select', () => {
  test('depth-2 projection nest is populated', async () => {
    await expect(`
        run: ${table} -> {
          group_by: f1 is substr(popular_name, 1, 1)
          nest: by2 is {
            group_by: f2 is substr(popular_name, 1, 2)
            nest: names is { select: popular_name }
          }
        }
      `).toMatchResult(tm, {
      f1: 'A',
      by2: [
        {
          f2: 'Av',
          names: [
            {popular_name: 'Ava'},
            {popular_name: 'Ava'},
            {popular_name: 'Ava'},
          ],
        },
      ],
    });
  });

  test('single-group-set nest emits no group_set fan-out', async () => {
    // The point of the single-group-set path: a top-level group_by whose only
    // nests are projections needs no demux, so the SQL carries no `group_set`
    // column/FILTER/CASE and no cross-join. The result assertions here pass on
    // the general fan-out path too, so this pins the *shape* the change exists
    // to produce -- without it, a revert to the fan-out path goes unnoticed.
    const sql = await testDatabase.runtime
      .loadQuery(
        `run: ${table} -> {
            group_by: f is substr(popular_name, 1, 1)
            nest: names is { select: popular_name }
          }`
      )
      .getSQL();
    expect(sql).not.toMatch(/group_set/);
  });

  test('depth-3 projection nest is populated', async () => {
    await expect(`
        run: ${table} -> {
          group_by: f1 is substr(popular_name, 1, 1)
          nest: by2 is {
            group_by: f2 is substr(popular_name, 1, 2)
            nest: by3 is {
              group_by: f3 is substr(popular_name, 1, 3)
              nest: names is { select: popular_name }
            }
          }
        }
      `).toMatchPaths(tm, {'by2.by3.names.popular_name': 'Ava'});
  });

  test('all-group_by nesting (control) still works', async () => {
    await expect(`
        run: ${table} -> {
          group_by: f1 is substr(popular_name, 1, 1)
          nest: by2 is {
            group_by: f2 is substr(popular_name, 1, 2)
            nest: names is { group_by: popular_name }
          }
        }
      `).toMatchPaths(tm, {'by2.names.popular_name': 'Ava'});
  });

  const limitQuery = `
      run: ${table} -> {
        group_by: f1 is substr(popular_name, 1, 1)
        nest: names is { select: popular_name; limit: 3 }
      }
    `;

  test.when(testDatabase.dialect.supportsNestedProjectionLimit)(
    'limit on a projection nest caps the array',
    async () => {
      await expect(limitQuery).toMatchResult(tm, {
        f1: 'A',
        names: [
          {popular_name: 'Ava'},
          {popular_name: 'Ava'},
          {popular_name: 'Ava'},
        ],
      });
    }
  );

  test.when(!testDatabase.dialect.supportsNestedProjectionLimit)(
    'limit on a projection nest is rejected at compile time',
    async () => {
      await expect(runQuery(tm.model, limitQuery)).rejects.toThrow(
        /does not support 'limit:' on a nested 'select:'/
      );
    }
  );

  test('where on a projection nest filters elements', async () => {
    // Group 'A' is all "Ava", so filtering it out leaves an empty array.
    await expect(`
        run: ${table} -> {
          group_by: f1 is substr(popular_name, 1, 1)
          nest: names is { select: popular_name; where: popular_name != 'Ava' }
        }
      `).toMatchResult(tm, {f1: 'A', names: []});
  });

  test.when(testDatabase.dialect.supportsNestedProjectionLimit)(
    'order_by then limit keeps the ordered top-N',
    async () => {
      await expect(`
          run: ${table} -> {
            group_by: f1 is substr(popular_name, 1, 1)
            nest: names is {
              select: popular_name
              order_by: popular_name desc
              limit: 2
            }
          }
        `).toMatchResult(tm, {
        f1: 'A',
        names: [{popular_name: 'Ava'}, {popular_name: 'Ava'}],
      });
    }
  );

  // The top-level order_by must be re-emitted after a multi-stage nest's
  // carry-forward stage on non-REPLACE dialects (Trino). Otherwise the final
  // SELECT can return these rows in arbitrary order.
  const multiStageQuery = `
      run: ${table} -> {
        group_by: f1 is substr(popular_name, 1, 1)
        order_by: f1
        nest: m is {
          group_by: popular_name
        } -> {
          select: popular_name
        }
      }
    `;

  test.when(testDatabase.dialect.supportsPipelinesInViews)(
    'multi-stage nest works',
    async () => {
      await expect(multiStageQuery).toMatchRows(tm, [
        {f1: 'A'},
        {f1: 'E'},
        {f1: 'I'},
        {f1: 'M'},
        {f1: 'O'},
        {f1: 'S'},
      ]);
    }
  );

  test.when(!testDatabase.dialect.supportsPipelinesInViews)(
    'multi-stage nest is rejected at compile time',
    async () => {
      await expect(runQuery(tm.model, multiStageQuery)).rejects.toThrow(
        /does not support a multi-stage pipeline/
      );
    }
  );

  // A projection-FIRST multi-stage nest (issue #2899): the stage that
  // re-pipes the nested array must carry the prior CTE's group-set-suffixed
  // columns forward, not the query's final names. Broke only on dialects
  // without SELECT * REPLACE (Trino); guarded here without a `limit:` so it
  // isolates the carry-forward from the array-agg slice the limit case adds.
  test.when(testDatabase.dialect.supportsPipelinesInViews)(
    'multi-stage: a projection first stage carries forward',
    async () => {
      await expect(`
          run: ${table} -> {
            group_by: f1 is substr(popular_name, 1, 1)
            nest: m is { select: popular_name } -> { select: popular_name }
          }
        `).toMatchResult(tm, {
        f1: 'A',
        m: [
          {popular_name: 'Ava'},
          {popular_name: 'Ava'},
          {popular_name: 'Ava'},
        ],
      });
    }
  );

  // The first stage of a multi-stage nest is still a projection: its `limit:`
  // folds into that stage's array-agg ("compile the first stage and stop").
  // This composes the projection-`limit:` fix here with the multi-stage
  // stage-combination fix from #2899 (the carry-forward stage now references
  // the group-set-suffixed names the prior CTE produced, e.g. `f1__0`/`m__0`,
  // not the final names) -- so it runs wherever pipelined nests are
  // supported, Trino included.
  test.when(testDatabase.dialect.supportsPipelinesInViews)(
    'multi-stage: a projection first-stage limit caps that stage',
    async () => {
      await expect(`
          run: ${table} -> {
            group_by: f1 is substr(popular_name, 1, 1)
            nest: m is { select: popular_name; limit: 3 } -> { select: popular_name }
          }
        `).toMatchResult(tm, {
        f1: 'A',
        m: [
          {popular_name: 'Ava'},
          {popular_name: 'Ava'},
          {popular_name: 'Ava'},
        ],
      });
    }
  );
});

const runsHere = ['bigquery', 'duckdb'].includes(testDatabase.name);

describe('Nested Source Table', () => {
  const testModel = wrapTestModel(testDatabase, '');

  test.when(runsHere)('autobin', async () => {
    await expect(`
        source: airports is db.table('malloytest.airports') extend {
          measure: airport_count is count()
          view: by_elevation is {
            aggregate: bin_size is NULLIF((max(elevation) - min(elevation))/30,0)
            nest: data is {
              group_by: elevation
              aggregate: row_count is count()
            }
          }
          -> {
            group_by: elevation is floor(data.elevation/bin_size)*bin_size + bin_size/2
            aggregate: airport_count is data.row_count.sum()
            order_by: elevation
          }
        }

        run: airports -> {
          group_by: state is state
          aggregate: airport_count
          nest: by_elevation_bar_chart is by_elevation
        }
      `).toMatchResult(testModel, {});
  });
});

it('nest/unnest -basic', async () => {
  // in a joined table when the joined is leafiest
  //  we need to make sure we don't count rows that
  //  don't match the join.
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: db.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: c is airport_count.sum()
        nest: p is {
          group_by: popular_name
          aggregate: d is airport_count.sum()
        }
      } -> {
        group_by: state, c
        aggregate: p.d.sum()
      }
      `).toMatchResult(testModel, {
    state: 'TX',
    c: 1845,
    d: 1845,
  });
});

test.when(
  testDatabase.dialect.supportsNesting &&
    testDatabase.dialect.supportsPipelinesInViews
)('single value to udf', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
        run: db.table('malloytest.state_facts') extend {
          view: fun is {
            aggregate: t is count()
          } -> { select: t1 is t+1 }
        } -> { nest: fun }
      `).toMatchPaths(testModel, {'fun.t1': 52});
});

test.when(
  testDatabase.dialect.supportsNesting &&
    testDatabase.dialect.supportsPipelinesInViews
)(
  'Multi value to udf',

  async () => {
    const testModel = wrapTestModel(testDatabase, '');
    await expect(`
        run: db.table('malloytest.state_facts') extend {
          view: fun is {
            group_by: one is 1
            aggregate: t is count()
          } -> { select: t1 is t+1 }
        } -> {
          group_by: two is 2
          nest: fun
        }
      `).toMatchPaths(testModel, {'fun.t1': 52});
  }
);

test.when(
  testDatabase.dialect.supportsNesting &&
    testDatabase.dialect.supportsPipelinesInViews
)('Multi value to udf group by', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
        run: db.table('malloytest.state_facts') extend {
          view: fun is {
            group_by: one is 1
            aggregate: t is count()
          } -> { group_by: t1 is t+1 }
        } -> {
          nest: fun
        }
      `).toMatchPaths(testModel, {'fun.t1': 52});
});

test.when(
  testDatabase.dialect.supportsNesting &&
    testDatabase.dialect.supportsPipelinesInViews
)('Nested pipelines sort properly', async () => {
  const doTrace = false; // Have to turn this on to debug this test
  const result = await testDatabase.runtime
    .loadQuery(
      `
        source: state_facts is db.table('malloytest.state_facts')
        extend {
            view: base_view is {
                group_by: state
                aggregate: airports is sum(airport_count)
                order_by: airports asc
            }
            ->
            {
                group_by: state
                aggregate: airports.sum()
                order_by: airports
            }
            view: base_view2 is {
                group_by: state
                aggregate: aircrafts is sum(aircraft_count)
                order_by: aircrafts asc
            }
            ->
            {
                group_by: state
                aggregate: aircrafts.sum()
                order_by: aircrafts
            }
            view: base_view3 is {
                group_by: state
                aggregate: aircrafts is sum(aircraft_count)
            }
            -> {
              group_by: state
              aggregate: aircrafts.sum()
            }
            view: sort_issue is {
                where: popular_name ~ r'I'
                group_by: popular_name
                nest: base_view
                nest: base_view2
                nest: base_view3
            }
        }
        run: state_facts -> sort_issue
      `
    )
    .run();
  if (doTrace) console.log(result.sql);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = result.data.toObject();
  const baseView: {state: string; airports: number}[] = d[0]['base_view'];
  if (doTrace) console.log(baseView);
  let baseMax = baseView[0];
  for (const b of baseView) {
    expect(b.airports).toBeGreaterThanOrEqual(baseMax.airports);
    baseMax = b;
  }

  const baseView2: {state: string; aircrafts: number}[] = d[0]['base_view2'];
  if (doTrace) console.log(baseView2);
  let baseMax2 = baseView2[0];
  for (const b of baseView2) {
    expect(b.aircrafts).toBeGreaterThanOrEqual(baseMax2.aircrafts);
    baseMax2 = b;
  }
  // implicit order by
  const baseView3: {state: string; aircrafts: number}[] = d[0]['base_view3'];
  if (doTrace) console.log(baseView3);
  let baseMax3 = baseView3[0];
  for (const b of baseView3) {
    expect(b.aircrafts).toBeLessThanOrEqual(baseMax3.aircrafts);
    baseMax3 = b;
  }
});
