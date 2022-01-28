# Sessionized Data

Flight data contains time, carrier, origin, destination and the plane that made the flight (`tail_num`).  Take the
flight data and sessionize it by carrier and date.  Compute statistics and the session, plane and flight level.
Retain the original flight events.

```malloy
--! {"isRunnable": true, "showAs": "json", "runMode": "auto", "isPaginationEnabled": true, "size": "large"}
query: table('malloy-data.faa.flights') {
  where: carrier = 'WN' and dep_time: @2002-03-03
  measure: flight_count is count()
} -> {
  group_by: [
    flight_date is dep_time.day
    carrier
  ]
  aggregate: daily_flight_count is flight_count
  nest: per_plane_data is {
    top: 20
    group_by: tail_num
    aggregate: plane_flight_count is flight_count
    nest: flight_legs is {
      order_by: 2
      group_by: [
        tail_num
        dep_minute is dep_time.minute
        origin
        destination
        dep_delay
        arr_delay
      ]
    }
  }
}
```
