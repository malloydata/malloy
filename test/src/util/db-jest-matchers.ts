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

import type {
  ModelMaterializer,
  QueryMaterializer,
  Result,
  Runtime,
  LogMessage,
} from '@malloydata/malloy';
import {MalloyError, SingleConnectionRuntime, API} from '@malloydata/malloy';
import type {Tag} from '@malloydata/malloy-tag';
import EventEmitter from 'events';
import {inspect} from 'util';

type ExpectedResultRow = Record<string, unknown>;
type ExpectedResult = ExpectedResultRow | ExpectedResultRow[];
type Runner = Runtime | ModelMaterializer;

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
        runtime: Runner,
        matchVals: ExpectedResult
      ): Promise<R>;
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
    runtime: Runner,
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

    let query: QueryMaterializer;
    let queryTestTag: Tag | undefined = undefined;
    try {
      query = runtime.loadQuery(querySrc);
      const queryTags = (await query.getPreparedQuery()).tagParse().tag;
      queryTestTag = queryTags.tag('test');
    } catch (e) {
      return {
        pass: false,
        message: () => `Could not prepare query to run: ${e.message}`,
      };
    }

    let result: Result;
    try {
      result = await query.run();
    } catch (e) {
      let failMsg = `query.run failed: ${e.message}\n`;
      if (e instanceof MalloyError) {
        failMsg = `Error in query compilation\n${errorLogToString(
          querySrc,
          e.problems
        )}`;
      } else {
        try {
          failMsg += `SQL: ${await query.getSQL()}\n`;
        } catch (e2) {
          // we could not show the SQL for unknown reasons
        }
        failMsg += e.stack;
      }
      return {pass: false, message: () => failMsg};
    }

    try {
      API.util.wrapResult(result);
    } catch (error) {
      return {
        pass: false,
        message: () =>
          `Result could not be wrapped into new style result: ${error}\n${error.stack}`,
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
      const fromSQL = '  ' + (await query.getSQL()).split('\n').join('\n  ');
      if (debugFail && !failedTest) {
        fails.push('\nTest forced failure (# test.debug)');
      }
      const failMsg = `SQL Generated:\n${fromSQL}\n${fails.join('\n')}`;
      return {pass: false, message: () => failMsg};
    }

    return {
      pass: true,
      message: () => 'All rows matched expected results',
    };
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

function errorLogToString(src: string, msgs: LogMessage[]) {
  let lovely = '';
  let lineNo = 0;
  for (const line of src.split('\n')) {
    lovely += `    | ${line}\n`;
    for (const entry of msgs) {
      if (entry.at) {
        if (entry.at.range.start.line === lineNo) {
          const charFrom = entry.at.range.start.character;
          lovely += `!!!!! ${' '.repeat(charFrom)}^ ${entry.message}\n`;
        }
      }
    }
    lineNo += 1;
  }
  return lovely;
}

function humanReadable(thing: unknown): string {
  return inspect(thing, {breakLength: 72, depth: Infinity});
}

// b is "expected"
// a is "actual"
// If expected is an object, all of the keys should also match,
// but the expected is allowed to have other keys that are not matched
function objectsMatch(a: unknown, b: unknown): boolean {
  if (
    typeof b === 'string' ||
    typeof b === 'number' ||
    typeof b === 'boolean' ||
    typeof b === 'bigint' ||
    b === undefined ||
    b === null
  ) {
    return b === a;
  } else if (Array.isArray(b)) {
    if (Array.isArray(a)) {
      return a.length === b.length && a.every((v, i) => objectsMatch(v, b[i]));
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
    const keys = Object.keys(b);
    for (const key of keys) {
      if (!objectsMatch(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
}
