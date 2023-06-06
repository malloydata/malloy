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
      query: aircraft -> { ${testCases.map(
        (testCase, i) => `group_by: f${i} is ${testCase[0]}`
      )} }`
        )
        .run();
    };

    const result = await run();
    testCases.forEach((testCase, i) => {
      expect(result.data.path(0, `f${i}`).value).toBe(testCase[1]);
    });
  };

  describe('concat', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["concat('foo', 'bar')", 'foobar'],
        ["concat(1, 'bar')", '1bar'],
        [
          "concat('cons', true)",
          databaseName === 'postgres' ? 'const' : 'construe',
        ],
        ["concat('foo', @2003)", 'foo2003-01-01'],
        [
          "concat('foo', @2003-01-01 12:00:00)",
          databaseName === 'bigquery'
            ? 'foo2003-01-01 12:00:00+00'
            : 'foo2003-01-01 12:00:00',
        ],
        // TODO Maybe implement consistent null behavior
        // ["concat('foo', null)", null],
        ['concat()', '']
      );
    });
  });

  describe('round', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['round(1.2)', 1],
        // TODO Remove when we upgrade to DuckDB 0.8.X -- DuckDB has some bugs with rounding
        // that are fixed in 0.8.
        ...(databaseName === 'duckdb_wasm'
          ? []
          : ([['round(12.222, 1)', 12.2]] as [string, number][])),
        ['round(12.2, -1)', 10],
        ['round(null)', null],
        ['round(1, null)', null]
      );
    });
  });

  describe('floor', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['floor(1.9)', 1],
        // TODO Remove when we upgrade to DuckDB 0.8.X -- DuckDB has some bugs with rounding
        // that are fixed in 0.8.
        ...(databaseName === 'duckdb_wasm'
          ? []
          : ([['floor(-1.9)', -2]] as [string, number][])),
        ['floor(null)', null]
      );
      await funcTest('floor(1.9)', 1);
    });
  });

  describe('ceil', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['ceil(1.9)', 2],
        // TODO Remove when we upgrade to DuckDB 0.8.X -- DuckDB has some bugs with rounding
        // that are fixed in 0.8.
        ...(databaseName === 'duckdb_wasm'
          ? []
          : ([['ceil(-1.9)', -1]] as [string, number][])),
        ['ceil(null)', null]
      );
    });
  });

  describe('length', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(["length('foo')", 3], ['length(null)', null]);
    });
  });

  describe('lower', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(["lower('FoO')", 'foo'], ['lower(null)', null]);
    });
  });

  describe('upper', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(["upper('fOo')", 'FOO'], ['upper(null)', null]);
    });
  });

  describe('regexp_extract', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["regexp_extract('I have a dog', r'd[aeiou]g')", 'dog'],
        ["regexp_extract(null, r'd[aeiou]g')", null],
        ["regexp_extract('foo', null)", null]
      );
    });
  });

  describe('replace', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["replace('aaaa', 'a', 'c')", 'cccc'],
        ["replace('aaaa', r'.', 'c')", 'cccc'],
        [
          "replace('axbxc', r'(a).(b).(c)', '\\\\0 - \\\\1 - \\\\2 - \\\\3')",
          'axbxc - a - b - c',
        ],
        ["replace('aaaa', '', 'c')", 'aaaa'],
        ["replace(null, 'a', 'c')", null],
        ["replace('aaaa', null, 'c')", null],
        ["replace('aaaa', 'a', null)", null]
      );
    });
  });

  describe('substr', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["substr('foo', 2)", 'oo'],
        ["substr('foo', 2, 1)", 'o'],
        ["substr('foo bar baz', -3)", 'baz'],
        ['substr(null, 1, 2)', null],
        ["substr('aaaa', null, 1)", null],
        ["substr('aaaa', 1, null)", null]
      );
    });
  });

  describe('raw function call', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['floor(cbrt!(27)::number)', 3],
        ['floor(cbrt!number(27))', 3],
        ["substr('foo bar baz', -3)", 'baz'],
        ['substr(null, 1, 2)', null],
        ["substr('aaaa', null, 1)", null],
        ["substr('aaaa', 1, null)", null]
      );
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
      await funcTestMultiple(
        ['trunc(1.9)', 1],
        // TODO Remove when we upgrade to DuckDB 0.8.X -- DuckDB has some bugs with rounding
        // that are fixed in 0.8.
        ...(databaseName === 'duckdb_wasm'
          ? []
          : ([['trunc(-1.9)', -1]] as [string, number][])),
        ['trunc(12.29, 1)', 12.2],
        ['trunc(19.2, -1)', 10],
        ['trunc(null)', null],
        ['trunc(1, null)', null]
      );
    });
  });
  describe('log', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['log(10, 10)', 1],
        ['log(100, 10)', 2],
        ['log(32, 2)', 5],
        ['log(null, 2)', null],
        ['log(10, null)', null]
      );
    });
  });
  describe('ln', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['ln(exp(1))', 1],
        ['ln(exp(2))', 2],
        ['ln(null)', null]
      );
    });
  });
  describe('exp', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['exp(0)', 1],
        ['ln(exp(1))', 1],
        ['exp(null)', null]
      );
    });
  });

  // TODO trig functions could have more exhaustive tests -- these are mostly just here to
  // ensure they exist
  describe('cos', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(['cos(0)', 1], ['cos(null)', null]);
    });
  });
  describe('acos', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(['acos(1)', 0], ['acos(null)', null]);
    });
  });

  describe('sin', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(['sin(0)', 0], ['sin(null)', null]);
    });
  });
  describe('asin', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(['asin(0)', 0], ['asin(null)', null]);
    });
  });

  describe('tan', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(['tan(0)', 0], ['tan(null)', null]);
    });
  });
  describe('atan', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(['atan(0)', 0], ['atan(null)', null]);
    });
  });
  describe('atan2', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['atan2(0, 1)', 0],
        ['atan2(null, 1)', null],
        ['atan2(1, null)', null]
      );
    });
  });
  describe('sqrt', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['sqrt(9)', 3],
        ['sqrt(6.25)', 2.5],
        ['sqrt(null)', null]
      );
    });
  });
  describe('pow', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['pow(2, 3)', 8],
        ['pow(null, 3)', null],
        ['pow(2, null)', null]
      );
    });
  });
  describe('abs', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['abs(-3)', 3],
        ['abs(3)', 3],
        ['abs(null)', null]
      );
    });
  });
  describe('sign', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['sign(100)', 1],
        ['sign(-2)', -1],
        ['sign(0)', 0],
        ['sign(null)', null]
      );
    });
  });
  describe('is_inf', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["is_inf('+inf'::number)", true],
        ['is_inf(100)', false],
        ['is_inf(null)', null]
      );
    });
  });
  describe('is_nan', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["is_nan('NaN'::number)", true],
        ['is_nan(100)', false],
        ['is_nan(null)', null]
      );
    });
  });
  describe('greatest', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['greatest(1, 10, -100)', 10],
        ['greatest(@2003, @2004, @1994) = @2004', true],
        [
          'greatest(@2023-05-26 11:58:00, @2023-05-26 11:59:00) = @2023-05-26 11:59:00',
          true,
        ],
        ["greatest('a', 'b')", 'b'],
        ['greatest(1, null, 0)', null],
        ['greatest(null, null)', null]
      );
    });
  });
  describe('least', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['least(1, 10, -100)', -100],
        ['least(@2003, @2004, @1994) = @1994', true],
        [
          'least(@2023-05-26 11:58:00, @2023-05-26 11:59:00) = @2023-05-26 11:58:00',
          true,
        ],
        ["least('a', 'b')", 'a'],
        ['least(1, null, 0)', null],
        ['least(null, null)', null]
      );
    });
  });
  describe('div', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['div(3, 2)', 1],
        ['div(null, 2)', null],
        ['div(2, null)', null]
      );
    });
  });
  describe('strpos', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["strpos('123456789', '3')", 3],
        ["strpos('123456789', '0')", 0],
        ["strpos(null, '0')", null],
        ["strpos('123456789', null)", null]
      );
    });
  });
  describe('starts_with', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["starts_with('hello world', 'hello')", true],
        ["starts_with('hello world', 'world')", false],
        ["starts_with(null, 'world')", null],
        ["starts_with('hello world', null)", null]
      );
    });
  });
  describe('ends_with', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["ends_with('hello world', 'world')", true],
        ["ends_with('hello world', 'hello')", false],
        ["ends_with(null, 'world')", null],
        ["ends_with('hello world', null)", null]
      );
    });
  });
  describe('trim', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["trim('  keep this  ')", 'keep this'],
        ["trim('_ _keep_this_ _', '_ ')", 'keep_this'],
        ["trim(' keep everything ', '')", ' keep everything '],
        ["trim('null example', null)", null],
        ["trim(null, 'a')", null],
        ['trim(null)', null]
      );
    });
  });
  describe('ltrim', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["ltrim('  keep this ->  ')", 'keep this ->  '],
        ["ltrim('_ _keep_this -> _ _', '_ ')", 'keep_this -> _ _'],
        ["ltrim(' keep everything ', '')", ' keep everything '],
        ["ltrim('null example', null)", null],
        ["ltrim(null, 'a')", null],
        ['ltrim(null)', null]
      );
    });
  });
  describe('rtrim', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["rtrim('  <- keep this  ')", '  <- keep this'],
        ["rtrim('_ _ <- keep_this_ _', '_ ')", '_ _ <- keep_this'],
        ["rtrim(' keep everything ', '')", ' keep everything '],
        ["rtrim('null example', null)", null],
        ["rtrim(null, 'a')", null],
        ['rtrim(null)', null]
      );
    });
  });
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
      await funcTestMultiple(
        ["byte_length('hello')", 5],
        ["byte_length('©')", 2],
        ['byte_length(null)', null]
      );
    });
  });
  describe('ifnull', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["ifnull('a', 'b')", 'a'],
        ["ifnull(null, 'b')", 'b'],
        ["ifnull('a', null)", 'a'],
        ['ifnull(null, null)', null]
      );
    });
  });
  describe('coalesce', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["coalesce('a')", 'a'],
        ["coalesce('a', 'b')", 'a'],
        ["coalesce(null, 'a', 'b')", 'a'],
        ["coalesce(null, 'b')", 'b'],
        ["coalesce('a', null)", 'a'],
        ['coalesce(null, null)', null],
        ['coalesce(null)', null]
      );
    });
  });
  describe('nullif', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["nullif('a', 'a')", null],
        ["nullif('a', 'b')", 'a'],
        ["nullif('a', null)", 'a'],
        ['nullif(null, null)', null],
        ['nullif(null, 2)', null]
      );
    });
  });
  describe('chr', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ['chr(65)', 'A'],
        ['chr(255)', 'ÿ'],
        ['chr(null)', null],
        // BigQuery's documentation says that `chr(0)` returns the empty string, but it doesn't,
        // it actually returns the null character. We generate code so that it does this.
        ['chr(0)', '']
      );
    });
  });
  describe('ascii', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["ascii('A')", 65],
        ["ascii('ABC')", 65],
        ["ascii('')", 0],
        ['ascii(null)', null]
      );
    });
  });
  describe('unicode', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["unicode('A')", 65],
        ["unicode('â')", 226],
        ["unicode('âBC')", 226],
        ["unicode('')", 0],
        ['unicode(null)', null]
      );
    });
  });

  describe('repeat', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["repeat('foo', 0)", ''],
        ["repeat('foo', 1)", 'foo'],
        ["repeat('foo', 2)", 'foofoo'],
        ['repeat(null, 2)', null],
        ["repeat('foo', null)", null]
      );
    });
    // TODO how does a user do this: the second argument needs to be an integer, but floor doesn't cast to "integer" type.
    it.skip(`works floor decimal - ${databaseName}`, async () => {
      await funcTest("repeat('foo', floor(2.5))", 'foofoo');
    });
    // undefined behavior when negative, undefined behavior (likely error) when non-integer
  });
  describe('reverse', () => {
    it(`works - ${databaseName}`, async () => {
      await funcTestMultiple(
        ["reverse('foo')", 'oof'],
        ["reverse('')", ''],
        ['reverse(null)', null]
      );
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
  describe('avg_moving', () => {
    it(`works - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: state_facts -> {
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

    it(`works forward - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
          query: state_facts -> { project: *; limit: 3 } -> {
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
