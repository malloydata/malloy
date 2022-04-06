# Models

Malloy recognizes modeling as a key aspect of data analytics and provides tools that allow for modularity and reusability of definitions. Whereas in SQL, queries generally define all metrics inline, requiring useful snippets to be saved and managed separately, in Malloy,
_dimensions_, _measures_, and _queries_ can be saved and attached to a modeled source.

## Sources

A Malloy model file can contain several _sources_, which can be thought of as a table and a collection of computations and relationships which are relevant to that table.

```malloy
--! {"isModel": true, "modelPath": "/inline/e.malloy"}
source: flights is table('malloy-data.faa.flights') {
  dimension: distance_km is distance / 1.609344

  measure: flight_count is count()

  query: by_carrier is {
    group_by: carrier
    aggregate: flight_count
  }
}
```
See [here](source.md) for more information on sources.

## Queries

### Referencing a modeled query
```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e.malloy"}
query: flights -> by_carrier
```

### Running a named query with a filter
```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e.malloy"}
query: flights { where: origin = 'SFO' } -> by_carrier
```


### Adding a limit on the Query
```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e.malloy"}
query: flights { where: origin = 'SFO' } -> by_carrier { limit: 2 }
```

### Putting it all together
First, we'll create a brand new query:
```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e.malloy"}
query: flights -> {
  group_by: destination
  aggregate:
    flight_count
    average_distance_in_km is distance_km.avg()
}
```

Now we'll compose a query which contains both modeled and ad-hoc components:

```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e.malloy"}
query: flights -> {
  group_by: destination
  aggregate:
    flight_count
    average_distance_in_km is distance_km.avg()
  nest: top_carriers is by_carrier { limit: 2 }
}
```
See [here](query.md) for more information on queries.
