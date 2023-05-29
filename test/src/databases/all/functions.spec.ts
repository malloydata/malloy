/* eslint-disable no-console */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import * as malloy from '@malloydata/malloy';
import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));
// const runtimes = new RuntimeList(
//   databasesFromEnvironmentOr(['bigquery', 'duckdb'])
// );

const expressionModelText = `
explore: aircraft_models is table('malloytest.aircraft_models'){
  primary_key: aircraft_model_code
}

explore: aircraft is table('malloytest.aircraft'){
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count()
}

explore: airports is table('malloytest.airports') {}

source: state_facts is table('malloytest.state_facts') {}
`;

const expressionModels = new Map<string, malloy.ModelMaterializer>();
runtimes.runtimeMap.forEach((runtime, databaseName) =>
  expressionModels.set(databaseName, runtime.loadModel(expressionModelText))
);

expressionModels.forEach((expressionModel, databaseName) => {
  const funcTestGeneral = async (
    expr: string,
    type: 'group_by' | 'aggregate',
    expected:
      | {error: string; success?: undefined}
      | {success: string | boolean | number | null; error?: undefined}
  ) => {
    const run = async () => {
      return await expressionModel
        .loadQuery(
          `
      query: aircraft -> { ${type}: f is ${expr} }`
        )
        .run();
    };

    if (expected.success !== undefined) {
      const result = await run();
      expect(result.data.path(0, 'f').value).toBe(expected.success);
    } else {
      expect(run).rejects.toThrowError(expected.error);
    }
  };

  const funcTest = (expr: string, expexted: string | boolean | number | null) =>
    funcTestGeneral(expr, 'group_by', {success: expexted});

  const funcTestAgg = (
    expr: string,
    expexted: string | boolean | number | null
  ) => funcTestGeneral(expr, 'aggregate', {success: expexted});

  describe('concat', () => {
    it(`works with two args - ${databaseName}`, async () => {
      await funcTest("concat('foo', 'bar')", 'foobar');
    });

    it(`works with one arg - ${databaseName}`, async () => {
      await funcTest("concat('foo')", 'foo');
    });

    it(`works with number - ${databaseName}`, async () => {
      await funcTest("concat(1, 'bar')", '1bar');
    });

    it(`works with boolean - ${databaseName}`, async () => {
      await funcTest(
        "concat('cons', true)",
        databaseName === 'postgres' ? 'const' : 'construe'
      );
    });

    it(`works with date - ${databaseName}`, async () => {
      await funcTest("concat('foo', @2003)", 'foo2003-01-01');
    });

    it(`works with timestamp - ${databaseName}`, async () => {
      await funcTest(
        "concat('foo', @2003-01-01 12:00:00)",
        databaseName === 'bigquery'
          ? 'foo2003-01-01 12:00:00+00'
          : 'foo2003-01-01 12:00:00'
      );
    });

    it.skip(`works with null - ${databaseName}`, async () => {
      await funcTest("concat('foo', null)", null);
    });

    it(`works with zero args - ${databaseName}`, async () => {
      await funcTest('concat()', '');
    });
  });

  describe('round', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('round(1.2)', 1);
    });

    it(`works with precision - ${databaseName}`, async () => {
      // TODO Remove when we upgrade to DuckDB 0.8.X -- DuckDB has some bugs with rounding
      // that are fixed in 0.8.
      if (databaseName === 'duckdb_wasm') return;

      await funcTest('round(12.222, 1)', 12.2);
    });

    it(`works with negative precision - ${databaseName}`, async () => {
      await funcTest('round(12.2, -1)', 10);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('round(null)', null);
    });

    it(`works with null precision - ${databaseName}`, async () => {
      await funcTest('round(1, null)', null);
    });
  });

  describe('floor', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('floor(1.9)', 1);
    });

    it(`works with negative - ${databaseName}`, async () => {
      // TODO Remove when we upgrade to DuckDB 0.8.X -- DuckDB has some bugs with rounding
      // that are fixed in 0.8.
      if (databaseName === 'duckdb_wasm') return;

      await funcTest('floor(-1.9)', -2);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('floor(null)', null);
    });
  });

  describe('ceil', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('ceil(1.9)', 2);
    });

    it(`works with negative - ${databaseName}`, async () => {
      // TODO Remove when we upgrade to DuckDB 0.8.X -- DuckDB has some bugs with rounding
      // that are fixed in 0.8.
      if (databaseName === 'duckdb_wasm') return;

      await funcTest('ceil(-1.9)', -1);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('ceil(null)', null);
    });
  });

  describe('length', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest("length('foo')", 3);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('length(null)', null);
    });
  });

  describe('lower', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest("lower('FoO')", 'foo');
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('lower(null)', null);
    });
  });

  describe('upper', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest("upper('fOo')", 'FOO');
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('upper(null)', null);
    });
  });

  describe('regexp_extract', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest("regexp_extract('I have a dog', r'd[aeiou]g')", 'dog');
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest("regexp_extract(null, r'd[aeiou]g')", null);
    });

    it(`works with null regexp  - ${databaseName}`, async () => {
      await funcTest("regexp_extract('foo', null)", null);
    });
  });

  describe('replace', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest("replace('aaaa', 'a', 'c')", 'cccc');
    });

    it(`works with empty replacement - ${databaseName}`, async () => {
      await funcTest("replace('aaaa', '', 'c')", 'aaaa');
    });

    it(`works with null original - ${databaseName}`, async () => {
      await funcTest("replace(null, 'a', 'c')", null);
    });

    it(`works with null from - ${databaseName}`, async () => {
      await funcTest("replace('aaaa', null, 'c')", null);
    });

    it(`works with null to - ${databaseName}`, async () => {
      await funcTest("replace('aaaa', 'a', null)", null);
    });
  });

  describe('substr', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest("substr('foo', 2)", 'oo');
    });

    it(`works with max length - ${databaseName}`, async () => {
      await funcTest("substr('foo', 2, 1)", 'o');
    });

    // TODO postgres doesn't do this properly?
    it.skip(`works with negative start - ${databaseName}`, async () => {
      await funcTest("substr('foo bar baz', -3)", 'baz');
    });

    // TODO this doesn't work in Postgres...
    it(`works with null string - ${databaseName}`, async () => {
      await funcTest('substr(null, 1, 2)', null);
    });

    it(`works with null from - ${databaseName}`, async () => {
      await funcTest("substr('aaaa', null, 1)", null);
    });

    it(`works with null to - ${databaseName}`, async () => {
      await funcTest("substr('aaaa', 1, null)", null);
    });
  });

  describe('raw function call', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('floor(cbrt!(27)::number)', 3);
    });

    it(`works with type specified - ${databaseName}`, async () => {
      await funcTest('floor(cbrt!number(27))', 3);
    });
  });

  describe('stddev', () => {
    // TODO symmetric aggregates don't work with custom aggregate functions in BQ currently
    if (databaseName === "bigquery") return;
    it(`works - ${databaseName}`, async () => {
      await funcTestAgg('round(stddev(aircraft_models.seats))', 29);
    });

    it(`works with struct - ${databaseName}`, async () => {
      await funcTestAgg(
        'round(aircraft_models.stddev(aircraft_models.seats))',
        41
      );
    });

    it(`works with implicit parameter - ${databaseName}`, async () => {
      await funcTestAgg('round(aircraft_models.seats.stddev())', 41);
    });

    it(`works with filter - ${databaseName}`, async () => {
      await funcTestAgg(
        'round(aircraft_models.seats.stddev() { where: 1 = 1 })',
        41
      );
      await funcTestAgg(
        'round(aircraft_models.seats.stddev() { where: aircraft_models.seats > 4 })',
        69
      );
    });
  });

  describe('row_number', () => {
    it(`works when the order by is a dimension  - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
          group_by: state
          calculate: row_num is row_number()
        }`
        )
        .run();
      expect(result.data.path(0, 'row_num').value).toBe(1);
      expect(result.data.path(1, 'row_num').value).toBe(2);
    });

    it(`works when the order by is a dimension in the other order  - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
            calculate: row_num is row_number()
            group_by: state
        }`
        )
        .run();
      expect(result.data.path(0, 'row_num').value).toBe(1);
      expect(result.data.path(1, 'row_num').value).toBe(2);
    });

    it(`works when the order by is a measure - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
          group_by: state
          aggregate: c is count()
          calculate: row_num is row_number()
        }`
        )
        .run();
      expect(result.data.path(0, 'row_num').value).toBe(1);
      expect(result.data.path(1, 'row_num').value).toBe(2);
    });

    it(`works when the order by is a measure but there is no group by - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
            aggregate: c is count()
            calculate: row_num is row_number()
          }`
        )
        .run();
      expect(result.data.path(0, 'row_num').value).toBe(1);
    });

    it(`works inside nest - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts { join_one: airports on airports.state = state } -> {
            group_by: state
            nest: q is {
              group_by: airports.county
              calculate: row_num is row_number()
            }
          }`
        )
        .run();
      expect(result.data.path(0, 'q', 0, 'row_num').value).toBe(1);
      expect(result.data.path(0, 'q', 1, 'row_num').value).toBe(2);
      expect(result.data.path(1, 'q', 0, 'row_num').value).toBe(1);
      expect(result.data.path(1, 'q', 1, 'row_num').value).toBe(2);
    });

    it(`works outside nest, but with a nest nearby - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
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
    it(`works ordered by dimension - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
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

    it(`works ordered by aggregate - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
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
  });

  describe('lag', () => {
    it(`works with one param - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
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

    it(`works with offset - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
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

    it(`works with default value - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
          group_by: state
          calculate: prev_state is lag(state, 1, 'NONE')
        }`
        )
        .run();
      expect(result.data.path(0, 'prev_state').value).toBe('NONE');
    });

    it(`works with now as the default value - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: state_facts -> {
            group_by: state
            calculate: lag_val is lag(@2011-11-11 11:11:11, 1, now).year = now.year
          }`
        )
        .run();
      expect(result.data.path(0, 'lag_val').value).toBe(true);
      expect(result.data.path(1, 'lag_val').value).toBe(false);
    });
  });

  describe('first_value', () => {
    it(`works in nest - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state
            where: state != null
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
    it(`works outside nest - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: state_facts -> {
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
    it(`works with an aggregate which is not in the query - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: airports { measure: airport_count is count() } -> {
            group_by: state
            where: state != null
            calculate: prev_airport_count is lag(airport_count)
          }`
        )
        .run();
      expect(result.data.path(0, 'prev_airport_count').value).toBe(null);
      expect(result.data.path(1, 'prev_airport_count').value).toBe(608);
      expect(result.data.path(2, 'prev_airport_count').value).toBe(260);
    });
    it(`works with a localized aggregate - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
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

  describe('trunc', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('trunc(1.9)', 1);
    });

    it(`works with negative number (truncating toward zero) - ${databaseName}`, async () => {
      // TODO Remove when we upgrade to DuckDB 0.8.X -- DuckDB has some bugs with rounding
      // that are fixed in 0.8.
      if (databaseName === 'duckdb_wasm') return;

      await funcTest('trunc(-1.9)', -1);
    });

    it(`works with precision - ${databaseName}`, async () => {
      await funcTest('trunc(12.29, 1)', 12.2);
    });

    it(`works with negative precision - ${databaseName}`, async () => {
      await funcTest('trunc(19.2, -1)', 10);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('trunc(null)', null);
    });

    it(`works with null precision - ${databaseName}`, async () => {
      await funcTest('trunc(1, null)', null);
    });
  });

  // TODO trig functions could have more exhaustive tests -- these are mostly just here to
  // ensure they exist
  describe('cos', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('cos(0)', 1);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('cos(null)', null);
    });
  });
  describe('acos', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('acos(1)', 0);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('acos(null)', null);
    });
  });

  describe('sin', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('sin(0)', 0);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('sin(null)', null);
    });
  });
  describe('asin', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('asin(0)', 0);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('asin(null)', null);
    });
  });

  describe('tan', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('tan(0)', 0);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('tan(null)', null);
    });
  });
  describe('atan', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('atan(0)', 0);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('atan(null)', null);
    });
  });
  describe('atan2', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('atan2(0, 1)', 0);
    });

    it(`works with null y - ${databaseName}`, async () => {
      await funcTest('atan2(null, 1)', null);
    });

    it(`works with null x - ${databaseName}`, async () => {
      await funcTest('atan2(1, null)', null);
    });
  });
  describe('sqrt', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('sqrt(9)', 3);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('sqrt(null)', null);
    });
  });
  describe('pow', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('pow(2, 3)', 8);
    });

    it(`works with null base - ${databaseName}`, async () => {
      await funcTest('pow(null, 3)', null);
    });

    it(`works with null exponent - ${databaseName}`, async () => {
      await funcTest('pow(2, null)', null);
    });
  });
  describe('abs', () => {
    it(`works positive - ${databaseName}`, async () => {
      await funcTest('abs(-3)', 3);
    });
    it(`works negative - ${databaseName}`, async () => {
      await funcTest('abs(3)', 3);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('abs(null)', null);
    });
  });
  describe('sign', () => {
    it(`works positive - ${databaseName}`, async () => {
      await funcTest('sign(100)', 1);
    });
    it(`works negative - ${databaseName}`, async () => {
      await funcTest('sign(-2)', -1);
    });
    it(`works zero - ${databaseName}`, async () => {
      await funcTest('sign(0)', 0);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('sign(null)', null);
    });
  });
  describe('is_inf', () => {
    // TODO not sure how to generate infinity
    it.skip(`works infinite - ${databaseName}`, async () => {
      await funcTest('is_inf(1 / 0)', true);
    });
    it(`works finite - ${databaseName}`, async () => {
      await funcTest('is_inf(100)', false);
    });
    it(`works null - ${databaseName}`, async () => {
      await funcTest('is_inf(null)', null);
    });
  });
  describe('is_nan', () => {
    // TODO not sure how to generate nan
    it.skip(`works nan - ${databaseName}`, async () => {
      await funcTest('is_nan(cos(1 / 0))', true);
    });
    it(`works an - ${databaseName}`, async () => {
      await funcTest('is_nan(100)', false);
    });
    it(`works null - ${databaseName}`, async () => {
      await funcTest('is_nan(null)', null);
    });
  });
  describe('greatest', () => {
    it(`works with numbers - ${databaseName}`, async () => {
      await funcTest('greatest(1, 10, -100)', 10);
    });
    it(`works with dates - ${databaseName}`, async () => {
      await funcTest('greatest(@2003, @2004, @1994) = @2004', true);
    });
    it(`works with timestamps - ${databaseName}`, async () => {
      await funcTest(
        'greatest(@2023-05-26 11:58:00, @2023-05-26 11:59:00) = @2023-05-26 11:59:00',
        true
      );
    });
    it(`works with strings - ${databaseName}`, async () => {
      await funcTest("greatest('a', 'b')", 'b');
    });
    it(`works with nulls intermixed - ${databaseName}`, async () => {
      await funcTest('greatest(1, null, 0)', null);
    });
    it(`works with only null - ${databaseName}`, async () => {
      await funcTest('greatest(null, null)', null);
    });
  });
  describe('least', () => {
    it(`works with numbers - ${databaseName}`, async () => {
      await funcTest('least(1, 10, -100)', -100);
    });
    it(`works with dates - ${databaseName}`, async () => {
      await funcTest('least(@2003, @2004, @1994) = @1994', true);
    });
    it(`works with timestamps - ${databaseName}`, async () => {
      await funcTest(
        'least(@2023-05-26 11:58:00, @2023-05-26 11:59:00) = @2023-05-26 11:58:00',
        true
      );
    });
    it(`works with strings - ${databaseName}`, async () => {
      await funcTest("least('a', 'b')", 'a');
    });
    it(`works with nulls intermixed - ${databaseName}`, async () => {
      await funcTest('least(1, null, 0)', null);
    });
    it(`works with only null - ${databaseName}`, async () => {
      await funcTest('least(null, null)', null);
    });
  });
  describe('div', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest('div(3, 2)', 1);
    });
    it(`works with null numerator - ${databaseName}`, async () => {
      await funcTest('div(null, 2)', null);
    });
    it(`works with null denominator - ${databaseName}`, async () => {
      await funcTest('div(2, null)', null);
    });
  });
  describe('strpos', () => {});
  describe('starts_with', () => {});
  describe('ends_with', () => {});
  describe('trim', () => {});
  describe('ltrim', () => {});
  describe('rtrim', () => {});
  // TODO neither BQ or DDB have this function, only PG, maybe we skip...
  describe.skip('num_nulls', () => {
    it(`works with zero args - ${databaseName}`, async () => {
      await funcTest('num_nulls()', 0);
    });

    it(`works with one null arg - ${databaseName}`, async () => {
      await funcTest('num_nulls(null)', 1);
    });

    it(`works with one nonnull arg - ${databaseName}`, async () => {
      await funcTest('num_nulls(1)', 0);
    });

    it(`works with multiple args - ${databaseName}`, async () => {
      await funcTest('num_nulls(1, null)', 1);
    });

    it(`works with multiple args of different types - ${databaseName}`, async () => {
      await funcTest('num_nulls(1, @2009)', 0);
    });
  });
  describe('num_nonnulls', () => {});
  describe('rand', () => {
    it(`is usually not the same value - ${databaseName}`, async () => {
      // There are around a billion values that rand() can be, so if this
      // test fails, most likely something is broken. Otherwise, you're the lucky
      // one in a billion!
      await funcTest('rand() = rand()', false);
    });
  });
  describe('pi', () => {
    it(`is pi - ${databaseName}`, async () => {
      await funcTest('round(pi(), 15)', 3.141592653589793);
    });
  });
  describe('substr', () => {});
  describe('byte_length', () => {});
  describe('ifnull', () => {});
  describe('nullif', () => {});
  describe('chr', () => {});
  describe('ascii', () => {});
  describe('unicode', () => {});
  describe('format', () => {});
  describe('repeat', () => {});
  describe('reverse', () => {});
  describe('to_hex', () => {});

  describe('first', () => {});

  describe('lead', () => {});
  describe('last_value', () => {});
  describe('min_cumulative', () => {});
  describe('max_cumulative', () => {});
  describe('sum_cumulative', () => {});
  describe('min_window', () => {});
  describe('max_window', () => {});
  describe('sum_window', () => {});
});

afterAll(async () => {
  await runtimes.closeAll();
});
