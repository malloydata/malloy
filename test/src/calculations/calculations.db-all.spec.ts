/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

afterAll(() => testDatabase.shutdown());

const modelText = `
source: aircraft_models is db.table('malloytest.aircraft_models') extend {
  primary_key: aircraft_model_code
}

source: aircraft is db.table('malloytest.aircraft') extend {
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count()
}

source: airports is db.table('malloytest.airports')

source: state_facts is db.table('malloytest.state_facts')

source: flights is db.table('malloytest.flights')

source: carriers is db.table('malloytest.carriers')
`;

const expressionModel = testDatabase.runtime.loadModel(modelText);
const testModel = wrapTestModel(testDatabase, modelText);

describe('row_number', () => {
  it('works when the order by is a dimension', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
        group_by: state
        calculate: row_num is row_number()
      }`
      )
      .run();
    expect(result.data.path(0, 'row_num').value).toBe(1);
    expect(result.data.path(1, 'row_num').value).toBe(2);
  });

  it('works when the order by is a dimension in the other order', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
          calculate: row_num is row_number()
          group_by: state
      }`
      )
      .run();
    expect(result.data.path(0, 'row_num').value).toBe(1);
    expect(result.data.path(1, 'row_num').value).toBe(2);
  });

  it('works when the order by is a measure', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
        group_by: popular_name
        aggregate: c is count()
        calculate: row_num is row_number()
      }`
      )
      .run();
    expect(result.data.path(0, 'row_num').value).toBe(1);
    expect(result.data.path(1, 'row_num').value).toBe(2);
  });

  it('works when the order by is a measure but there is no group by', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
          aggregate: c is count()
          calculate: row_num is row_number()
        }`
      )
      .run();
    expect(result.data.path(0, 'row_num').value).toBe(1);
  });

  // should rework the tests to this form....
  // it(`boolean type`, async () => {
  //   await expect(`
  //     # test.debug
  //       run: state_facts extend { join_one: airports on airports.state = state } -> {
  //         group_by: state
  //         nest: q is {
  //           group_by: airports.county
  //           calculate: row_num is row_number()
  //         }
  //       }
  //   `).malloyResultMatches(expressionModel, {
  //     big: 1,
  //     model_count: 58451,
  //   });
  // });

  it('works inside nest', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        run: state_facts extend { join_one: airports on airports.state = state } -> {
          group_by: state
          nest: q is {
            group_by: airports.county
            calculate: row_num is row_number()
          }
        }
          `
      )
      .run();
    expect(result.data.path(0, 'q', 0, 'row_num').value).toBe(1);
    expect(result.data.path(0, 'q', 1, 'row_num').value).toBe(2);
    expect(result.data.path(1, 'q', 0, 'row_num').value).toBe(1);
    expect(result.data.path(1, 'q', 1, 'row_num').value).toBe(2);
  });

  test('works outside nest, but with a nest nearby', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
          group_by: state
          calculate: row_num is row_number()
          nest: nested is {
            group_by: state
          }
        }`
      )
      .run();
    expect(result.data.path(0, 'row_num').value).toBe(1);
    expect(result.data.path(1, 'row_num').value).toBe(2);
  });
});

describe('rank', () => {
  it('works ordered by dimension', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
          group_by:
            state,
            births_ballpark is ceil(births / 1000000) * 1000000
          order_by: births_ballpark desc
          calculate: births_ballpark_rank is rank()
          limit: 20
        }`
      )
      .run({rowLimit: 20});
    expect(result.data.path(0, 'births_ballpark_rank').value).toBe(1);
    expect(result.data.path(1, 'births_ballpark_rank').value).toBe(2);
    expect(result.data.path(8, 'births_ballpark_rank').value).toBe(9);
    expect(result.data.path(9, 'births_ballpark_rank').value).toBe(9);
    expect(result.data.path(10, 'births_ballpark_rank').value).toBe(9);
    expect(result.data.path(11, 'births_ballpark_rank').value).toBe(12);
  });

  it('works ordered by aggregate', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
          group_by: first_letter is substr(state, 1, 1)
          aggregate: states_with_first_letter_ish is round(count() / 2) * 2
          calculate: r is rank()
        }`
      )
      .run();
    expect(result.data.path(0, 'r').value).toBe(1);
    expect(result.data.path(1, 'r').value).toBe(1);
    expect(result.data.path(2, 'r').value).toBe(3);
    expect(result.data.path(3, 'r').value).toBe(3);
  });

  it('dense_rank is supported', async () => {
    const result = await expressionModel
      .loadQuery(
        ` run: state_facts -> {
          group_by:
            first_letter is substr(state, 1, 1)
          aggregate: state_count is count()
          calculate: r is dense_rank() {order_by: state_count desc}
        }`
      )
      .run();
    // console.log(result.sql);
    // console.log(result.data);
    expect(result.data.path(0, 'r').value).toBe(1);
    expect(result.data.path(1, 'r').value).toBe(1);
    expect(result.data.path(2, 'r').value).toBe(2);
    expect(result.data.path(3, 'r').value).toBe(2);
  });

  it('works using unary minus in calculate block', async () => {
    await expect(`
      run: state_facts -> {
        group_by: first_letter is substr(state, 1, 1)
        aggregate: states_with_first_letter_ish is round(count() / 2) * 2
        calculate:
          r is rank()
          neg_r is -r
    }`).toMatchResult(
      testModel,
      {neg_r: -1},
      {neg_r: -1},
      {neg_r: -3},
      {neg_r: -3}
    );
  });

  it('properly isolated nested calculations', async () => {
    await expect(`
          run: db.table('malloytest.airports') -> {
          group_by: faa_region
          aggregate: airport_count is count()
          calculate: id is row_number()
          nest: by_fac_type is {
            group_by: fac_type
            aggregate: airport_count is count()
            calculate: id2 is row_number()
            nest: elevation is {
              aggregate: avg_elevation is elevation.avg()
            }
            limit: 2
          }
        }
        -> {
          // should be 2 rows, max of 2
          group_by: by_fac_type.id2
          order_by: id2 desc
        }
    `).toMatchResult(testModel, {
      id2: 2,
    });
  });
});

describe('lag', () => {
  it('works with one param', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
        group_by: state
        calculate: prev_state is lag(state)
      }`
      )
      .run();
    expect(result.data.path(0, 'state').value).toBe('AK');
    expect(result.data.path(0, 'prev_state').value).toBe(null);
    expect(result.data.path(1, 'prev_state').value).toBe('AK');
    expect(result.data.path(1, 'state').value).toBe('AL');
    expect(result.data.path(2, 'prev_state').value).toBe('AL');
  });

  it('works with expression field', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
        group_by: lower_state is lower(state)
        calculate: prev_state is lag(lower_state)
      }`
      )
      .run();
    expect(result.data.path(0, 'lower_state').value).toBe('ak');
    expect(result.data.path(0, 'prev_state').value).toBe(null);
    expect(result.data.path(1, 'prev_state').value).toBe('ak');
    expect(result.data.path(1, 'lower_state').value).toBe('al');
    expect(result.data.path(2, 'prev_state').value).toBe('al');
  });

  it('works with expression', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
        group_by: state
        calculate: prev_state is lag(lower(state))
      }`
      )
      .run();
    expect(result.data.path(0, 'state').value).toBe('AK');
    expect(result.data.path(0, 'prev_state').value).toBe(null);
    expect(result.data.path(1, 'prev_state').value).toBe('ak');
    expect(result.data.path(1, 'state').value).toBe('AL');
    expect(result.data.path(2, 'prev_state').value).toBe('al');
  });

  it('works with field, ordering by expression field', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
        group_by: lower_state is lower(state)
        aggregate: c is count()
        order_by: lower_state
        calculate: prev_count is lag(c)
      }`
      )
      .run();
    expect(result.data.path(0, 'lower_state').value).toBe('ak');
    expect(result.data.path(0, 'prev_count').value).toBe(null);
    expect(result.data.path(1, 'prev_count').value).toBe(1);
    expect(result.data.path(1, 'lower_state').value).toBe('al');
    expect(result.data.path(2, 'prev_count').value).toBe(1);
  });

  it('works with offset', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
        group_by: state
        calculate: prev_prev_state is lag(state, 2)
      }`
      )
      .run();
    expect(result.data.path(0, 'state').value).toBe('AK');
    expect(result.data.path(0, 'prev_prev_state').value).toBe(null);
    expect(result.data.path(1, 'prev_prev_state').value).toBe(null);
    expect(result.data.path(2, 'prev_prev_state').value).toBe('AK');
    expect(result.data.path(1, 'state').value).toBe('AL');
    expect(result.data.path(3, 'prev_prev_state').value).toBe('AL');
  });

  it('works with default value', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
        group_by: state
        calculate: prev_state is lag(state, 1, 'NONE')
      }`
      )
      .run();
    expect(result.data.path(0, 'prev_state').value).toBe('NONE');
  });

  it('works with now as the default value', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        # test.debug
        run: state_facts -> {
          group_by: state
          calculate: lag_val is
            pick 'now' when lag(@2011-11-11 11:11:11, 1, now).year = now.year else 'then'
        }`
      )
      .run();
    expect(result.data.path(0, 'lag_val').value).toBe('now');
    expect(result.data.path(1, 'lag_val').value).toBe('then');
  });
});

describe('output field in calculate', () => {
  it('output field referenceable in calculate', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: aircraft -> {
          group_by: s is aircraft_models.seats
          calculate: a is lag(s)
        }`
      )
      .run();
    expect(result.data.path(1, 'a').value).toBe(result.data.path(0, 's').value);
  });
});

describe('first_value', () => {
  test('works in nest', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        run: aircraft -> {
          group_by: state
          where: state is not null
          nest: by_county is {
            limit: 2
            group_by: county
            aggregate: aircraft_count
            calculate: first_count is first_value(count())
          }
        }`
      )
      .run();
    expect(result.data.path(0, 'by_county', 1, 'first_count').value).toBe(
      result.data.path(0, 'by_county', 0, 'aircraft_count').value
    );
    expect(result.data.path(1, 'by_county', 1, 'first_count').value).toBe(
      result.data.path(1, 'by_county', 0, 'aircraft_count').value
    );
  });
  it('works outside nest', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        run: state_facts -> {
          group_by: state, births
          order_by: births desc
          calculate: most_births is first_value(births)
        }`
      )
      .run();
    const firstBirths = result.data.path(0, 'births').value;
    expect(result.data.path(0, 'most_births').value).toBe(firstBirths);
    expect(result.data.path(1, 'most_births').value).toBe(firstBirths);
  });
  it('works with an aggregate which is not in the query', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        run: airports extend { measure: airport_count is count() } -> {
          group_by: state
          where: state is not null
          calculate: prev_airport_count is lag(airport_count)
        }`
      )
      .run();
    expect(result.data.path(0, 'prev_airport_count').value).toBe(null);
    expect(result.data.path(1, 'prev_airport_count').value).toBe(608);
    expect(result.data.path(2, 'prev_airport_count').value).toBe(260);
  });
  it('works with a localized aggregate', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        run: aircraft -> {
          group_by: aircraft_models.seats,
          calculate: prev_sum_of_seats is lag(aircraft_models.seats.sum())
        }`
      )
      .run();
    expect(result.data.path(0, 'prev_sum_of_seats').value).toBe(null);
    expect(result.data.path(1, 'prev_sum_of_seats').value).toBe(0);
    expect(result.data.path(2, 'prev_sum_of_seats').value).toBe(230);
  });
});

describe('lead', () => {
  it('works with one param', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
        group_by: state
        calculate: next_state is lead(state)
      }`
      )
      .run();
    expect(result.data.path(0, 'state').value).toBe('AK');
    expect(result.data.path(0, 'next_state').value).toBe('AL');
    expect(result.data.path(1, 'state').value).toBe('AL');
  });

  it('works with offset', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> {
        group_by: state
        calculate: next_next_state is lead(state, 2)
      }`
      )
      .run();
    expect(result.data.path(0, 'state').value).toBe('AK');
    expect(result.data.path(0, 'next_next_state').value).toBe('AR');
    expect(result.data.path(1, 'next_next_state').value).toBe('AZ');
    expect(result.data.path(1, 'state').value).toBe('AL');
    expect(result.data.path(2, 'state').value).toBe('AR');
    expect(result.data.path(3, 'state').value).toBe('AZ');
  });

  it('works with default value', async () => {
    const result = await expressionModel
      .loadQuery(
        `run: state_facts -> { select: *; limit: 10 } -> {
        group_by: state
        calculate: next_state is lead(state, 1, 'NONE')
      }`
      )
      .run();
    expect(result.data.path(9, 'next_state').value).toBe('NONE');
  });
});
describe('last_value', () => {
  it('works', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        run: state_facts -> {
          group_by: state, births
          order_by: births desc
          calculate: least_births is last_value(births)
        }`
      )
      .run({rowLimit: 100});
    const numRows = result.data.toObject().length;
    const lastBirths = result.data.path(numRows - 1, 'births').value;
    expect(result.data.path(0, 'least_births').value).toBe(lastBirths);
    expect(result.data.path(1, 'least_births').value).toBe(lastBirths);
  });
});
describe('avg_moving', () => {
  it('works', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        run: state_facts -> {
          group_by: state, births
          order_by: births desc
          calculate: rolling_avg is avg_moving(births, 2)
        }`
      )
      .run({rowLimit: 100});
    const births0 = result.data.path(0, 'births').number.value;
    const births1 = result.data.path(1, 'births').number.value;
    const births2 = result.data.path(2, 'births').number.value;
    const births3 = result.data.path(3, 'births').number.value;
    expect(result.data.path(0, 'rolling_avg').number.value).toBe(births0);
    expect(Math.floor(result.data.path(1, 'rolling_avg').number.value)).toBe(
      Math.floor((births0 + births1) / 2)
    );
    expect(Math.floor(result.data.path(2, 'rolling_avg').number.value)).toBe(
      Math.floor((births0 + births1 + births2) / 3)
    );
    expect(Math.floor(result.data.path(3, 'rolling_avg').number.value)).toBe(
      Math.floor((births1 + births2 + births3) / 3)
    );
  });

  it('works forward', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        run: state_facts -> { select: *; limit: 3 } -> {
          group_by: state, births
          order_by: births desc
          calculate: rolling_avg is avg_moving(births, 0, 2)
        }`
      )
      .run({rowLimit: 100});
    const births0 = result.data.path(0, 'births').number.value;
    const births1 = result.data.path(1, 'births').number.value;
    const births2 = result.data.path(2, 'births').number.value;
    expect(Math.floor(result.data.path(0, 'rolling_avg').number.value)).toBe(
      Math.floor((births0 + births1 + births2) / 3)
    );
    expect(Math.floor(result.data.path(1, 'rolling_avg').number.value)).toBe(
      Math.floor((births1 + births2) / 2)
    );
    expect(result.data.path(2, 'rolling_avg').number.value).toBe(births2);
  });
});

describe('sum_moving', () => {
  it('works', async () => {
    await expect(`
    run: state_facts -> {
      group_by: state, b is births
      order_by: b desc
      calculate: s is sum_moving(b, 2)
      limit: 5
    }`).toMatchRows(testModel, [
      {b: 28810563, s: 28810563},
      {b: 23694136, s: 23694136 + 28810563},
      {b: 21467359, s: 21467359 + 23694136 + 28810563},
      {b: 16661910, s: 16661910 + 21467359 + 23694136},
      {b: 15178876, s: 15178876 + 16661910 + 21467359},
    ]);
  });

  it('works forward', async () => {
    await expect(`
    run: state_facts -> {
      group_by: state, b is births
      order_by: b desc
      calculate: s is sum_moving(b, 0, 2)
      limit: 7
    }`).toMatchRows(testModel, [
      {b: 28810563, s: 28810563 + 23694136 + 21467359},
      {b: 23694136, s: 23694136 + 21467359 + 16661910},
      {b: 21467359, s: 21467359 + 16661910 + 15178876},
      {b: 16661910, s: 16661910 + 15178876 + 14201526},
      {b: 15178876, s: 15178876 + 14201526 + 11643455},
      {b: 14201526},
      {b: 11643455},
    ]);
  });
});

describe('min, max, sum / window, cumulative', () => {
  it('works', async () => {
    const result = await expressionModel
      .loadQuery(
        `
        run: state_facts -> { select: *; limit: 5 } -> {
          group_by: state, births
          order_by: births asc
          calculate: min_c is min_cumulative(births)
          calculate: max_c is max_cumulative(births)
          calculate: sum_c is sum_cumulative(births)
          calculate: min_w is min_window(births)
          calculate: max_w is max_window(births)
          calculate: sum_w is sum_window(births)
        }`
      )
      .run({rowLimit: 100});
    const births0 = result.data.path(0, 'births').number.value;
    const births1 = result.data.path(1, 'births').number.value;
    const births2 = result.data.path(2, 'births').number.value;
    const births3 = result.data.path(3, 'births').number.value;
    const births4 = result.data.path(4, 'births').number.value;
    const births = [births0, births1, births2, births3, births4];
    for (let r = 0; r < 5; r++) {
      expect(result.data.path(r, 'min_c').number.value).toBe(births0);
      expect(result.data.path(r, 'max_c').number.value).toBe(births[r]);
      expect(result.data.path(r, 'sum_c').number.value).toBe(
        births.slice(0, r + 1).reduce((a, b) => a + b)
      );
      expect(result.data.path(r, 'min_w').number.value).toBe(births0);
      expect(result.data.path(r, 'max_w').number.value).toBe(births4);
      expect(result.data.path(r, 'sum_w').number.value).toBe(
        births.reduce((a, b) => a + b)
      );
    }
  });
});

describe('partition_by', () => {
  it('works', async () => {
    await expect(`
    run: flights -> {
      group_by:
        yr is year(dep_time)
        qtr is quarter(dep_time)

      aggregate:
        qtr_flights is count()

      calculate:
        last_yr_qtr_flights is lag(qtr_flights) {
          partition_by: qtr
          order_by: yr asc
        }
      order_by: yr, qtr
      where: dep_time < @2002
    }`).toMatchResult(
      testModel,
      {yr: 2000, qtr: 1, qtr_flights: 12148, last_yr_qtr_flights: null},
      {yr: 2000, qtr: 2, qtr_flights: 11599, last_yr_qtr_flights: null},
      {yr: 2000, qtr: 3, qtr_flights: 12075, last_yr_qtr_flights: null},
      {yr: 2000, qtr: 4, qtr_flights: 11320, last_yr_qtr_flights: null},
      {yr: 2001, qtr: 1, qtr_flights: 11612, last_yr_qtr_flights: 12148},
      {yr: 2001, qtr: 2, qtr_flights: 13186, last_yr_qtr_flights: 11599},
      {yr: 2001, qtr: 3, qtr_flights: 12663, last_yr_qtr_flights: 12075},
      {yr: 2001, qtr: 4, qtr_flights: 11714, last_yr_qtr_flights: 11320}
    );
  });

  it('works with aggregate', async () => {
    await expect(`
    run: state_facts -> {
      aggregate: c is count()
      group_by: l is substr(state, 1, 1)

      calculate:
        prev is lag(l) {
          partition_by: c
        }
      order_by: l
      limit: 5
    }`).toMatchResult(
      testModel,
      {l: 'A', c: 4, prev: null},
      {l: 'C', c: 3, prev: null},
      {l: 'D', c: 2, prev: null},
      {l: 'F', c: 1, prev: null},
      {l: 'G', c: 1, prev: 'F'}
    );
  });

  it('works with multiple order_bys', async () => {
    await expect(`
    run: aircraft -> {
      where: name =
        "UNITED AIR LINES INC"
        | "FEDERAL EXPRESS CORP"
        | "AMERICAN AIRLINES INC"
        | "CESSNA AIRCRAFT COMPANY"
      group_by: name
      calculate:
        # label="Rank by model count then seat count"
        r is rank() {
          order_by:
            aircraft_models.count() desc,
            aircraft_models.seats.sum() desc
        }
      order_by: name
    }`).toMatchResult(
      testModel,
      {name: 'AMERICAN AIRLINES INC', r: 3},
      {name: 'CESSNA AIRCRAFT COMPANY', r: 4},
      {name: 'FEDERAL EXPRESS CORP', r: 2},
      {name: 'UNITED AIR LINES INC', r: 1}
    );
  });

  it('can be used in a select', async () => {
    await expect(`
      ##! experimental { function_order_by partition_by }
      run: state_facts -> {
        select: state, births, popular_name
        calculate: prev_births_by_name is lag(births) {
          partition_by: popular_name
          order_by: births desc
        }
        order_by: births desc
        limit: 3
      }
    `).toMatchResult(
      testModel,
      {
        state: 'CA',
        births: 28810563,
        popular_name: 'Isabella',
        prev_births_by_name: null,
      },
      {
        state: 'NY',
        births: 23694136,
        popular_name: 'Isabella',
        prev_births_by_name: 28810563,
      },
      {
        state: 'TX',
        births: 21467359,
        popular_name: 'Isabella',
        prev_births_by_name: 23694136,
      }
    );
  });
  it('can be used in a select in a composite source', async () => {
    await expect(`
      ##! experimental { function_order_by partition_by composite_sources }
      source: state_facts_composite is compose(state_facts, state_facts)
      run: state_facts_composite -> {
        select: state, births, popular_name
        calculate: prev_births_by_name is lag(births) {
          partition_by: popular_name
          order_by: births desc
        }
        order_by: births desc
        limit: 3
      }
    `).toMatchResult(
      testModel,
      {
        state: 'CA',
        births: 28810563,
        popular_name: 'Isabella',
        prev_births_by_name: null,
      },
      {
        state: 'NY',
        births: 23694136,
        popular_name: 'Isabella',
        prev_births_by_name: 28810563,
      },
      {
        state: 'TX',
        births: 21467359,
        popular_name: 'Isabella',
        prev_births_by_name: 23694136,
      }
    );
  });
});
// Issue: #1284
it('parenthesize output field values', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: db.table('malloytest.aircraft') -> {
        group_by: r is 1.0

        calculate:
          zero is 1 - rank()
          zero_bare  is 0 - zero
          zero_paren is 0 - (zero)
      }
    `).toMatchResult(testModel, {zero_bare: 0, zero_paren: 0});
});
