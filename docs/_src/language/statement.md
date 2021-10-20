# Models

Malloy recognizes modeling as a key aspect of data analyitics and
provides tools that allow for modularity and reusability of definitions.
Whereas in SQL, queries generally define all metrics inline,
requiring useful snippets to be saved and managed separately, in Malloy,
_dimensions_, _measures_, and _queries_ can be saved and attached to a
modeled _explore_.

## Explores

A Malloy model can contain several _explores_, which usually start with a database
table and its associaed schema.

```malloy
define flights is (explore 'malloy-data.faa.flights');
```

When an explore is defined from a table, all its columns are automatically available as part of the explore's interface.

```malloy
flights | reduce
  -- Columns from the source table are available
  origin
  destination
```

### Extending an Explore

When defining an explore, it is possible to declare additional fields to be used in
any query involving the explore (either directly, or via a join).

```malloy
define flights is (explore 'malloy-data.faa.flights'
  -- A dimension
  distance_km is distance_mi / 1.609344

  -- A measure
  flight_count is count()

  -- A query
  by_distance_bucket_km is (reduce
    -- The dimension `distance_km` can be used here because
    -- it is defined within this explore.
    distance_bucket_km is floor(distance_km / 100)

    -- Likewise, `flight_count` is defined above.
    flight_count
  )
);

-- Usage in a query
flights | reduce
  carrier
  flight_count
  by_distance_bucket_km
```

See [here](explore.md) for more information on explores.

## Queries

Named queries can also be defined at the top level of a model.

```malloy
define flights_by_carrier is (flights | reduce
  carrier
  flight_count
)
```

See [here](query.md) for more information on queries.