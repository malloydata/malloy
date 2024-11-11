/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';
import {FieldDef, Expr} from '@malloydata/malloy';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

/*
 * Tests for the composite atomic data types "record", "array of values",
 * and "array of records". Each starts with a test that the dialect functions
 * for literals work, and then bases the rest of the tests on literals,
 * so fix that one first if the tests are failing.
 */

type NumberLiteralNodeType = 'numberLiteral'; // Do not understand why this is needed
describe.each(runtimes.runtimeList)(
  'composite fields %s',
  (databaseName, runtime) => {
    function literalNum(num: Number) {
      const literal = num.toString();
      const node: NumberLiteralNodeType = 'numberLiteral';
      return {node, literal, sql: literal};
    }
    function arraySelectVal(...val: Number[]): string {
      return runtime.dialect.sqlLiteralArray({
        node: 'arrayLiteral',
        typeDef: {
          type: 'array',
          name: 'evens',
          join: 'many',
          elementTypeDef: {type: 'number'},
          fields: [],
          dialect: runtime.dialect.name,
        },
        kids: {values: val.map(v => literalNum(v))},
      });
    }
    function recordSelectVal(fromObj: Record<string, number>): string {
      const kids: Record<string, Expr> = {};
      const fields: FieldDef[] = Object.keys(fromObj).map(name => {
        kids[name] = literalNum(fromObj[name]);
        return {
          type: 'number',
          name,
        };
      });
      return runtime.dialect.sqlLiteralRecord({
        node: 'recordLiteral',
        typeDef: {
          type: 'record',
          name: 'evens',
          join: 'one',
          dialect: runtime.dialect.name,
          fields,
        },
        kids,
      });
    }

    const sizesObj = {s: 0, m: 1, l: 2, xl: 3};
    const sizes = `${databaseName}.sql("""SELECT ${recordSelectVal(
      sizesObj
    )} as sizes""")`;

    const evensObj = [2, 4, 6, 8];
    const evens = `${databaseName}.sql("SELECT ${arraySelectVal(
      ...evensObj
    )} as evens")`;

    describe('simple arrays', () => {
      test('array literal dialect function', async () => {
        await expect(`run: ${evens}`).malloyResultMatches(runtime, {
          evens: evensObj,
        });
      });
      test('select array', async () => {
        await expect(`
          run: ${evens}->{select: nn is evens}
          `).malloyResultMatches(runtime, {nn: evensObj});
      });
      test('array-un-nest on each', async () => {
        await expect(`
      run: ${evens}->{ select: n is evens.each }
    `).malloyResultMatches(
          runtime,
          evensObj.map(n => ({n}))
        );
      });
      test('array can be passed to functions', async () => {
        await expect(
          `run: ${evens}->{ select: nby2 is len!number(evens); } `
        ).malloyResultMatches(runtime, {nby2: evensObj.length});
      });
      test('array.each in source', async () => {
        await expect(`
          run: duckdb.sql("select 1")
          extend { dimension: d4 is [1,2,3,4] }
          -> { select: die_roll is d4.each }
        `).malloyResultMatches(runtime, [
          {die_roll: 1},
          {die_roll: 2},
          {die_roll: 3},
          {die_roll: 4},
        ]);
      });
      test('array.each in extend block', async () => {
        await expect(`
          run: duckdb.sql("select 1") -> {
            extend: { dimension: d4 is [1,2,3,4] }
            select: die_roll is d4.each
          }
        `).malloyResultMatches(runtime, [
          {die_roll: 1},
          {die_roll: 2},
          {die_roll: 3},
          {die_roll: 4},
        ]);
      });
      test.skip('cross join arrays', async () => {
        await expect(`
          # test.verbose
          run: duckdb.sql("select 1") extend {
            dimension: d1 is [1,2,3,4]
            join_cross: d2 is [1,2,3,4]
          } -> {
            group_by: roll is d1.each + d2.each
            aggregate: rolls is count()
          }
        `).malloyResultMatches(runtime, [
          {roll: 2, rolls: 1},
          {roll: 3, rolls: 2},
          {roll: 4, rolls: 3},
          {roll: 5, rolls: 4},
          {roll: 6, rolls: 3},
          {roll: 7, rolls: 2},
          {roll: 8, rolls: 1},
        ]);
      });
    });
    describe('record', () => {
      function rec_eq(as?: string): Record<string, Number> {
        const name = as ?? 'sizes';
        return {
          [`${name}/s`]: 0,
          [`${name}/m`]: 1,
          [`${name}/l`]: 2,
          [`${name}/xl`]: 3,
        };
      }
      test('record literal dialect function', async () => {
        await expect(`run: ${sizes}`).malloyResultMatches(runtime, rec_eq());
      });
      test('record.property access', async () => {
        await expect(`
          run: ${sizes} -> { select: small is sizes.s }`).malloyResultMatches(
          runtime,
          {small: 0}
        );
      });
      test('record can be selected', async () => {
        await expect(
          `
          run: ${sizes} -> { select: sizes }`
        ).malloyResultMatches(runtime, rec_eq());
      });
      test('record literal can be selected', async () => {
        await expect(`
          run: ${sizes} -> { select: record is sizes }
        `).malloyResultMatches(runtime, rec_eq('record'));
      });
      test('select record literal from a source', async () => {
        await expect(`
          run: duckdb.sql("select 1") -> {
            extend: { dimension: sizes is {s is 0, m is 1, l is 2, xl is 3} }
            select: sizes
          }
        `).malloyResultMatches(runtime, rec_eq());
      });
      test('computed record.property from a source', async () => {
        await expect(`
          run: duckdb.sql("select 1")
            extend { dimension: record is {s is 0, m is 1, l is 2, xl is 3} }
            -> { select: small is record.s }
        `).malloyResultMatches(runtime, {small: 0});
      });
      test('record.property normal', async () => {
        await expect(`
          run: ${sizes} -> { select: small is sizes.s }
        `).malloyResultMatches(runtime, {small: 0});
      });
      test('record.property from an extend block', async () => {
        await expect(`
          run: duckdb.sql("select 1") -> {
            extend: { dimension: record is {s is 0, m is 1, l is 2, xl is 3} }
            select: small is record.s
          }
        `).malloyResultMatches(runtime, {small: 0});
      });
      test.todo('array of records can be selected');
      test.todo('array of records literal');
    });
  }
);
