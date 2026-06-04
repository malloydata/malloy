/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DateTime} from 'luxon';
import {RuntimeList, runtimeFor} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

// TODO identify which tests need to run on wasm and move them into their own file
const runtimes = ['duckdb', 'duckdb_wasm'];

const [describe, databases] = describeIfDatabaseAvailable(runtimes);
const allDucks = new RuntimeList(databases);

describe.each(allDucks.runtimeList)('duckdb:%s', (dbName, runtime) => {
  const testModel = wrapTestModel(runtime, '');

  it('can open tables with wildcards', async () => {
    await expect(`
      run: duckdb.table('test/data/duckdb/flights/part.*.parquet') -> {
        top: 1
        group_by: carrier;
      }
    `).toMatchResult(testModel, {carrier: 'AA'});
  });

  // DuckDB's table-path grammar (validated by dialect.sqlValidateTableName)
  // is a superset of the standard "dotted identifier path" because DuckDB
  // accepts string-literal-form table names that resolve to files via
  // replacement scans. These tests exercise the DuckDB-only shapes.
  // (The validator itself is unit-tested in
  // packages/malloy/src/dialect/escape.spec.ts; these are end-to-end
  // checks that the full pipeline — validate → schema fetch → query —
  // works for shapes the cross-dialect tests can't cover.)

  it('table path with relative-path file-name convenience', async () => {
    // Dashes/dots-as-extension force the FilePathConvenience branch,
    // which wraps the input in single quotes at the SQL level.
    await expect(`
      run: duckdb.table('test/data/duckdb/words.parquet') -> {
        top: 1
        group_by: word
        order_by: word
      }
    `).toMatchResult(testModel, {});
  });

  it('table path with ? glob wildcard', async () => {
    // Single-char glob matches part.0.parquet, part.1.parquet,
    // part.2.parquet.
    await expect(`
      run: duckdb.table('test/data/duckdb/flights/part.?.parquet') -> {
        top: 1
        group_by: carrier
      }
    `).toMatchResult(testModel, {carrier: 'AA'});
  });

  it('accepts all schema numbers', async () => {
    const allNumeric = [
      'BIGINT',
      'DOUBLE',
      'FLOAT',
      'FLOAT4',
      'FLOAT8',
      'HUGEINT',
      'INT',
      'INT1',
      'INT2',
      'INT4',
      'INT8',
      'INTEGER',
      'LONG',
      'REAL',
      'SHORT',
      'SIGNED',
      'SMALLINT',
      'TINYINT',
      'UBIGINT',
      'UINTEGER',
      'USMALLINT',
      'UTINYINT',
    ];
    const allFields = allNumeric.map(numType => `a${numType.toLowerCase()}`);
    const query = `
      run: ${dbName}.sql("""
        SELECT
        ${allNumeric
          .map(numType => `1::${numType} as a${numType.toLowerCase()}`)
          .join(',\n')}
      """) -> {
        aggregate:
        ${allFields
          .map(fieldType => `sum_${fieldType} is sum(${fieldType})`)
          .join('\n')}
      }
    `;
    await expect(query).toMatchResult(
      testModel,
      allNumeric.reduce<Record<string, number>>((building, ent) => {
        building[`sum_a${ent.toLowerCase()}`] = 1;
        return building;
      }, {})
    );
  });

  it('handles decimal literals', async () => {
    const query = `
    run: duckdb.sql("select 1") -> {
      select:
          n1 is 1.234
          n2 is 1234.0 / 1000
  }
    `;
    await expect(query).toMatchResult(testModel, {n1: 1.234, n2: 1.234});
  });

  it('dayname', async () => {
    await expect(`
      run: duckdb.sql('select 1') -> {
        select:
          x is dayname(@2024-09-12)
          y is dayname(@2024-09-10 12:22:22)
      }`).toMatchResult(testModel, {x: 'Thursday', y: 'Tuesday'});
  });

  it('can open json files', async () => {
    await expect(`
      run: duckdb.table('test/data/duckdb/test.json') -> {
        select: *
      }`).toMatchResult(testModel, {foo: 'bar'});
  });

  it('supports timezones', async () => {
    // Use isolated connection to avoid affecting other tests
    const isolatedRuntime = runtimeFor(dbName);
    try {
      await isolatedRuntime.connection.runSQL("SET TimeZone='CET'");
      const result = await isolatedRuntime.connection.runSQL(
        "SELECT current_setting('TimeZone')"
      );
      expect(result.rows[0]).toEqual({"current_setting('TimeZone')": 'CET'});
    } finally {
      await isolatedRuntime.connection.close();
    }
  });

  it('supports varchars with parameters', async () => {
    await expect(
      "run: duckdb.sql(\"SELECT 'a'::VARCHAR as abc, 'a3'::VARCHAR(3) as abc3\")"
    ).toMatchResult(testModel, {abc: 'a', abc3: 'a3'});
  });

  it('raw query as head works', async () => {
    await expect(
      `
        query: q is duckdb.sql("SELECT 1 as one")
        run: q -> { group_by: one }
      `
    ).toMatchResult(testModel, {one: 1});
    await expect(
      `
        query: q is duckdb.sql("SELECT 1 as one")
        query: q2 is q -> { group_by: one }
        run: q2 -> { select: one }
      `
    ).toMatchResult(testModel, {one: 1});
    await expect(
      `
        query: q is duckdb.sql("SELECT 1 as one") -> { group_by: two is one + 1 }
        run: q -> { group_by: two }
      `
    ).toMatchResult(testModel, {two: 2});
    await expect(
      `
        query: q is duckdb.sql("SELECT 1 as one") -> { group_by: two is one + 1 }
        run: q
      `
    ).toMatchResult(testModel, {two: 2});
  });

  describe('time oddities', () => {
    const zone = 'America/Mexico_City'; // -06:00 no DST
    const zone_2020 = DateTime.fromObject(
      {year: 2020, month: 2, day: 20, hour: 0, minute: 0, second: 0},
      {zone}
    );

    test('can cast TIMESTAMPTZ to timestamp', async () => {
      await expect(`
        run: duckdb.sql("""
              SELECT TIMESTAMPTZ '2020-02-20 00:00:00 ${zone}' as t_tstz
          """) -> {
            select: mex_220 is t_tstz::timestamp
          }`).toMatchResult(testModel, {mex_220: zone_2020.toJSDate()});
    });
  });
});

afterAll(async () => {
  await allDucks.closeAll();
});
