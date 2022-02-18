# Google Analytics

_You can find the complete source code for this model [here](https://github.com/looker-open-source/malloy/blob/docs-release/samples/ga_sessions/ga_sessions.malloy)._

Start by defining a source based on a query.

```malloy
source: ga_sesions is table('bigquery-public-data.google_analytics_sample.ga_sessions_20170801') {
  dimension: start_time is timestamp_seconds(visitStartTime)::timestamp
  measure: [
    user_count is count(distinct fullVisitorId)
    session_count is count()
    total_visits is totals.visits.sum()
    total_hits is totals.hits.sum()
    total_page_views is totals.pageviews.sum()
    total_productRevenue is hits.product.productRevenue.sum()
    sold_count is hits.count() { where: hits.product.productQuantity > 0 }
  ]
}
```

We can then add a few named queries to the model to easily access or reference elsewhere.

```malloy
  query: by_region is {
    top: 10
    where: geoNetwork.region !~ '%demo%'
    group_by: geoNetwork.region
    aggregate: user_count
  }

  query: by_device is {
    group_by: device.browser
    aggregate: user_count
    group_by: device.deviceCategory
  }

  query: by_source is {
    top: 10
    where: trafficSource.source != '(direct)'
    group_by: trafficSource.source
    aggregate: hits_count is hits.count()
  }

```

## Putting it all together

```malloy
--! {"isRunnable": true, "source": "ga_sessions/ga_sessions.malloy", "isPaginationEnabled": true, "size":"large", "queryName": "sessions_dashboard"}
query: sessions_dashboard is ga_sessions -> {
  nest: [
    by_region
    by_device
    by_source
    by_category is {
      group_by: category is hits.product.v2ProductCategory
      aggregate: [ total_productRevenue, sold_count ]
    }
  ]
}
```