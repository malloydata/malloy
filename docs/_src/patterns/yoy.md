# Year Over Year Analysis
There are a couple of different ways to go about this in Malloy.

## Method 1: Pivoting a Visualization

Compare performance of different years on the same scale.  Line charts take the X-Axis, Y-Axis and Dimensional Axis as parameters.
In this Case, the X-Axis is `month_of_year`, the Y-Axis is `flight_count` and the Dimensional Axis is the year.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "medium", "dataStyles": {"year_over_year":{"renderer":"line_chart"}}}
source: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}

query: flights -> {
  nest: year_over_year is {
    group_by: month_of_year is month(dep_time)
    aggregate: flight_count
    group_by: flight_year is dep_time.year
  }
}
```

## Method 2: Filtered Aggregates
Filters make it easy to reuse aggregate calculations for trends analysis.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
// common calculation for flights
source: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}

query: flights->{
  group_by: carrier
  aggregate:
    flights_in_2002 is flight_count { where: dep_time = @2002 }
    flights_in_2003 is flight_count { where: dep_time = @2003 }
    percent_change is round(
      (flight_count { where: dep_time = @2003 } - flight_count { where: dep_time = @2002 })
        / nullif(flight_count { where: dep_time = @2003 }, 0) * 100,
      1
    )
}
```


### Using Relative Timeframes
Often you want to show up-to-date information.  You can write timeframes relatively so the queries always show
current data.  Read more about it in the [filters](filter_expressions.md) section.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
source: inventory_items is table('malloy-data.ecomm.inventory_items') {
  primary_key: id
}

source: order_items is table('malloy-data.ecomm.order_items') {
  join_one: inventory_items with inventory_item_id
  measure: order_item_count is count()
}

query: order_items -> {
  top: 10
  group_by: inventory_items.product_category
  aggregate:
    last_year is order_item_count { where: created_at: now.year - 1 year }
    prior_year is order_item_count { where: created_at: now.year - 2 years }
    percent_change is round(
      (order_item_count { where: created_at: now.year - 1 year } - order_item_count { where: created_at: now.year - 2 years })
        / nullif(order_item_count { where: created_at : now.year - 2 years }, 0) * 100,
      1
    )
}
```


### Declaring and reusing common expressions
We can rewrite the query so it is more reusable.  The declarations after the source are temporary additions to this order_items table for the sake of just this query.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
-- common calculation for order_items
source: inventory_items is table('malloy-data.ecomm.inventory_items') {
  primary_key: id
}

source: order_items is table('malloy-data.ecomm.order_items') {
  join_one: inventory_items  with inventory_item_id
  measure: order_item_count is count()
}

query: order_items{
  measure: [
    // these caclulations can be used in multipe parts of the query
    last_year is order_item_count { where: created_at: now.year - 1 year }
    prior_year is order_item_count { where: created_at: now.year - 2 years }
  ]
} -> {
  top: 10
  group_by: inventory_items.product_category
  aggregate:
    last_year
    prior_year
    percent_change is round(
      (last_year - prior_year) / nullif(last_year, 0) * 100,
      1
    )
}
```
