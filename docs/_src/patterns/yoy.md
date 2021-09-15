# Year Over Year Analysis
There are a couple of different ways to go about this in Malloy.

## Method 1: Pivoting a Visualization

Compare performace of different years on the same scale.  Line charts take the X-Axis, Y-Axis and Dimensional Axis as parameters.
In this Case, the X-Axis is `month_of_year`, the Y-Axis is `flight_count` and the Dimensional Axis is the year.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "medium", "dataStyles": {"year_over_year":{"renderer":"line_chart"}}}
explore 'malloy-data.faa.flights'
    flight_count is count()
| reduce
  year_over_year is (reduce
    month_of_year is month(dep_time)
    flight_count
    flight_year is dep_time.year
  )
```

## Method 2: Filtered Aggregates
Filters make it easy to reuse aggreate calculations for trends analysis.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
-- common calculation for flights
define flights is ('malloy-data.faa.flights'
  flight_count is count(*)
);

explore flights
| reduce top 10
  carrier
  flights_in_2002 is flight_count : [dep_time : @2003]
  flights_in_2003 is flight_count : [dep_time : @2002]
  percent_change is round(
      (flight_count : [dep_time : @2003] - flight_count : [dep_time : @2002])
        / NULLIF( flight_count : [dep_time : @2003],0)*100
    ,1)
```


### Using Relative Timeframes
Often you want to show up-to-date information.  You can write timeframes relatively so the queries always show
current data.  Read more about it in the [filters](filter_expressions.md) section.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
-- common calculation for order_items
define inventory_items is (explore 'malloy-data.ecomm.inventory_items'
  primary key id
);

define order_items is ('malloy-data.ecomm.order_items'
  inventory_items is join on inventory_item_id
  order_item_count is count(*)
);

explore order_items
| reduce top 10
    inventory_items.product_category
    last_year is order_item_count : [created_at : now.year-1 year]
    prior_year is order_item_count : [created_at : now.year-2 year]
    percent_change is round(
      (order_item_count : [created_at : now.year-1 year] - order_item_count : [created_at : now.year-2 year])
        / NULLIF(order_item_count : [created_at : now.year-2 year],0)*100
      ,1)
```


### Declaring and reusing common expressions
We can rewrite the query so it is more reusable.  The declarations after the explore are temporary additions to this order_items table for the sake of just this query.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
-- common calculation for order_items
define inventory_items is (explore 'malloy-data.ecomm.inventory_items'
  primary key id
);

define order_items is ('malloy-data.ecomm.order_items'
  inventory_items is join on inventory_item_id
  order_item_count is count(*)
);

explore order_items
    last_year is order_item_count : [created_at : now.year-1 year]
    prior_year is order_item_count : [created_at : now.year-2 year]
    percent_change is round((last_year - prior_year)
        / NULLIF(prior_year,0)*100,1)
| reduce top 10
  inventory_items.product_category
  last_year
  prior_year
  percent_change
```
