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
define flights is (explore 'malloy-data.faa.flights'
  -- A dimension
  distance_km is distance_mi / 1.609344

  -- A measure
  flight_count is count()
);
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