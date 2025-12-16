/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Test data creation
export {TV} from './test-values';
export type {TypedValue} from './test-values';
export {mkTestModel, wrapTestModel} from './test-models';
export type {TestModelSources, TestModel} from './test-models';

// Query execution
export {runQuery} from './runQuery';
export type {QueryResult} from './runQuery';

// Result type matchers
export {resultIs, isResultMatcher} from './resultIs';
export type {ResultMatcher} from './resultIs';

// Jest matcher types (matchers registered via separate import)
export type {ExpectedRow, MatcherOptions} from './resultMatchers';

/*
 * Legacy exports - kept for backwards compatibility
 */

/**
 * Accepts databases in env, either via comma-separated dialect list
 * (MALLOY_DATABASES=) or a single database (MALLOY_DATABASE=). returns either
 *  databases defined in env or a default list that was passed.
 */
export function databasesFromEnvironmentOr(
  defaultDatabases: string[]
): string[] {
  return process.env['MALLOY_DATABASES']
    ? process.env['MALLOY_DATABASES'].split(',')
    : process.env['MALLOY_DATABASE']
      ? [process.env['MALLOY_DATABASE']]
      : defaultDatabases;
}

/**
 * A replacement for [describe()] that mimics [describe.skip()]
 */
const describeSkip: jest.Describe = Object.assign(
  (
    name: number | string | Function | jest.FunctionLike,
    fn: jest.EmptyFunction
  ) => describe.skip(name, fn),
  {
    skip: describe.skip,
    // eslint-disable-next-line no-restricted-properties
    only: describe.only,
    each: (() => () => it.skip('skipped', () => {})) as unknown as jest.Each,
  }
);

/**
 * Confirms that one or more of the databases being tested overlaps with
 * the databases a test suite can accept. If there is overlap, return a tuple
 * of jest.describe and the dialects to be tested if there is no overlap,
 * return a tuple if jest.describe.skip and the dialects to be tested
 */
export function describeIfDatabaseAvailable(
  acceptableDatabases: string[]
): [jest.Describe, string[]] {
  const currentDatabases = databasesFromEnvironmentOr(acceptableDatabases);
  const overlap = acceptableDatabases.filter(d => currentDatabases.includes(d));

  return overlap.length > 0 ? [describe, overlap] : [describeSkip, overlap];
}

export function brokenIn(dialectName: string, connectionName: string): boolean {
  return dialectName === connectionName;
}
