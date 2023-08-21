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
  SingleConnectionRuntime,
} from '@malloydata/malloy';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      isSqlEq(): R;
      /**
       * Jest matcher for running a Malloy query, assumes you only care about
       * columns in the first row.
       *
       *     await expect(runtime).queryMatches('query', {colName: colValue});
       *
       * @param runtime Database connection runtime
       * @param querySrc Malloy source, last query in source will be run
       * @param expected Key value pairs
       */
      queryMatches(
        querySrc: string,
        matchVals: Record<string, unknown>
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

  async queryMatches(
    runtime: SingleConnectionRuntime,
    querySrc: string,
    expected: Record<string, unknown>
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
      return {pass: false, message: () => `loadQuery failed: ${e.message}`};
    }

    let result: Result;
    try {
      result = await query.run();
    } catch (e) {
      const failMsg =
        `query.run failed: ${e.message}\n` + `SQL: ${await query.getSQL()}`;
      return {pass: false, message: () => failMsg};
    }

    const fails: string[] = [];
    for (const [name, value] of Object.entries(expected)) {
      try {
        const got = result.data.path(0, name).value;
        const mustBe = value instanceof Date ? value.getTime() : value;
        const actuallyGot = got instanceof Date ? got.getTime() : got;
        if (actuallyGot !== mustBe) {
          fails.push(`Expected {${name}: ${value}} Got: ${got}`);
        }
      } catch (e) {
        fails.push(`Expected {${name}: ${value}} Error: ${e.message}`);
      }
    }
    if (fails.length !== 0) {
      const failMsg = `SQL: ${await query.getSQL()}\n${fails.join('\n')}`;
      return {pass: false, message: () => failMsg};
    }

    return {
      pass: true,
      message: () => `First row matched ${JSON.stringify(expected)}`,
    };
  },
});
