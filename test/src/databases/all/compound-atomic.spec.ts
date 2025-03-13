/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';
import type {
  RecordLiteralNode,
  ArrayLiteralNode,
  ArrayTypeDef,
  FieldDef,
  Expr,
  SQLSourceRequest,
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
  (conName, runtime) => {
    const supportsNestedArrays = runtime.dialect.nestedArrays;
    const quote = runtime.dialect.sqlMaybeQuoteIdentifier;
    function literalNum(num: Number): Expr {
      const literal = num.toString();
      return {node: 'numberLiteral', literal, sql: literal};
    }
    const empty = `${conName}.sql("SELECT 0 as z")`;
    function arraySelectVal(...val: Number[]): string {
      const literal: ArrayLiteralNode = {
        node: 'arrayLiteral',
        typeDef: {
          type: 'array',
          elementTypeDef: {type: 'number'},
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
    const canReadCompoundSchema = runtime.dialect.compoundObjectInSchema;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const ab = recordSelectVal({a: 0, b: 1});

    const malloySizes = 'sizes is {s is 0, m is 1, l is 2, xl is 3}';
    const sizesObj = {s: 0, m: 1, l: 2, xl: 3};
    const sizesSQL = recordSelectVal(sizesObj);
    // Keeping the pipeline simpler makes debugging easier, so don't add
    // and extra stage unless you have to
    const sizes = canReadCompoundSchema
      ? `${conName}.sql(""" SELECT ${sizesSQL} AS ${quote('sizes')} """)`
      : `${conName}.sql('SELECT 0 AS O') -> { select: ${malloySizes}}`;
    const evensObj = [2, 4, 6, 8];
    const evensSQL = arraySelectVal(...evensObj);
    const evens = `${conName}.sql("""
      SELECT ${evensSQL} AS ${quote('evens')}
    """)`;

    describe('simple arrays', () => {
      test('array literal dialect function', async () => {
        await expect(`
          run: ${evens}`).malloyResultMatches(runtime, {
          evens: evensObj,
        });
      });
      test('select array', async () => {
        await expect(`
          # test.verbose
          run: ${evens}->{select: nn is evens}
          `).malloyResultMatches(runtime, {nn: evensObj});
      });
      test.when(canReadCompoundSchema)(
        'schema read allows array-un-nest on each',
        async () => {
          await expect(`
          run: ${evens}->{ select: n is evens.each }
        `).malloyResultMatches(
            runtime,
            evensObj.map(n => ({n}))
          );
        }
      );
      test('array can be passed to !function', async () => {
        // Used as a standin for "unknown function user might call"
        const nameOfArrayLenFunction = {
          'duckdb': 'LEN',
          'standardsql': 'ARRAY_LENGTH',
          'postgres': 'JSONB_ARRAY_LENGTH',
          'presto': 'CARDINALITY',
          'trino': 'CARDINALITY',
          'mysql': 'JSON_LENGTH',
          'snowflake': 'ARRAY_SIZE',
        };
        const dialect = runtime.dialect.name;
        const missing = `Dialect '${dialect}' missing array length function in nameOfArrayLenFunction`;
        const fn = nameOfArrayLenFunction[dialect] ?? missing;
        expect(fn).not.toEqual(missing);
        await expect(
          `run: ${evens}->{ select: nby2 is ${fn}!number(evens); } `
        ).malloyResultMatches(runtime, {nby2: evensObj.length});
      });
      test('array.each in source', async () => {
        await expect(`
          run: ${empty}
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
          run: ${empty} -> {
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
          run: ${empty} extend {
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
      // can't use special chars in column names in bq
      test.when(conName !== 'bigquery')(
        'array stored field with special chars in name',
        async () => {
          const special_chars = ["'", '"', '.', '`'];
          for (const c of special_chars) {
            const qname = '`_\\' + c + '_`';
            const malloySrc = `
            # test.verbose
            run: ${empty}
            ->{ select: ${qname} is [1]}
            -> { select: num is ${qname}.each }`;
            await expect(malloySrc).malloyResultMatches(runtime, {});
            const result = await runtime.loadQuery(malloySrc).run();
            const ok =
              result.data.path(0, 'num').value === 1
                ? 'ok'
                : `Array containing ${c} character is not ok`;
            expect(ok).toEqual('ok');
          }
        }
      );
      test.when(supportsNestedArrays && canReadCompoundSchema)(
        'Can read schema for array of arrays',
        async () => {
          // a lot of work to make [[1],[2]] on all dialects
          const aLit: ArrayLiteralNode = {
            node: 'arrayLiteral',
            typeDef: {type: 'array', elementTypeDef: {type: 'number'}},
            kids: {values: []},
          };
          const aOne = {...aLit};
          aOne.kids.values[0] = {node: 'numberLiteral', literal: '1', sql: '1'};
          aOne.sql = runtime.dialect.sqlLiteralArray(aOne);
          const aTwo = {...aLit, sql: '2'};
          aTwo.kids.values[0] = {node: 'numberLiteral', literal: '2', sql: '2'};
          aTwo.sql = runtime.dialect.sqlLiteralArray(aTwo);
          const aoa: ArrayLiteralNode = {
            node: 'arrayLiteral',
            typeDef: {type: 'array', elementTypeDef: aLit.typeDef},
            kids: {values: [aOne, aTwo]},
          };
          const sql_aoa = runtime.dialect.sqlLiteralArray(aoa);
          const asStruct: SQLSourceRequest = {
            connection: conName,
            selectStr: `SELECT ${sql_aoa} AS aoa`,
          };
          const ret = await runtime.connection.fetchSchemaForSQLStruct(
            asStruct,
            {}
          );
          expect(ret.structDef).toBeDefined();
          const aoa_ent = ret.structDef!.fields[0];
          expect(aoa_ent).toMatchObject(aoa.typeDef);
        }
      );
      test.when(supportsNestedArrays)('bare array of array', async () => {
        await expect(`
          run: ${empty} -> { select: aoa is [[1,2]] }
        `).malloyResultMatches(runtime, {aoa: [[1, 2]]});
      });
      test.when(supportsNestedArrays)('each.each array of array', async () => {
        await expect(`
          run: ${empty} extend { dimension: aoa is [[1,2]] } -> { select: aoa.each.each }
        `).malloyResultMatches(runtime, [{each: 1}, {each: 2}]);
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
      test('record literal object', async () => {
        await expect(`
          run: ${conName}.sql("select 0 as o")
          -> { select: ${malloySizes}}
        `).malloyResultMatches(runtime, rec_eq());
      });
      // can't use special chars in column names in bq
      test.when(conName !== 'bigquery')(
        'special character in record property name',
        async () => {
          const special_chars = ["'", '"', '.', '`'];
          for (const c of special_chars) {
            const qname = '_\\' + c + '_';
            const name = '_' + c + '_';
            const malloySrc = `run: ${empty} -> { select: \`${qname}\` is 'ok' }`;
            // no malloyResultMatches because it treats a special in an expect key
            const query = runtime.loadQuery(malloySrc);
            const result = await query.run();
            const p =
              result.data.path(0, name).value === 'ok'
                ? 'ok'
                : `Name containing the ${c} character was not ok`;
            expect(p).toEqual('ok');
          }
        }
      );
      // can't use special chars in column names in bq
      test.when(conName !== 'bigquery')(
        'record stored in field with special chars in name',
        async () => {
          const special_chars = ["'", '"', '.', '`'];
          for (const c of special_chars) {
            const qname = '`_\\' + c + '_`';
            const malloySrc = `
            run: ${empty}
            ->{ select: ${qname} is {rnum is 1}}
            -> { select: num is ${qname}.rnum }`;
            const result = await runtime.loadQuery(malloySrc).run();
            const ok =
              result.data.path(0, 'num').value === 1
                ? 'ok'
                : `Array containing ${c} character is not ok`;
            expect(ok).toEqual('ok');
          }
        }
      );
      test.when(canReadCompoundSchema)(
        'can read schema of record object',
        async () => {
          await expect(`run: ${conName}.sql("""
          SELECT ${sizesSQL} AS ${quote('sizes')}
        """)`).malloyResultMatches(runtime, rec_eq());
        }
      );
      test('simple record.property access', async () => {
        await expect(`
          run: ${sizes} -> { select: small is sizes.s }`).malloyResultMatches(
          runtime,
          {small: 0}
        );
      });
      test('nested data looks like a record', async () => {
        await expect(`
          run: ${conName}.sql('SELECT 1 as ${quote('o')}') -> {
            group_by: row is 'one_row'
            nest: sizes is {
              aggregate:
                s is sum(o) - 1,
                m is sum(o),
                x is sum(o) + 1,
                xl is sum(o) + 2
            }
          } -> { select: small is sizes.s }`).malloyResultMatches(runtime, {
          small: 0,
        });
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
          run: ${empty} -> {
            extend: { dimension: ${malloySizes} }
            select: sizes
          }
        `).malloyResultMatches(runtime, rec_eq());
      });
      test('computed record.property from a source', async () => {
        await expect(`
          run: ${empty}
            extend { dimension: record is {s is 0, m is 1, l is 2, xl is 3} }
            -> { select: small is record.s }
        `).malloyResultMatches(runtime, {small: 0});
      });
      test('record.property from an extend block', async () => {
        await expect(`
          run: ${empty} -> {
            extend: { dimension: record is {s is 0, m is 1, l is 2, xl is 3} }
            select: small is record.s
          }
        `).malloyResultMatches(runtime, {small: 0});
      });
      test('simple each on array property inside record', async () => {
        await expect(`
          run: ${empty} -> { select: nums is { odds is [1,3], evens is [2,4]} }
          -> { select: odd is nums.odds.value }
        `).malloyResultMatches(runtime, [{odd: 1}, {odd: 3}]);
      });
      test('each on array property inside record from source', async () => {
        await expect(`
          run: ${empty} extend { dimension: nums is { odds is [1,3], evens is [2,4]} }
          -> { select: odd is nums.odds.each }
        `).malloyResultMatches(runtime, [{odd: 1}, {odd: 3}]);
      });
      const abc = "rec is {a is 'a', bc is {b is 'b', c is 'c'}}";
      test('record with a record property', async () => {
        await expect(`
          run: ${empty} -> { select: ${abc} }
          -> { select: rec.a, rec.bc.b, rec.bc.c }
        `).malloyResultMatches(runtime, {a: 'a', b: 'b', c: 'c'});
      });
      test('record in source with a record property', async () => {
        await expect(`
          run: ${empty} extend { dimension: ${abc} }
          -> { select: rec.a, rec.bc.b, rec.bc.c }
        `).malloyResultMatches(runtime, {a: 'a', b: 'b', c: 'c'});
      });
      test('record dref in source with a record property', async () => {
        await expect(`
          run: ${empty} extend { dimension: ${abc} }
          -> { select: b is pick rec.bc.b when true else 'b' }
        `).malloyResultMatches(runtime, {b: 'b'});
      });
      test.todo('array or record where first entries are null');
    });
    describe('repeated record', () => {
      const abType: ArrayTypeDef = {
        type: 'array',
        elementTypeDef: {type: 'record_element'},
        fields: [
          {name: 'a', type: 'number'},
          {name: 'b', type: 'number'},
        ],
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
      const abMalloy = '[{a is 10, b is 11}, {a is 20, b is 21}]';
      function selectAB(n: string) {
        return `SELECT ${ab} AS ${quote(n)}`;
      }

      test('repeated record from nest', async () => {
        await expect(`
            run: ${conName}.sql("""
              SELECT
                10 as ${quote('a')},
                11 as ${quote('b')}
              UNION ALL SELECT 20 , 21
            """) -> { nest: ab is { select: a, b } }
                 -> { select: ab.a, ab.b ; order_by: a}
        `).malloyResultMatches(runtime, ab_eq);
      });
      test('select repeated record from literal dialect functions', async () => {
        await expect(`
          run: ${conName}.sql(""" ${selectAB('ab')} """)
        `).malloyResultMatches(runtime, {ab: ab_eq});
      });
      test('repeat record from malloy literal', async () => {
        await expect(`
          run: ${empty}
          -> { select: ab is ${abMalloy} }
        `).malloyResultMatches(runtime, {ab: ab_eq});
      });
      test('repeated record can be selected and renamed', async () => {
        const src = `
          run: ${conName}.sql("""
            ${selectAB('sqlAB')}
          """) -> { select: ab is sqlAB }
      `;
        await expect(src).malloyResultMatches(runtime, {ab: ab_eq});
      });
      test('select repeated record passed down pipeline', async () => {
        await expect(`
          run: ${empty}
          -> { select: pipeAb is ${abMalloy} }
          -> { select: ab is pipeAb }
        `).malloyResultMatches(runtime, {ab: ab_eq});
      });
      test('deref repeat record passed down pipeline', async () => {
        await expect(`
          run: ${empty}
          -> { select: pipeAb is ${abMalloy} }
          -> { select: pipeAb.a, pipeAb.b }
        `).malloyResultMatches(runtime, ab_eq);
      });
      test('select array of records from source', async () => {
        await expect(`
          run: ${empty}
          extend { dimension: abSrc is ${abMalloy} }
          -> { select: ab is abSrc }
        `).malloyResultMatches(runtime, {ab: ab_eq});
      });
      test('deref array of records from source', async () => {
        await expect(`
          run: ${empty}
          extend { dimension: ab is ${abMalloy} }
          -> { select: ab.a, ab.b }
        `).malloyResultMatches(runtime, ab_eq);
      });
      test('repeated record in source wth record property', async () => {
        await expect(`
          run: ${empty} extend { dimension: rec is [ {bc is  {b is 'b'}} ] }
          -> { select: rec.bc.b }
        `).malloyResultMatches(runtime, {b: 'b'});
      });
      test('piped repeated record containing an array', async () => {
        await expect(`
          run: ${empty} -> {
            select: rrec is [
              { val is 1, names is ['uno', 'one'] },
              { val is 2, names is ['due', 'two'] }
            ]
          } -> {
            select: val is rrec.val, name is rrec.names.each
            order_by: val desc, name asc
          }
        `).malloyResultMatches(runtime, [
          {val: 2, name: 'due'},
          {val: 2, name: 'two'},
          {val: 1, name: 'one'},
          {val: 1, name: 'uno'},
        ]);
      });
      test('source repeated record containing an array', async () => {
        await expect(`
          run: ${empty} extend {
            dimension: rrec is [
              { val is 1, names is ['uno', 'one'] },
              { val is 2, names is ['due', 'two'] }
            ]
          } -> {
            select: val is rrec.val, name is rrec.names.each
            order_by: val desc, name asc
          }
        `).malloyResultMatches(runtime, [
          {val: 2, name: 'due'},
          {val: 2, name: 'two'},
          {val: 1, name: 'one'},
          {val: 1, name: 'uno'},
        ]);
      });
    });
  }
);

afterAll(async () => {
  await runtimes.closeAll();
});
