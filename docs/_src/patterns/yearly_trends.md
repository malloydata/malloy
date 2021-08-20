# Year-over-Year Trends

Compare performace of different years on the same scale.  Line charts take the X-Axis, Y-Axis and Dimensional Axis as parameters.
In this Case, the X-Axis is `month_of_year`, the Y-Axis is `flight_count` and the Dimensional Axis is the year.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "medium", "dataStyles": {"year_over_year":{"renderer":"line_chart"}}}
explore 'malloy-data.faa.flights'
  fields
    flight_count is count(*)
| reduce
  year_over_year is (reduce
    month_of_year is month(dep_time)
    flight_count
    flight_year is dep_time.year
  )
```
