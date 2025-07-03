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
import {describeIfDatabaseAvailable, runQuery} from '../../util';

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

  it('supports hierarchical dimensions', async () => {
    // Test basic hierarchical dimension with two levels
    const query = `
      source: test_source is duckdb.sql("""
        SELECT 
          'North America' as region, 'USA' as country, 'New York' as city, 100 as sales
        UNION ALL SELECT 'North America', 'USA', 'Los Angeles', 150
        UNION ALL SELECT 'North America', 'Canada', 'Toronto', 80
        UNION ALL SELECT 'Europe', 'UK', 'London', 200
        UNION ALL SELECT 'Europe', 'Germany', 'Berlin', 120
      """) extend {
        hierarchical_dimension: location_hierarchy is region, country, city
        measure: total_sales is sales.sum()
        measure: sale_count is count()
      }

      run: test_source -> {
        group_by: location_hierarchy
        aggregate: 
          total_sales
          sale_count
      }
    `;
    
    const result = await runQuery(runtime, query);
    const data = result.data.toObject();
    
    // Verify structure
    expect(data).toHaveLength(2); // Two regions
    
    const northAmerica = data.find((r: any) => r['region'] === 'North America');
    expect(northAmerica).toBeDefined();
    expect(northAmerica!['total_sales']).toBe(330);
    expect(northAmerica!['sale_count']).toBe(3);
    expect(northAmerica!['data']).toBeDefined();
    expect(Array.isArray(northAmerica!['data'])).toBe(true);
    expect(northAmerica!['data']).toHaveLength(2); // USA and Canada
    
    const usa = (northAmerica!['data'] as any[]).find((c: any) => c['country'] === 'USA');
    expect(usa).toBeDefined();
    expect(usa['total_sales']).toBe(250);
    expect(usa['sale_count']).toBe(2);
    expect(usa['city_data']).toBeDefined();
    expect(Array.isArray(usa['city_data'])).toBe(true);
    expect(usa['city_data']).toHaveLength(2); // New York and Los Angeles
    
    const newYork = (usa['city_data'] as any[]).find((c: any) => c['city'] === 'New York');
    expect(newYork).toBeDefined();
    expect(newYork['total_sales']).toBe(100);
    expect(newYork['sale_count']).toBe(1);
  });

  it('hierarchical dimension in view', async () => {
    const query = `
      source: sales_data is duckdb.sql("""
        SELECT 
          'Q1' as sales_quarter, 'Jan' as sales_month, 1000 as revenue
        UNION ALL SELECT 'Q1', 'Feb', 1500
        UNION ALL SELECT 'Q1', 'Mar', 1200
        UNION ALL SELECT 'Q2', 'Apr', 1800
        UNION ALL SELECT 'Q2', 'May', 2000
      """) extend {
        hierarchical_dimension: time_hierarchy is sales_quarter, sales_month
        measure: total_revenue is revenue.sum()
        
        view: revenue_by_time is {
          group_by: time_hierarchy
          aggregate: total_revenue
        }
      }

      run: sales_data -> revenue_by_time
    `;
    
    const result = await runQuery(runtime, query);
    const data = result.data.toObject();
    
    expect(data).toHaveLength(2); // Q1 and Q2
    
    const q1 = data.find((r: any) => r['sales_quarter'] === 'Q1');
    expect(q1).toBeDefined();
    expect(q1!['total_revenue']).toBe(3700);
    expect(q1!['data']).toBeDefined();
    expect(Array.isArray(q1!['data'])).toBe(true);
    expect(q1!['data']).toHaveLength(3); // Jan, Feb, Mar
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

  it('raw query as head works', async () => {
    await expect(
      `
        query: q is duckdb.sql("SELECT 1 as one")
        run: q -> { group_by: one }
      `
    ).malloyResultMatches(runtime, {one: 1});
    await expect(
      `
        query: q is duckdb.sql("SELECT 1 as one")
        query: q2 is q -> { group_by: one }
        run: q2 -> { select: one }
      `
    ).malloyResultMatches(runtime, {one: 1});
    await expect(
      `
        query: q is duckdb.sql("SELECT 1 as one") -> { group_by: two is one + 1 }
        run: q -> { group_by: two }
      `
    ).malloyResultMatches(runtime, {two: 2});
    await expect(
      `
        query: q is duckdb.sql("SELECT 1 as one") -> { group_by: two is one + 1 }
        run: q
      `
    ).malloyResultMatches(runtime, {two: 2});
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
