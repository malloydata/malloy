# Models

Malloy recognizes modeling as a key aspect of data analyitics and
provides tools that allow for modularity and reusability of definitions.
Whereas in SQL, queries generally define all metrics inline,
requiring useful snippets to be saved and managed separately, in Malloy,
_dimensions_, _measures_, and _queries_ can be saved and attached to a
modeled _explore_.

## Explores

A Malloy model file can contain several _explores_, which define fields that can be
used in queries.

```malloy
--! {"isModel": true, "modelPath": "/inline/e.malloy"}
explore: flights is table('malloy-data.faa.flights'){
  dimension: distance_km is distance / 1.609344

  measure: flight_count is count()

  query: by_carrier is  {
    group_by: carrier
    aggregate: flight_count
  }
}
```
See [here](explore.md) for more information on explores.

## Queries

### Using modeled in query.
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e.malloy"}
query: flights->by_carrier
```

### Using modeled with a filter.
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e.malloy"}
query: flights{where: origin: 'SFO'}->by_carrier
```
### Setting a limit on the Query
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e.malloy"}
query: flights{where: origin: 'SFO'}->by_carrier{limit: 2}
```


### Creating a brand new Query.
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e.malloy"}
query: flights->{
  group_by: destination
  aggregate: [
    flight_count
    average_distance_in_km is distance_km.avg()
  ]
}
```

### Putting it all together.
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e.malloy"}
query: flights->{
  group_by: destination
  aggregate: [
    flight_count
    average_distance_in_km is distance_km.avg()
  ]
  nest: top_carriers is by_carrier{limit: 2}
}
```
See [here](query.md) for more information on queries.