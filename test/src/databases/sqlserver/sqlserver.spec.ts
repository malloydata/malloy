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

    test('carries a newline in a string literal', async () => {
      await expect(`
        run: sqlserver.sql("SELECT 1 AS n") -> { select: s is 'a\\nb' }
      `).toMatchResult(tm, {s: 'a\nb'});
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

    test('limits a stage that feeds another', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') -> {
          select: state
          order_by: state desc
          limit: 3
        } -> {
          select: state
          order_by: state asc
        }
      `).toEqualResult(tm, [{state: 'WI'}, {state: 'WV'}, {state: 'WY'}]);
    });

    test('sorts NULLs last in either direction', async () => {
      const nulls =
        'sqlserver.sql("SELECT n FROM (VALUES (1), (NULL), (3)) v(n)")';
      await expect(
        `run: ${nulls} -> { select: n; order_by: n asc }`
      ).toEqualResult(tm, [{n: 1}, {n: 3}, {n: null}]);
      await expect(
        `run: ${nulls} -> { select: n; order_by: n desc }`
      ).toEqualResult(tm, [{n: 3}, {n: 1}, {n: null}]);
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

    test('orders and limits a grouped result', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: state_count is count()
          order_by: state_count desc, popular_name
          limit: 2
        }
      `).toEqualResult(tm, [
        {popular_name: 'Isabella', state_count: 24},
        {popular_name: 'Sophia', state_count: 11},
      ]);
    });

    test('orders a query used as a source', async () => {
      await expect(`
        source: by_name is sqlserver.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: state_count is count()
          order_by: state_count desc
        }
        run: by_name -> {
          select: popular_name
          where: state_count > 10
          order_by: popular_name
        }
      `).toEqualResult(tm, [
        {popular_name: 'Isabella'},
        {popular_name: 'Sophia'},
      ]);
    });

    test('orders the last stage of a pipeline', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') -> {
          group_by: popular_name
          aggregate: state_count is count()
        } -> {
          select: popular_name, state_count
          order_by: state_count asc, popular_name desc
          limit: 2
        }
      `).toEqualResult(tm, [
        {popular_name: 'Madison', state_count: 3},
        {popular_name: 'Ava', state_count: 3},
      ]);
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
      `).toMatchResult(tm, {n: 12});
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
      `).toMatchResult(tm, {n: 12});
    });

    test('a boolean literal is a condition', async () => {
      await expect(`
        source: x is sqlserver.sql('SELECT 1 AS n') extend {
          join_one: y is sqlserver.sql('SELECT 2 AS n') on true
        }
        run: x -> { select: y.n; where: true }
      `).toMatchResult(tm, {n: 2});
    });

    test('not of a boolean dimension', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') extend {
          dimension: big is airport_count > 500
        } -> {
          aggregate: n is count()
          where: not big
        }
      `).toMatchResult(tm, {n: 39});
    });

    test('a comparison as a value keeps null', async () => {
      await expect(`
        run: sqlserver.sql("SELECT CAST(NULL AS INT) AS x, 3 AS y") -> {
          select:
            unknown is (x > 1) ?? true
            known is (y > 1) ?? false
        }
      `).toMatchResult(tm, {unknown: true, known: true});
    });

    test('not of null is true', async () => {
      await expect(`
        run: sqlserver.sql("SELECT CAST(NULL AS INT) AS x") -> {
          select: r is not (x > 1)
        }
      `).toMatchResult(tm, {r: true});
    });
  });

  describe('nesting', () => {
    const isabella = `
      run: sqlserver.table('malloytest.state_facts') -> {
        where: popular_name = 'Isabella'
        group_by: popular_name
        aggregate: state_count is count()`;

    test('nests a grouped aggregate, ordered and limited', async () => {
      await expect(`${isabella}
        nest: by_first is {
          group_by: first is substr(state, 1, 1)
          aggregate: n is count()
          order_by: n desc, first
          limit: 2
        }
      }`).toEqualResult(tm, [
        {
          popular_name: 'Isabella',
          state_count: 24,
          by_first: [
            {first: 'N', n: 4},
            {first: 'C', n: 3},
          ],
        },
      ]);
    });

    test('nests two levels deep', async () => {
      await expect(`${isabella}
        nest: by_first is {
          group_by: first is substr(state, 1, 1)
          nest: states is { group_by: state; order_by: state }
          order_by: first
          limit: 1
        }
      }`).toMatchResult(tm, {
        by_first: [{first: 'A', states: [{state: 'AZ'}]}],
      });
    });

    test('a nest of only measures is one record', async () => {
      await expect(`${isabella}
        nest: totals is { aggregate: n is count(), airports is airport_count.sum() }
      }`).toMatchResult(tm, {totals: {n: 24, airports: 11146}});
    });

    test('an empty nest is an empty list', async () => {
      await expect(`${isabella}
        nest: none is { where: state = 'ZZ'; group_by: state; aggregate: n is count() }
      }`).toMatchResult(tm, {none: []});
    });

    test('a projection nest lists rows', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') -> {
          where: popular_name = 'Emma'
          group_by: popular_name
          nest: states is { select: state; order_by: state }
        }
      `).toMatchResult(tm, {
        states: [
          {state: 'AL'},
          {state: 'AR'},
          {state: 'IN'},
          {state: 'ME'},
          {state: 'MT'},
          {state: 'NC'},
        ],
      });
    });

    test('an ungrouped aggregate sees the whole table', async () => {
      await expect(`
        run: sqlserver.table('malloytest.state_facts') extend {
          measure: total_births is births.sum()
          measure: births_per_100k is floor(total_births / all(total_births) * 100000)
        } -> { group_by: state; aggregate: births_per_100k }
      `).toMatchResult(tm, {state: 'CA', births_per_100k: 9742});
    });
  });

  describe('time zones', () => {
    test('converts a query time zone through its Windows name', async () => {
      await expect(`
        run: sqlserver.sql("SELECT CAST('2020-02-20 00:00:00' AS DATETIME2) AS t") -> {
          timezone: 'America/Mexico_City'
          select: mex_day is t.day, mex_hour is hour(t)
        }
      `).toMatchResult(tm, {
        mex_day: new Date('2020-02-19T06:00:00Z'),
        mex_hour: 18,
      });
    });

    test('a literal written in a zone is that instant', async () => {
      await expect(`
        run: sqlserver.sql("SELECT 1 AS n") -> {
          select: t is @2020-02-20 00:00:00[America/Mexico_City]
        }
      `).toMatchResult(tm, {t: new Date('2020-02-20T06:00:00Z')});
    });

    test('reads a datetimeoffset column as a timestamp', async () => {
      await expect(`
        run: sqlserver.table('malloytest.alltypes') -> {
          select: t_timestamp, h is hour(t_timestamp)
        }
      `).toMatchResult(tm, {
        t_timestamp: new Date('2020-03-02T12:35:56Z'),
        h: 12,
      });
    });
  });

  describe('joins', () => {
    test('sums each side of a fan-out once', async () => {
      await expect(`
        source: facts is sqlserver.table('malloytest.state_facts')
        run: facts extend { join_cross: other is facts on other.state = 'CA' | 'NY' } -> {
          aggregate:
            row_count is count(concat(state, other.state))
            left_sum is airport_count.sum()
            right_sum is other.airport_count.sum()
        }
      `).toMatchResult(tm, {row_count: 102, left_sum: 19701, right_sum: 1560});
    });

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
