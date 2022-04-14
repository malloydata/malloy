# Segment Maps

The plugin currently supports US maps. Segment maps take as input 4 columns: start latitude , start longitude, end latitude, and  end longitude of the segment.  The model and data styles for the subsequent examples are:

```malloy
--! {"isModel": true, "modelPath": "/inline/e.malloy"}
source: airports is table('malloy-data.faa.airports') {
  primary_key: code
  dimension: name is concat(code, ' - ', full_name)
  measure: airport_count is count()
}

source: flights is table('malloy-data.faa.flights') {
  primary_key: id2
  rename: origin_code is origin
  rename: destination_code is destination

  join_one: origin is airports with origin_code
  join_one: destination is airports with destination_code

  measure: flight_count is count()

  query: routes_map is {
    group_by:
      origin.latitude
      origin.longitude
      latitude2 is destination.latitude
      longitude2 is destination.longitude
    aggregate: flight_count
  }
}

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
--! {"isRunnable": true, "runMode": "auto", "source": "/inline/e.malloy", "size": "medium", "pageSize": 100000, "dataStyles":{"routes_map": {"renderer": "segment_map"}}}
query: flights { where: dep_time = @2003-02 and origin.code = 'ORD' } -> routes_map
```

## Run as a trellis
By calling the configured map as a nested query, a trellis is formed.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "/inline/e.malloy", "size": "medium", "dataStyles":{"routes_map": {"renderer": "segment_map"}}}
query: flights { where: dep_time = @2003-02 and origin.code = 'ORD' } -> {
  group_by: carrier
  aggregate: flight_count
  nest:routes_map
}
```

## Run as a trellis, repeated with different filters

```malloy
--! {"isRunnable": true, "runMode": "auto", "size": "large", "source": "faa/flights.malloy"}
query: flights -> {
  group_by: carrier
  aggregate: flight_count
  nest:
    ord_segment_map is routes_map { where: origin.code ? 'ORD' }
    sfo_segment_map is routes_map { where: origin.code ? 'SFO' }
    jfk_segment_map is routes_map { where: origin.code ? 'JFK' }
}

```
