/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel, mkTestModel} from '@malloydata/malloy/test';
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

it('join dependencies tracked from annotated references', async () => {
  await expect(`
       run: aircraft -> {
          # ThisShouldNotAffectTheQuery
          group_by: aircraft_models.seats
        }
    `).toMatchResult(testModel, {
    seats: 0,
  });
});

it('joined filtered sources', async () => {
  await expect(`
      source: a_models is db.table('malloytest.aircraft_models') extend {
        where: manufacturer ? ~'B%'
        primary_key: aircraft_model_code
        measure:model_count is count()
      }

      source: aircraft2 is db.table('malloytest.aircraft') extend {
        join_one: model is a_models with aircraft_model_code
        measure: aircraft_count is count()
      }

      run: aircraft2->{
        aggregate:
          model.model_count
          aircraft_count
      }
    `).toMatchResult(testModel, {
    model_count: 244,
    aircraft_count: 3599,
  });
});

test.when(testDatabase.dialect.supportsComplexFilteredSources)(
  'joined filtered explores with dependencies',
  async () => {
    await expect(`
      source: bo_models is
        db.table('malloytest.aircraft_models') extend { where: manufacturer ? ~ 'BO%' }
        -> { select: aircraft_model_code, manufacturer, seats }
        extend {
          primary_key: aircraft_model_code
          measure: bo_count is count()
        }
      source: b_models is
        db.table('malloytest.aircraft_models') extend { where: manufacturer ? ~ 'B%' }
        -> { select: aircraft_model_code, manufacturer, seats }
        extend {
          where: bo_models.seats > 200
          primary_key: aircraft_model_code
          measure: b_count is count()
          join_one: bo_models with aircraft_model_code
        }

      source: models is db.table('malloytest.aircraft_models') extend {
        join_one: b_models with aircraft_model_code
        measure: model_count is count()
      }

      run: models -> {
        aggregate: model_count
        aggregate: b_models.b_count
        -- aggregate: b_models.bo_models.bo_count
      }
    `).toMatchResult(testModel, {model_count: 60461, b_count: 355});
  }
);

// A filtered join is emitted as a subquery, so every join below it lives
// inside that subquery and has to be projected back out for the outer query
// to name it -- at every depth, not just the direct children.
describe('joins below a filtered join', () => {
  const chain = (filterTwo: string) => `
      source: sf is db.table('malloytest.state_facts')

      source: three is sf
      source: two is sf extend {
        ${filterTwo}
        join_one: three on three.state = state
      }
      source: one is sf extend {
        where: state ~ 'A%'
        join_one: two on two.state = state
      }
      source: zero is sf extend { join_one: one on one.state = state }
    `;

  test.when(testDatabase.dialect.supportsComplexFilteredSources)(
    'two levels below',
    async () => {
      await expect(`
          ${chain('')}
          run: zero -> {
            aggregate:
              child is one.two.count()
              grandchild is one.two.three.count()
          }
        `).toMatchResult(testModel, {child: 4, grandchild: 4});

      await expect(`
          ${chain('')}
          run: zero -> {
            group_by: grandchild_state is one.two.three.state
            order_by: grandchild_state
            limit: 1
          }
        `).toMatchResult(testModel, {grandchild_state: 'AK'});
    }
  );

  // `having:` and `calculate:` name output fields, so their field usage is
  // rooted in the query's output and does not resolve against its source.
  test.when(testDatabase.dialect.supportsComplexFilteredSources)(
    'having on an output field, with a filtered join',
    async () => {
      await expect(`
          ${chain('')}
          run: zero -> {
            group_by: grandchild_state is one.two.three.state
            aggregate: rows_here is count()
            having: rows_here > 0
            order_by: grandchild_state
            limit: 1
          }
        `).toMatchResult(testModel, {grandchild_state: 'AK', rows_here: 1});
    }
  );

  // The packed columns are the source's own column names, so the struct has
  // to quote them on the value side and in any type it declares.
  test.when(testDatabase.dialect.supportsComplexFilteredSources)(
    'a packed column name which needs quoting',
    async () => {
      const oddName = testDatabase.dialect.sqlQuoteIdentifier('order');
      await expect(`
          source: two is db.sql("""SELECT 1 as ${oddName}, 1 as k""")
          source: one is db.sql("""SELECT 1 as k, 2 as j""") extend {
            where: j > 0
            join_one: two on two.k = k
          }
          source: zero is db.sql("""SELECT 1 as k""") extend {
            join_one: one on one.k = k
          }

          run: zero -> { group_by: g is one.two.\`order\` }
        `).toMatchResult(testModel, {g: 1});
    }
  );

  // A distinct key is the one thing the packed struct must carry which no
  // expression in the query names, and when the key is computed what the
  // query reads is the columns its expression reads, not the key's name.
  test.when(testDatabase.dialect.supportsComplexFilteredSources)(
    'two levels below, reached by a computed primary key',
    async () => {
      await expect(`
          source: sf is db.table('malloytest.state_facts')

          source: three is sf extend {
            dimension: pk is births
            primary_key: pk
          }
          source: two is sf extend { join_one: three on three.state = state }
          source: one is sf extend {
            where: state ~ 'A%'
            join_one: two on two.state = state
          }
          source: zero is sf extend { join_one: one on one.state = state }

          run: zero -> {
            aggregate:
              child is one.two.count()
              grandchild is one.two.three.count()
          }
        `).toMatchResult(testModel, {child: 4, grandchild: 4});
    }
  );

  // `two` is filtered as well, so it becomes a subquery of its own inside
  // the one for `one`, and `three` reaches the outer query through it.
  test.when(testDatabase.dialect.supportsComplexFilteredSources)(
    'two levels below, both filtered',
    async () => {
      await expect(`
          ${chain("where: state != 'AK'")}
          run: zero -> {
            aggregate:
              child is one.two.count()
              grandchild is one.two.three.count()
          }
        `).toMatchResult(testModel, {child: 3, grandchild: 3});

      await expect(`
          ${chain("where: state != 'AK'")}
          run: zero -> {
            group_by: grandchild_state is one.two.three.state
            order_by: grandchild_state
            limit: 1
          }
        `).toMatchResult(testModel, {grandchild_state: 'AL'});
    }
  );
  // An array is a column of the join above it: the subquery packs that
  // column, and the array is unnested outside the subquery from it.
  describe('an array two levels below', () => {
    const arrayChain = (filterTwo: string) => `
        source: sf is db.table('malloytest.state_facts')
        source: three is db.table('malloytest.airports') -> {
          group_by: state
          nest: types is { group_by: fac_type; aggregate: c is count() }
        }
        source: two is sf extend {
          ${filterTwo}
          join_one: three on three.state = state
        }
        source: one is sf extend {
          where: state ~ 'A%'
          join_one: two on two.state = state
        }
        source: zero is sf extend { join_one: one on one.state = state }
      `;

    test.when(testDatabase.dialect.supportsComplexFilteredSources)(
      'read and aggregated',
      async () => {
        await expect(`
            ${arrayChain('')}
            run: zero -> {
              group_by: s is one.two.three.state
              aggregate: n is one.two.three.types.count()
              order_by: s
              limit: 2
            }
          `).toMatchResult(testModel, {s: 'AK', n: 3}, {s: 'AL', n: 5});

        await expect(`
            ${arrayChain('')}
            run: zero -> {
              where: one.two.three.state = 'AK'
              group_by: fac_type is one.two.three.types.fac_type
              order_by: fac_type
              limit: 1
            }
          `).toMatchResult(testModel, {fac_type: 'AIRPORT'});
      }
    );

    // An array the filtered join reads itself, in its `where:` or in an
    // `on` inside it, stays inside the subquery.
    test.when(testDatabase.dialect.supportsComplexFilteredSources)(
      'read by the filtered join itself',
      async () => {
        const twoArrays = `
            source: sf is db.table('malloytest.state_facts')
            source: three is db.table('malloytest.airports') -> {
              group_by: state
              nest: types is { group_by: fac_type; aggregate: c is count() }
            }
            source: two is sf extend {
              join_one: three on three.state = state
              join_one: sf2 is sf on sf2.state = three.types.fac_type
            }`;
        // Of Alabama's facility types, only airports number over 100
        await expect(`
            ${twoArrays}
            source: one is two extend { where: three.types.c > 100 }
            source: zero is sf extend { join_one: one on one.state = state }
            run: zero -> {
              where: state = 'AL'
              select: state, x is one.three.state
            }
          `).toMatchResult(testModel, {state: 'AL', x: 'AL'});
        // No facility type is a state's name
        await expect(`
            ${twoArrays}
            source: one is two extend { where: state ~ 'A%' }
            source: zero is sf extend { join_one: one on one.state = state }
            run: zero -> {
              where: state = 'AL'
              aggregate: n is count(one.sf2.state)
            }
          `).toMatchResult(testModel, {n: 0});
      }
    );

    test.when(testDatabase.dialect.supportsComplexFilteredSources)(
      'below two filtered joins',
      async () => {
        await expect(`
            ${arrayChain("where: state != 'AK'")}
            run: zero -> {
              group_by: s is one.two.three.state
              aggregate: n is one.two.three.types.count()
              order_by: s
              limit: 1
            }
          `).toMatchResult(testModel, {s: 'AL', n: 5});
      }
    );
  });

  // An array the filtered join's `where:` reads is unnested inside its
  // subquery; read from outside, it answers as the filtered source does on
  // its own.
  describe('an array the filtered join reads, read outside it', () => {
    // Ten values, as the result matchers read at most ten rows
    const countdown = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    const readArrays = `
        source: sf is db.table('malloytest.state_facts')
        source: by_state is db.table('malloytest.airports') -> {
          group_by: state
          nest: types is { group_by: fac_type; aggregate: c is count() }
        }
        source: big is by_state extend { where: types.c > 100 }
        source: nums is sf -> { select: state, top is [1, 2, 3] }
        source: big_nums is nums extend { where: top.each > 1 }
        source: long is sf -> { select: state, la is [${countdown.join(', ')}] }
        source: long_f is long extend { where: la.each > 0 }
        source: zero is sf extend {
          join_one: b is big on b.state = state
          join_one: bn is big_nums on bn.state = state
          join_one: lf is long_f on lf.state = state
        }
      `;

    test.when(
      testDatabase.dialect.supportsComplexFilteredSources &&
        testDatabase.dialect.requiresExplicitUnnestOrdering
    )('array of values keeps its order', async () => {
      await expect(`
          ${readArrays}
          run: zero -> {
            where: state = 'AL'
            select: state, e is lf.la.each
            order_by: state
          }
        `).toEqualResult(
        testModel,
        countdown.filter(n => n > 0).map(e => ({state: 'AL', e}))
      );
    });

    test.when(testDatabase.dialect.supportsComplexFilteredSources)(
      'array of records aggregated',
      async () => {
        await expect(`
            ${readArrays}
            run: zero -> {
              where: state ~ 'A%'
              group_by: state
              aggregate:
                rows is b.count()
                n is b.types.count()
                total is b.types.c.sum()
              order_by: state
              limit: 2
            }
          `).toMatchResult(
          testModel,
          {state: 'AK', rows: 1, n: 2, total: 578},
          {state: 'AL', rows: 1, n: 1, total: 180}
        );
      }
    );

    test.when(testDatabase.dialect.supportsComplexFilteredSources)(
      'array of records selected',
      async () => {
        await expect(`
            ${readArrays}
            run: zero -> {
              where: state = 'AK'
              select: state, fac_type is b.types.fac_type, c is b.types.c
              order_by: fac_type
            }
          `).toEqualResult(testModel, [
          {state: 'AK', fac_type: 'AIRPORT', c: 474},
          {state: 'AK', fac_type: 'SEAPLANE BASE', c: 104},
        ]);
      }
    );

    test.when(testDatabase.dialect.supportsComplexFilteredSources)(
      'array of values aggregated',
      async () => {
        await expect(`
            ${readArrays}
            run: zero -> {
              where: state = 'AL'
              aggregate:
                rows is bn.count()
                n is bn.top.count()
                total is bn.top.each.sum()
            }
          `).toMatchResult(testModel, {rows: 1, n: 2, total: 5});
      }
    );

    test.when(testDatabase.dialect.supportsComplexFilteredSources)(
      'array of values selected',
      async () => {
        await expect(`
            ${readArrays}
            run: zero -> {
              where: state = 'AL'
              select: state, e is bn.top.each
              order_by: e
            }
          `).toEqualResult(testModel, [
          {state: 'AL', e: 2},
          {state: 'AL', e: 3},
        ]);
      }
    );
  });
});

test('joined filtered explores with NO dependencies', async () => {
  await expect(`
      source: sf is db.table('malloytest.state_facts') extend {
        measure: state_count is count()
        primary_key: state
      }

      source: al is sf extend {where: state = 'AL'}

      source: a is sf extend {
        where: state ~ 'A%'
        join_one: al with state
      }

      source: allx is sf extend {
        join_one: a with state
      }
      // # test.debug
      run: allx -> {
        aggregate:
          allx is state_count
          a is a.state_count
          al is a.al.state_count
      }
    `).toMatchResult(testModel, {allx: 51, a: 4, al: 1});
});

test('a condition of a join is a single term beside the others', async () => {
  // Flags are numbers so that the same rows mean the same on every dialect
  const tm = mkTestModel(testDatabase, {
    rws: [
      {k: 1, ai: 1, bi: 9, fa: 0, fb: 0},
      {k: 2, ai: 2, bi: 9, fa: 1, fb: 0},
    ],
  });
  await expect(`
      source: only_a is rws extend { where: fa = 1 }
      source: two_filters is rws extend { where: (fa = 1 or fb = 1), k > 5 }
      run: rws extend {
        join_one: by_or is only_a on (by_or.k = ai or by_or.k = bi)
        join_one: filtered is two_filters on filtered.k = ai
      } -> {
        aggregate:
          or_matched is by_or.count()
          filter_matched is filtered.count()
      }
    `).toMatchResult(tm, {or_matched: 1, filter_matched: 0});
});

const joinModelText = `
  source: aircraft_models is db.table('malloytest.aircraft_models') extend {
    primary_key: aircraft_model_code
    measure: model_count is count()
    view: manufacturer_models is {
      group_by: manufacturer
      aggregate: num_models is count()
    }
    view: manufacturer_seats is {
      group_by: manufacturer
      aggregate: total_seats is seats.sum()
    }
  }

  source: aircraft is db.table('malloytest.aircraft') extend {
    primary_key: tail_num
    measure: aircraft_count is count()
  }

  source: funnel is aircraft_models->manufacturer_models extend {
    join_one: seats is aircraft_models->manufacturer_seats
        with manufacturer
  }
`;

const joinModel = wrapTestModel(testDatabase, joinModelText);
const joinTestModel = wrapTestModel(testDatabase, '');

it('model source refine join', async () => {
  await expect(`
      source: a2 is aircraft extend {
        join_one: aircraft_models with aircraft_model_code
      }
      run: a2 -> {
        aggregate:
          aircraft_count
          aircraft_models.model_count
      }
    `).toMatchResult(joinModel, {model_count: 1416});
});

it('model source refine in query join', async () => {
  await expect(`
      run: aircraft extend {
        join_one: aircraft_models with aircraft_model_code
      } -> {
        aggregate:
          aircraft_count
          aircraft_models.model_count
      }
    `).toMatchResult(joinModel, {model_count: 1416});
});

it('model: join fact table query', async () => {
  await expect(`
      run: aircraft_models extend {
        join_one: am_facts is
          aircraft_models->{
            group_by: m is manufacturer
            aggregate: num_models is count()
          } with manufacturer
      } -> {
        select:
          manufacturer
          am_facts.num_models
        order_by: 2 desc
        limit: 1
      }
    `).toMatchResult(joinModel, {num_models: 1147});
});

it('model: funnel - merge two queries', async () => {
  await expect(`
      run: aircraft_models->{
        group_by: m is manufacturer
        aggregate: num_models is count()
        } extend {
          join_one: seats_join is
            aircraft_models->{
              group_by: m is manufacturer
              aggregate: total_seats is seats.sum()
            } with m
        } -> {
          select:
            m
            num_models
            seats_join.total_seats
          order_by: 2 desc
          limit: 1
        }
    `).toMatchResult(joinModel, {
    num_models: 1147,
    total_seats: 252771,
  });
});

it('model: modeled funnel', async () => {
  await expect(`
      run: aircraft_models-> manufacturer_models extend {
        join_one: seats is aircraft_models->manufacturer_seats with manufacturer
      } -> {
        select:
          manufacturer,
          num_models,
          seats.total_seats
        order_by: 2 desc
        limit: 1
      }
    `).toMatchResult(joinModel, {
    num_models: 1147,
    total_seats: 252771,
  });
});

it('model: modeled funnel2', async () => {
  await expect(`
      run: funnel->{
        select:
        manufacturer
          num_models
          seats.total_seats
        order_by: 2 desc
        limit: 1
      }
    `).toMatchResult(joinModel, {
    num_models: 1147,
    total_seats: 252771,
  });
});

it('activates parent join when fields in leaf join are referenced', async () => {
  await expect(`
      source: flights is db.table('malloytest.flights') extend {
        join_one: aircraft is db.table('malloytest.aircraft')
          on tail_num = aircraft.tail_num
        join_one: aircraft_models is db.table('malloytest.aircraft_models')
          on aircraft.aircraft_model_code = aircraft_models.aircraft_model_code
      }

      run: flights -> {
        group_by: aircraft_models.seats
        aggregate: flight_count is count()
        limit: 5
      }
    `).toMatchRows(joinTestModel, [{}, {}, {}, {}, {}]);
});

// I don't know what join issue 440 was, there was a change of repos and that
// is no longer recorded anywhere. I suspect it was the indirect reference to
// the leaf join field. In a world where the join tree is built from fieldUsage
// that automatically works, but what is a problem is inferring the join tree
// from the ordering of usages. Inverting the "on" comparison in this test
// caused it to fail when the previous one passed.
it('join issue440', async () => {
  await expect(`
      source: aircraft is db.table('malloytest.aircraft')
      source: aircraft_models is db.table('malloytest.aircraft_models')

      source: flights is db.table('malloytest.flights') extend {
        join_one: aircraft on aircraft.tail_num = tail_num
        join_one: aircraft_models on aircraft_models.aircraft_model_code = aircraft.aircraft_model_code
      }

      run: flights-> {
        group_by: testtwo is aircraft_models.seats
        limit: 1
      }
    `).toMatchResult(joinTestModel, {});
});

it('join issue1092', async () => {
  await expect(`
      run: db.table('malloytest.state_facts') -> {
        extend: {join_one: sf is db.table('malloytest.state_facts') on sf.state = state}
        aggregate: x is sf.births.sum() { where:  state = 'CA' }
      }
    `).toMatchResult(joinTestModel, {});
});

it('always join in query', async () => {
  await expect(`
      run: db.table('malloytest.state_facts') -> {
        join_cross: x is db.table('malloytest.state_facts') on true
        select: x is 1
      } -> {
        aggregate: c is count()
      }
    `).toMatchResult(joinModel, {c: 51 * 51});
});

it('not always join in extend', async () => {
  await expect(`
      run: db.table('malloytest.state_facts') -> {
        extend: {
          join_cross: x is db.table('malloytest.state_facts') on true
        }
        select: x is 1
      } -> {
        aggregate: c is count()
      }
    `).toMatchResult(joinModel, {c: 51});
});

it('always inner join has side effects (in group_by)', async () => {
  await expect(`
      ##! experimental.join_types
      run: db.table('malloytest.state_facts') -> {
        join_cross: x is db.table('malloytest.state_facts') inner on false
        group_by: x is 1
      } -> {
        aggregate: c is count()
      }
    `).toMatchResult(joinModel, {c: 0});
});

const matrixModel = `
      ##! experimental.join_types
      source: am_states is db.table('malloytest.state_facts') -> {
        select: *
        where: state ~ r'^(A|M)'
      } extend {
        measure:
          am_count is count()
          am_sum is airport_count.sum()
      }

      query: ac_states_base is db.table('malloytest.state_facts') -> {
        select: *
        where: state ~ r'^(A|C)'
      }

      // mulitply the number of rows in ac_states so we have a many to one join
      source: ac_states is ac_states_base -> {
        extend: {
          join_cross: b is ac_states_base
        }
        select:
          b.state
          b.airport_count
      } extend {
        measure:
          ac_count is count()
          ac_sum is airport_count.sum()
      }
  `;

it('join_many', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: m is db.table('malloytest.aircraft_models') extend {
        join_many:
          a is db.table('malloytest.aircraft') extend {
            measure: avg_year is floor(avg(year_built))
          } on a.aircraft_model_code=aircraft_model_code
        measure: avg_seats is floor(avg(seats))
      }
      run: m->{aggregate: avg_seats, a.avg_year}
      `).toMatchResult(testModel, {avg_year: 1969, avg_seats: 7});
});

it('join_many condition no primary key', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: a is db.table('malloytest.airports')
      source: b is db.table('malloytest.state_facts') extend {
        join_many: a on state=a.state
      }
      run: b->{aggregate: c is airport_count.sum()}
    `).toMatchResult(testModel, {c: 19701});
});

it('join_many filter multiple values', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: a is db.table('malloytest.airports') extend {
        where: state = 'NH' | 'CA'
      }
      run: db.table('malloytest.state_facts') extend {
        join_many: a on state=a.state
      } -> {
        aggregate: c is airport_count.sum()
        group_by: a.state
      }
    `).toMatchRows(testModel, [
    {state: null, c: 18605},
    {state: 'CA', c: 984},
    {state: 'NH', c: 112},
  ]);
});

it('join_one condition no primary key', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: a is db.table('malloytest.state_facts')
      source: b is db.table('malloytest.airports') extend {
        join_one: a on state=a.state
      }
      run: b -> {
        aggregate: c is a.airport_count.sum()
      }
    `).toMatchResult(testModel, {c: 19701});
});

it('join_one filter multiple values', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: a is db.table('malloytest.state_facts') extend {
        where: state = 'TX' | 'LA'
      }
      source: b is db.table('malloytest.airports') extend {
        join_one: a on state=a.state
      }
      run: b-> {
        aggregate: c is a.airport_count.sum()
        group_by: a.state
      }
    `).toMatchRows(testModel, [
    {state: 'TX', c: 1845},
    {state: 'LA', c: 500},
    {state: null, c: 0},
  ]);
});

it('join_many cross from', async () => {
  // a cross join produces a Many to Many result.
  // symmetric aggregate are needed on both sides of the join
  // Check the row count and that sums on each side work properly.
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: a is db.table('malloytest.state_facts') extend {
        dimension: x is airport_count/10000
      }
      source: f is a extend {
        join_cross: a
      }
      run: f->{
        aggregate:
          row_count is count(concat(state,a.state))
          left_count is count()
          right_count is a.count()
          left_sum is airport_count.sum()
          right_sum is a.airport_count.sum()
          left_small_sum is round(x.sum() * 10000)
          right_small_sum is round(x.sum() * 10000)
      }
    `).toMatchResult(testModel, {
    row_count: 51 * 51,
    left_sum: 19701,
    right_sum: 19701,
    left_small_sum: 19701,
    right_small_sum: 19701,
  });
});

it('join_one only', async () => {
  // a cross join produces a Many to Many result.
  // symmetric aggregate are needed on both sides of the join
  // Check the row count and that sums on each side work properly.
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      query: q is db.table('malloytest.state_facts')->{
        aggregate: r is airport_count.sum()
      }
      source: f is db.table('malloytest.state_facts') extend {
        join_one: a is q
      }
      run: f->{
        aggregate:
          row_count is count(concat(state,a.r::string))
          left_sum is airport_count.sum()
          right_sum is a.r.sum()
          sum_sum is sum(airport_count + a.r)
      }
    `).toMatchResult(testModel, {
    row_count: 51,
    left_sum: 19701,
    right_sum: 19701,
    sum_sum: 19701 + 51 * 19701,
  });
});

it('join_many cross ON', async () => {
  // a cross join produces a Many to Many result.
  // symmetric aggregate are needed on both sides of the join
  // Check the row count and that sums on each side work properly.
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      source: a is db.table('malloytest.state_facts')
      source: f is a extend {
        join_cross: a on a.state = 'CA' | 'NY'
      }
      run: f->{
        aggregate:
          row_count is count(concat(state,a.state))
          left_sum is airport_count.sum()
          right_sum is a.airport_count.sum()
      }
    `).toMatchResult(testModel, {
    row_count: 51 * 2,
    left_sum: 19701,
    right_sum: 1560,
  });
});

it('join inner', async () => {
  // a cross join produces a Many to Many result.
  // symmetric aggregate are needed on both sides of the join
  // Check the row count and that sums on each side work properly.
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      ${matrixModel}
      run: ac_states -> {
        extend: {
          join_one: am_states inner on state = am_states.state
        }
        aggregate:
          ac_count
          ac_sum
          am_states.am_sum
          am_states.am_count

      }
      `).toMatchResult(testModel, {
    ac_count: 28,
    ac_sum: 10402,
    am_count: 4,
    am_sum: 1486,
    //show_sql_fail: 1,
  });
});

it('join left', async () => {
  // a cross join produces a Many to Many result.
  // symmetric aggregate are needed on both sides of the join
  // Check the row count and that sums on each side work properly.
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      ${matrixModel}
      run: ac_states -> {
        extend: {
          join_one: am_states left on state = am_states.state
        }
        aggregate:
          ac_count
          ac_sum
          am_states.am_sum
          am_states.am_count

      }
      `).toMatchResult(testModel, {
    ac_count: 49,
    ac_sum: 21336,
    am_count: 4,
    am_sum: 1486,
    //show_sql_fail: 1,
  });
});

it('join right', async () => {
  // a cross join produces a Many to Many result.
  // symmetric aggregate are needed on both sides of the join
  // Check the row count and that sums on each side work properly.
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      ${matrixModel}
      run: ac_states -> {
        extend: {
          join_one: am_states right on state = am_states.state
        }
        aggregate:
          ac_count
          ac_sum
          am_states.am_sum
          am_states.am_count

      }
      `).toMatchResult(testModel, {
    ac_count: 28,
    ac_sum: 10402,
    am_count: 12,
    am_sum: 4139,
    //show_sql_fail: 1,
  });
});

it.when(testDatabase.dialect.supportsFullJoin)('join full', async () => {
  // a cross join produces a Many to Many result.
  // symmetric aggregate are needed on both sides of the join
  // Check the row count and that sums on each side work properly.
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      ${matrixModel}
      run: ac_states -> {
        extend: {
          join_one: am_states full on state = am_states.state
        }
        aggregate:
          ac_count
          ac_sum
          am_states.am_sum
          am_states.am_count

      }
      `).toMatchResult(testModel, {
    ac_count: 49,
    ac_sum: 21336,
    am_count: 12,
    am_sum: 4139,
  });
});

const orderByModel = wrapTestModel(
  testDatabase,
  `
    source: models is db.table('malloytest.aircraft_models') extend {
      measure: model_count is count()
    }`
);

it('turtle references joined element', async () => {
  await expect(`
      source: a is db.table('malloytest.aircraft') extend {
        primary_key: tail_num
        measure: aircraft_count is count()
      }

      run: db.table('malloytest.flights') extend {
        primary_key: id2
        join_one: a with tail_num

        measure: flight_count is count()
        view: foo is {
          group_by: carrier
          aggregate: flight_count
          aggregate: a.aircraft_count
        }
      } -> foo
    `).toMatchResult(orderByModel, {});
});
