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

  const funcTestMultiple = async (
    ...testCases: [string, string | boolean | number | null][]
  ) => {
    const run = async () => {
      return await expressionModel
        .loadQuery(
          `
      query: aircraft -> { ${testCases.map((testCase, i) => `group_by: f${i} is ${testCase[0]}`)} }`
        )
        .run();
    };

    const result = await run();
    testCases.forEach((testCase, i) => {
      expect(result.data.path(0, `f${i}`).value).toBe(testCase[1]);
    })
  };

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

    it(`works multiple replacement regex - ${databaseName}`, async () => {
      await funcTest("replace('aaaa', r'.', 'c')", 'cccc');
    });

    it(`works multiple replacement capture - ${databaseName}`, async () => {
      await funcTest(
        "replace('axbxc', r'(a).(b).(c)', '\\\\0 - \\\\1 - \\\\2 - \\\\3')",
        'axbxc - a - b - c'
      );
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

    it(`works with negative start - ${databaseName}`, async () => {
      await funcTest("substr('foo bar baz', -3)", 'baz');
    });

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
    if (databaseName === 'bigquery') return;
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

  describe('output field in calculate', () => {
    it(`dotted aggregates work with an output field - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: aircraft -> {
            group_by: aircraft_models.seats
            aggregate: s is aircraft_models.seats.sum()
            calculate: a is lag(seats.sum())
          }`
        )
        .run();
      expect(result.data.path(1, 'a').value).toBe(
        result.data.path(0, 's').value
      );
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
      await funcTest('abs(pi() - 3.141592653589793) < 0.0000000000001', true);
    });
  });

  describe('byte_length', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest("byte_length('©')", 2);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('byte_length(null)', null);
    });
  });
  describe('ifnull', () => {
    it(`works with non-null - ${databaseName}`, async () => {
      await funcTest("ifnull('a', 'b')", 'a');
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest("ifnull(null, 'b')", 'b');
    });

    it(`works with null default - ${databaseName}`, async () => {
      await funcTest("ifnull('a', null)", 'a');
    });

    it(`works with two nulls - ${databaseName}`, async () => {
      await funcTest('ifnull(null, null)', null);
    });
  });
  describe('nullif', () => {
    it(`works with equal - ${databaseName}`, async () => {
      await funcTest("nullif('a', 'a')", null);
    });

    it(`works with non-equal - ${databaseName}`, async () => {
      await funcTest("nullif('a', 'b')", 'a');
    });

    it(`works with null check - ${databaseName}`, async () => {
      await funcTest("nullif('a', null)", 'a');
    });

    it(`works with two nulls - ${databaseName}`, async () => {
      await funcTest('nullif(null, null)', null);
    });

    it(`works with null value - ${databaseName}`, async () => {
      await funcTest('nullif(null, 2)', null);
    });
  });
  describe('chr', () => {
    it(`works with ascii - ${databaseName}`, async () => {
      await funcTest('chr(65)', 'A');
    });
    it(`works with unicode - ${databaseName}`, async () => {
      await funcTest('chr(255)', 'ÿ');
    });
    it(`works with null - ${databaseName}`, async () => {
      await funcTest('chr(null)', null);
    });
    // BigQuery's documentation says that `chr(0)` returns the empty string, but it doesn't,
    // it actually returns the null character. We generate code so that it does this.
    it(`works with 0 - ${databaseName}`, async () => {
      await funcTest('chr(0)', '');
    });
  });
  describe('ascii', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest("ascii('A')", 65);
    });
    it(`works (first letter) - ${databaseName}`, async () => {
      await funcTest("ascii('ABC')", 65);
    });
    it(`works empty string - ${databaseName}`, async () => {
      await funcTest("ascii('')", 0);
    });
    it(`works null - ${databaseName}`, async () => {
      await funcTest('ascii(null)', null);
    });
  });
  describe('unicode', () => {
    it(`works ascii - ${databaseName}`, async () => {
      await funcTest("unicode('A')", 65);
    });
    it(`works unicode - ${databaseName}`, async () => {
      await funcTest("unicode('â')", 226);
    });
    it(`works (first letter) - ${databaseName}`, async () => {
      await funcTest("unicode('âBC')", 226);
    });
    it(`works empty string - ${databaseName}`, async () => {
      await funcTest("unicode('')", 0);
    });
    it(`works null - ${databaseName}`, async () => {
      await funcTest('unicode(null)', null);
    });
  });
  describe('format', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["format('%d', 10)", '10'],
        ["format('|%10d|', 11)", '|           11|'],
        ["format('+%010d+', 12)", '+0000000012+'],
        ["format('%\\'d', 123456789)", '123,456,789'],
        ["format('-%s-', 'abcd efg')", '-abcd efg-'],
        ["format('%f %E', 1.1, 2.2)", '1.100000 2.200000E+00'],
        ["format('%t', @2003-11-01)", '10'],
        ["format('%t', @2003-11-01 11:28:00)", '10']
      );
    });
  });

  describe('repeat', () => {
    it(`works 0 - ${databaseName}`, async () => {
      await funcTest("repeat('foo', 0)", '');
    });
    it(`works 1 - ${databaseName}`, async () => {
      await funcTest("repeat('foo', 1)", 'foo');
    });
    it(`works multiple - ${databaseName}`, async () => {
      await funcTest("repeat('foo', 2)", 'foofoo');
    });
    it(`works null string - ${databaseName}`, async () => {
      await funcTest('repeat(null, 2)', null);
    });
    it(`works null count - ${databaseName}`, async () => {
      await funcTest("repeat('foo', null)", null);
    });
    // TODO how does a user do this: the second argument needs to be an integer, but floor doesn't cast to "integer" type.
    it.skip(`works floor decimal - ${databaseName}`, async () => {
      await funcTest("repeat('foo', floor(2.5))", 'foofoo');
    });
    // undefined behavior when negative, undefined behavior (likely error) when non-integer
  });
  describe('reverse', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTest("reverse('foo')", 'oof');
    });
    it(`works empty - ${databaseName}`, async () => {
      await funcTest("reverse('')", '');
    });
    it(`works null - ${databaseName}`, async () => {
      await funcTest('reverse(null)', null);
    });
  });

  describe('lead', () => {
    it(`works with one param - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
          group_by: state
          calculate: next_state is lead(state)
        }`
        )
        .run();
      expect(result.data.path(0, 'state').value).toBe('AK');
      expect(result.data.path(0, 'next_state').value).toBe('AL');
      expect(result.data.path(1, 'state').value).toBe('AL');
    });

    it(`works with offset - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> {
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

    it(`works with default value - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `query: state_facts -> { project: *; limit: 10 } -> {
          group_by: state
          calculate: next_state is lead(state, 1, 'NONE')
        }`
        )
        .run();
      expect(result.data.path(9, 'next_state').value).toBe('NONE');
    });
  });
  describe('last_value', () => {
    it(`works - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: state_facts -> {
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
  describe('avg_rolling', () => {
    it(`works - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: state_facts -> {
            group_by: state, births
            order_by: births desc
            calculate: rolling_avg is avg_rolling(births, 2)
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

    it(`works forward - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: state_facts -> { project: *; limit: 3 } -> {
            group_by: state, births
            order_by: births desc
            calculate: rolling_avg is avg_rolling(births, 0, 2)
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
  describe('min, max, sum / window, cumulative', () => {
    it(`works - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: state_facts -> { project: *; limit: 5 } -> {
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
});

afterAll(async () => {
  await runtimes.closeAll();
});
