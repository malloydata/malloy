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

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';
// No prebuilt shared model, each test is complete.  Makes debugging easier.

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  it(`named view plus named view - ${databaseName}`, async () => {
    await expect(`
      source: x is ${databaseName}.sql("SELECT 1 AS n") extend {
        view: d is { group_by: n }
        view: m is { aggregate: c is count() }
      }
      run: x -> d + m
    `).malloyResultMatches(runtime, {n: 1, c: 1});
  });
  it(`named view plus named view in source - ${databaseName}`, async () => {
    await expect(`
      source: x is ${databaseName}.sql("SELECT 1 AS n") extend {
        view: d is { group_by: n }
        view: m is { aggregate: c is count() }
        view: y is d + m
      }
      run: x -> y
    `).malloyResultMatches(runtime, {n: 1, c: 1});
  });
  it(`literal view plus named view - ${databaseName}`, async () => {
    await expect(`
      source: x is ${databaseName}.sql("SELECT 1 AS n") extend {
        view: m is { aggregate: c is count() }
      }
      run: x -> { group_by: n } + m
    `).malloyResultMatches(runtime, {n: 1, c: 1});
  });
  it(`literal view plus named view in source - ${databaseName}`, async () => {
    await expect(`
      source: x is ${databaseName}.sql("SELECT 1 AS n") extend {
        view: m is { aggregate: c is count() }
        view: y is { group_by: n } + m
      }
      run: x -> y
    `).malloyResultMatches(runtime, {n: 1, c: 1});
  });
  it(`named view plus literal view - ${databaseName}`, async () => {
    await expect(`
      source: x is ${databaseName}.sql("SELECT 1 AS n") extend {
        view: d is { group_by: n }
      }
      run: x -> d + { aggregate: c is count() }
    `).malloyResultMatches(runtime, {n: 1, c: 1});
  });
  it(`literal view plus literal view - ${databaseName}`, async () => {
    await expect(`
      source: x is ${databaseName}.sql("SELECT 1 AS n")
      run: x -> { group_by: n } + { aggregate: c is count() }
    `).malloyResultMatches(runtime, {n: 1, c: 1});
  });
  it(`three named views - ${databaseName}`, async () => {
    await expect(`
      source: x is ${databaseName}.sql("SELECT 1 AS n") extend {
        view: d1 is { group_by: n1 is n }
        view: d2 is { group_by: n2 is n }
        view: m is { aggregate: c is count() }
      }
      run: x -> d1 + d2 + m
    `).malloyResultMatches(runtime, {n1: 1, n2: 1, c: 1});
  });
  it(`nested no name - ${databaseName}`, async () => {
    await expect(`
      source: x is ${databaseName}.sql("SELECT 1 AS n") extend {
        view: d is { group_by: n }
        view: m is { aggregate: c is count() }
      }
      run: x -> {
        nest: d + m
      }
    `).malloyResultMatches(runtime, {'d.n': 1, 'd.c': 1});
  });
  it(`nested with name - ${databaseName}`, async () => {
    await expect(`
      source: x is ${databaseName}.sql("SELECT 1 AS n") extend {
        view: d is { group_by: n }
        view: m is { aggregate: c is count() }
      }
      run: x -> {
        nest: y is d + m
      }
    `).malloyResultMatches(runtime, {'y.n': 1, 'y.c': 1});
  });
});
