# Sessionized Data

Flight data contains time, carrier, origin, destination and the plane that made the flight (`tail_num`).  Take the
flight data and sessionize it by carrier and date.  Compute statistics and the session, plane and flight level.
Retain the original flight events.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "large"}
explore 'malloy-data.faa.flights'
  fields
    flight_count is count()
| reduce:  [carrier : 'WN', dep_time : '2002-03-03']
  dep_time.`date`
  carrier
  flight_count
  plane is (reduce top 20
    tail_num
    flight_count
    flights is (reduce order by 2
      tail_num
      dep_minute is dep_time.minute
      origin
      destination
    )
  )
```
