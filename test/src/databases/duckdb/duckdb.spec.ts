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

const [_describe, databases] = describeIfDatabaseAvailable(runtimes);
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
    const allInts = [
      'BIGINT',
      'INTEGER',
      'TINYINT',
      'SMALLINT',
      'UBIGINT',
      'UINTEGER',
      'UTINYINT',
      'USMALLINT',
      'HUGEINT',
    ];
    const allFields = allInts.map(intType => `a${intType.toLowerCase()}`);
    const query = `
      run: ${dbName}.sql("""
        SELECT
        ${allInts
          .map(intType => `1::${intType} as a${intType.toLowerCase()}`)
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
      allInts.reduce<Record<string, number>>((building, ent) => {
        building[`sum_a${ent.toLowerCase()}`] = 1;
        return building;
      }, {})
    );
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

  describe('time', () => {
    const zone = 'America/Mexico_City'; // -06:00 no DST
    const zone_2020 = DateTime.fromObject({
      year: 2020,
      month: 2,
      day: 20,
      hour: 0,
      minute: 0,
      second: 0,
      zone,
    });
    test('can cast TIMESTAMPTZ to timestamp', async () => {
      await expect(
        `run: duckdb.sql("""
              SELECT TIMESTAMPTZ '2020-02-20 00:00:00 ${zone}' as t_tstz
          """) -> {
            select: mex_220 is t_tstz::timestamp
          }`
      ).malloyResultMatches(runtime, {mex_220: zone_2020.toJSDate()});
    });
  });
});

afterAll(async () => {
  await allDucks.closeAll();
});
