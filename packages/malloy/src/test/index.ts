/*
 * Copyright 2024 Google LLC
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
