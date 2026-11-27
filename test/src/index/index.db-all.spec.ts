/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

// No prebuilt shared model, each test is complete.  Makes debugging easier.
afterAll(() => testDatabase.shutdown());

const testModel = wrapTestModel(testDatabase, '');
test.when(testDatabase.dialect.supportsTempTables)('basic index', async () => {
  const model = await testDatabase.runtime.loadModel(
    `
        source: airports is db.table('malloytest.airports') extend {
        }
    `
  );
  let result = await model.search('airports', 'SANTA', 10);

  // if (result !== undefined) {
  //   console.log(result);
  // } else {
  //   console.log("no result");
  // }
  expect(result).toBeDefined();
  if (result !== undefined) {
    expect(result[0].fieldName).toBe('county');
    expect(result[0].fieldValue).toBe('SANTA ROSA');
    expect(result[0].weight).toBe(26);
    expect(result.length).toBe(10);
  }

  result = await model.search('airports', 'SANTA A', 100, 'city');
  if (result !== undefined) {
    // console.log(result);
    expect(result[0].fieldName).toBe('city');
    expect(result[0].fieldValue).toBe('SANTA ANA');
  }
});

it('index value map', async () => {
  const model = await testDatabase.runtime.loadModel(
    `
        source: airports is db.table('malloytest.airports') extend {
        }
    `
  );
  const result = await model.searchValueMap('airports');
  // if (result !== undefined) {
  //   console.log(result[4].values);
  // } else {
  //   console.log("no result");
  // }
  expect(result).toBeDefined();
  if (result !== undefined) {
    expect(result[4].values[0].fieldValue).toBe('WASHINGTON');
    expect(result[4].values[0].weight).toBe(214);
  }
});

it('index no sample rows', async () => {
  await expect(`
      run: db.table('malloytest.state_facts') extend {
        dimension: one is 'one'
      } -> {index:one, state }
        -> {select: fieldName, weight, fieldValue; order_by: 2 desc; where: fieldName = 'one'}
    `).toMatchResult(testModel, {fieldName: 'one', weight: 51});
});

// bigquery doesn't support row count based sampling; sqlserver's TABLESAMPLE
// returns whole pages, not the count asked for.
test.when(
  testDatabase.name !== 'bigquery' &&
    testDatabase.name !== 'trino' &&
    testDatabase.name !== 'presto' &&
    testDatabase.name !== 'sqlserver'
)('index rows count', async () => {
  await expect(`
        run: db.table('malloytest.state_facts') extend {
          dimension: one is 'one'
        } -> {index:one, state; sample: 10 }
            -> {select: fieldName, weight, fieldValue; order_by: 2 desc; where: fieldName = 'one'}
      `).toMatchResult(testModel, {fieldName: 'one', weight: 10});
});

it.when(testDatabase.name !== 'trino' && testDatabase.name !== 'presto')(
  'index rows count',
  async () => {
    await expect(`
      run: db.table('malloytest.flights') extend {
        dimension: one is 'one'
      } -> {index:one, tail_num; sample: 50% }
        -> {select: fieldName, weight, fieldValue; order_by: 2 desc; where: fieldName = 'one'}
    `).toMatchResult(testModel, {fieldName: 'one'});
    // Hard to get consistent results here so just check that we get a value back.
  }
);

const runsHere = ['bigquery', 'duckdb'].includes(testDatabase.name);

const modelText = `
source: ga_sessions is db.table('malloytest.ga_sample') extend {

  measure:
    user_count is count(fullVisitorId)
    session_count is count()
    total_visits is totals.visits.sum()
    total_hits is totals.hits.sum()
    total_page_views is totals.pageviews.sum()
    t2 is totals.pageviews.sum()
    total_productRevenue is hits.product.productRevenue.sum()
    hits_count is hits.count()
    sold_count is hits.count() { where: hits.product.productQuantity > 0 }

  view: by_source is {
    where: trafficSource.\`source\` != '(direct)'
    group_by: trafficSource.\`source\`
    aggregate: hits_count
    limit: 10
  }
  view: by_adContent_bar_chart is {
    group_by: device.browser
    aggregate: user_count
    group_by: device.deviceCategory
  }
  view: by_region is {
    where: geoNetwork.region !~ '%demo%'
    group_by: geoNetwork.region
    aggregate: user_count
    limit: 10
  }
  view: by_device is {
    group_by: device.browser
    aggregate: user_count
    group_by: device.deviceCategory
  }
  view: by_category is {
    group_by: category is hits.product.v2ProductCategory
    aggregate: total_productRevenue
    aggregate: sold_count
    limit: 10
  }
  view: by_hour_of_day is {
    // group_by: gsession_hour is hour(start_time::timestamp)
    aggregate: session_count
    order_by: 1
  }

  view: page_load_times is {
    group_by: hits.page.pageTitle
    aggregate: hit_count is hits.count()
    nest: load_bar_chart is {
      group_by: hit_seconds is floor(hits.latencyTracking.pageLoadTime / 2) * 2
      aggregate: hits_count
    }
    limit: 10
  }

  view: by_page_title is { where: totals.transactionRevenue > 0
    group_by: hits.page.pageTitle
    aggregate: hits_count
    aggregate: sold_count
  }

  view: by_all is {
    nest: by_source
    nest: by_adContent_bar_chart
    nest: by_region
    nest: by_category
  }

  view: search_index is {
    index: *, hits.*, customDimensions.* totals.*, trafficSource.*, hits.product.*
    sample: 1%
  }
}

query: sessions_dashboard is ga_sessions -> {
  nest:
    by_region
    by_device
    by_source
    by_category is {
      group_by: category is hits.product.v2ProductCategory
      aggregate: total_productRevenue
      aggregate: sold_count
    }
}
`;

describe('Nested Source Table', () => {
  const gaModel = wrapTestModel(testDatabase, modelText);
  const testModel = wrapTestModel(testDatabase, '');

  // Tests intermittently fail and lloyd said
  // "I bet it has to do with my sampling test on indexing. Intermittently
  //  getting different results. I'd comment out the test and I'll take a
  //  look at it when I get back." and that seems reasonable.
  // "search_index" is the test that failed, but a skipped both
  // this one and "manual index". Here's the errror:
  //   * Nested Source Table › search_index - duckdb
  //
  //      expect(received).toBe(expected) // Object.is equality
  //
  //      Expected: "Organic Search"
  //      Received: "Referral"
  test.when(runsHere)('search_index', async () => {
    await expect(`
        run: ga_sessions->search_index -> {
          where: fieldName is not null
          select: *
          order_by: fieldName, weight desc
          limit: 10
        }
      `).toMatchResult(gaModel, {});
  });

  test.when(runsHere)('manual index', async () => {
    let sampleSize = '10';
    if (testDatabase.name === 'bigquery') {
      sampleSize = 'false';
    }
    await expect(`
        run: db.table('malloytest.ga_sample')-> {
          index: *
          sample: ${sampleSize}
        }
        -> {
          aggregate: field_count is count(fieldName)
          nest: top_fields is {
            group_by: fieldName
            aggregate: row_count is count()
            limit: 100
          }
        }
      `).toMatchResult(testModel, {});
  });
});

it('basic index', async () => {
  // Make sure basic indexing works.
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: db.table('malloytest.flights') -> {
        index: *
      }
      -> {
        select: *
        order_by: fieldValue
        where: fieldName = 'carrier'
      }
      `).toMatchResult(testModel, {
    fieldValue: 'AA',
  });
});
