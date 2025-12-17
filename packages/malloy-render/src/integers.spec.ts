/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {RuntimeList, allDatabases} from '../../../test/src/runtimes';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import '../../../test/src/util/db-jest-matchers';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {databasesFromEnvironmentOr} from '../../../test/src/util';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {TestSelect} from '../../../test/src/test-select';
import {getDataTree} from './data_tree';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

describe.each(runtimes.runtimeList)(
  '%s: integer cell types in dataTree',
  (databaseName, runtime) => {
    const limits = runtime.dialect.integerTypeLimits;
    const ts = new TestSelect(runtime.dialect);

    // Test integer type produces NumberCell with JS number
    it('integer type produces NumberCell', async () => {
      const sql = ts.generate({val: ts.mk_int(42)});
      const result = await runtime
        .loadQuery(`run: ${databaseName}.sql("""${sql}""")`)
        .run();
      const tree = getDataTree(result);
      const row = tree.rows[0];
      const cell = row.cells[0];

      expect(cell.isNumber()).toBe(true);
      expect(cell.isBigNumber()).toBe(false);
      expect(cell.value).toBe(42);
      expect(typeof cell.value).toBe('number');
    });

    // Test bigint type with value > MAX_SAFE_INTEGER produces BigNumberCell
    if (limits.bigint !== null) {
      it('bigint type with large value produces BigNumberCell', async () => {
        // 2^53 + 1 = 9007199254740993 (just over MAX_SAFE_INTEGER)
        const largeValue = '9007199254740993';
        const sql = ts.generate({val: ts.mk_bigint(largeValue)});
        const result = await runtime
          .loadQuery(`run: ${databaseName}.sql("""${sql}""")`)
          .run();
        const tree = getDataTree(result);
        const row = tree.rows[0];
        const cell = row.cells[0];

        expect(cell.isBigNumber()).toBe(true);
        expect(cell.isNumber()).toBe(false);
        expect(cell.value).toBe(largeValue);
        expect(typeof cell.value).toBe('string');
      });

      it('bigint type with huge value produces BigNumberCell', async () => {
        // 2^126 = 85070591730234615865843651857942052864 (only DuckDB HUGEINT can hold this)
        const hugeValue = '85070591730234615865843651857942052864';
        const sql = ts.generate({val: ts.mk_bigint(hugeValue)});
        const result = await runtime
          .loadQuery(`run: ${databaseName}.sql("""${sql}""")`)
          .run();
        const tree = getDataTree(result);
        const row = tree.rows[0];
        const cell = row.cells[0];

        expect(cell.isBigNumber()).toBe(true);
        expect(cell.isNumber()).toBe(false);
        expect(cell.value).toBe(hugeValue);
        expect(typeof cell.value).toBe('string');
      });

      it('bigint type with small value still produces BigNumberCell', async () => {
        const sql = ts.generate({val: ts.mk_bigint(100)});
        const result = await runtime
          .loadQuery(`run: ${databaseName}.sql("""${sql}""")`)
          .run();
        const tree = getDataTree(result);
        const row = tree.rows[0];
        const cell = row.cells[0];

        // bigint type always produces BigNumberCell regardless of value size
        expect(cell.isBigNumber()).toBe(true);
        expect(cell.value).toBe('100');
      });
    }
  }
);

afterAll(async () => {
  await runtimes.closeAll();
});
