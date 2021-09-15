# Segment Maps

The plugin currently supports US maps. Segement maps take as input 4 columns: start latitude , start longitude, end latitude, and  end longitude of the segment.  The model and data styles for the subsequent examples are:

```malloy
define airports is (explore 'malloy-data.faa.airports'
  primary key code
  airport_count is count(*)
);

define flights is (explore 'malloy-data.faa.flights'
  primary key id2

  origin_code renames origin
  destination_code renames destination
  origin is join airports on origin_code,
  destination is join airports on destination_code

  flight_count is count()

  routes_map is (reduce
    origin.latitude
    origin.longitude
    latitude2 is destination.latitude
    longitude2 is destination.longitude
    flight_count
  )


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
## Run as a simple query
Departing from Chicago

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size": "medium" }
explore flights : [dep_time : @2003-02, origin.code : 'ORD']
| routes_map
```

## Run as a turtle

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "medium", "source": "faa/flights.malloy"}
explore flights : [dep_time : @2003-02, origin.code : 'ORD']
| reduce
  routes_map
```

## Run as a trellis
By calling the configured map as a turtle, a trellis is formed.

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "large", "source": "faa/flights.malloy"}
explore flights : [dep_time : @2003-02, origin.code : 'ORD']
| reduce
  carrier
  flight_count
  routes_map
```

## Run as a trellis, repeated with different filters

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
