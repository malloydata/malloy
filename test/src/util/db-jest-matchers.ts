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

import type {Result, Runtime} from '@malloydata/malloy';
import {SingleConnectionRuntime} from '@malloydata/malloy';
import EventEmitter from 'events';
import {inspect} from 'util';
import type {ExpectedResult, TestRunner, TestQuery} from './db-matcher-support';
import {runQuery} from './db-matcher-support';

interface ExpectedEvent {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

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
       *   * If you use an array, the number of rows in the result must match the rows in the match
       *   * The empty match {} accepts ANY data, but will errror if there is not a row
       *   * A match key of nestName.colName expects nestName to be a query which returns multiple rows, it will match
       *     fields from the first row of the rows of nestName
       *   * A match key of nestName/colName expects nestName to be a record/struct type
       *
       * In addition, the query is checked for the following tags
       *
       *   * test.verbose -- If the test fails, also pretty-print the result data
       *   * test.debug -- Force test failure, and the result data will be printed
       *
       * @param querySrc Malloy source, last query in source will be run
       * @param runtime Database connection runtime OR Model ( for the call to loadQuery )
       * @param expected Key value pairs or array of key value pairs
       */
      malloyResultMatches(
        runtime: TestRunner,
        matchVals: ExpectedResult
      ): Promise<R>;
      /**
       * Jest matcher for running a Malloy query, checks that each row
       * contains the values matching the template. The argument list
       * at the end will be matched for each row of the query.
       *
       * To see if the first row of a query contains a field called num with a value of 7
       * ( a "runtime"  can be a Runtime, or a Model from load/extend of a Model)
       *
       *     await expect(query(runtime, 'run: ...')).matchesResult({num: 7});
       *
       * To see if the first two rows of a query contains a field called num with a values 7 and 8
       *
       *     await expect(query(runtime, 'run: ...')).matchesResult({num: 7}, {num:8});
       *
       * Every symbol in the expect match must be in the row, however there can be columns in the row
       * which are not in the match.
       *
       * mtoy todo maybe this should be "debug_query()" instead of a tag ... ?
       * In addition, the query is checked for the tags, preceed your run statement with ...
       *
       *   * test.debug -- Force test failure, and the result data will be printed
       *
       * @param matchVals ... list of row objects containing key-value pairs
       */
      matchesResult(...matchVals: unknown[]): Promise<R>;
      toEmitDuringCompile(
        runtime: Runtime,
        ...events: ExpectedEvent[]
      ): Promise<R>;
      toEmitDuringTranslation(
        runtime: Runtime,
        ...events: ExpectedEvent[]
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
    runtime: TestRunner,
    shouldEqual: ExpectedResult
  ) {
    // TODO -- THIS IS NOT OK BUT I AM NOT FIXING IT NOW
    if (querySrc.indexOf('nest:') >= 0) {
      if (
        runtime instanceof SingleConnectionRuntime &&
        !runtime.supportsNesting
      ) {
        return {
          pass: true,
          message: () =>
            'Test was skipped since connection does not support nesting.',
        };
      }
    }

    const {fail, result, queryTestTag, query} = await runQuery({
      runner: runtime,
      src: querySrc,
    });
    if (fail) return fail;
    if (!result) {
      return {
        pass: false,
        message: () => 'runQuery returned no results and no errors',
      };
    }

    const allRows = Array.isArray(shouldEqual) ? shouldEqual : [shouldEqual];
    const fails: string[] = [];
    const gotRows = result.data.toObject().length;

    if (Array.isArray(shouldEqual)) {
      if (gotRows !== allRows.length) {
        fails.push(`Expected result.rows=${allRows.length}  Got: ${gotRows}`);
      }
    }
    let matchRow = 0;
    for (const expected of allRows) {
      for (const [name, value] of Object.entries(expected)) {
        const pExpect = JSON.stringify(value);
        const row = allRows.length > 1 ? `[${matchRow}]` : '';
        const expected = `Expected ${row}{${name}: ${pExpect}}`;
        try {
          // the internet taught me this, use lookahead/behind to preserve delimiters
          // but we are splitting on / and .
          const nestParse = name.split(/(?=[./])|(?<=[./])/g);

          const resultPath = [matchRow, nestParse[0]];
          for (
            let pathCursor = 1;
            pathCursor < nestParse.length;
            pathCursor += 2
          ) {
            if (nestParse[pathCursor] === '.') {
              resultPath.push(0);
            }
            resultPath.push(nestParse[pathCursor + 1]);
          }
          const got = result.data.path(...resultPath).value;
          const pGot = JSON.stringify(got);
          const mustBe = value instanceof Date ? value.getTime() : value;
          const actuallyGot = got instanceof Date ? got.getTime() : got;
          if (typeof mustBe === 'number' && typeof actuallyGot !== 'number') {
            fails.push(`${expected} Got: Non Numeric '${pGot}'`);
          } else if (!objectsMatch(actuallyGot, mustBe)) {
            fails.push(`${expected} Got: ${pGot}`);
          }
        } catch (e) {
          fails.push(`${expected} Error: ${e.message}`);
        }
      }
      matchRow += 1;
    }
    const failedTest = fails.length > 0;
    const debugFail = queryTestTag?.has('debug');
    if (debugFail || (failedTest && queryTestTag?.has('verbose'))) {
      fails.unshift(`Result Data: ${humanReadable(result.data.toObject())}\n`);
    }

    if (fails.length > 0) {
      if (debugFail && !failedTest) {
        fails.push('\nTest forced failure (# test.debug)');
      }
      const fromSQL = query
        ? 'SQL Generated:\n  ' + (await query.getSQL()).split('\n').join('\n  ')
        : 'SQL Missing';
      const failMsg = `${fromSQL}\n${fails.join('\n')}`;
      return {pass: false, message: () => failMsg};
    }

    return {
      pass: true,
      message: () => 'All rows matched expected results',
    };
  },

  async matchesResult(tq: TestQuery, ...expected: unknown[]) {
    const {fail, result, queryTestTag, query} = await runQuery(tq);
    if (fail) return fail;
    if (!result) {
      return {
        pass: false,
        message: () => 'runQuery returned no results and no errors',
      };
    }

    const fails: string[] = [];
    const got = result.data.toObject();
    const expectStr = this.utils.EXPECTED_COLOR(humanReadable(expected));

    if (!Array.isArray(got)) {
      fails.push(`!!! Expected: ${expectStr}`);
      fails.push(
        `??? NonArray: ${this.utils.RECEIVED_COLOR(humanReadable(got))}`
      );
    } else {
      // compare each row in the result to each row in the expectation
      // This is more useful than a straight diff
      const diffs: string[] = [];
      let unMatched = false;
      for (let expectNum = 0; expectNum < expected.length; expectNum += 1) {
        const eStr = this.utils.EXPECTED_COLOR(
          humanReadable(expected[expectNum])
        );
        if (objectsMatch(got[expectNum], expected[expectNum])) {
          diffs.push(`     Matched: ${eStr}`);
        } else {
          diffs.push(`<<< Expected: ${eStr}`);
          diffs.push(
            `>>> Received: ${this.utils.RECEIVED_COLOR(
              humanReadable(got[expectNum])
            )}`
          );
          unMatched = true;
        }
      }
      if (unMatched) {
        fails.push(...diffs);
      }
    }

    if (queryTestTag?.has('debug') && fails.length === 0) {
      fails.push(
        `\n${this.utils.RECEIVED_COLOR('Test forced failure (# test.debug)')}`
      );
      fails.push(`Received: ${this.utils.RECEIVED_COLOR(humanReadable(got))}`);
    }

    if (fails.length > 0) {
      const fromSQL = query
        ? 'SQL Generated:\n  ' + (await query.getSQL()).split('\n').join('\n  ')
        : 'SQL Missing';
      const failMsg = `${fromSQL}\n${fails.join('\n')}`;
      return {pass: false, message: () => failMsg};
    }

    return {pass: true, message: () => `Matched: ${expectStr}`};
  },

  async toEmitDuringCompile(
    querySrc: string,
    runtime: Runtime,
    ...expectedEvents: ExpectedEvent[]
  ) {
    return toEmit(this, querySrc, 'compile', runtime, ...expectedEvents);
  },
  async toEmitDuringTranslation(
    querySrc: string,
    runtime: Runtime,
    ...expectedEvents: ExpectedEvent[]
  ) {
    return toEmit(this, querySrc, 'translate', runtime, ...expectedEvents);
  },
});

async function toEmit(
  context: jest.MatcherContext,
  querySrc: string,
  when: 'compile' | 'translate',
  runtime: Runtime,
  ...expectedEvents: ExpectedEvent[]
) {
  const eventStream = runtime.eventStream;
  if (eventStream === undefined) {
    return {
      pass: false,
      message: () => 'No event stream found',
    };
  }
  if (!(eventStream instanceof EventEmitter)) {
    return {
      pass: false,
      message: () => 'Event stream is not an EventEmitter',
    };
  }
  const gotEvents: ExpectedEvent[] = [];
  const eventIdsWeCareAbout = new Set(expectedEvents.map(e => e.id));
  for (const id of eventIdsWeCareAbout) {
    eventStream.on(id, data => {
      gotEvents.push({id, data});
    });
  }
  const model = runtime.loadModel(querySrc, {
    noThrowOnError: when === 'translate',
  });
  if (when === 'compile') {
    const query = model.loadFinalQuery();
    await query.getPreparedResult();
  } else {
    await model.getModel();
  }

  let matching = gotEvents.length === expectedEvents.length;
  if (matching) {
    for (let i = 0; i < expectedEvents.length; i++) {
      const got = gotEvents[i];
      const want = expectedEvents[i];
      matching &&= objectsMatch(got, want);
    }
  }

  if (!matching) {
    return {
      pass: false,
      message: () =>
        `Expected events ${context.utils.diff(expectedEvents, gotEvents)}`,
    };
  }

  return {
    pass: true,
    message: () => 'All rows matched expected results',
  };
}

function humanReadable(thing: unknown): string {
  return inspect(thing, {breakLength: 72, depth: Infinity});
}

// If expected is an object, all of the keys should also match,
// but the expected is allowed to have other keys that are not matched
function objectsMatch(a: unknown, mustHave: unknown): boolean {
  if (
    typeof mustHave === 'string' ||
    typeof mustHave === 'number' ||
    typeof mustHave === 'boolean' ||
    typeof mustHave === 'bigint' ||
    mustHave === undefined ||
    mustHave === null
  ) {
    return mustHave === a;
  } else if (Array.isArray(mustHave)) {
    if (Array.isArray(a)) {
      return (
        a.length === mustHave.length &&
        a.every((v, i) => objectsMatch(v, mustHave[i]))
      );
    }
    return false;
  } else {
    if (
      typeof a === 'string' ||
      typeof a === 'number' ||
      typeof a === 'boolean' ||
      typeof a === 'bigint' ||
      a === undefined ||
      a === null
    ) {
      return false;
    }
    if (Array.isArray(a)) return false;
    const keys = Object.keys(mustHave);
    for (const key of keys) {
      if (!objectsMatch(a[key], mustHave[key])) {
        return false;
      }
    }
    return true;
  }
}
