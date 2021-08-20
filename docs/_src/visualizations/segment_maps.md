# Segment Maps

malloy can create segment maps.  By currently it uses US maps and state names.

Segement maps take as input a series take a table with 4 columns, lat, long, lat, long of the segment.

The model and data styles for the subsequent examples is:

```malloy
define airports is (explore 'malloy-data.faa.airports'
  primary key code
  airport_count is count(*)
);

define flights is (explore 'malloy-data.faa.flights'
  primary key id2
  origin_code renames origin
  destination_code renames destination
  flight_count is count(*)

  routes_map is (reduce
    origin.latitude
    origin.longitude
    latitude2 is destination.latitude
    longitude2 is destination.longitude
    flight_count
  )

  joins
    origin is airports on origin_code,
    destination is airports on destination_code
);

```

and data styles are
```json
{
  "routes_map": {
    "renderer": "segment_map"
  }
} 
```
## Run as a simple query.
Depararting from Chicago

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size": "medium" }
explore flights : [dep_time : @2003-02, origin.code : 'ORD'] 
| routes_map
```

## Run as a turtle.

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "medium", "source": "faa/flights.malloy"}
explore flights : [dep_time : @2003-02, origin.code : 'ORD'] 
| reduce
  routes_map
```

## Run as a trellis.

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "large", "source": "faa/flights.malloy"}
explore flights : [dep_time : @2003-02, origin.code : 'ORD'] 
| reduce
  carrier
  flight_count
  routes_map
```

## Run as a trellis repeated filtered

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "large", "source": "faa/flights.malloy"}
explore flights : [dep_time : @2003-02] 
| reduce : [origin.code : 'ORD'|'SFO'|'JFK']
  carrier
  flight_count
   ord is routes_map : [ origin.code: 'ORD']
   sfo is routes_map : [ origin.code: 'SFO']
   jfk is routes_map : [ origin.code: 'JFK']

```
