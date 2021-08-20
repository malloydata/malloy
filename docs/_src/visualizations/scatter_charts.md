# Scatter Charts

Scatter charts can compare two numeric values. 

Thedata styles for the subsequent examples is:

and data styles are
```json
{
  "seats_by_distance": {
    "renderer": "scatter_chart"
  },
} 
```

## Run as a turtle.

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "medium", "source": "faa/flights.malloy"}
explore flights : [dep_time : @2003-02, origin_code : 'SFO']  
| reduce
  seats_by_distance_scatter_chart is (reduce
    seats is aircraft.aircraft_models.seats
    distance is distance
    route_count is count(distinct concat(origin_code, destination_code))
  )
```

## Run as a trellis.

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "large", "source": "faa/flights.malloy"}
explore flights : [dep_time : @2003-02, origin_code : 'ATL' | 'SFO' | 'SJC' | 'BUR']  
| reduce
  origin_code
  seats_by_distance_scatter_chart is (reduce
    seats is aircraft.aircraft_models.seats
    distance is distance
    route_count is count(distinct concat(origin_code, destination_code))
  )
```
