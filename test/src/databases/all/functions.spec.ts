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
import '../../util/is-sql-eq';
import {databasesFromEnvironmentOr} from '../../util';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases)); // TODO
// const runtimes = new RuntimeList(databasesFromEnvironmentOr(['bigquery', 'duckdb']));

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
      console.log(result.sql);
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

    // TODO duckdb doesn't do this properly?
    it(`works with precision - ${databaseName}`, async () => {
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

    // TODO duckdb doesn't do this properly?
    it.skip(`works with negative - ${databaseName}`, async () => {
      await funcTest('floor(-1.9)', -2);
    });

    it(`works with null - ${databaseName}`, async () => {
      await funcTest('floor(null)', null);
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

    // TODO not sure how to represent a null regular expression
    it.skip(`works with null regexp  - ${databaseName}`, async () => {
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

  describe('out keyword', () => {
    it(`works - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state
            group_by: x is out.state
          }`
        )
        .run();
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
      console.log(result.sql);
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
      console.log(result.sql);
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
      console.log(result.sql);
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
      console.log(result.data.toObject());
      expect(result.data.path(0, 'by_county', 1, 'first_count').value).toBe(
        result.data.path(0, 'by_county', 0, 'aircraft_count').value
      );
      expect(result.data.path(1, 'by_county', 1, 'first_count').value).toBe(
        result.data.path(1, 'by_county', 0, 'aircraft_count').value
      );
    });
  });

  describe('misc analytic functions', () => {

    it(`12 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state
            aggregate: aircraft_count
            nest: my_turtle is {
              limit: 4
              group_by: county
              aggregate: aircraft_count
              calculate: row_num is row_number()
              calculate: first_count is first_value(count())
            }
          }`
        )
        .run();
    });

    it(`13 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state
            aggregate: aircraft_count
            nest: my_turtle is {
              limit: 4
              group_by: county
              aggregate: aircraft_count
              calculate: row_num is row_number()
              calculate: first_stddev is first_value(stddev(id))
            }
          }`
        )
        .run();
    });

    it(`14.5 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state
            calculate: percent_less_than_prev is
              (lag(count()) - aircraft_count) / lag(count())
          }`
        )
        .run();
    });

    // This is supposed to fail because measures cannot be used in a project!
    it(`15.5 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            project: state
            calculate: row_num is lag(count())
          }`
        )
        .run();
    });

    // This should maybe succeed because aircraft_count is a measure
    it.skip(`15.75 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state
            calculate: row_num is lag(aircraft_count)
          }`
        )
        .run();
    });

    // TODO BQ wants args 2 and 3 to be constants. Duckdb doesn't care.
    it.skip(`16 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state,
            aggregate: aircraft_count
            calculate: increse_from_prev is
              (lag(aircraft_count, 1, aircraft_count) - lag(aircraft_count, 1, aircraft_count))
          }`
        )
        .run();
    });

    it(`17 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state,
            aggregate: aircraft_count
            calculate: prev_state is lag(state, 2, 'None')
          }`
        )
        .run();
    });

    it(`18 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: aircraft_models.seats,
            aggregate: aircraft_count
            calculate: prev_state is lag(seats, 1)
          }`
        )
        .run();
    });

    it(`19 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: aircraft_models.seats,
            aggregate: aircraft_count
            order_by: seats
            calculate: rn is row_number()
          }`
        )
        .run();
    });

    it(`20 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: aircraft_models.seats,
            aggregate: aircraft_count
            calculate: prev_state is lag(aircraft_models.seats.sum(), 1)
          }`
        )
        .run();
    });

    it(`21 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: aircraft_models.seats,
            aggregate: aircraft_count
            group_by: prev_state is lag(aircraft_models.seats.stddev(), 1)
          }`
        )
        .run();
    });
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
