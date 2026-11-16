/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Dialect} from '@malloydata/malloy';
import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

// A row of the source being summed: its key, and its value as the digits of
// a number, or undefined for NULL. A join which repeats a row is a key which
// appears more than once.
type Row = [key: number, value: string | undefined];

const TOP_VALUE = '9'.repeat(29) + '.99999999';

// These run the SQL of the shifty sum on its own, and compare its result with
// the expected one inside the database. A result which has come through a
// query, a DOUBLE and a driver no longer shows whether every digit is right.
describe.each(runtimes.runtimeList)('%s', (_databaseName, runtime) => {
  const byHash = runtime.dialect.sumDistinctByHash;
  const shifty = byHash?.form === 'shifty';
  const roundsWideProducts =
    byHash?.form === 'shifty' && byHash.roundsWideProducts;

  // The dialect without the cast to its result type, which would round away
  // the digits these tests compare.
  const exact: Dialect = Object.create(runtime.dialect);
  if (byHash) {
    exact.sumDistinctByHash = {...byHash, resultType: undefined};
  }

  async function shiftySum(
    funcName: 'SUM' | 'AVG',
    valueType: string,
    rows: Row[],
    expected: string | undefined,
    where = ''
  ) {
    const source = rows
      .map(
        ([key, value]) =>
          `SELECT ${key} AS k, CAST(${
            value === undefined ? 'NULL' : `'${value}'`
          } AS ${valueType}) AS v`
      )
      .join(' UNION ALL ');
    const sum = exact.sqlSumDistinct('t.k', 't.v', funcName);
    const matches =
      expected === undefined
        ? `(${sum}) IS NULL`
        : `(${sum}) = CAST('${expected}' AS DECIMAL(38,8))`;
    const result = await runtime.connection.runSQL(
      `SELECT ${matches} AS matches FROM (${source}) t ${where}`
    );
    return Object.values(result.rows[0])[0];
  }

  test.when(shifty)(
    'folds the rows a join repeated, and no others',
    async () => {
      const rows: Row[] = [
        [1, '5'],
        [1, '5'],
        [1, '5'],
        [2, '5'],
        [3, '7'],
      ];
      expect(await shiftySum('SUM', 'INTEGER', rows, '17')).toBe(true);
    }
  );

  test.when(shifty)('sums the ends of a 32 bit integer', async () => {
    const rows: Row[] = [
      [1, '2147483647'],
      [1, '2147483647'],
      [2, '-2147483648'],
      [3, '474'],
    ];
    expect(await shiftySum('SUM', 'INTEGER', rows, '473')).toBe(true);
  });

  test.when(shifty)('sums the ends of a 64 bit integer', async () => {
    const rows: Row[] = [
      [1, '9223372036854775807'],
      [1, '9223372036854775807'],
      [2, '9223372036854775807'],
      [3, '-9223372036854775807'],
      [4, '1'],
    ];
    expect(await shiftySum('SUM', 'BIGINT', rows, '9223372036854775808')).toBe(
      true
    );
  });

  test.when(shifty)(
    'rounds each value at its ninth fractional digit',
    async () => {
      const rows: Row[] = [
        [1, '0.000000005'],
        [2, '0.000000014'],
        [3, '-0.000000015'],
        [4, '0.000000004'],
        [5, '0.999999995'],
        [6, '-2.5'],
        [6, '-2.5'],
        [7, '2.5'],
        [8, '0.12345678'],
      ];
      expect(await shiftySum('SUM', 'DECIMAL(20,9)', rows, '1.12345678')).toBe(
        true
      );
    }
  );

  test.when(shifty)('sums a double as its nearest eight digits', async () => {
    const rows: Row[] = [
      [1, '0.1'],
      [1, '0.1'],
      [2, '0.2'],
      [3, '-1.00000001'],
    ];
    expect(await shiftySum('SUM', 'DOUBLE', rows, '-0.70000001')).toBe(true);
  });

  test.when(shifty)('sums the largest value, of either sign', async () => {
    const rows: Row[] = [
      [1, TOP_VALUE],
      [1, TOP_VALUE],
      [2, `-${TOP_VALUE}`],
      [3, '0.00000001'],
    ];
    expect(await shiftySum('SUM', 'DECIMAL(37,8)', rows, '0.00000001')).toBe(
      true
    );
  });

  test.when(shifty)('fails on a value of 10^29', async () => {
    const rows: Row[] = [[1, '1' + '0'.repeat(29)]];
    await expect(
      shiftySum('SUM', 'DECIMAL(38,0)', rows, undefined)
    ).rejects.toThrow();
  });

  // Nine of the largest value: a tenth would pass 10^38 once shifted.
  test.when(shifty && !roundsWideProducts)(
    'sums as far as 38 digits reach',
    async () => {
      const rows: Row[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(key => [
        key,
        TOP_VALUE,
      ]);
      expect(
        await shiftySum(
          'SUM',
          'DECIMAL(37,8)',
          rows,
          '8' + '9'.repeat(29) + '.99999991'
        )
      ).toBe(true);
    }
  );

  // Twenty, because Snowflake sums a little past 38 digits before it fails.
  test.when(shifty)(
    'fails when the shifted values are more than the engine can sum',
    async () => {
      const rows: Row[] = [];
      for (let key = 1; key <= 20; key++) {
        rows.push([key, TOP_VALUE]);
      }
      await expect(
        shiftySum('SUM', 'DECIMAL(37,8)', rows, undefined)
      ).rejects.toThrow();
    }
  );

  test.when(roundsWideProducts)(
    'sums to just below 10^27 where a wide product is rounded',
    async () => {
      const top = '9'.repeat(27) + '.99999999';
      const rows: Row[] = [
        [1, top],
        [1, top],
      ];
      expect(await shiftySum('SUM', 'DECIMAL(37,8)', rows, top)).toBe(true);
    }
  );

  test.when(roundsWideProducts)(
    'fails on a sum of 10^27 where a wide product is rounded',
    async () => {
      const half = '5' + '0'.repeat(26);
      const rows: Row[] = [
        [1, half],
        [2, half],
      ];
      await expect(
        shiftySum('SUM', 'DECIMAL(38,0)', rows, undefined)
      ).rejects.toThrow();
    }
  );

  test.when(shifty)('counts a NULL value as zero', async () => {
    const rows: Row[] = [
      [1, undefined],
      [2, '3'],
      [2, '3'],
    ];
    expect(await shiftySum('SUM', 'INTEGER', rows, '3')).toBe(true);
  });

  test.when(shifty)('is NULL when there are no rows', async () => {
    const rows: Row[] = [[1, '3']];
    expect(
      await shiftySum('SUM', 'INTEGER', rows, undefined, 'WHERE t.k < 0')
    ).toBe(true);
  });

  test.when(shifty)(
    'averages over the rows whose value is not NULL',
    async () => {
      const rows: Row[] = [
        [1, '1'],
        [1, '1'],
        [2, '2'],
        [3, undefined],
      ];
      expect(await shiftySum('AVG', 'INTEGER', rows, '1.5')).toBe(true);
    }
  );

  test.when(shifty)('keeps thirty rows apart', async () => {
    const rows: Row[] = [];
    for (let key = 1; key <= 30; key++) {
      rows.push([key, '7'], [key, '7']);
    }
    expect(await shiftySum('SUM', 'INTEGER', rows, '210')).toBe(true);
  });
});
