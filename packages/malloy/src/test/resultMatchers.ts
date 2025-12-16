/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ModelMaterializer, QueryMaterializer, LogMessage} from '..';
import {API, MalloyError} from '..';
import type {Tag} from '@malloydata/malloy-tag';
import {inspect} from 'util';
import {isResultMatcher} from './resultIs';
import {cellsToObjects} from './cellsToObject';

/** Expected row shape for result matching */
export type ExpectedRow = Record<string, unknown>;

/** Options for result matchers */
export interface MatcherOptions {
  debug?: boolean;
}

/** Test runner - can be a ModelMaterializer */
export type TestRunner = ModelMaterializer;

type JestMatcherResult = {
  pass: boolean;
  message: () => string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      /**
       * Jest matcher for running a Malloy query with partial matching.
       * Actual rows can have extra fields beyond what's expected.
       *
       * @example
       * await expect('run: users -> { select: * }')
       *   .toMatchResult(tm, {name: 'alice'});  // passes with extra fields
       *
       * // Multiple rows - variadic
       * await expect('run: users -> { select: * }')
       *   .toMatchResult(tm, {name: 'alice'}, {name: 'bob'});
       *
       * // Check at least one row exists
       * await expect('run: users -> { select: * }')
       *   .toMatchResult(tm, {});
       *
       * @param tm - TestModel from mkTestModel()
       * @param rows - Expected row values (variadic), last arg can be options
       */
      toMatchResult(
        tm: TestRunner,
        ...rowsOrOptions: (ExpectedRow | MatcherOptions)[]
      ): Promise<R>;

      /**
       * Jest matcher for running a Malloy query with exact matching.
       * Actual rows must have exactly the expected fields.
       *
       * @example
       * await expect('run: users -> { select: name }')
       *   .toEqualResult(tm, [{name: 'alice'}]);
       *
       * @param tm - TestModel from mkTestModel()
       * @param rows - Array of expected rows
       * @param options - Optional matcher options
       */
      toEqualResult(
        tm: TestRunner,
        rows: ExpectedRow[],
        options?: MatcherOptions
      ): Promise<R>;
    }
  }
}

interface QueryRunResult {
  fail: JestMatcherResult;
  data: Record<string, unknown>[];
  query: QueryMaterializer;
  queryTestTag: Tag;
}

function errInfo(e: {message?: string; stack?: string}) {
  let err = '';
  const trace = e.stack ?? '';
  if (e.message && !trace.includes(e.message)) {
    err = `ERROR: ${e.message}\n`;
  }
  if (e.stack) {
    err += `STACK: ${e.stack}\n`;
  }
  return err;
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

async function runQuery(
  tm: TestRunner,
  src: string
): Promise<Partial<QueryRunResult>> {
  let query: QueryMaterializer;
  let queryTestTag: Tag | undefined = undefined;
  try {
    query = tm.loadQuery(src);
    const queryTags = (await query.getPreparedQuery()).tagParse().tag;
    queryTestTag = queryTags.tag('test');
  } catch (e) {
    // Add line numbers, helpful if failure is a compiler error
    const queryText = src
      .split('\n')
      .map((line, index) => `${(index + 1).toString().padStart(4)}: ${line}`)
      .join('\n');
    return {
      fail: {
        pass: false,
        message: () =>
          `Could not prepare query to run:\n${queryText}\n\n${errInfo(e)}`,
      },
    };
  }

  try {
    const result = await query.run();
    // Use wrapResult to normalize data across all databases
    // This handles BigQuery timestamp wrappers, MySQL boolean 0/1, etc.
    const malloyResult = API.util.wrapResult(result);
    if (!malloyResult.data) {
      return {
        fail: {pass: false, message: () => 'Query returned no data'},
        query,
      };
    }
    const data = cellsToObjects(malloyResult.data, malloyResult.schema);
    return {data, queryTestTag, query};
  } catch (e) {
    const cleanSrc = src.replace(/^\n+/m, '').trimEnd();
    let failMsg = `QUERY RUN FAILED:\n${cleanSrc}`;
    if (e instanceof MalloyError) {
      failMsg = `Error in query compilation\n${errorLogToString(src, e.problems)}`;
    } else {
      try {
        failMsg += `\nSQL: ${await query.getSQL()}\n`;
      } catch {
        failMsg += '\nSQL FOR QUERY COULD NOT BE COMPUTED\n';
      }
      failMsg += errInfo(e);
    }
    return {fail: {pass: false, message: () => failMsg}, query};
  }
}

function humanReadable(thing: unknown): string {
  return inspect(thing, {breakLength: 72, depth: Infinity});
}

/**
 * Compare two values with partial matching.
 * If expected is an object, all expected keys must match, but actual can have extra keys.
 */
function partialMatch(
  actual: unknown,
  expected: unknown,
  path: string
): {pass: boolean; message?: string} {
  // Handle ResultMatcher
  if (isResultMatcher(expected)) {
    const result = expected.match(actual);
    if (!result.pass) {
      return {
        pass: false,
        message: `${path}: expected ${result.expected}, got ${result.actual}`,
      };
    }
    return {pass: true};
  }

  // Handle null
  if (expected === null) {
    if (actual === null) {
      return {pass: true};
    }
    return {
      pass: false,
      message: `${path}: expected null, got ${humanReadable(actual)}`,
    };
  }

  // Handle primitives
  // Note: dates/timestamps are normalized to ISO strings by the new API
  if (
    typeof expected === 'string' ||
    typeof expected === 'number' ||
    typeof expected === 'boolean' ||
    typeof expected === 'bigint'
  ) {
    if (actual === expected) {
      return {pass: true};
    }
    return {
      pass: false,
      message: `${path}: expected ${humanReadable(expected)}, got ${humanReadable(actual)}`,
    };
  }

  // Handle arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return {
        pass: false,
        message: `${path}: expected array, got ${typeof actual}`,
      };
    }
    if (actual.length !== expected.length) {
      return {
        pass: false,
        message: `${path}: expected ${expected.length} elements, got ${actual.length}`,
      };
    }
    for (let i = 0; i < expected.length; i++) {
      const result = partialMatch(actual[i], expected[i], `${path}[${i}]`);
      if (!result.pass) {
        return result;
      }
    }
    return {pass: true};
  }

  // Handle objects (partial match - expected keys must match, extra keys allowed)
  if (typeof expected === 'object') {
    if (
      typeof actual !== 'object' ||
      actual === null ||
      Array.isArray(actual)
    ) {
      return {
        pass: false,
        message: `${path}: expected object, got ${humanReadable(actual)}`,
      };
    }
    for (const [key, value] of Object.entries(expected)) {
      const actualValue = (actual as Record<string, unknown>)[key];
      const result = partialMatch(actualValue, value, `${path}.${key}`);
      if (!result.pass) {
        return result;
      }
    }
    return {pass: true};
  }

  return {
    pass: false,
    message: `${path}: unsupported type ${typeof expected}`,
  };
}

/**
 * Compare two values with exact matching.
 * Objects must have exactly the same keys.
 */
function exactMatch(
  actual: unknown,
  expected: unknown,
  path: string
): {pass: boolean; message?: string} {
  // Handle ResultMatcher
  if (isResultMatcher(expected)) {
    const result = expected.match(actual);
    if (!result.pass) {
      return {
        pass: false,
        message: `${path}: expected ${result.expected}, got ${result.actual}`,
      };
    }
    return {pass: true};
  }

  // Handle null
  if (expected === null) {
    if (actual === null) {
      return {pass: true};
    }
    return {
      pass: false,
      message: `${path}: expected null, got ${humanReadable(actual)}`,
    };
  }

  // Handle primitives
  // Note: dates/timestamps are normalized to ISO strings by the new API
  if (
    typeof expected === 'string' ||
    typeof expected === 'number' ||
    typeof expected === 'boolean' ||
    typeof expected === 'bigint'
  ) {
    if (actual === expected) {
      return {pass: true};
    }
    return {
      pass: false,
      message: `${path}: expected ${humanReadable(expected)}, got ${humanReadable(actual)}`,
    };
  }

  // Handle arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return {
        pass: false,
        message: `${path}: expected array, got ${typeof actual}`,
      };
    }
    if (actual.length !== expected.length) {
      return {
        pass: false,
        message: `${path}: expected ${expected.length} elements, got ${actual.length}`,
      };
    }
    for (let i = 0; i < expected.length; i++) {
      const result = exactMatch(actual[i], expected[i], `${path}[${i}]`);
      if (!result.pass) {
        return result;
      }
    }
    return {pass: true};
  }

  // Handle objects (exact match - keys must match exactly)
  if (typeof expected === 'object') {
    if (
      typeof actual !== 'object' ||
      actual === null ||
      Array.isArray(actual)
    ) {
      return {
        pass: false,
        message: `${path}: expected object, got ${humanReadable(actual)}`,
      };
    }

    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual as Record<string, unknown>).sort();

    // Check for extra keys in actual
    for (const key of actualKeys) {
      if (!expectedKeys.includes(key)) {
        return {
          pass: false,
          message: `${path}: unexpected field '${key}'`,
        };
      }
    }

    // Check for missing keys in actual
    for (const key of expectedKeys) {
      if (!actualKeys.includes(key)) {
        return {
          pass: false,
          message: `${path}: missing field '${key}'`,
        };
      }
    }

    // Compare values
    for (const [key, value] of Object.entries(expected)) {
      const actualValue = (actual as Record<string, unknown>)[key];
      const result = exactMatch(actualValue, value, `${path}.${key}`);
      if (!result.pass) {
        return result;
      }
    }
    return {pass: true};
  }

  return {
    pass: false,
    message: `${path}: unsupported type ${typeof expected}`,
  };
}

/**
 * Check if last argument is an options object.
 */
function isOptions(arg: unknown): arg is MatcherOptions {
  if (typeof arg !== 'object' || arg === null) {
    return false;
  }
  const keys = Object.keys(arg);
  // Options object only has 'debug' key
  return keys.length === 1 && keys[0] === 'debug';
}

expect.extend({
  async toMatchResult(
    querySrc: string,
    tm: TestRunner,
    ...rowsOrOptions: (ExpectedRow | MatcherOptions)[]
  ): Promise<JestMatcherResult> {
    // Parse args - last might be options
    let options: MatcherOptions = {};
    let expectedRows: ExpectedRow[];

    if (
      rowsOrOptions.length > 0 &&
      isOptions(rowsOrOptions[rowsOrOptions.length - 1])
    ) {
      options = rowsOrOptions[rowsOrOptions.length - 1] as MatcherOptions;
      expectedRows = rowsOrOptions.slice(0, -1) as ExpectedRow[];
    } else {
      expectedRows = rowsOrOptions as ExpectedRow[];
    }

    querySrc = querySrc.trimEnd().replace(/^\n*/, '');
    const {fail, data, queryTestTag, query} = await runQuery(tm, querySrc);
    if (fail) return fail;
    if (!data) {
      return {
        pass: false,
        message: () => 'runQuery returned no data and no errors',
      };
    }

    const got = data;
    const fails: string[] = [];
    const debug = options.debug || queryTestTag?.has('debug');

    // Check row count
    if (expectedRows.length > 0 && got.length < expectedRows.length) {
      fails.push(
        `Expected at least ${expectedRows.length} rows, got ${got.length}`
      );
    }

    // Check empty match {} means "at least one row"
    if (
      expectedRows.length === 1 &&
      Object.keys(expectedRows[0]).length === 0
    ) {
      if (got.length === 0) {
        fails.push('Expected at least one row, got 0');
      }
    } else {
      // Compare each expected row
      for (let i = 0; i < expectedRows.length; i++) {
        const matchResult = partialMatch(got[i], expectedRows[i], `Row ${i}`);
        if (!matchResult.pass && matchResult.message) {
          fails.push(matchResult.message);
        }
      }
    }

    if (debug && fails.length === 0) {
      fails.push('Test forced failure (# test.debug)');
      fails.push(`Result: ${humanReadable(got)}`);
    }

    if (fails.length > 0) {
      if (debug) {
        fails.unshift(`Result Data: ${humanReadable(got)}`);
      }
      const fromSQL = query
        ? 'SQL Generated:\n  ' + (await query.getSQL()).split('\n').join('\n  ')
        : 'SQL Missing';
      const failMsg = `QUERY:\n${querySrc}\n\n${fromSQL}\n\n${fails.join('\n')}`;
      return {pass: false, message: () => failMsg};
    }

    return {
      pass: true,
      message: () => 'All rows matched expected results',
    };
  },

  async toEqualResult(
    querySrc: string,
    tm: TestRunner,
    expectedRows: ExpectedRow[],
    options: MatcherOptions = {}
  ): Promise<JestMatcherResult> {
    querySrc = querySrc.trimEnd().replace(/^\n*/, '');
    const {fail, data, queryTestTag, query} = await runQuery(tm, querySrc);
    if (fail) return fail;
    if (!data) {
      return {
        pass: false,
        message: () => 'runQuery returned no data and no errors',
      };
    }

    const got = data;
    const fails: string[] = [];
    const debug = options.debug || queryTestTag?.has('debug');

    // Exact row count match
    if (got.length !== expectedRows.length) {
      fails.push(`Expected ${expectedRows.length} rows, got ${got.length}`);
    }

    // Compare each row exactly
    const rowsToCheck = Math.min(got.length, expectedRows.length);
    for (let i = 0; i < rowsToCheck; i++) {
      const matchResult = exactMatch(got[i], expectedRows[i], `Row ${i}`);
      if (!matchResult.pass && matchResult.message) {
        fails.push(matchResult.message);
      }
    }

    if (debug && fails.length === 0) {
      fails.push('Test forced failure (# test.debug)');
      fails.push(`Result: ${humanReadable(got)}`);
    }

    if (fails.length > 0) {
      if (debug) {
        fails.unshift(`Result Data: ${humanReadable(got)}`);
      }
      const fromSQL = query
        ? 'SQL Generated:\n  ' + (await query.getSQL()).split('\n').join('\n  ')
        : 'SQL Missing';
      const failMsg = `QUERY:\n${querySrc}\n\n${fromSQL}\n\n${fails.join('\n')}`;
      return {pass: false, message: () => failMsg};
    }

    return {
      pass: true,
      message: () => 'All rows matched expected results exactly',
    };
  },
});
