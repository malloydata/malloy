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
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true}
explore: flights is table('malloy-data.faa.flights'){
  -- A dimension
  dimension: distance_km is distance / 1.609344

  -- A measure
  measure: flight_count is count()

  query: by_carrier is  {
    limit: 3
    group_by: carrier
    aggregate: flight_count
  }
}
// run this query
query: flights->by_carrier
```

See [here](explore.md) for more information on explores.

## Queries

Named queries can also be defined at the top level of a model.

```malloy
query: flights_by_destination is flights->{
  group_by: destination
  measure: [
    flight_count
    average_distance_in_km is distance_km.avg()
  ]
}
```

See [here](query.md) for more information on queries.