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

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));
// const runtimes = new RuntimeList(databasesFromEnvironmentOr(['bigquery']));

const expressionModelText = `
explore: aircraft_models is table('malloytest.aircraft_models'){
  primary_key: aircraft_model_code
}

explore: aircraft is table('malloytest.aircraft'){
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count()
}
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

  const funcTestErr = (expr: string, error: string) =>
    funcTestGeneral(expr, 'group_by', {error});

  const funcTestAggErr = (expr: string, error: string) =>
    funcTestGeneral(expr, 'aggregate', {error});

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

    it.skip(`errors when given decimal precision - ${databaseName}`, async () => {
      await funcTestErr(
        'round(12.2, -1.5)',
        'parameter precision for round must be integer, received float'
      );
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
      await funcTestErr(
        'cbrt(27)',
        "Unknown function 'cbrt'. Did you mean to import it?"
      );
    });

    it(`works with type specified - ${databaseName}`, async () => {
      await funcTest('floor(cbrt!number(27))', 3);
      await funcTestErr(
        'cbrt(27)',
        "Unknown function 'cbrt'. Did you mean to import it?"
      );
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

    it(`errors with zero args - ${databaseName}`, async () => {
      await funcTestAggErr('stddev()', 'No matching overload');
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

    it(`errors if you pass in an aggregate - ${databaseName}`, async () => {
      await funcTestAggErr(
        'round(stddev(count()))',
        'Parameter value of stddev must be scalar, but received aggregate'
      );
    });
  });

  describe('row_number', () => {
    it(`works when the order by is a measure - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
   query: aircraft -> {
     group_by: state,
     aggregate: aircraft_count
     group_by: row_num is row_number()
   }`
        )
        .run();
      // console.log(result.sql);
      expect(result.data.path(0, 'row_num').value).toBe(1);
      expect(result.data.path(1, 'row_num').value).toBe(2);
    });

    it(`works when the order by is a measure but there is no group by - ${databaseName}`, async () => {
      const result = await expressionModel
        .loadQuery(
          `
   query: aircraft -> {
     aggregate: aircraft_count
     group_by: row_num is row_number()
   }`
        )
        .run();
      console.log(result.sql);
      expect(result.data.path(0, 'row_num').value).toBe(1);
    });
  });

  describe('misc analytic functions', () => {
    it(`1 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: tail_num,
            group_by: n is row_number()
            order_by: 1
            nest: foo is {
              group_by: tail_num
            }
          }`
        )
        .run();
    });

    it(`2 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: tail_num
            group_by: n is row_number()
          }`
        )
        .run();
    });

    it(`3 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: n is row_number()
            group_by: tail_num
          }`
        )
        .run();
    });

    it(`4 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state,
            aggregate: aircraft_count
            group_by: row_num is row_number()
          }`
        )
        .run();
    });

    it(`5 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            aggregate: aircraft_count
            group_by: row_num is row_number()
          }`
        )
        .run();
    });

    it(`6 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state,
            group_by: row_num is row_number()
          }`
        )
        .run();
    });

    it(`7 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: row_num is row_number()
          }`
        )
        .run();
    });

    it(`8 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: row_num is row_number()
            order_by: row_num desc
          }`
        )
        .run();
    });

    it(`9 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state,
            aggregate: aircraft_count
            group_by: row_num is row_number()
            group_by: r is rank()
          }`
        )
        .run();
    });

    it(`10 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          // Copy of "hand turtle analytic"
          query: aircraft -> {
            group_by: state
            aggregate: aircraft_count
            nest: my_turtle is {
              limit: 4
              group_by: county
              aggregate: aircraft_count
              group_by: row_num is row_number()
            }
          }`
        )
        .run();
    });

    it(`11 - ${databaseName}`, async () => {
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
              group_by: row_num is row_number()
              group_by: first_state is first_value(state)
            }
          }`
        )
        .run();
    });

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
              group_by: row_num is row_number()
              group_by: first_count is first_value(count())
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
              group_by: row_num is row_number()
              group_by: first_stddev is first_value(stddev(id))
            }
          }`
        )
        .run();
    });

    it(`14 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state,
            aggregate: aircraft_count
            declare: prev_state_count is lag(aircraft_count)
            group_by: percent_less_than_prev is
              (prev_state_count - aircraft_count) / prev_state_count
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

    it(`15 - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: state,
            aggregate: aircraft_count
            declare: two_prev_state_count is lag(aircraft_count, 2)
            group_by: percent_less_than_two_prev is
              (two_prev_state_count - aircraft_count) / two_prev_state_count
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

    it.skip(`22 should fail - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            group_by: prev_state is lag(state)
          }`
        )
        .run();
    });

    it(`refinement field ref - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: foo is aircraft -> {
            group_by: state
            calculate: prev_state is lag(state)
          }
          query: -> foo {
            order_by: state
            calculate: prev_state2 is lag(state)
          }`
        )
        .run();
    });

    it(`refinement field def - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: foo is aircraft -> {
            group_by: state is '1'
          }
          query: -> foo {
            order_by: state
            calculate: prev_state is lag(state)
          }`
        )
        .run();
    });

    it(`infinte recursion bug - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            calculate: n is row_number()
            group_by: tail_num
          }`
        )
        .run();
    });

    it(`output space bug - ${databaseName}`, async () => {
      await expressionModel
        .loadQuery(
          `
          query: aircraft -> {
            nest: foo is {
              group_by: bar is 1
              group_by: state
            }
          }`
        )
        .run();
    });

    // Expect this to fail
    it(`refinement preserves expr type - ${databaseName}`, async () => {
      // Should get error: invalid field definition: expected a analytic expression but got an aggregate expression instead.
      // Should also get error: Parameter value of lag must be scalar or aggregate, but received analytic
      await expressionModel
        .loadQuery(
          `
          query: foo is aircraft -> {
            group_by: state
            aggregate: aircraft_count
            calculate: prev_state is lag(state)
          }
          query: -> foo {
            order_by: state
            calculate: a is aircraft_count
            calculate: prev_state2 is lag(prev_state)
          }`
        )
        .run();
    });
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
