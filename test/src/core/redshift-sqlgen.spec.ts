/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Golden Redshift SQL-gen: compiles real Malloy with the real driver and asserts on
// the generated SQL. The one introspection call is stubbed, so nothing hits a warehouse.

import {testRuntimeFor} from '../runtimes';
import {RedshiftConnection} from '@malloydata/db-redshift';

const TABLE_COLUMNS = [
  {column_name: 'cat', data_type: 'character varying'},
  {column_name: 'n', data_type: 'integer'},
  {column_name: 'f', data_type: 'double precision'},
  {column_name: 'g', data_type: 'double precision'},
  {column_name: 'ts', data_type: 'timestamp without time zone'},
  {column_name: 'd', data_type: 'date'},
];

describe('redshift SQL generation (direct driver, no warehouse)', () => {
  const connection = new RedshiftConnection('redshift');
  // runPostgresQuery is the only network call; stub it so getSQL never executes.
  jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .spyOn(connection as any, 'runPostgresQuery')
    .mockResolvedValue({rows: TABLE_COLUMNS, totalRows: TABLE_COLUMNS.length});
  const runtime = testRuntimeFor(connection);
  runtime.isTestRuntime = false; // allow the experimental redshift dialect

  const sqlFor = (
    body: string,
    experiments = 'dialect.redshift'
  ): Promise<string> =>
    runtime
      .loadQuery(
        `##! experimental { ${experiments} }\nrun: redshift.table('public.t') -> {\n${body}\n}`
      )
      .getSQL();

  afterAll(async () => {
    await runtime.connection.close();
  });

  describe('string aggregation (LISTAGG, never STRING_AGG)', () => {
    test('string_agg → LISTAGG', async () => {
      const sql = await sqlFor('aggregate: x is cat.string_agg()');
      expect(sql).toContain('LISTAGG(');
      expect(sql).not.toContain('STRING_AGG');
    });

    test('string_agg with separator', async () => {
      const sql = await sqlFor("aggregate: x is cat.string_agg('|')");
      expect(sql).toMatch(/LISTAGG\([^)]*'\|'\)/);
    });

    test('string_agg with order_by → LISTAGG … WITHIN GROUP', async () => {
      const sql = await sqlFor(
        'aggregate: x is cat.string_agg() { order_by: cat }',
        'dialect.redshift aggregate_order_by'
      );
      expect(sql).toContain('LISTAGG(');
      expect(sql).toContain('WITHIN GROUP');
    });

    test('string_agg_distinct → LISTAGG(DISTINCT …)', async () => {
      const sql = await sqlFor('aggregate: x is cat.string_agg_distinct()');
      expect(sql).toContain('LISTAGG(DISTINCT');
    });
  });

  describe('filtered aggregates use CASE WHEN, never FILTER (WHERE …)', () => {
    test('sum with where → SUM(CASE WHEN …)', async () => {
      const sql = await sqlFor('aggregate: pos is n.sum() { where: n > 0 }');
      expect(sql).toContain('CASE WHEN');
      expect(sql).not.toMatch(/FILTER\s*\(/i);
    });

    test('count with where → COUNT(CASE WHEN …)', async () => {
      const sql = await sqlFor('aggregate: c is count() { where: n > 0 }');
      expect(sql).not.toMatch(/FILTER\s*\(/i);
    });
  });

  describe('scalar function overrides', () => {
    test('byte_length → OCTET_LENGTH', async () => {
      const sql = await sqlFor('group_by: x is byte_length(cat)');
      expect(sql).toContain('OCTET_LENGTH');
    });

    test('unicode → ASCII', async () => {
      const sql = await sqlFor('group_by: x is unicode(cat)');
      expect(sql).toContain('ASCII(');
    });

    test('concat → || operator (Redshift CONCAT is binary-only)', async () => {
      const sql = await sqlFor("group_by: x is concat(cat, '-', cat)");
      expect(sql).toContain('||');
      expect(sql).not.toMatch(/\bCONCAT\s*\(/i);
    });

    test('ends_with → RIGHT(…)=… (no native ENDS_WITH)', async () => {
      const sql = await sqlFor("group_by: x is ends_with(cat, 'a')");
      expect(sql).toContain('RIGHT(');
      expect(sql).not.toMatch(/ENDS_WITH/i);
    });

    test('rand → RANDOM()', async () => {
      const sql = await sqlFor('group_by: x is floor(rand() * 10)');
      expect(sql).toContain('RANDOM(');
    });

    test('regexp_extract → REGEXP_SUBSTR', async () => {
      const sql = await sqlFor("group_by: x is regexp_extract(cat, r'al')");
      expect(sql).toContain('REGEXP_SUBSTR');
    });

    test('regex replace → REGEXP_REPLACE 5-arg PCRE (no 6-arg occurrence)', async () => {
      const sql = await sqlFor("group_by: x is replace(cat, r'a', 'b')");
      expect(sql).toContain('REGEXP_REPLACE');
      expect(sql).toMatch(/'p'\s*\)/);
      expect(sql).not.toMatch(/,\s*0\s*,\s*'p'/);
    });

    test('round to precision → ROUND(f, p), no precision-losing ::NUMERIC', async () => {
      const sql = await sqlFor('group_by: x is round(f, 1)');
      expect(sql).toContain('ROUND(');
      expect(sql).not.toContain('::NUMERIC');
    });

    test('trunc → TRUNC(f), no precision-losing ::NUMERIC', async () => {
      const sql = await sqlFor('group_by: x is trunc(f)');
      expect(sql).toContain('TRUNC(');
      expect(sql).not.toContain('::NUMERIC');
    });

    test('log(value, base) → LOG(base, value)', async () => {
      const sql = await sqlFor('group_by: x is log(f, 10)');
      expect(sql).toContain('LOG(');
    });

    test('floor/abs cast the argument to DOUBLE PRECISION', async () => {
      expect(await sqlFor('group_by: x is floor(f)')).toMatch(
        /FLOOR\(.*::DOUBLE PRECISION\)/
      );
      expect(await sqlFor('group_by: x is abs(f)')).toMatch(
        /ABS\(.*::DOUBLE PRECISION\)/
      );
    });

    test('div → TRUNC(a/b) (no native DIV on Redshift)', async () => {
      const sql = await sqlFor('group_by: x is div(n, 2)');
      expect(sql).toContain('TRUNC(');
      expect(sql).not.toMatch(/\bDIV\s*\(/i);
    });

    test('starts_with → LEFT(…)=… (no native STARTS_WITH)', async () => {
      const sql = await sqlFor("group_by: x is starts_with(cat, 'a')");
      expect(sql).toContain('LEFT(');
      expect(sql).not.toMatch(/STARTS_WITH/i);
    });

    test('stddev → STDDEV(…::DOUBLE PRECISION)', async () => {
      const sql = await sqlFor('aggregate: x is stddev(n)');
      expect(sql).toContain('STDDEV(');
      expect(sql).toContain('DOUBLE PRECISION');
    });

    test('substr with negative position → SUBSTRING(… CASE WHEN … < 0 …)', async () => {
      const sql = await sqlFor('group_by: x is substr(cat, -2)');
      expect(sql).toContain('SUBSTRING(');
      expect(sql).toMatch(/<\s*0/);
    });

    test("is_inf → CAST('Infinity' AS FLOAT8)", async () => {
      const sql = await sqlFor('group_by: x is is_inf(f)');
      expect(sql).toContain("CAST('Infinity' AS FLOAT8)");
    });

    test("is_nan → CAST('NaN' AS FLOAT8)", async () => {
      const sql = await sqlFor('group_by: x is is_nan(f)');
      expect(sql).toContain("CAST('NaN' AS FLOAT8)");
    });

    test('repeat / reverse are available', async () => {
      const sql = await sqlFor(
        'group_by: x is repeat(cat, 3), y is reverse(cat)'
      );
      expect(sql).toContain('REPEAT(');
      expect(sql).toContain('REVERSE(');
    });
  });

  describe('time and date', () => {
    test('timestamp truncation → DATE_TRUNC', async () => {
      const sql = await sqlFor('group_by: m is ts.month');
      expect(sql).toContain('DATE_TRUNC');
    });

    test('time extraction → EXTRACT', async () => {
      const sql = await sqlFor('group_by: y is day_of_year(ts)');
      expect(sql.toUpperCase()).toContain('EXTRACT(');
    });

    test('date literal filter compiles to a date comparison', async () => {
      const sql = await sqlFor('group_by: cat\nwhere: d > @2021-01-01');
      expect(sql).toMatch(/"d"\s*>/);
    });
  });

  describe('identifiers and ordering (Postgres-style, double-quoted)', () => {
    test('identifiers are double-quoted', async () => {
      const sql = await sqlFor('group_by: cat');
      expect(sql).toContain('"cat"');
      expect(sql).not.toContain('`cat`');
    });

    test('nulls ordering is explicit (NULLS FIRST/LAST)', async () => {
      const sql = await sqlFor('group_by: cat\norder_by: cat');
      expect(sql).toMatch(/NULLS (FIRST|LAST)/i);
    });
  });

  describe('string literals use backslash escaping', () => {
    test('filter on a quoted literal escapes the quote with a backslash', async () => {
      const sql = await sqlFor('group_by: cat\nwhere: cat = "O\'Brien"');
      expect(sql).toContain("O\\'Brien");
    });
  });

  // Guards against a future base-class change reintroducing Postgres-only SQL.
  describe('no Postgres-only SQL leaks into generated Redshift', () => {
    const FORBIDDEN = [
      /GENERATE_SERIES/i,
      /make_interval/i,
      /GEN_RANDOM_UUID/i,
      /TABLESAMPLE/i,
      /row_to_json/i,
      /::bit\(/i,
      /DECIMAL\(65/i,
      /FILTER\s*\(/i,
      /\bCONCAT\s*\(/i,
      /STRING_AGG/i,
      /\bDIV\s*\(/i,
    ];
    const assertClean = (sql: string) => {
      for (const re of FORBIDDEN) expect(sql).not.toMatch(re);
    };

    test('grouped + filtered aggregate', async () => {
      assertClean(
        await sqlFor(
          'group_by: cat\naggregate: c is count(), s is n.sum()\nwhere: n > 0'
        )
      );
    });

    test('relative-time offset emits DATEADD, not make_interval', async () => {
      const sql = await sqlFor('group_by: x is ts + 3 days');
      expect(sql).toContain('DATEADD');
      assertClean(sql);
    });
  });
});
