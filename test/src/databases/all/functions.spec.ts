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

const expressionModelText = `
explore: aircraft_models is table('malloytest.aircraft_models'){
  primary_key: aircraft_model_code
}

explore: aircraft is table('malloytest.aircraft'){
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
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
      import "malloy://bigquery_functions"
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

  describe(`concat - ${databaseName}`, () => {
    it('works with two args', async () => {
      await funcTest("concat('foo', 'bar')", 'foobar');
    });

    it('works with one arg', async () => {
      await funcTest("concat('foo')", 'foo');
    });

    it.skip('works with null', async () => {
      await funcTest("concat('foo', null)", null);
    });

    it.skip('errors in translator with zero args', async () => {
      await funcTestErr('concat()', 'no matching overload for concat');
    });
  });

  describe(`round - ${databaseName}`, () => {
    it('works', async () => {
      await funcTest('round(1.2)', 1);
    });

    it('works with precision', async () => {
      await funcTest('round(12.222, 1)', 12.2);
    });

    it('works with negative precision', async () => {
      await funcTest('round(12.2, -1)', 10);
    });

    it.skip('errors when given decimal precision', async () => {
      await funcTestErr(
        'round(12.2, -1.5)',
        'parameter precision for round must be integer, received float'
      );
    });

    it('works with null', async () => {
      await funcTest('round(null)', null);
    });

    it('works with null precision', async () => {
      await funcTest('round(1, null)', null);
    });
  });

  describe(`floor - ${databaseName}`, () => {
    it('works', async () => {
      await funcTest('floor(1.9)', 1);
    });

    it('works with negative', async () => {
      await funcTest('floor(-1.9)', -1);
    });

    it('works with null', async () => {
      await funcTest('floor(null)', null);
    });
  });

  describe(`length - ${databaseName}`, () => {
    it('works', async () => {
      await funcTest("length('foo')", 3);
    });

    it('works with null', async () => {
      await funcTest('length(null)', null);
    });
  });

  describe(`lower - ${databaseName}`, () => {
    it('works', async () => {
      await funcTest("lower('FoO')", 'foo');
    });

    it('works with null', async () => {
      await funcTest('lower(null)', null);
    });
  });

  describe(`upper - ${databaseName}`, () => {
    it('works', async () => {
      await funcTest("upper('fOo')", 'FOO');
    });

    it('works with null', async () => {
      await funcTest('upper(null)', null);
    });
  });

  describe(`regexp_extract - ${databaseName}`, () => {
    it('works', async () => {
      await funcTest("regexp_extract('I have a dog', r'd[aeiou]g')", 'dog');
    });

    it('works with null', async () => {
      await funcTest("regexp_extract(null, r'd[aeiou]g')", null);
    });

    // TODO not sure how to represent a null regular expression
    it.skip('works with null regexp', async () => {
      await funcTest("regexp_extract('foo', null)", null);
    });
  });

  describe(`replace - ${databaseName}`, () => {
    it('works', async () => {
      await funcTest("replace('aaaa', 'a', 'c')", 'cccc');
    });

    it('works with empty replacement', async () => {
      await funcTest("replace('aaaa', '', 'c')", 'aaaa');
    });

    it('works with null original', async () => {
      await funcTest("replace(null, 'a', 'c')", null);
    });

    it('works with null from', async () => {
      await funcTest("replace('aaaa', null, 'c')", null);
    });

    it('works with null to', async () => {
      await funcTest("replace('aaaa', 'a', null)", null);
    });
  });

  describe(`substr - ${databaseName}`, () => {
    it('works', async () => {
      await funcTest("substr('foo', 2)", 'oo');
    });

    it('works with max length', async () => {
      await funcTest("substr('foo', 2, 1)", 'o');
    });

    it('works with negative start', async () => {
      await funcTest("substr('foo bar baz', -3)", 'baz');
    });

    it('works with null string', async () => {
      await funcTest('substr(null, 1, 2)', null);
    });

    it('works with null from', async () => {
      await funcTest("substr('aaaa', null, 1)", null);
    });

    it('works with null to', async () => {
      await funcTest("substr('aaaa', 1, null)", null);
    });
  });

  describe(`raw function call - ${databaseName}`, () => {
    it('works', async () => {
      await funcTest('nullif!(1, 1)::number', null);
      await funcTestErr(
        'nullif(1, 1)',
        "Unknown function 'nullif'. Did you mean to import it?"
      );
    });

    it('works with type specified', async () => {
      await funcTest('nullif!number(1, 1)', null);
      await funcTestErr(
        'nullif(1, 1)',
        "Unknown function 'nullif'. Did you mean to import it?"
      );
    });
  });

  describe(`stddev - ${databaseName}`, () => {
    it('works', async () => {
      await funcTestAgg('round(stddev(aircraft_models.seats))', 29);
    });

    it('works with struct', async () => {
      await funcTestAgg(
        'round(aircraft_models.stddev(aircraft_models.seats))',
        41
      );
    });

    it('works with implicit parameter', async () => {
      await funcTestAgg('round(aircraft_models.seats.stddev())', 41);
    });

    it('works with filter', async () => {
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
});

afterAll(async () => {
  await runtimes.closeAll();
});
