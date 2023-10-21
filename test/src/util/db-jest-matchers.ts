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

import {
  QueryMaterializer,
  Result,
  Runtime,
  SingleConnectionRuntime,
} from '@malloydata/malloy';

type ExpectedResultRow = Record<string, unknown>;
type ExpectedResult = ExpectedResultRow | ExpectedResultRow[];

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      isSqlEq(): R;
      /**
       * Jest matcher for running a Malloy query, checks that each row
       * contains the values matching the template. If you only want to
       * check the first row, use the first form. If you want to check
       * multiple rows, use the second.
       *
       *     await expect('query').malloyResultMatches(runtime, {colName: colValue});
       *     await expect('query').malloyResultMatches(runtime, [{colName: colValue}]);
       *
       * If "colName" has a dot in it, it is assumed to be a reference to a value in a nest
       *
       * @param querySrc Malloy source, last query in source will be run
       * @param runtime Database connection runtime
       * @param expected Key value pairs or array of key value pairs
       */
      malloyResultMatches(
        runtime: Runtime,
        matchVals: ExpectedResult
      ): Promise<R>;
    }
  }
}

expect.extend({
  /**
   * Check the return of `sqlEQ(expr1,expr2)` and error if the database
   * does not find those two expressions to be equal.
   */
  isSqlEq(result: Result) {
    const wantEq = result.data.path(0, 'calc').value;
    const sql = result.sql.replace(/\n/g, '\n    ');
    if (wantEq !== '=') {
      return {
        pass: false,
        message: () =>
          `Got '${wantEq}' ${Object.prototype.toString.call(
            wantEq
          )} instead of '='\nSQL:\n    ${sql}`,
      };
    }
    return {
      pass: true,
      message: () => 'SQL expression matched',
    };
  },

  async malloyResultMatches(
    querySrc: string,
    runtime: SingleConnectionRuntime,
    shouldEqual: ExpectedResult
  ) {
    if (!runtime.supportsNesting && querySrc.indexOf('nest:') >= 0) {
      return {
        pass: true,
        message: () =>
          'Test was skipped since connection does not support nesting.',
      };
    }

    let query: QueryMaterializer;
    try {
      query = runtime.loadQuery(querySrc);
    } catch (e) {
      return {
        pass: false,
        message: () => `loadQuery failed: ${e.message}`,
      };
    }

    let result: Result;
    try {
      result = await query.run();
    } catch (e) {
      let failMsg = `query.run failed: ${e.message}`;
      try {
        failMsg += `\nSQL: ${await query.getSQL()}`;
      } catch (e2) {
        //
      }
      return {pass: false, message: () => failMsg};
    }

    const allRows = Array.isArray(shouldEqual) ? shouldEqual : [shouldEqual];
    let i = 0;
    const fails: string[] = [];
    const gotRows = result.data.toObject().length;
    if (Array.isArray(shouldEqual)) {
      if (gotRows !== allRows.length) {
        fails.push(`Expected result.rows=${allRows.length}  Got: ${gotRows}`);
      }
    }
    for (const expected of allRows) {
      for (const [name, value] of Object.entries(expected)) {
        const valueAs = value === 'null' ? "'null'" : value;
        const row = allRows.length > 1 ? `[${i}]` : '';
        const expected = `Expected ${row}{${name}: ${valueAs}}`;
        try {
          let got;
          const nestOne = name.split('.');
          if (nestOne.length === 1) {
            got = result.data.path(i, name).value;
          } else if (nestOne.length === 2) {
            got = result.data.path(i, nestOne[0], 0, nestOne[1]).value;
          } else {
            throw new Error(
              "malloyResultMatcher doesn't handle paths that long yet"
            );
          }
          const mustBe = value instanceof Date ? value.getTime() : value;
          const actuallyGot = got instanceof Date ? got.getTime() : got;
          const gotAs = got === 'null' ? "'null'" : got;
          if (actuallyGot !== mustBe) {
            fails.push(`${expected} Got: ${gotAs}`);
          }
        } catch (e) {
          fails.push(`${expected} Error: ${e.message}`);
        }
      }
      i += 1;
    }
    if (fails.length !== 0) {
      const failMsg = `SQL: ${await query.getSQL()}\n${fails.join('\n')}`;
      return {pass: false, message: () => failMsg};
    }

    return {
      pass: true,
      message: () => 'All rows matched expected results',
    };
  },
});
