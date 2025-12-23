/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as fs from 'fs';
import * as util from 'util';
import {fileURLToPath} from 'url';
import type {Connection} from '..';
import {SingleConnectionRuntime} from '..';

/**
 * Create a SingleConnectionRuntime for testing with a standard file URL reader.
 *
 * This reduces boilerplate in connection test files by providing a simple
 * way to create a runtime that can read local files.
 *
 * @example
 * import { createTestRuntime } from '@malloydata/malloy/test';
 * import { BigQueryConnection } from '@malloydata/malloy-db-bigquery';
 *
 * const bq = new BigQueryConnection('test');
 * const runtime = createTestRuntime(bq);
 *
 * @param connection - The database connection to use
 * @returns A SingleConnectionRuntime configured with a file URL reader
 */
export function createTestRuntime<T extends Connection>(
  connection: T
): SingleConnectionRuntime<T> {
  return new SingleConnectionRuntime({
    urlReader: {
      readURL: async (url: URL) => {
        const filePath = fileURLToPath(url);
        return await util.promisify(fs.readFile)(filePath, 'utf8');
      },
    },
    connection,
  });
}

// Test data creation
export {TV} from './test-values';
export type {TypedValue} from './test-values';
export {mkTestModel, wrapTestModel, extendTestModel} from './test-models';
export type {TestModelSources, TestModel} from './test-models';

// Query execution
export {runQuery} from './runQuery';
export type {QueryResult} from './runQuery';

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
