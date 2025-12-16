/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import '@malloydata/malloy/test/matchers';
import {databasesFromEnvironmentOr} from '../../util';
import {TestSelect} from '../../test-select';
import {wrapTestModel} from '@malloydata/malloy/test';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

describe.each(runtimes.runtimeList)('TestSelect for %s', (db, runtime) => {
  const ts = new TestSelect(runtime.dialect);
  const testModel = wrapTestModel(runtime, '');

  // Basic Type Tests
  test(`${db} inferred basic types`, async () => {
    const sql = ts.generate(
      {t_int: 1, t_string: 'a', t_bool: true, t_float: 1.5},
      {t_int: 2, t_string: 'b', t_bool: false, t_float: 2.5}
    );
    await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
      {t_int: 1, t_string: 'a', t_bool: true, t_float: 1.5},
      {t_int: 2, t_string: 'b', t_bool: false, t_float: 2.5},
    ]);
  });

  test(`${db} explicit type hints`, async () => {
    const sql = ts.generate({
      t_int: ts.mk_int(1),
      t_float: ts.mk_float(1.5),
      t_string: ts.mk_string('hello'),
      t_bool: ts.mk_bool(true),
    });
    await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
      {
        t_int: 1,
        t_float: 1.5,
        t_string: 'hello',
        t_bool: true,
      },
    ]);
  });

  test(`${db} NULL handling with typed nulls`, async () => {
    const sql = ts.generate({
      t_int: ts.mk_int(null),
      t_string: ts.mk_string(null),
      t_bool: ts.mk_bool(null),
      t_float: ts.mk_float(null),
    });
    await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
      {t_int: null, t_string: null, t_bool: null, t_float: null},
    ]);
  });

  test(`${db} mixed nulls and values`, async () => {
    const sql = ts.generate(
      {a: 1, b: ts.mk_int(null), c: 'hello'},
      {a: ts.mk_int(null), b: 2, c: 'world'},
      {a: 3, b: 4, c: ts.mk_string(null)}
    );
    await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
      {a: 1, b: null, c: 'hello'},
      {a: null, b: 2, c: 'world'},
      {a: 3, b: 4, c: null},
    ]);
  });

  // Cast Behavior Tests
  test(`${db} float casting`, async () => {
    const sql = ts.generate({
      f1: ts.mk_float(1.0),
      f2: ts.mk_float(2.5),
    });
    // Verify SQL contains CAST for floats
    expect(sql).toContain('CAST');
  });

  test(`${db} integer no unnecessary cast`, async () => {
    const sql = ts.generate({
      i1: ts.mk_int(1),
      i2: ts.mk_int(2),
    });
    // Check that integers don't get unnecessary CAST (only in column alias)
    const castCount = (sql.match(/CAST/g) || []).length;
    expect(castCount).toBe(0);
  });

  // Edge Cases
  test(`${db} single row`, async () => {
    const sql = ts.generate({a: 1, b: 'test'});
    await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
      {a: 1, b: 'test'},
    ]);
  });

  // Array Tests - Inferred
  test(`${db} inferred arrays`, async () => {
    const sql = ts.generate({
      string_array: ['a', 'b', 'c'],
      number_array: [1, 2, 3],
    });
    await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
      {string_array: ['a', 'b', 'c'], number_array: [1, 2, 3]},
    ]);
  });

  // Array Tests - Explicit mk_array
  test(`${db} explicit array creation with mk_array`, async () => {
    const sql = ts.generate({
      string_arr: ts.mk_array(['a', 'b', 'c']),
      number_arr: ts.mk_array([1, 2, 3]),
      typed_arr: ts.mk_array([ts.mk_int(1), ts.mk_int(2), ts.mk_int(3)]),
    });
    await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
      {
        string_arr: ['a', 'b', 'c'],
        number_arr: [1, 2, 3],
        typed_arr: [1, 2, 3],
      },
    ]);
  });

  // mysql and postgres don't have literal records that Malloy can read
  // so when reading a record, it will just see json
  const testRecords = db !== 'mysql' && db !== 'postgres';

  describe('tests involving records', () => {
    // Record Tests - Inferred
    test.when(testRecords)(`${db} simple inferred records`, async () => {
      const sql = ts.generate({
        person: {name: 'Alice', age: 30},
      });
      await expect(`run: ${db}.sql("""${sql}""")`).toMatchResult(testModel, {
        person: {name: 'Alice', age: 30},
      });
    });

    test.when(testRecords)(`${db} nested inferred records`, async () => {
      const sql = ts.generate({
        user: {
          name: 'Bob',
          address: {
            street: '123 Main',
            city: 'Boston',
          },
        },
      });
      await expect(`run: ${db}.sql("""${sql}""")`).toMatchResult(testModel, {
        user: {name: 'Bob', address: {street: '123 Main', city: 'Boston'}},
      });
    });

    // Record Tests - Explicit mk_record
    test.when(testRecords)(
      `${db} explicit record creation with mk_record`,
      async () => {
        const sql = ts.generate({
          person: ts.mk_record({
            name: ts.mk_string('Alice'),
            age: ts.mk_int(30),
            active: ts.mk_bool(true),
          }),
        });
        await expect(`run: ${db}.sql("""${sql}""")`).toMatchResult(testModel, {
          person: {name: 'Alice', age: 30, active: true},
        });
      }
    );

    test.when(testRecords)(`${db} nested records with mk_record`, async () => {
      const sql = ts.generate({
        user: ts.mk_record({
          name: ts.mk_string('Bob'),
          address: ts.mk_record({
            street: ts.mk_string('123 Main'),
            city: ts.mk_string('Boston'),
            zip: ts.mk_int(12345),
          }),
        }),
      });
      await expect(`run: ${db}.sql("""${sql}""")`).toMatchResult(testModel, {
        user: {
          name: 'Bob',
          address: {street: '123 Main', city: 'Boston', zip: 12345},
        },
      });
    });

    test.when(testRecords)(`${db} records with arrays`, async () => {
      const sql = ts.generate({
        data: {
          name: 'Test',
          values: [1, 2, 3],
        },
      });
      await expect(`run: ${db}.sql("""${sql}""")`).toMatchResult(testModel, {
        data: {name: 'Test', values: [1, 2, 3]},
      });
    });

    // Array of Records Tests - Inferred
    test.when(testRecords)(`${db} inferred repeated records`, async () => {
      const sql = ts.generate({
        items: [
          {sku: 'ABC', qty: 2},
          {sku: 'DEF', qty: 3},
        ],
      });
      await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
        {
          items: [
            {sku: 'ABC', qty: 2},
            {sku: 'DEF', qty: 3},
          ],
        },
      ]);
    });

    // Array of Records Tests - Explicit
    test.when(testRecords)(
      `${db} array of records with mk_array and mk_record`,
      async () => {
        const sql = ts.generate({
          items: ts.mk_array([
            ts.mk_record({sku: ts.mk_string('ABC'), qty: ts.mk_int(2)}),
            ts.mk_record({sku: ts.mk_string('DEF'), qty: ts.mk_int(3)}),
          ]),
        });
        await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
          {
            items: [
              {sku: 'ABC', qty: 2},
              {sku: 'DEF', qty: 3},
            ],
          },
        ]);
      }
    );
  });

  // Date/Time Tests
  test(`${db} date literals`, async () => {
    const sql = ts.generate({
      d1: ts.mk_date('2024-01-15'),
      d2: ts.mk_date('2024-12-31'),
    });
    await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
      {d1: new Date('2024-01-15'), d2: new Date('2024-12-31')},
    ]);
  });

  test.when(db !== 'presto' && db !== 'trino')(
    `${db} timestamp literals`,
    async () => {
      const sql = ts.generate({
        ts1: ts.mk_timestamp('2024-01-15 10:30:00'),
        ts2: ts.mk_timestamp('2024-12-31 23:59:59'),
      });
      await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
        {
          ts1: new Date('2024-01-15T10:30:00Z'),
          ts2: new Date('2024-12-31T23:59:59Z'),
        },
      ]);
    }
  );

  test(`${db} null dates and timestamps`, async () => {
    const sql = ts.generate({
      d: ts.mk_date(null),
      ts: ts.mk_timestamp(null),
    });
    await expect(`run: ${db}.sql("""${sql}""")`).toEqualResult(testModel, [
      {d: null, ts: null},
    ]);
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
