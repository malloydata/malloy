/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import {mkTestModel, TV} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

describe.each(runtimes.runtimeList)('New matchers for %s', (db, runtime) => {
  describe('mkTestModel and TV', () => {
    test('basic types with type inference', async () => {
      const tm = mkTestModel(runtime, {
        data: [
          {t_int: 1, t_string: 'a', t_bool: true},
          {t_int: 2, t_string: 'b', t_bool: false},
        ],
      });
      await expect('run: data -> { select: * }').toMatchResult(
        tm,
        {t_int: 1, t_string: 'a', t_bool: true},
        {t_int: 2, t_string: 'b', t_bool: false}
      );
    });

    test('floats need TV.float for explicit cast', async () => {
      const tm = mkTestModel(runtime, {
        data: [{f: TV.float(1.5)}],
      });
      await expect('run: data -> { select: * }').toMatchResult(tm, {f: 1.5});
    });

    test('NULL handling with typed nulls', async () => {
      const tm = mkTestModel(runtime, {
        data: [
          {
            t_int: TV.int(null),
            t_string: TV.string(null),
            t_bool: TV.bool(null),
            t_float: TV.float(null),
          },
        ],
      });
      await expect('run: data -> { select: * }').toMatchResult(tm, {
        t_int: null,
        t_string: null,
        t_bool: null,
        t_float: null,
      });
    });

    test('date literals need TV.date', async () => {
      const tm = mkTestModel(runtime, {
        data: [
          {
            d1: TV.date('2024-01-15'),
            d2: TV.date('2024-12-31'),
          },
        ],
      });
      // Schema-aware matching - plain date strings work for date fields
      await expect('run: data -> { select: * }').toMatchResult(tm, {
        d1: '2024-01-15',
        d2: '2024-12-31',
      });
    });

    test('arrays with type inference', async () => {
      const tm = mkTestModel(runtime, {
        data: [
          {
            string_array: ['a', 'b', 'c'],
            number_array: [1, 2, 3],
          },
        ],
      });
      await expect('run: data -> { select: * }').toMatchResult(tm, {
        string_array: ['a', 'b', 'c'],
        number_array: [1, 2, 3],
      });
    });
  });

  describe('toMatchResult (partial matching)', () => {
    test('passes with extra fields', async () => {
      const tm = mkTestModel(runtime, {
        data: [{id: 1, name: 'alice', extra: 'ignored'}],
      });
      // Only checking name, ignoring extra fields
      await expect('run: data -> { select: * }').toMatchResult(tm, {
        name: 'alice',
      });
    });

    test('empty match {} checks for at least one row', async () => {
      const tm = mkTestModel(runtime, {
        data: [{id: 1}],
      });
      await expect('run: data -> { select: * }').toMatchResult(tm, {});
    });

    test('variadic rows', async () => {
      const tm = mkTestModel(runtime, {
        data: [
          {id: 1, name: 'alice'},
          {id: 2, name: 'bob'},
          {id: 3, name: 'charlie'},
        ],
      });
      await expect('run: data -> { select: * }').toMatchResult(
        tm,
        {name: 'alice'},
        {name: 'bob'},
        {name: 'charlie'}
      );
    });
  });

  describe('toEqualResult (exact matching)', () => {
    test('exact field match', async () => {
      const tm = mkTestModel(runtime, {
        data: [{id: 1, name: 'alice'}],
      });
      // Select only name, expect exact match
      await expect('run: data -> { select: name }').toEqualResult(tm, [
        {name: 'alice'},
      ]);
    });

    test('exact row count', async () => {
      const tm = mkTestModel(runtime, {
        data: [
          {id: 1, name: 'alice'},
          {id: 2, name: 'bob'},
        ],
      });
      await expect('run: data -> { select: name }').toEqualResult(tm, [
        {name: 'alice'},
        {name: 'bob'},
      ]);
    });
  });

  describe('schema-aware type matching', () => {
    test('plain date strings work for date fields', async () => {
      const tm = mkTestModel(runtime, {
        data: [{d: TV.date('2024-01-15')}],
      });
      // Schema knows 'd' is a date field, so '2024-01-15' matches '2024-01-15T00:00:00.000Z'
      await expect('run: data -> { select: * }').toMatchResult(tm, {
        d: '2024-01-15',
      });
    });

    test('plain booleans work with dialect boolean handling', async () => {
      const tm = mkTestModel(runtime, {
        data: [{a: true, b: false}],
      });
      // Booleans are handled by dialect.resultBoolean() in the matcher
      await expect('run: data -> { select: * }').toMatchResult(tm, {
        a: true,
        b: false,
      });
    });
  });

  describe('test.debug tag', () => {
    test('# test.debug forces test to fail and shows data', async () => {
      const tm = mkTestModel(runtime, {
        data: [{n: 1}],
      });
      const query = 'run: data -> { select: * }';
      // Without debug tag, test passes
      await expect(query).toMatchResult(tm, {n: 1});
      // With debug tag, test fails even though data matches
      await expect('# test.debug\n' + query).not.toMatchResult(tm, {n: 1});
    });
  });

  describe.skip('error output format', () => {
    // These tests are skipped - they exist to show the error output format
    // Remove .skip to see the output

    test('too many results - got more rows than expected', async () => {
      const tm = mkTestModel(runtime, {
        data: [
          {id: 1, name: 'alice'},
          {id: 2, name: 'bob'},
          {id: 3, name: 'charlie'},
        ],
      });
      // Expect only 1 row but got 3
      await expect('run: data -> { select: * }').toMatchRows(tm, [
        {name: 'alice'},
      ]);
    });

    test('too few results - expected more rows than got', async () => {
      const tm = mkTestModel(runtime, {
        data: [{id: 1, name: 'alice'}],
      });
      // Expect 3 rows but only got 1
      await expect('run: data -> { select: * }').toMatchRows(tm, [
        {name: 'alice'},
        {name: 'bob'},
        {name: 'charlie'},
      ]);
    });
  });

  describe('multiple sources', () => {
    test('can define multiple sources in one model', async () => {
      const tm = mkTestModel(runtime, {
        users: [
          {id: 1, name: 'alice'},
          {id: 2, name: 'bob'},
        ],
        orders: [
          {user_id: 1, amount: TV.float(99.99)},
          {user_id: 2, amount: TV.float(49.99)},
        ],
      });

      await expect('run: users -> { select: * }').toMatchResult(
        tm,
        {name: 'alice'},
        {name: 'bob'}
      );

      await expect('run: orders -> { select: * }').toMatchResult(
        tm,
        {amount: 99.99},
        {amount: 49.99}
      );
    });
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
