# Google Analytics.

Simple Model.

```malloy
export define ga_sessions is (explore 'bigquery-public-data.google_analytics_sample.ga_sessions_20170801'
  start_time is cast(timestamp_seconds(visitStartTime) as timestamp)
  user_count is count(distinct fullVisitorId)
  session_count is count()
  total_visits is totals.visits.sum()
  total_hits is totals.hits.sum()
  total_page_views is totals.pageviews.sum()
  total_productRevenue is hits.product.productRevenue.sum()
  sold_count is hits.count() : [hits.product.productQuantity : >0 ]
);
```


## By Source 

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "ga_sessions/ga_sessions.malloy", "isPaginationEnabled": true}
explore ga_sessions 
| reduce
  by_source is (reduce top 10 : [trafficSource.source: != '(direct)']
    trafficSource.source
    hits_count is hits.count()
  )
```

## By Device

```malloy
--! {"isRunnable": true, "source": "ga_sessions/ga_sessions.malloy", "isPaginationEnabled": true, "size":"medium"}
explore ga_sessions 
| reduce
  by_device is (reduce 
    device.browser
    user_count
    device.deviceCategory
  )
```

## By Region

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "ga_sessions/ga_sessions.malloy", "isPaginationEnabled": true}
explore ga_sessions 
| reduce
  by_region is (reduce top 10 : [geoNetwork.region !~ '%demo%'] 
    geoNetwork.region
    user_count
  )
```

## As a dashboard

```malloy
--! {"isRunnable": true, "source": "ga_sessions/ga_sessions.malloy", "isPaginationEnabled": true, "size":"large"}
explore ga_sessions 
| reduce
  by_region is (reduce top 10 : [geoNetwork.region !~ '%demo%']
    geoNetwork.region
    user_count
  )
  by_device is (reduce 
    device.browser
    user_count
    device.deviceCategory
  )
  by_source is (reduce top 10 : [trafficSource.source !~ '(direct)'] 
    trafficSource.source
    hits_count is hits.count()
  )
  by_category is (reduce top 10
    category is hits.product.v2ProductCategory
    total_productRevenue
    sold_count
  )
```