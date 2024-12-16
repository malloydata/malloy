/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-console */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';
import '../../util/db-jest-matchers';

const [describe, databases] = describeIfDatabaseAvailable(['presto', 'trino']);
const runtimes = new RuntimeList(databases);

describe.each(runtimes.runtimeList)(
  'Presto/Trino dialect functions - %s',

  (databaseName, runtime) => {
    if (runtime === undefined) {
      throw new Error("Couldn't build runtime");
    }

    it(`runs an sql query - ${databaseName}`, async () => {
      await expect(
        `run: ${databaseName}.sql("SELECT 1 as n") -> { select: n }`
      ).malloyResultMatches(runtime, {n: 1});
    });
    test.when(databaseName === 'presto')(
      'schema parser does not throw on compound types',
      async () => {
        const abrec = 'CAST(ROW(0,1) AS ROW(a DOUBLE,b DOUBLE))';
        await expect(`
          run: ${databaseName}.sql("""
            SELECT
              ${abrec} as "abrec",
              ARRAY['c', 'd'] as str_array,
              array[1,2,3] as int_array,
              ARRAY[${abrec}] as array_of_abrec
          """)
      `).malloyResultMatches(runtime, {});
      }
    );

    it(`runs the to_unixtime function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      timezone: 'America/Los_Angeles'
      select: x is to_unixtime(@2024-09-12 04:59:44)
      }`).malloyResultMatches(runtime, {x: 1726142384});
    });

    it(`runs the arbitrary function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      aggregate: x is arbitrary(n)
      }`).malloyResultMatches(runtime, {x: 1});
    });

    it(`runs the date_format function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      select: ts_string is date_format(@2024-09-12 15:42:33, '%Y-%m-%d %H:%i:%S')
      }`).malloyResultMatches(runtime, {ts_string: '2024-09-12 15:42:33'});
    });

    it(`runs the date_parse function - ${databaseName}`, async () => {
      const expected = Date.parse('15 Sep 2024 00:00:00 UTC');

      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      select: x is date_parse('2024-09-15', '%Y-%m-%d')::date
      }`).malloyResultMatches(runtime, {x: expected});
    });

    it(`runs the regexp_replace function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      select:
        remove_matches is regexp_replace('1a 2b 14m', '\\\\d+[ab] ')
        replace_matches is regexp_replace('1a 2b 14m', '(\\\\d+)([ab]) ', '3c$2 ')
        remove_matches_r is regexp_replace('1a 2b 14m', r'\\d+[ab] ')
        replace_matches_r is regexp_replace('1a 2b 14m', r'(\\d+)([ab]) ', '3c$2 ')
      }`).malloyResultMatches(runtime, {
        remove_matches: '14m',
        replace_matches: '3ca 3cb 14m',
        remove_matches_r: '14m',
        replace_matches_r: '3ca 3cb 14m',
      });
    });

    it(`runs the regexp_like function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      select:
        should_match is regexp_like('1a 2b 14m', '\\\\d+b')
        shouldnt_match is regexp_like('1a 2b 14m', '\\\\d+c')
        should_match_r is regexp_like('1a 2b 14m', r'\\d+b')
        shouldnt_match_r is regexp_like('1a 2b 14m', r'\\d+c')
      }`).malloyResultMatches(runtime, {
        should_match: true,
        shouldnt_match: false,
        should_match_r: true,
        shouldnt_match_r: false,
      });
    });

    it(`runs the approx_percentile function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
      SELECT 1 as n
      UNION ALL SELECT 50 as n
      UNION ALL SELECT 100 as n
      """) -> {
      aggregate:
        default_pctl is approx_percentile(n, 0.5)
      }`).malloyResultMatches(runtime, {
        default_pctl: 50,
      });
    });

    it(`runs the bool_and function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT true as n1, false as n2, false as n3
      UNION ALL SELECT true as n1, true as n2,  false as n3
      UNION ALL SELECT true as n1, false as n2, false as n3
      """) -> {
      aggregate:
        and_n1 is bool_and(n1)
        and_n2 is bool_and(n2)
        and_n3 is bool_and(n3)
      }`).malloyResultMatches(runtime, {
        and_n1: true,
        and_n2: false,
        and_n3: false,
      });
    });

    it(`runs the bool_or function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT true as n1, false as n2, false as n3
      UNION ALL SELECT true as n1, true as n2,  false as n3
      UNION ALL SELECT true as n1, false as n2, false as n3
      """) -> {
      aggregate:
        or_n1 is bool_or(n1)
        or_n2 is bool_or(n2)
        or_n3 is bool_or(n3)
      }`).malloyResultMatches(runtime, {
        or_n1: true,
        or_n2: true,
        or_n3: false,
      });
    });

    it(`runs the bitwise_and function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 13678423 as n1, 23524678 as n2
      """) -> {
      select:
        x is bitwise_and(n1, n2)
      }`).malloyResultMatches(runtime, {x: 4240710});
    });

    it(`runs the bitwise_or function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 13678423 as n1, 23524678 as n2
      """) -> {
      select:
        x is bitwise_or(n1, n2)
      }`).malloyResultMatches(runtime, {x: 32962391});
    });

    it(`runs the variance function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
      SELECT 1 as n
      UNION ALL SELECT 50 as n
      UNION ALL SELECT 100 as n
      """) -> {
      aggregate:
        var is floor(variance(n))
      }`).malloyResultMatches(runtime, {var: 2450});
    });

    it(`runs the corr function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 1 as y, 55 as x
      UNION ALL SELECT 50 as y, 22 as x
      UNION ALL SELECT 100 as y, 1 as x
      """) -> {
      aggregate:
        correlation is corr(y, x)
      }`).malloyResultMatches(runtime, {correlation: -0.9911108});
    });

    // TODO: once we support Presto JSON types, we should test that situation
    it(`runs the json_extract_scalar function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 1 as n,
                JSON '{"store": {"book": [ {"title": "Moby Dick", "author": "Herman Melville"} ]}}' as literal_col
                """) -> {
      select:
        json_arr is json_extract_scalar('[1, 2, 3]', '$[2]')
        json_obj is json_extract_scalar(
            '{"store": {"book": [ {"title": "Moby Dick", "author": "Herman Melville"} ]}}',
            '$.store.book[0].author'
          ),
        -- json_literal is json_extract_scalar(literal_col, '$.store.book[0].author')
      }`).malloyResultMatches(runtime, {
        json_arr: '3',
        json_obj: 'Herman Melville',
        // json_literal: 'Herman Melville',
      });
    });

    it(`runs the bitwise_agg functions - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 13678423 as n1 UNION ALL
                SELECT 23524678 as n1 UNION ALL
                SELECT 987342 as n1
      """) -> {
      aggregate:
        and_agg is bitwise_and_agg(n1)
        or_agg is bitwise_or_agg(n1)
        xor_agg is bitwise_xor_agg(n1)
      }`).malloyResultMatches(runtime, {
        and_agg: 33552351,
        or_agg: 4166,
        xor_agg: 28922591,
      });
    });

    it(`runs the max_by function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 1 as y, 55 as x
      UNION ALL SELECT 50 as y, 22 as x
      UNION ALL SELECT 100 as y, 1 as x
      """) -> {
      aggregate:
        m1 is max_by(x, y)
        m2 is max_by(y, x)
      }`).malloyResultMatches(runtime, {m1: 1, m2: 1});
    });

    it(`runs the min_by function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 1 as y, 55 as x
      UNION ALL SELECT 50 as y, 22 as x
      UNION ALL SELECT 100 as y, 1 as x
      """) -> {
      aggregate:
        m1 is min_by(x, y)
        m2 is min_by(y, x)
      }`).malloyResultMatches(runtime, {m1: 55, m2: 100});
    });

    it(`runs the percent_rank function - ${databaseName}`, async () => {
      await expect(`# debug
          run: ${databaseName}.sql(
            """
                      SELECT 55 as x
            UNION ALL SELECT 22 as x
            UNION ALL SELECT 1 as x
            """
          ) -> {
            group_by: x
            order_by: x desc
            calculate: pctrnk is percent_rank()
          }
        `).malloyResultMatches(runtime, [
        {x: 55, pctrnk: 0},
        {x: 22, pctrnk: 0.5},
        {x: 1, pctrnk: 1},
      ]);
    });

    it(`runs the percent_rank function with order_by - ${databaseName}`, async () => {
      await expect(`# debug
        run: ${databaseName}.sql(
          """
                    SELECT 55 as x
          UNION ALL SELECT 22 as x
          UNION ALL SELECT 1 as x
          """
        ) -> {
          group_by: x
          order_by: x desc
          calculate: pctrnk is percent_rank() { order_by: x asc }
        }
        `).malloyResultMatches(runtime, [
        {x: 55, pctrnk: 1},
        {x: 22, pctrnk: 0.5},
        {x: 1, pctrnk: 0},
      ]);
    });

    it(`runs the url_extract functions - ${databaseName}`, async () => {
      await expect(`
        run: ${databaseName}.sql(
          """
            SELECT 'http://websitetesthost.com:80/path_comp/my_test?first_param=val_one&second_param=2#example_frag' as test_url
          """
        ) -> {
          select:
            fragment is url_extract_fragment(test_url)
            host is url_extract_host(test_url)
            param_one is url_extract_parameter(test_url, 'first_param')
            param_two is url_extract_parameter(test_url, 'second_param')
            path is url_extract_path(test_url)
            port is url_extract_port(test_url)
            protocol is url_extract_protocol(test_url)
            query is url_extract_query(test_url)
        }
        `).malloyResultMatches(runtime, {
        fragment: 'example_frag',
        host: 'websitetesthost.com',
        param_one: 'val_one',
        param_two: '2',
        path: '/path_comp/my_test',
        port: 80,
        protocol: 'http',
        query: 'first_param=val_one&second_param=2',
      });
    });
    describe('various array functions', () => {
      const nums = `${databaseName}.sql('SELECT ARRAY[4,1,1] as "nums"')`;
      it('runs split function', async () => {
        await expect(`
          run: ${databaseName}.sql("SELECT 1 AS N") -> {
            select: some_words is split('hello world', ' ')
          }
        `).malloyResultMatches(runtime, {some_words: ['hello', 'world']});
      });
      it('runs array_average', async () => {
        await expect(
          `run: ${nums}->{select tavg is array_average(nums)}`
        ).malloyResultMatches(runtime, {tavg: 2});
      });
      it('runs array_distinct', async () => {
        await expect(
          `run: ${nums}->{select t is array_distinct(nums)}`
        ).malloyResultMatches(runtime, {t: [1, 4]});
      });
      it('runs array_has_duplicates', async () => {
        await expect(
          `run: ${nums}->{select t is array_has_duplicates(nums)}`
        ).malloyResultMatches(runtime, {t: true});
      });
      it('runs array_max', async () => {
        await expect(
          `run: ${nums}->{select t is array_max(nums)}`
        ).malloyResultMatches(runtime, {t: 4});
      });
      it('runs array_min', async () => {
        await expect(
          `run: ${nums}->{select t is array_min(nums)}`
        ).malloyResultMatches(runtime, {t: 1});
      });
      it('runs array_cum_sum', async () => {
        await expect(
          `run: ${nums}->{select t is array_cum_sum(nums)}`
        ).malloyResultMatches(runtime, {t: [4, 5, 6]});
      });
      it('runs array_duplicates', async () => {
        await expect(
          `run: ${nums}->{select t is array_cum_sum(nums)}`
        ).malloyResultMatches(runtime, {t: [1]});
      });
      it('runs array_sort', async () => {
        await expect(
          `run: ${nums}->{select t is array_sort(nums)}`
        ).malloyResultMatches(runtime, {t: [1, 1, 4]});
      });
      it('runs repeat', async () => {
        await expect(
          `run: ${nums}->{select t is repeat('x', 2)}`
        ).malloyResultMatches(runtime, {t: ['x', 'x']});
      });
      it('runs slice', async () => {
        await expect(
          `run: ${nums}->{select t is slice(nums, 2, 2)}`
        ).malloyResultMatches(runtime, {t: ['1', '1']});
      });
      it('runs cardinality', async () => {
        await expect(
          `run: ${nums}->{select t is cardinality(nums)}`
        ).malloyResultMatches(runtime, {t: 3});
      });
      it('runs array_sum', async () => {
        await expect(
          `run: ${nums}->{select t is array_sum(nums)}`
        ).malloyResultMatches(runtime, {t: 6});
      });
      it('runs contains', async () => {
        await expect(
          `run: ${nums}->{select t is contains(nums, 42)}`
        ).malloyResultMatches(runtime, {t: false});
      });
      it('runs array_except', async () => {
        await expect(
          `run: ${nums}->{select t is array_except(nums, [4])}`
        ).malloyResultMatches(runtime, {t: [1]});
      });
      it('runs array_normalize', async () => {
        await expect(
          `run: ${nums}->{select t is array_normalize(nums, 40)}`
        ).malloyResultMatches(runtime, {t: [1, 0.25, 0.25]});
      });
      it('runs array_position', async () => {
        await expect(
          `run: ${nums}->{select t is array_position(nums, 1, 2)}`
        ).malloyResultMatches(runtime, {t: 3});
      });
      it('runs array_remove', async () => {
        await expect(
          `run: ${nums}->{select t is array_remove(nums, 1)}`
        ).malloyResultMatches(runtime, {t: [4]});
      });
      it('runs array_sort_desc', async () => {
        await expect(
          `run: ${nums}->{select t is array_sort_desc([1,2,3], 1)}`
        ).malloyResultMatches(runtime, {t: [3, 2, 1]});
      });
      it('runs array_split_into_chunks', async () => {
        await expect(
          `run: ${nums}->{select t is array_split_into_chunks(num, 1)}`
        ).malloyResultMatches(runtime, {t: [[4], [1], [1]]});
      });
      it('runs arrays_overlap', async () => {
        await expect(
          `run: ${nums}->{select t is array_overlap(num, [2,3,4])}`
        ).malloyResultMatches(runtime, {t: true});
      });
      it('runs arrays_union', async () => {
        await expect(
          `run: ${nums}->{select t is array_union(num, [2])}`
        ).malloyResultMatches(runtime, {t: [4, 1, 2]});
      });
      it('runs remove_nulls', async () => {
        await expect(
          `run: ${nums}->{select t is remove_nulls([null, 2])}`
        ).malloyResultMatches(runtime, {t: [2]});
      });
      it('runs reverse', async () => {
        await expect(
          `run: ${nums}->{select t is reverse(nums)}`
        ).malloyResultMatches(runtime, {t: [1, 1, 4]});
      });
      it('runs shuffle', async () => {
        await expect(
          `run: ${nums}->{select t is shuffle([1])}`
        ).malloyResultMatches(runtime, {t: [1]});
      });
      it('runs array_top_n', async () => {
        await expect(
          `run: ${nums}->{select t is array_top_n(nums, 2)}`
        ).malloyResultMatches(runtime, {t: [4, 1]});
      });
      it('runs combinations', async () => {
        await expect(
          `run: ${nums}->{select t is combinations([1,2,3], 2)}`
        ).malloyResultMatches(runtime, {
          t: [
            [1, 2],
            [1, 3],
            [2, 3],
          ],
        });
      });
      it('runs element_at', async () => {
        await expect(
          `run: ${nums}->{select t is element_at(nums, 1)}`
        ).malloyResultMatches(runtime, {t: 4});
      });
      it('runs flatten', async () => {
        await expect(
          `run: ${nums}->{select t is flatten([1], [2])}`
        ).malloyResultMatches(runtime, {t: [1, 2]});
      });
      it('runs ngrams', async () => {
        await expect(
          `run: ${nums}->{select t is ngrams([1,2,3], 2)}`
        ).malloyResultMatches(runtime, {
          t: [
            [1, 2],
            [2, 3],
          ],
        });
      });
      it('runs trim_array', async () => {
        await expect(
          `run: ${nums}->{select t is trim_array(nums, 2)}`
        ).malloyResultMatches(runtime, {t: [4]});
      });
      it('runs sequence(n1,n2)', async () => {
        await expect(
          `run: ${nums}->{select t is sequence(1,2)}`
        ).malloyResultMatches(runtime, {t: [1, 2]});
      });
      it('runs sequence(n1,n2,n3)', async () => {
        await expect(
          `run: ${nums}->{select t is sequence(10, 20, 10)}`
        ).malloyResultMatches(runtime, {t: [10, 20]});
      });
      it('runs sequence(d1,d2)', async () => {
        await expect(
          `run: ${nums}->{select t is sequence(@2001-01-01, @2001-01-02)}`
        ).malloyResultMatches(runtime, {t: [1, 2]});
      });
      it('runs sequence(ts1,ts2)', async () => {
        await expect(
          `run: ${nums}->{select t is sequence(@2001-01-01 00:00:00, @2001-01-02 00:00:00)}`
        ).malloyResultMatches(runtime, {t: [1, 2]});
      });
      it('runs array_intersect(a1,a2)', async () => {
        await expect(
          `run: ${nums}->{select t is array_intersect(nums, [4])}`
        ).malloyResultMatches(runtime, {t: [4]});
      });
      it('runs array_intersect(a)', async () => {
        await expect(
          `run: ${nums}->{select t is array_intersect([[1,2], [2,3]])}`
        ).malloyResultMatches(runtime, {t: [2]});
      });
      it('runs array_join(a,s)', async () => {
        await expect(
          `run: ${nums}->{select t is array_join(nums, ',')}`
        ).malloyResultMatches(runtime, {t: '4,1,1'});
      });
      it('runs array_join(a,s, n)', async () => {
        await expect(
          `run: ${nums}->{select t is array_join([1, null], ',', 42)}`
        ).malloyResultMatches(runtime, {t: [1, 42]});
      });
      it('runs array_least_frequent(a)', async () => {
        await expect(
          `run: ${nums}->{select t is array_least_frequent(nums)}`
        ).malloyResultMatches(runtime, {t: [4]});
      });
      it('runs array_least_frequent(a, n)', async () => {
        await expect(
          `run: ${nums}->{select t is array_least_frequent(nums)}`
        ).malloyResultMatches(runtime, {t: [4, 1]});
      });
      // mtoy todo document missing lambda sort
    });
  }
);

afterAll(async () => {
  await runtimes.closeAll();
});
