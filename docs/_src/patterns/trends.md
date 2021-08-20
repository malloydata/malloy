# Trend Analysis
Filters make it easy to reuse aggreate calculations for trends analysis.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
-- common calculation for flights
define flights is ('malloy-data.faa.flights'
  flight_count is count(*)
);

explore flights 
| reduce
  carrier
  flights_in_2020 is flight_count : [dep_time : @2020]
  flights_in_2019 is flight_count : [dep_time : @2019]
  growth is (flight_count : [dep_time : @2020] - flight_count : [dep_time : @2019]) 
    / NULLIF( flight_count : [dep_time : @2020],0)*100
```


## Using Relative Timeframes
Often you want to show upto date information.  You can write timeframes relatively so the queries always show
current data.  Read more about it in the [filters](filter_expressions.md) section.  *(note, appears to be a bug 
time range filters, '2 years ago' is showing 2 years worth of data)*.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
-- common calculation for flights
define flights is ('malloy-data.faa.flights'
  flight_count is count(*)
);

explore flights 
| reduce
  carrier
  last_year is flight_count : [dep_time : now.year-1 year]
  prior_year is flight_count : [dep_time : now.year-2 year]
  growth is (flight_count : [dep_time : now.year-1 year] - flight_count: [dep_time : now.year-2 years]) 
    / NULLIF( flight_count : [dep_time : now.year-2 years],0)*100
```


## Declaring and reusing common expressions
We can rewrite the query so it is more reusable.  The declarations after the explore are temporary additions to flights for this query.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
-- common calculation for flights
define flights is ('malloy-data.faa.flights'
  flight_count is count(*)
);

explore flights 
  fields
    -- mtoy: bug '+0' forces expression.
    last_year is flight_count : [dep_time : now.year-1 year] + 0
    prior_year is flight_count : [dep_time : now.year-2 year] + 0
    growth is (last_year - prior_year) 
        / NULLIF(prior_year,0)*100
| reduce
  carrier
  last_year 
  prior_year
  growth 
```
