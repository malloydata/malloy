/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import {runQuery, wrapTestModel} from '@malloydata/malloy/test';
import '@malloydata/malloy/test/matchers';
import {Dialect} from '@malloydata/malloy';

afterAll(() => testDatabase.shutdown());

const testModel = testDatabase.runtime.loadModel('');

describe('limits', () => {
  test('limit only', async () => {
    const {data} = await runQuery(
      testModel,
      `
        run: db.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: c is count()
          limit: 3
        }
        `
    );
    expect(data.length).toBe(3);
  });

  test('limit select - in pipeline', async () => {
    const {data} = await runQuery(
      testModel,
      `
        run: db.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: c is count()
          having: c % 2 = 1
          limit: 100
          nest: one is {
            group_by: state
            limit: 2
          }
        } -> {
          select: popular_name
          limit: 2
        }
        `
    );
    expect(data.length).toBe(2);
  });
});

it('limit - provided', async () => {
  // a cross join produces a Many to Many result.
  // symmetric aggregate are needed on both sides of the join
  // Check the row count and that sums on each side work properly.
  const result = await testDatabase.runtime
    .loadQuery(
      `
      run: db.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: c is count()
        limit: 3
      }
      `
    )
    .run();
  expect(result.resultExplore.limit).toBe(3);
});

it('limit - not provided', async () => {
  // a cross join produces a Many to Many result.
  // symmetric aggregate are needed on both sides of the join
  // Check the row count and that sums on each side work properly.
  const result = await testDatabase.runtime
    .loadQuery(
      `run: db.table('malloytest.state_facts') -> {
          group_by: state
          aggregate: c is count()
        }`
    )
    .run();
  expect(result.resultExplore.limit).toBe(undefined);
});

it('removes surpuflous order_by - solo aggregates', async () => {
  const result = await testDatabase.runtime
    .loadQuery(
      `
      run: db.table('malloytest.state_facts') -> {
        aggregate: airport_count.sum()
      }
      `
    )
    .run();
  expect(result.sql).not.toContain('ORDER BY');
});

it('removes surpuflous order_by - pipeline', async () => {
  const result = await testDatabase.runtime
    .loadQuery(
      `
      run: db.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: airport_count.sum()
        order_by: state desc
      }
      -> {
        aggregate: airport_count.sum()
      }
      `
    )
    .run();
  expect(result.sql).not.toContain('ORDER BY');
});

it('removes surpuflous order_by - joined_query', async () => {
  const result = await testDatabase.runtime
    .loadQuery(
      `
      query: foo is  db.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: airport_count.sum()
        order_by: state desc
      }

      run: db.table('malloytest.state_facts') -> {
        extend: {
          join_one: foo on state = foo.state
        }
        aggregate: x is foo.airport_count.sum()
      }
      `
    )
    .run();
  expect(result.sql).not.toContain('ORDER BY');
});

it('removes surpuflous order_by - joined_query pipeline', async () => {
  const result = await testDatabase.runtime
    .loadQuery(
      `
      query: foo is  db.table('malloytest.state_facts') -> {
        group_by: state
        aggregate: airport_count.sum()
        order_by: state desc
      } -> {
        group_by: state
        aggregate: airport_count.sum()
        order_by: state desc
      }

      run: db.table('malloytest.state_facts') -> {
        extend: {
          join_one: foo on state = foo.state
        }
        aggregate: x is foo.airport_count.sum()
      }
      `
    )
    .run();
  expect(result.sql).not.toContain('ORDER BY');
});

const orderByModel = wrapTestModel(
  testDatabase,
  `
    source: models is db.table('malloytest.aircraft_models') extend {
      measure: model_count is count()
    }`
);

// There's a problem with null ordering in MySQL which we are ignoring for now
const testNullOrdering = testDatabase.name !== 'mysql';
const testTimes =
  testNullOrdering && !['presto', 'trino'].includes(testDatabase.name);
describe('null ordering', () => {
  const q = (x: TemplateStringsArray) =>
    testDatabase.dialect.sqlQuoteIdentifier(x.toString());
  const a = testDatabase.dialect.sqlLiteralString('a');
  const b = testDatabase.dialect.sqlLiteralString('b');
  const c = testDatabase.dialect.sqlLiteralString('c');
  const abc = `db.sql("""
      SELECT ${a} as ${q`l`}, 'a' as ${q`ln`}
      UNION ALL SELECT ${c}, 'c'
      UNION ALL SELECT ${b}, 'b'
      UNION ALL SELECT NULL, 'null'
    """)`;
  test.when(testNullOrdering)(
    'null last in select string with ascending order',
    async () => {
      await expect(`run: ${abc} -> { select: *; order_by: l asc }`).toMatchRows(
        orderByModel,
        [{ln: 'a'}, {ln: 'b'}, {ln: 'c'}, {ln: 'null'}]
      );
    }
  );
  test.when(testNullOrdering)(
    'null last in select string with descending order',
    async () => {
      await expect(
        `run: ${abc} -> { select: *; order_by: l desc }`
      ).toMatchRows(orderByModel, [
        {ln: 'c'},
        {ln: 'b'},
        {ln: 'a'},
        {ln: 'null'},
      ]);
    }
  );
  test.when(testNullOrdering)(
    'null last in reduce string with default ascending order',
    async () => {
      await expect(`
          #! test.verbose
          run: ${abc} -> { group_by: l }`).toMatchRows(orderByModel, [
        {l: 'a'},
        {l: 'b'},
        {l: 'c'},
        {l: null},
      ]);
    }
  );
  const nums = `db.sql("""
      SELECT 1 as ${q`n`}
      UNION ALL SELECT 9
      UNION ALL SELECT 5
      UNION ALL SELECT NULL
      """)`;
  test.when(testNullOrdering)(
    'null last in numbers with ascending order',
    async () => {
      await expect(
        `run: ${nums} -> { select: n; order_by: n asc }`
      ).toMatchRows(orderByModel, [{n: 1}, {n: 5}, {n: 9}, {n: null}]);
    }
  );
  test.when(testNullOrdering)(
    'null last in numbers with descending order',
    async () => {
      await expect(
        `run: ${nums} -> { select: n; order_by: n desc }`
      ).toMatchRows(orderByModel, [{n: 9}, {n: 5}, {n: 1}, {n: null}]);
    }
  );
  test.when(testNullOrdering)(
    'null last in reduce measure with default descending order',
    async () => {
      await expect(`
          # test.verbose
          run: ${nums} -> {
            group_by: nstr is n ? pick 'null' when is null else concat('number', n::string)
            aggregate: nTotal is n.sum()
          }`).toMatchRows(orderByModel, [
        {nstr: 'number9'},
        {nstr: 'number5'},
        {nstr: 'number1'},
        {nstr: 'null'},
      ]);
    }
  );
  const y2020Node = Dialect.makeTimeLiteralNode(
    testDatabase.dialect,
    '2020-01-01 00:00:00',
    undefined,
    undefined,
    'timestamp'
  );
  const y2020 = testDatabase.dialect.exprToSQL({}, y2020Node) || '';
  const d2020 = '2020-01-01T00:00:00.000Z';
  const d2022 = '2022-01-01T00:00:00.000Z';
  const d2025 = '2025-01-01T00:00:00.000Z';
  const y2025Node = Dialect.makeTimeLiteralNode(
    testDatabase.dialect,
    '2025-01-01 00:00:00',
    undefined,
    undefined,
    'timestamp'
  );
  const y2025 = testDatabase.dialect.exprToSQL({}, y2025Node) || '';
  const y2022Node = Dialect.makeTimeLiteralNode(
    testDatabase.dialect,
    '2022-01-01 00:00:00',
    undefined,
    undefined,
    'timestamp'
  );
  const y2022 = testDatabase.dialect.exprToSQL({}, y2022Node) || '';
  const times = `db.sql("""
      SELECT ${y2020} as ${q`t`}
      UNION ALL SELECT ${y2025}
      UNION ALL SELECT ${y2022}
      UNION ALL SELECT NULL
    """)`;
  test.when(testTimes)(
    'null last in timestamps with ascending order',
    async () => {
      await expect(
        `run: ${times} -> { select: t; order_by: t asc }`
      ).toMatchRows(orderByModel, [
        {t: d2020},
        {t: d2022},
        {t: d2025},
        {t: null},
      ]);
    }
  );
  test.when(testTimes)(
    'null last in timestamps with descending order',
    async () => {
      await expect(
        `run: ${times} -> { select: t; order_by: t desc }`
      ).toMatchRows(orderByModel, [
        {t: d2025},
        {t: d2022},
        {t: d2020},
        {t: null},
      ]);
    }
  );
  test.when(testTimes)(
    'null last in reduce timestamps with default descending order',
    async () => {
      await expect(`run: ${times} -> { group_by: t }`).toMatchRows(
        orderByModel,
        [{t: d2025}, {t: d2022}, {t: d2020}, {t: null}]
      );
    }
  );
});
