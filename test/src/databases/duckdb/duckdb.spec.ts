/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {DateTime} from 'luxon';
import {RuntimeList} from '../../runtimes';
import '../../util/db-jest-matchers';
import {describeIfDatabaseAvailable} from '../../util';

// TODO identify which tests need to run on wasm and move them into their own file
const runtimes = ['duckdb', 'duckdb_wasm'];

const [describe, databases] = describeIfDatabaseAvailable(runtimes);
const allDucks = new RuntimeList(databases);

describe.each(allDucks.runtimeList)('duckdb:%s', (dbName, runtime) => {
  it('can open tables with wildcards', async () => {
    await expect(`
      run: duckdb.table('test/data/duckdb/flights/part.*.parquet') -> {
        top: 1
        group_by: carrier;
      }
    `).malloyResultMatches(runtime, {carrier: 'AA'});
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
    await expect(query).malloyResultMatches(
      runtime,
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
    await expect(query).malloyResultMatches(runtime, {n1: 1.234, n2: 1.234});
  });

  it('dayname', async () => {
    await expect(`
      run: duckdb.sql('select 1') -> {
        select:
          x is dayname(@2024-09-12)
          y is dayname(@2024-09-10 12:22:22)
      }`).malloyResultMatches(runtime, {x: 'Thursday', y: 'Tuesday'});
  });

  it('can open json files', async () => {
    await expect(`
      run: duckdb.table('test/data/duckdb/test.json') -> {
        select: *
      }`).malloyResultMatches(runtime, {foo: 'bar'});
  });

  it('supports timezones', async () => {
    await runtime.connection.runSQL("SET TimeZone='CET'");
    const result = await runtime.connection.runSQL(
      "SELECT current_setting('TimeZone')"
    );
    expect(result.rows[0]).toEqual({"current_setting('TimeZone')": 'CET'});
  });

  it('supports varchars with parameters', async () => {
    await expect(
      "run: duckdb.sql(\"SELECT 'a'::VARCHAR as abc, 'a3'::VARCHAR(3) as abc3\")"
    ).malloyResultMatches(runtime, {abc: 'a', abc3: 'a3'});
  });

  it('supports arg_[min, max] functions', async () => {
    await expect(
      `run: ${dbName}.sql(
    """
              SELECT 1 as y, 55 as x
    UNION ALL SELECT 50 as y, 22 as x
    UNION ALL SELECT 100 as y, 1 as x
    """
    ) -> {
      aggregate:
        m1 is arg_min(y, x)
        m2 is arg_min(x, y)
        m3 is arg_max(y, x)
        m4 is arg_max(x, y)
        m5 is arg_min(y, x, 2)
        m6 is arg_min(x, y, 1)
        m7 is arg_max(y, x, 3)
        m8 is arg_max(x, y, 1)
    }`
    ).malloyResultMatches(runtime, {
      m1: 100,
      m2: 55,
      m3: 1,
      m4: 1,
      m5: [100, 50],
      m6: [55],
      m7: [1, 50, 100],
      m8: [1],
    });
  });

  describe('time oddities', () => {
    const zone = 'America/Mexico_City'; // -06:00 no DST
    const zone_2020 = DateTime.fromObject(
      {
        year: 2020,
        month: 2,
        day: 20,
        hour: 0,
        minute: 0,
        second: 0,
      },
      {
        zone,
      }
    );
    test('can cast TIMESTAMPTZ to timestamp', async () => {
      await expect(`
        run: duckdb.sql("""
              SELECT TIMESTAMPTZ '2020-02-20 00:00:00 ${zone}' as t_tstz
          """) -> {
            select: mex_220 is t_tstz::timestamp
          }`).malloyResultMatches(runtime, {mex_220: zone_2020.toJSDate()});
    });
  });
});

afterAll(async () => {
  await allDucks.closeAll();
});
