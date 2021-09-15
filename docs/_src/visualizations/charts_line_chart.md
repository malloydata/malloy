# Line Charts
Line charts take two or three parameters.

* First parameter -  X-axis is time field or numeric expression
* Second parameter - Y-axis is a numeric expression
* Thrid (optional) Pivot is dimensional field (numeric or string)

Data Style is <code>'line_chart'</code>

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "medium", "dataStyles": {"departures_by_month":{"renderer":"line_chart"}}}
explore 'malloy-data.faa.flights'
| reduce
  departures_by_month is (reduce
    departure_month is dep_time.month
    flight_count is count()
  )
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "medium", "dataStyles": {"carriers_by_month":{"renderer":"line_chart"}}}
explore 'malloy-data.faa.flights'
| reduce
  carriers_by_month is (reduce
    departure_month is dep_time.month
    flight_count is count()
    carrier
  )
```

Style
```json
{
  "carriers_by_month" : {
    "renderer": "line_chart"
  },
  "departures_by_month" : {
    "renderer": "line_chart"
  }
}
```
