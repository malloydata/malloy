# Explores

An explore consists of a data source along with a list of
additional properties which extend it, such as named fields, queries, and joins. When an explore is used in a query,
everything from the original source and all its extensions can be referenced.

```malloy
define my_explore is (explore source
  -- Extensions go here
);
```

## Explore Sources

An explore's source can be any of the following:

* A SQL table or view
* Another Malloy explore
* A Malloy query

### Explores from Tables or Views

An explore can be created from a SQL table or view from a connected database.

```malloy
define flights is (explore 'malloy-data.faa.flights'
  ...
);
```

When defining an explore in this way, all the columns from
the source table are available for use in field definitions
or queries.

```malloy
flights | reduce
  -- Columns from the source table are available
  distance
  carrier
```

### Explores from Other Explores

An explore can also be created from another explore in order
to add fields, impose filters, or restrict available fields.
This is useful for performing in-depth analysis without altering
the base explore with modifications only relevant in that specific context.

```malloy
define sfo_flights is (explore flights : [origin = 'SFO']);
```

### Explores from Queries

Lastly, a query can be used as the source for an explore.
In Malloy, every query has a shape like that of an explore,
so the output fields of a query can be used to define a new
explore.

When defining an explore from a query, the query can either
be defined inline or referenced by name.

**Inline query as explore source**

```malloy
define carriers is (explore (flights | reduce
  code is carrier
  flight_count is count()
)
  ...
);
```

**Named query as explore source**

```malloy
define flight_origins is (flights | reduce
  code is origin
  flight_count is count()
);

define origins is (explore flight_origins
  ...
);
```

For more information about named queries appearing in models, see the [Models](statement.md) section.

## Explore Modifications

An explore can introduce a number of different
modifications or additions to its source, including adding
filters, specifying a `primary key`, adding fields and
joins, renaming fields, or limiting which fields are
available.

### Filtering Explores

When an explore is defined, filters which apply to any query against the new explore may be added.

```malloy
define long_sfo_flights is (explore flights : [
  distance > 1000,
  origin = 'SFO'
]);
```

### Primary Keys

To be used in joins to other explores, an explore must
have a primary key specified.

```malloy
define carriers is (explore 'malloy-data.faa.carriers'
  primary key code
);
```

### Joins

When explores are joined as part of their definition, queries can reference fields in the joined explores without having to specify the join relationship each time.

```malloy
define flights is (explore 'malloy-data.faa.flights'
  carriers is join on carrier_code
);

explore flights | reduce
  carriers.name
  flight_count
```

See the [Joins](join.md) section for more information on working with joins.

### Adding Fields

Fields—dimensions, measures, and queries—may be defined as
part of an explore, allowing for them to be used in any
query against the explore.

```malloy
define airports is (explore 'malloy-data.faa.airports'
  -- A dimension
  has_control_tower is cntl_twr = 'Y'

  -- A measure
  average_elevation is avg(elevation)

  -- A query
  average_elevation_by_control_tower is (reduce
    has_control_tower
    average_elevation
  )
);
```

### Renaming Fields

Fields from an explore's source may be renamed in the context of the
new explore. This is useful when the original name is undescriptive or has a different meaning in the new explore.

```malloy
define flights is (explore 'malloy-data.faa.flights'
  facility_type renames fac_type
  origin_code renames origin

  origin is join airports on origin_code
);
```

### Limiting Access to Fields

The list of fields available in an explore from its source
can be limited. This can be done either by `accept`ing a
list of fields to include (in which case any other field
from the source is excluded, i.e. an "allow list") or by
`except`ing a list of fields to exclude (any other field
is included, i.e. a "deny list"). These cannot be used in
conjunction with one another.

**Accepting fields**

```malloy
define airports is (explore 'malloy-data.faa.airports'
  accept id, name, code, city, state, elevation
);
```

**Excepting fields**

```malloy
define airports is (explore 'malloy-data.faa.airports'
  except c_ldg_rts, aero_cht, cntl_twr
);
```