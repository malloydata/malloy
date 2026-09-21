/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const [describe] = describeIfDatabaseAvailable(['sqlserver']);

/*
 * The dialect is built up here in the order a query grows: a literal, a
 * table, a filter, an ordering, a grouping, a join. Each block is what the
 * next one stands on, and what the cross-dialect suite in ../all assumes.
 */
describe('SQL Server', () => {
  const runtimes = new RuntimeList(['sqlserver']);
  const runtime = runtimes.runtimeMap.get('sqlserver');
  if (runtime === undefined) {
    throw new Error("Couldn't build runtime");
  }
  // A test runtime enables experimental dialects; no compiler flag is needed
  const tm = wrapTestModel(runtime, '');

  afterAll(async () => {
    await runtimes.closeAll();
  });

  describe('a SQL block', () => {
    test('selects a literal', async () => {
      await expect(
        'run: sqlserver.sql("SELECT 1 AS n") -> { select: n }'
      ).toMatchResult(tm, {n: 1});
    });

    test('carries string, date and timestamp values', async () => {
      await expect(`
        run: sqlserver.sql("""
          SELECT N'héllo' AS s,
                 CAST('2021-02-24' AS DATE) AS d,
                 CAST('2021-02-24 03:05:06' AS DATETIME2) AS t
        """) -> { select: s, d, t }
      `).toMatchResult(tm, {
        s: 'héllo',
        d: new Date('2021-02-24T00:00:00Z'),
        t: new Date('2021-02-24T03:05:06Z'),
      });
    });

    test('quotes a field named like a keyword', async () => {
      await expect(`
        run: sqlserver.sql('SELECT 1 AS "select"') -> {
          select: \`select\`, \`create\` is \`select\` + 1
        }
      `).toMatchResult(tm, {select: 1, create: 2});
    });
  });

  describe('a table', () => {
    test('reads a column', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') -> {
          select: state
          where: state = 'CA'
        }
      `).toEqualResult(tm, [{state: 'CA'}]);
    });

    test('reads a bracket-quoted path', async () => {
      await expect(`
        run: sqlserver.table('[malloytest].[state_facts]') -> {
          select: state
          where: state = 'CA'
        }
      `).toEqualResult(tm, [{state: 'CA'}]);
    });

    test('orders and limits', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') -> {
          select: state
          order_by: state desc
          limit: 2
        }
      `).toEqualResult(tm, [{state: 'WY'}, {state: 'WV'}]);
    });

    test('escapes a bracket in a LIKE pattern', async () => {
      await expect(`
        run: sqlserver.sql("""
          SELECT s FROM (VALUES (N'a[b'), (N'ab'), (N'axb')) v(s)
        """) -> { select: s; where: s ~ 'a[%' }
      `).toEqualResult(tm, [{s: 'a[b'}]);
    });
  });

  describe('aggregation', () => {
    test('counts without a group', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') -> {
          aggregate: state_count is count()
        }
      `).toMatchResult(tm, {state_count: 51});
    });

    test('groups by a column', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: state_count is count()
          order_by: state_count desc
        }
      `).toMatchResult(tm, {popular_name: 'Isabella'});
    });

    test('groups by an expression', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') -> {
          group_by: first is substr(state, 1, 1)
          aggregate: state_count is count()
          order_by: state_count desc, first
        }
      `).toMatchResult(tm, {first: 'M', state_count: 8});
    });

    test('divides as a float', async () => {
      await expect(`
        run: sqlserver.sql("SELECT 7 AS a, 2 AS b") -> {
          select: q is a / b
        }
      `).toMatchResult(tm, {q: 3.5});
    });
  });

  describe('booleans', () => {
    test('filters on a comparison', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') -> {
          aggregate: n is count()
          where: airport_count > 500
        }
      `).toMatchResult(tm, {n: 4});
    });

    test('selects a comparison as a value', async () => {
      await expect(`
        run: sqlserver.sql("SELECT 1 AS a, 2 AS b") -> {
          select: lt is a < b, gt is a > b
        }
      `).toMatchResult(tm, {lt: true, gt: false});
    });

    test('filters on a boolean dimension', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') extend {
          dimension: big is airport_count > 500
        } -> {
          aggregate: n is count()
          where: big
        }
      `).toMatchResult(tm, {n: 4});
    });

    test('not of null is true', async () => {
      await expect(`
        run: sqlserver.sql("SELECT CAST(NULL AS INT) AS x") -> {
          select: r is not (x > 1)
        }
      `).toMatchResult(tm, {r: true});
    });
  });

  describe('joins', () => {
    test('joins and aggregates symmetrically', async () => {
      await expect(`
        source: carriers is sqlserver.table('malloytest.carriers') extend {
          primary_key: code
        }
        source: flights is sqlserver.table('malloytest.flights') extend {
          join_one: carriers with carrier
        }
        run: flights -> {
          group_by: carriers.nickname
          aggregate: flight_count is count(), carrier_count is carriers.count()
          order_by: flight_count desc
        }
      `).toMatchResult(tm, {nickname: 'Southwest', carrier_count: 1});
    });
  });
});
