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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
/* eslint-disable no-console */

import '../../util/db-jest-matchers';
import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';

// No prebuilt shared model, each test is complete.  Makes debugging easier.

const [describe, databases] = describeIfDatabaseAvailable([
  'bigquery',
  'duckdb',
]);

function modelText(databaseName: string) {
  return `
source: ga_sessions is ${databaseName}.table('malloytest.ga_sample') extend {

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
}

const runtimes = new RuntimeList(databases);
describe.each(runtimes.runtimeList)(
  'Nested Source Table - %s',
  (databaseName, runtime) => {
    const gaModel = runtime.loadModel(modelText(databaseName));
    test(`repeated child of record - ${databaseName}`, async () => {
      await expect('run: ga_sessions->by_page_title').malloyResultMatches(
        gaModel,
        {pageTitle: 'Shopping Cart'}
      );
    });

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
    test(`search_index - ${databaseName}`, async () => {
      await expect(`
        run: ga_sessions->search_index -> {
          where: fieldName != null
          select: *
          order_by: fieldName, weight desc
          limit: 10
        }
      `).malloyResultMatches(gaModel, {
        // fieldName: 'channelGrouping',
        // fieldValue: 'Organic Search',
        // weight: 10,
      });
    });

    test(`manual index - ${databaseName}`, async () => {
      let sampleSize = '10';
      if (databaseName === 'bigquery') {
        sampleSize = 'false';
      }
      await expect(`
        run: ${databaseName}.table('malloytest.ga_sample')-> {
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
      `).malloyResultMatches(runtime, {
        // 'top_fields.fieldName': 'channelGrouping',
        // 'top_fields.fieldValue': 'Organic Search',
        // 'top_fields.weight': 18,
      });
    });

    test(`autobin - ${databaseName}`, async () => {
      await expect(`
        source: airports is ${databaseName}.table('malloytest.airports') extend {
          measure: airport_count is count()
          view: by_elevation is {
            aggregate: bin_size is NULLIF((max(elevation) - min(elevation))/30,0)
            nest: data is {
              group_by: elevation
              aggregate: row_count is count()
            }
          }
          -> {
            group_by: elevation is floor(data.elevation/bin_size)*bin_size + bin_size/2
            aggregate: airport_count is data.row_count.sum()
            order_by: elevation
          }
        }

        run: airports -> {
          group_by: state is state
          aggregate: airport_count
          nest: by_elevation_bar_chart is by_elevation
        }
      `).malloyResultMatches(runtime, {
        // don't know what to expect ...
      });
    });
  }
);

afterAll(async () => {
  await runtimes.closeAll();
});
