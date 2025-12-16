/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-console */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel, resultIs} from '@malloydata/malloy/test';

const [describe, databases] = describeIfDatabaseAvailable(['presto', 'trino']);
const runtimes = new RuntimeList(databases);

describe.each(runtimes.runtimeList)(
  'Presto/Trino dialect functions - %s',

  (databaseName, runtime) => {
    if (runtime === undefined) {
      throw new Error("Couldn't build runtime");
    }
    const testModel = wrapTestModel(runtime, '');
    const presto = databaseName === 'presto';
    it(`runs an sql query - ${databaseName}`, async () => {
      await expect(
        `run: ${databaseName}.sql("SELECT 1 as n") -> { select: n }`
      ).toMatchResult(testModel, {n: 1});
    });

    describe('HLL Window Functions', () => {
      it.when(presto)(
        `hll_accumulate_moving function - ${databaseName}`,
        async () => {
          await expect(`run: ${databaseName}.sql("""
          SELECT 'A' as category, 'value1' as val, 1 as seq
          UNION ALL SELECT 'A' as category, 'value2' as val, 2 as seq
          UNION ALL SELECT 'B' as category, 'value1' as val, 1 as seq
          UNION ALL SELECT 'B' as category, 'value3' as val, 2 as seq
        """) -> {
          select: *
          order_by: category, seq
          calculate: hll_acc is hll_accumulate_moving(val, 1)
        } -> {
          select:
            *
            hll_moving is hll_estimate(hll_acc)
        }`).toEqualResult(testModel, [
            {category: 'A', val: 'value1', seq: 1, hll_moving: 1},
            {category: 'A', val: 'value2', seq: 2, hll_moving: 2},
            {category: 'B', val: 'value1', seq: 1, hll_moving: 2},
            {category: 'B', val: 'value3', seq: 2, hll_moving: 2},
          ]);
        }
      );

      it.when(presto)(
        `hll_combine_moving function - ${databaseName}`,
        async () => {
          await expect(`run: ${databaseName}.sql("""
          SELECT 'A' as category, 'value1' as val, 1 as seq
          UNION ALL SELECT 'A' as category, 'value2' as val, 2 as seq
          UNION ALL SELECT 'B' as category, 'value1' as val, 1 as seq
        """) -> {
          group_by: category
          aggregate: hll_set is hll_accumulate(val)
        } -> {
          select: *
          order_by: category
          calculate: combined_hll is hll_combine_moving(hll_set, 1)
        } -> {
          select:
           *
           final_count is hll_estimate(combined_hll)
        }`).toEqualResult(testModel, [
            {category: 'A', final_count: 2},
            {category: 'B', final_count: 2},
          ]);
        }
      );
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
      `).toMatchResult(testModel, {});
      }
    );

    it(`runs the to_unixtime function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      timezone: 'America/Los_Angeles'
      select: x is to_unixtime(@2024-09-12 04:59:44)
      }`).toMatchResult(testModel, {x: 1726142384});
    });

    it(`runs the arbitrary function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      aggregate: x is arbitrary(n)
      }`).toMatchResult(testModel, {x: 1});
    });

    it(`runs the date_format function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      select: ts_string is date_format(@2024-09-12 15:42:33, '%Y-%m-%d %H:%i:%S')
      }`).toMatchResult(testModel, {ts_string: '2024-09-12 15:42:33'});
    });

    it(`runs the date_parse function - ${databaseName}`, async () => {
      const expected = resultIs.date('2024-09-15');

      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      select: x is date_parse('2024-09-15', '%Y-%m-%d')::date
      }`).toMatchResult(testModel, {x: expected});
    });

    it(`runs the regexp_replace function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      select:
        remove_matches is regexp_replace('1a 2b 14m', '\\\\d+[ab] ')
        replace_matches is regexp_replace('1a 2b 14m', '(\\\\d+)([ab]) ', '3c$2 ')
        remove_matches_r is regexp_replace('1a 2b 14m', r'\\d+[ab] ')
        replace_matches_r is regexp_replace('1a 2b 14m', r'(\\d+)([ab]) ', '3c$2 ')
      }`).toMatchResult(testModel, {
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
      }`).toMatchResult(testModel, {
        should_match: true,
        shouldnt_match: false,
        should_match_r: true,
        shouldnt_match_r: false,
      });
    });

    it(`runs the regexp_extract function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      select:
        extract is regexp_extract('1a 2b 14m', r'\\d+')
        group is regexp_extract('1a 2b 14m', r'(\\d+)([a-z]+)', 2)
      }`).toMatchResult(testModel, {
        extract: '1',
        group: 'a',
      });
    });

    it(`runs the split_part function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("SELECT 1 as n") -> {
      select:
        part is split_part('one/two/three', '/', 2)
      }`).toMatchResult(testModel, {
        part: 'two',
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
      }`).toMatchResult(testModel, {
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
      }`).toMatchResult(testModel, {
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
      }`).toMatchResult(testModel, {
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
      }`).toMatchResult(testModel, {x: 4240710});
    });

    it(`runs the bitwise_or function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 13678423 as n1, 23524678 as n2
      """) -> {
      select:
        x is bitwise_or(n1, n2)
      }`).toMatchResult(testModel, {x: 32962391});
    });

    it(`runs the variance function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
      SELECT 1 as n
      UNION ALL SELECT 50 as n
      UNION ALL SELECT 100 as n
      """) -> {
      aggregate:
        var is floor(variance(n))
      }`).toMatchResult(testModel, {var: 2450});
    });

    it(`runs the corr function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 1 as y, 55 as x
      UNION ALL SELECT 50 as y, 22 as x
      UNION ALL SELECT 100 as y, 1 as x
      """) -> {
      aggregate:
        correlation is corr(y, x)
      }`).toMatchResult(testModel, {correlation: -0.9911108});
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
      }`).toMatchResult(testModel, {
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
      }`).toMatchResult(testModel, {
        and_agg: 4166,
        or_agg: 33552351,
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
      }`).toMatchResult(testModel, {m1: 1, m2: 1});
    });

    it(`runs the max_by function by grouping - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 1 as y, 55 as x, 10 as z
      UNION ALL SELECT 50 as y, 22 as x, 10 as z
      UNION ALL SELECT 1 as y, 10 as x, 20 as z
      UNION ALL SELECT 100 as y, 15 as x, 20 as z
      """) -> {
      group_by:
        z
      aggregate:
        m1 is max_by(x, y)
        m2 is max_by(y, x)
      }`).toEqualResult(testModel, [
        {z: 10, m1: 22, m2: 1},
        {z: 20, m1: 15, m2: 100},
      ]);
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
      }`).toMatchResult(testModel, {m1: 55, m2: 100});
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
        `).toEqualResult(testModel, [
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
        `).toEqualResult(testModel, [
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
        `).toMatchResult(testModel, {
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
        `).toMatchResult(testModel, {some_words: ['hello', 'world']});
      });
      it('runs array_agg', async () => {
        const onetwo = `${databaseName}.sql('SELECT 1 as "n" UNION ALL SELECT 2 UNION ALL SELECT 1')`;
        await expect(`##! experimental
          run: ${onetwo}->{aggregate: alln is array_agg(n) {order_by: n desc }}
        `).toMatchResult(testModel, {alln: [2, 1, 1]});
        await expect(`##! experimental
          run: ${onetwo}->{aggregate: alln is array_agg_distinct(n) {order_by:n asc}}
        `).toMatchResult(testModel, {alln: [1, 2]});
      });
      it.when(presto)('runs array_average', async () => {
        await expect(
          `run: ${nums}->{select: tavg is array_average(nums)}`
        ).toMatchResult(testModel, {tavg: 2});
      });
      it('runs array_distinct', async () => {
        await expect(
          `run: ${nums}->{select: t is array_distinct(nums)}`
        ).toMatchResult(testModel, {t: [4, 1]});
      });
      it.when(presto)('runs array_has_duplicates', async () => {
        await expect(
          `run: ${nums}->{select: t is array_has_duplicates(nums)}`
        ).toMatchResult(testModel, {t: true});
      });
      it('runs array_max', async () => {
        await expect(
          `run: ${nums}->{select: t is array_max(nums)}`
        ).toMatchResult(testModel, {t: 4});
      });
      it('runs array_min', async () => {
        await expect(
          `run: ${nums}->{select: t is array_min(nums)}`
        ).toMatchResult(testModel, {t: 1});
      });
      it.when(presto)('runs array_cum_sum', async () => {
        await expect(
          `run: ${nums}->{select: t is array_cum_sum(nums)}`
        ).toMatchResult(testModel, {t: [4, 5, 6]});
      });
      it.when(presto)('runs array_duplicates', async () => {
        await expect(
          `run: ${nums}->{select: t is array_duplicates(nums)}`
        ).toMatchResult(testModel, {t: [1]});
      });
      it('runs array_sort', async () => {
        await expect(
          `run: ${nums}->{select: t is array_sort(nums)}`
        ).toMatchResult(testModel, {t: [1, 1, 4]});
      });
      it('runs repeat', async () => {
        await expect(
          `run: ${nums}->{select: t is repeat('x', 2)}`
        ).toMatchResult(testModel, {t: ['x', 'x']});
      });
      it('runs slice', async () => {
        await expect(
          `run: ${nums}->{select: t is slice(nums, 2, 2)}`
        ).toMatchResult(testModel, {t: [1, 1]});
      });
      it('runs cardinality', async () => {
        await expect(
          `run: ${nums}->{select: t is cardinality(nums)}`
        ).toMatchResult(testModel, {t: 3});
      });
      it.when(presto)('runs array_sum', async () => {
        await expect(
          `run: ${nums}->{select: t is array_sum(nums)}`
        ).toMatchResult(testModel, {t: 6});
      });
      it('runs contains', async () => {
        await expect(
          `run: ${nums}->{select: t is contains(nums, 42)}`
        ).toMatchResult(testModel, {t: false});
      });
      it('runs array_except', async () => {
        await expect(
          `run: ${nums}->{select: t is array_except(nums, [4])}`
        ).toMatchResult(testModel, {t: [1]});
      });
      // mtoy todo figure out how to test this, maybe reconfigure test instance
      it.skip('runs array_normalize', async () => {
        await expect(`
          # test.verbose
          run: ${nums}->{select: t is array_normalize(nums, 40)}
        `).toMatchResult(testModel, {t: [1, 0.25, 0.25]});
      });
      it.when(presto)('runs array_position', async () => {
        await expect(
          `run: ${nums}->{select: t is array_position(nums, 1, 2)}`
        ).toMatchResult(testModel, {t: 3});
      });
      it('runs array_remove', async () => {
        await expect(
          `run: ${nums}->{select: t is array_remove(nums, 1)}`
        ).toMatchResult(testModel, {t: [4]});
      });
      it.when(presto)('runs array_sort_desc', async () => {
        await expect(
          `run: ${nums}->{select: t is array_sort_desc([1,2,3])}`
        ).toMatchResult(testModel, {t: [3, 2, 1]});
      });
      // mtoy todo find why test instance doesn't have this fucntion
      it.skip('runs array_split_into_chunks', async () => {
        await expect(
          `run: ${nums}->{select: t is array_split_into_chunks(nums, 1)}`
        ).toMatchResult(testModel, {t: [[4], [1], [1]]});
      });
      it('runs arrays_overlap', async () => {
        await expect(
          `run: ${nums}->{select: t is arrays_overlap(nums, [2,3,4])}`
        ).toMatchResult(testModel, {t: true});
      });
      it('runs arrays_union', async () => {
        await expect(
          `run: ${nums}->{select: t is array_union(nums, [2])}`
        ).toMatchResult(testModel, {t: [4, 1, 2]});
      });
      it.when(presto)('runs remove_nulls', async () => {
        await expect(
          `run: ${nums}->{select: t is remove_nulls([null, 2])}`
        ).toMatchResult(testModel, {t: [2]});
      });
      it('runs reverse(null)', async () => {
        await expect(
          `run: ${nums}->{select: t is reverse(null)}`
        ).toMatchResult(testModel, {t: null});
      });
      it.when(presto)('runs reverse(array)', async () => {
        await expect(
          `run: ${nums}->{select: t is reverse(nums)}`
        ).toMatchResult(testModel, {t: [1, 1, 4]});
      });
      it('runs shuffle', async () => {
        await expect(`run: ${nums}->{select: t is shuffle([1])}`).toMatchResult(
          testModel,
          {t: [1]}
        );
      });
      it.when(presto)('runs array_top_n', async () => {
        await expect(
          `run: ${nums}->{select: t is array_top_n(nums, 2)}`
        ).toMatchResult(testModel, {t: [4, 1]});
      });
      it('runs combinations', async () => {
        await expect(
          `run: ${nums}->{select: t is combinations([1,2,3], 2)}`
        ).toMatchResult(testModel, {
          t: [
            [1, 2],
            [1, 3],
            [2, 3],
          ],
        });
      });
      it('runs element_at', async () => {
        await expect(
          `run: ${nums}->{select: t is element_at(nums, 1)}`
        ).toMatchResult(testModel, {t: 4});
      });
      it('runs flatten', async () => {
        await expect(
          `run: ${nums}->{select: t is flatten([[1], [2]])}`
        ).toMatchResult(testModel, {t: [1, 2]});
      });
      it('runs ngrams', async () => {
        await expect(
          `run: ${nums}->{select: t is ngrams([1,2,3], 2)}`
        ).toMatchResult(testModel, {
          t: [
            [1, 2],
            [2, 3],
          ],
        });
      });
      it('runs trim_array', async () => {
        await expect(
          `run: ${nums}->{select: t is trim_array(nums, 2)}`
        ).toMatchResult(testModel, {t: [4]});
      });
      it('runs sequence(n1,n2)', async () => {
        await expect(
          `run: ${nums}->{select: t is sequence(1,2)}`
        ).toMatchResult(testModel, {t: [1, 2]});
      });
      it('runs sequence(n1,n2,n3)', async () => {
        await expect(
          `run: ${nums}->{select: t is sequence(10, 20, 10)}`
        ).toMatchResult(testModel, {t: [10, 20]});
      });
      // mtoy todo figure out how to write test
      it.skip('runs sequence(d1,d2)', async () => {
        await expect(
          `run: ${nums}->{select: t is sequence(@2001-01-01, @2001-01-02)}`
        ).toMatchResult(testModel, {
          t: [new Date('2001-01-01'), new Date('2001-01-02')],
        });
      });
      it('runs array_intersect(a1,a2)', async () => {
        await expect(
          `run: ${nums}->{select: t is array_intersect(nums, [4])}`
        ).toMatchResult(testModel, {t: [4]});
      });
      it.when(presto)('runs array_intersect(a)', async () => {
        await expect(
          `run: ${nums}->{select: t is array_intersect([[1,2], [2,3]])}`
        ).toMatchResult(testModel, {t: [2]});
      });
      it('runs array_join(a,s)', async () => {
        await expect(
          `run: ${nums}->{select: t is array_join(nums, ',')}`
        ).toMatchResult(testModel, {t: '4,1,1'});
      });
      it('runs array_join(a,s, n)', async () => {
        await expect(
          `run: ${nums}->{select: t is array_join(['a', null], ',', 'x')}`
        ).toMatchResult(testModel, {t: 'a,x'});
      });
      it.when(presto)('runs array_least_frequent(a)', async () => {
        await expect(
          `run: ${nums}->{select: t is array_least_frequent(nums)}`
        ).toMatchResult(testModel, {t: [4]});
      });
      it.when(presto)('runs array_least_frequent(a, n)', async () => {
        await expect(
          `run: ${nums}->{select: t is array_least_frequent(nums, 2)}`
        ).toMatchResult(testModel, {t: [4, 1]});
      });
      // mtoy todo document missing lambda sort
    });

    it('can read a map data type from an sql schema', async () => {
      await expect(`run: ${databaseName}.sql("""
          SELECT MAP(ARRAY['key1', 'key2', 'key3' ], ARRAY['v1', 'v2', 'v3']) as KEY_TO_V
        """) -> { aggregate: n is count() }
      `).toMatchResult(testModel, {n: 1});
    });

    describe('T-Digest functions', () => {
      const testData = `${databaseName}.sql("""
        SELECT CAST(1.0 AS DOUBLE) as n, CAST(1 AS BIGINT) as w
        UNION ALL SELECT CAST(2.0 AS DOUBLE) as n, CAST(2 AS BIGINT) as w
        UNION ALL SELECT CAST(3.0 AS DOUBLE) as n, CAST(1 AS BIGINT) as w
        UNION ALL SELECT CAST(4.0 AS DOUBLE) as n, CAST(3 AS BIGINT) as w
        UNION ALL SELECT CAST(5.0 AS DOUBLE) as n, CAST(1 AS BIGINT) as w
        UNION ALL SELECT CAST(6.0 AS DOUBLE) as n, CAST(2 AS BIGINT) as w
        UNION ALL SELECT CAST(7.0 AS DOUBLE) as n, CAST(1 AS BIGINT) as w
        UNION ALL SELECT CAST(8.0 AS DOUBLE) as n, CAST(2 AS BIGINT) as w
        UNION ALL SELECT CAST(9.0 AS DOUBLE) as n, CAST(1 AS BIGINT) as w
        UNION ALL SELECT CAST(10.0 AS DOUBLE) as n, CAST(3 AS BIGINT) as w
      """)`;

      it.when(presto)(
        `runs the basic tdigest_agg function - ${databaseName}`,
        async () => {
          await expect(`run: ${testData} -> {
          aggregate:
            median is value_at_quantile(tdigest_agg(n), 0.5)
        }`).toMatchResult(testModel, {
            median: 6,
          });
        }
      );

      it.when(presto)(
        `runs the tdigest_agg with weight function - ${databaseName}`,
        async () => {
          await expect(`run: ${testData} -> {
          aggregate:
            weighted_median is value_at_quantile(tdigest_agg(n, w), 0.5)
        }`).toMatchResult(testModel, {
            weighted_median: 5.5,
          });
        }
      );

      it.when(presto)(
        `runs the tdigest_agg with weight and compression function - ${databaseName}`,
        async () => {
          await expect(`run: ${testData} -> {
          aggregate:
            compressed_median is value_at_quantile(tdigest_agg(n, w, 100), 0.5)
        }`).toMatchResult(testModel, {
            compressed_median: 5.5,
          });
        }
      );

      it.when(presto)(
        `runs the value_at_quantile function - ${databaseName}`,
        async () => {
          await expect(`run: ${testData} -> {
          aggregate:
            q25 is value_at_quantile(tdigest_agg(n), 0.25)
            q50 is value_at_quantile(tdigest_agg(n), 0.5)
            q75 is value_at_quantile(tdigest_agg(n), 0.75)
            q90 is value_at_quantile(tdigest_agg(n), 0.9)
        }`).toMatchResult(testModel, {
            q25: 3,
            q50: 6,
            q75: 8,
            q90: 10,
          });
        }
      );

      it.when(presto)(
        `runs the quantile_at_value function - ${databaseName}`,
        async () => {
          await expect(`run: ${testData} -> {
          aggregate:
            q_at_5 is quantile_at_value(tdigest_agg(n), 5.0)
            q_at_2 is quantile_at_value(tdigest_agg(n), 2.0)
            q_at_8 is quantile_at_value(tdigest_agg(n), 8.0)
        }`).toMatchResult(testModel, {
            q_at_5: 0.45,
            q_at_2: 0.15,
            q_at_8: 0.75,
          });
        }
      );

      it.when(presto)(
        `runs the values_at_quantiles function - ${databaseName}`,
        async () => {
          await expect(`run: ${testData} -> {
          aggregate:
            quantiles is values_at_quantiles(tdigest_agg(n), [0.25, 0.5, 0.75])
        }`).toMatchResult(testModel, {
            quantiles: [3, 6, 8],
          });
        }
      );

      it.when(presto)(
        `runs the scale_tdigest function - ${databaseName}`,
        async () => {
          await expect(`run: ${testData} -> {
          aggregate:
            original_median is value_at_quantile(tdigest_agg(n), 0.5)
            scaled_median is value_at_quantile(scale_tdigest(tdigest_agg(n), 2.0), 0.5)
        }`).toMatchResult(testModel, {
            original_median: 6,
            scaled_median: 5.5,
          });
        }
      );

      it.when(presto)(
        `runs the trimmed_mean function - ${databaseName}`,
        async () => {
          await expect(`run: ${testData} -> {
          aggregate:
            trimmed_mean_10_90 is trimmed_mean(tdigest_agg(n), 0.1, 0.9)
            trimmed_mean_25_75 is trimmed_mean(tdigest_agg(n), 0.25, 0.75)
        }`).toMatchResult(testModel, {
            trimmed_mean_10_90: 6,
            trimmed_mean_25_75: 5.5,
          });
        }
      );

      it.when(presto)(
        `runs the merge tdigest function - ${databaseName}`,
        async () => {
          await expect(`run: ${testData} -> {
          group_by: group_col is case when n <= 5 then 'A' else 'B' end
          aggregate: td is tdigest_agg(n)
        } -> {
          aggregate:
            overall_median is value_at_quantile(merge_tdigest(td), 0.5)
        }`).toMatchResult(testModel, {
            overall_median: 6,
          });
        }
      );

      it.when(presto)(
        `runs the merge_tdigest array function - ${databaseName}`,
        async () => {
          await expect(`run: ${testData} -> {
          group_by: group_col is case when n <= 5 then 'A' else 'B' end
          aggregate: td is tdigest_agg(n)
        } -> {
          aggregate:
            overall_median is value_at_quantile(merge_tdigest_array(array_agg(td)), 0.5)
        }`).toMatchResult(testModel, {
            overall_median: 6,
          });
        }
      );

      it.skip(`runs the destructure_tdigest function - ${databaseName}`, async () => {
        // TODO: Fix this test - destructure_tdigest returns a record type
        // which needs special handling in the test
        await expect(`run: ${testData} -> {
          aggregate:
            destructured is destructure_tdigest(tdigest_agg(n))
        }`).toMatchResult(testModel, {
          destructured: {
            centroid_means: [],
            centroid_weights: [],
            min_value: 1.0,
            max_value: 10.0,
            sum_value: 55.0,
            count_value: 10,
          },
        });
      });

      it.skip(`runs the construct_tdigest function - ${databaseName}`, async () => {
        // This test is complex because construct_tdigest needs the output of destructure_tdigest
        // For now, we'll test that the function exists and can be called with sample data
        await expect(`run: ${databaseName}.sql("SELECT 1 as dummy") -> {
          select:
            test_construct is value_at_quantile(
              construct_tdigest(
                [1.0, 2.0, 3.0],
                [1.0, 1.0, 1.0],
                1.0,
                3.0,
                6.0,
                3.0,
                100
              ),
              0.5
            )
        }`).toMatchResult(testModel, {
          test_construct: 2,
        });
      });

      it.when(presto)(
        `runs tdigest functions with edge cases - ${databaseName}`,
        async () => {
          const singleValueData = `${databaseName}.sql("SELECT CAST(5.0 AS DOUBLE) as n")`;
          await expect(`run: ${singleValueData} -> {
          aggregate:
            median is value_at_quantile(tdigest_agg(n), 0.5)
            q25 is value_at_quantile(tdigest_agg(n), 0.25)
            q75 is value_at_quantile(tdigest_agg(n), 0.75)
        }`).toMatchResult(testModel, {
            median: 5.0,
            q25: 5.0,
            q75: 5.0,
          });
        }
      );

      it.when(presto)(
        `runs tdigest functions with extreme quantiles - ${databaseName}`,
        async () => {
          await expect(`run: ${testData} -> {
          aggregate:
            min_quantile is value_at_quantile(tdigest_agg(n), 0.0)
            max_quantile is value_at_quantile(tdigest_agg(n), 1.0)
            q_at_min is quantile_at_value(tdigest_agg(n), 1.0)
            q_at_max is quantile_at_value(tdigest_agg(n), 10.0)
        }`).toMatchResult(testModel, {
            min_quantile: 1,
            max_quantile: 10,
            q_at_min: 0.05,
            q_at_max: 0.95,
          });
        }
      );
    });
  }
);

afterAll(async () => {
  await runtimes.closeAll();
});
