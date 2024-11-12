/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';
import {
  RecordLiteralNode,
  ArrayLiteralNode,
  ArrayTypeDef,
  FieldDef,
  Expr,
} from '@malloydata/malloy';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

/*
 * Tests for the composite atomic data types "record", "array of values",
 * and "array of records". Each starts with a test that the dialect functions
 * for literals work, and then bases the rest of the tests on literals,
 * so fix that one first if the tests are failing.
 */

describe.each(runtimes.runtimeList)(
  'compound atomic datatypes %s',
  (databaseName, runtime) => {
    function literalNum(num: Number): Expr {
      const literal = num.toString();
      return {node: 'numberLiteral', literal, sql: literal};
    }
    function arraySelectVal(...val: Number[]): string {
      const literal: ArrayLiteralNode = {
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
      };
      return runtime.dialect.sqlLiteralArray(literal);
    }
    function recordLiteral(fromObj: Record<string, number>): RecordLiteralNode {
      const kids: Record<string, Expr> = {};
      const fields: FieldDef[] = Object.keys(fromObj).map(name => {
        kids[name] = literalNum(fromObj[name]);
        return {
          type: 'number',
          name,
        };
      });
      const literal: RecordLiteralNode = {
        node: 'recordLiteral',
        typeDef: {
          type: 'record',
          name: 'evens',
          join: 'one',
          dialect: runtime.dialect.name,
          fields,
        },
        kids,
      };
      literal.sql = runtime.dialect.sqlLiteralRecord(literal);
      return literal;
    }

    function recordSelectVal(fromObj: Record<string, number>): string {
      return runtime.dialect.sqlLiteralRecord(recordLiteral(fromObj));
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
    });
    describe('repeated record', () => {
      const abType: ArrayTypeDef = {
        type: 'array',
        dialect: runtime.dialect.name,
        join: 'many',
        elementTypeDef: {type: 'record_element'},
        fields: [
          {name: 'a', type: 'number'},
          {name: 'b', type: 'number'},
        ],
        name: '',
      };
      const values = [
        recordLiteral({a: 10, b: 11}),
        recordLiteral({a: 20, b: 21}),
      ];

      const ab = runtime.dialect.sqlLiteralArray({
        node: 'arrayLiteral',
        typeDef: abType,
        kids: {values},
      });
      const ab_eq = [
        {a: 10, b: 11},
        {a: 20, b: 21},
      ];

      test('repeated record from literal dialect functions', async () => {
        await expect(`
          # test.debug
          run: duckdb.sql("""SELECT ${ab} as ab""") -> { select: ab.a, ab.b }
        `).malloyResultMatches(runtime, ab_eq);
      });
      test('repeated record from nest', async () => {
        await expect(`
          # test.verbose
            run: duckdb.sql("""SELECT 10 as a, 11 as b UNION ALL SELECT 20 as a, 21 as b""")
            -> { nest: ab is { select: a, b } }
            -> { select: ab.a, ab.b }
        `).malloyResultMatches(runtime, ab_eq);
      });
      test('select repeated record from literal dialect functions', async () => {
        await expect(`
          # test.verbose
          run: duckdb.sql("""SELECT ${ab} as ab""")
        `).malloyResultMatches(runtime, {ab: ab_eq});
      });
      test('repeat record from malloy literal', async () => {
        await expect(`
          # test.verbose
          run: duckdb.sql("select null")
          -> { select: ab is [{a is 10, b is 11}, {a is 20, b is 21}] }
        `).malloyResultMatches(runtime, {ab: ab_eq});
      });
      test('repeated record can be selected and renamed', async () => {
        await expect(`
          # test.verbose
          run: duckdb.sql("""SELECT ${ab} as sqlAB""")
          -> { select: ab is sqlAB }
        `).malloyResultMatches(runtime, {ab: ab_eq});
      });
      test('select repeated record passed down pipeline', async () => {
        await expect(`
          # test.verbose
          run: duckdb.sql("select null")
          -> { select: pipeAb is [{a is 10, b is 11}, {a is 20, b is 21}] }
          -> { select: ab is pipeAb }
        `).malloyResultMatches(runtime, {ab: ab_eq});
      });
      test('deref repeat record passed down pipeline', async () => {
        await expect(`
          run: duckdb.sql("""SELECT ${ab} as sqlAB""")
          -> { select: ab is sqlAB }
          -> { select: ab.a, ab.b }
        `).malloyResultMatches(runtime, ab_eq);
      });
      test.todo('select array of records from source');
      test.todo('select property from array of records from source');
    });
  }
);
