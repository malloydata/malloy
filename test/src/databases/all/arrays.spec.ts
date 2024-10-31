/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

describe.each(runtimes.runtimeList)('arrays %s', (databaseName, runtime) => {
  const head = `${databaseName}.sql("select null")`;
  const digits = `${head} -> {select: digits is [1,2]}`;
  test('array literal', async () => {
    await expect(`run: ${digits}`).malloyResultMatches(runtime, {
      digits: [1, 2],
    });
  });
  test('array-un-nest', async () => {
    expect(`run: ${digits}->{ select: n is digits.each }`).malloyResultMatches(
      runtime,
      [{n: 1}, {n: 2}]
    );
  });
  test('array columns can be passed to functions', async () => {
    await expect(
      `run: ${digits}->{ select: two is len!number(digits); } `
    ).malloyResultMatches(runtime, {two: 2});
  });
});
