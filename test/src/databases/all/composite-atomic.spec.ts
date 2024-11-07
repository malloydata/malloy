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

describe.each(runtimes.runtimeList)(
  'composite fields %s',
  (databaseName, runtime) => {
    describe('simple arrays', () => {
      const evens = 'duckdb.sql("SELECT [2,4] as evens")';
      test('select array literal', async () => {
        await expect(`
      run: duckdb.sql("SELECT 1 AS row") -> { select: odds is [1,3] }
    `).malloyResultMatches(runtime, {odds: [1, 3]});
      });
      test('array-un-nest on each', async () => {
        await expect(`
      run: ${evens}->{ select: n is evens.each }
    `).malloyResultMatches(runtime, [{n: 2}, {n: 4}]);
      });
      test('array columns can be passed to functions', async () => {
        await expect(
          `run: ${evens}->{ select: two is len!number(evens); } `
        ).malloyResultMatches(runtime, {two: 2});
      });
      test('select array columns', async () => {
        await expect(`run: ${evens}->{ select: evens }`).malloyResultMatches(
          runtime,
          {evens: [2, 4]}
        );
      });
      test('array literal in source', async () => {
        await expect(`
          # test.debug
          run: duckdb.sql("select 1") extend { dimension: d1 is [1,2,3,4,5,6] }
          // -> { select: d1 }
          -> { select: die_roll is d1.each }
        `).malloyResultMatches(runtime, [
          {die_roll: 1},
          {die_roll: 2},
          {die_roll: 3},
          {die_roll: 4},
          {die_roll: 5},
          {die_roll: 6},
        ]);
      });
      test.todo('cross join two arrays');
    });
    describe('record', () => {
      const record = 'duckdb.sql("SELECT {s: 0, m: 1, l:2, xl: 3} as record")';
      test('record can be selected', async () => {
        await expect(
          `
          run: ${record} -> { select: record }`
        ).malloyResultMatches(runtime, {
          'record/s': 0,
          'record/m': 1,
          'record/l': 2,
          'record/xl': 3,
        });
      });
      test('record literal', async () => {
        await expect(`
          run: duckdb.sql("select 1") -> {
            select: record is {s is 0, m is 1, l is 2, xl is 3}
          }
        `).malloyResultMatches(runtime, {
          'record/s': 0,
          'record/m': 1,
          'record/l': 2,
          'record/xl': 3,
        });
      });
      test.todo('array of records can be seclted');
      test.todo('array of records literal');
    });
  }
);
