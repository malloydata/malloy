# Explores

An explore consists of a data source along with a list of
additional properties which extend it, such as named fields, queries, and joins. When an explore is used in a query,
everything from the original source and all its extensions can be referenced.

## Explore Sources

An explore's source can be any of the following:

* A SQL table or view
* Another Malloy explore
* A Malloy query

### Explores from Tables or Views

An explore can be created from a SQL table or view from a connected database.

```malloy
--! {"isModel": true, "modelPath": "/inline/e1.malloy"}
explore: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}
```

When defining an explore in this way, all the columns from
the source table are available for use in field definitions
or queries.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e1.malloy"}
query: flights -> {
  // Columns from the source table are available
  group_by: [
    carrier
    origin
  ]
  aggregate: flight_count
  limit: 3
}
```

### Explores from Other Explores

An explore can also be created from another explore in order
to add fields, impose filters, or restrict available fields.
This is useful for performing in-depth analysis without altering
the base explore with modifications only relevant in that specific context.

```malloy
--! {"isModel": true, "modelPath": "/inline/e1.malloy"}
explore: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}

// new explore 'my_flights' adds total_distance and carrier_stats to flights
explore: my_flights is flights {
  measure: total_distance is distance.sum()

  query: carrier_stats is {
    group_by: carrier
    aggregate: [ total_distance, flight_count ]
  }
}
```
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e1.malloy"}
query: my_flights -> carrier_stats { limit: 3 }
```

### Explores from Queries

A Query can be used as the source for an explore.
In Malloy, every query has a shape like that of an explore,
so the output fields of a query can be used to define a new
explore.

When defining an explore from a query, the query can either
be defined inline or referenced by name.

**Inline query as explore source**

```malloy
--! {"isModel": true, "modelPath": "/inline/e2.malloy"}
explore: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}

explore: carrier_facts is from(
  flights -> {
    group_by: carrier
    aggregate: lifetime_flights is flight_count
  }
) {
  dimension: lifetime_flights_bucketed is floor(lifetime_flights / 10000) * 10000
}

```
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e2.malloy"}
query: carrier_facts -> {
  project: [ carrier, lifetime_flights_bucketed, lifetime_flights ]
  limit: 3
}
```


**Named query as explore source**

```malloy
--! {"isModel": true, "modelPath": "/inline/e3.malloy"}
explore: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
  query: by_carrier is {
    group_by: carrier
    aggregate: lifetime_flights is flight_count
  }
}

explore: carrier_facts is from(flights -> by_carrier) {
  dimension: lifetime_flights_bucketed is floor(lifetime_flights / 10000) * 10000
}
```
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e3.malloy"}
query: carrier_facts -> {
  project: [ carrier, lifetime_flights_bucketed, lifetime_flights ]
  limit: 3
}
```
For more information about named queries appearing in models, see the [Models](statement.md) section.

### Explores from SQL Blocks

Explores can be created from a SQL block, e.g.

```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "size": "large" }
sql: my_sql_query is ||
  SELECT
    first_name,
    last_name,
    gender
  FROM malloy-data.ecomm.users
  LIMIT 10
;;

explore: limited_users is from_sql(my_sql_query) {
  measure: user_count is count()
}

query: limited_users -> {
  aggregate: user_count
}
```

## Explore Modifications

An explore can introduce a number of different
modifications or additions to its source, including adding
filters, specifying a `primary key`, adding fields and
joins, renaming fields, or limiting which fields are
available.

### Filtering Explores

When an explore is defined, filters which apply to any query against the new explore may be added.

```malloy
--! {"isModel": true, "modelPath": "/inline/e4.malloy"}
explore: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}

explore: long_sfo_flights is flights {
  where: origin = 'SFO' and distance > 1000
}
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e4.malloy"}
query: long_sfo_flights -> { group_by: destination; aggregate: flight_count; limit: 3 }
```

### Primary Keys

To be used in joins to other explores, an explore must
have a primary key specified.

```malloy
explore: carriers is table('malloy-data.faa.carriers') {
  primary_key: code
}
```

### Joins

When explores are joined as part of their definition, queries can reference fields in the joined explores without having to specify the join relationship each time.

```malloy
--! {"isModel": true, "modelPath": "/inline/e5.malloy"}
explore: carriers is table('malloy-data.faa.carriers') {
  primary_key: code
}

explore: flights is table('malloy-data.faa.flights') {
  join_one: carriers with carrier
  measure: flight_count is count()
}
```
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "source": "/inline/e5.malloy"}
query: flights -> {
  group_by: carriers.nickname
  aggregate: flight_count
  limit: 3
}
```



See the [Joins](join.md) section for more information on working with joins.

### Adding Fields

Fields—dimensions, measures, and queries—may be defined as
part of an explore, allowing for them to be used in any
query against the explore.

```malloy
explore: airports is table('malloy-data.faa.airports') {
  // A dimension
  dimension: has_control_tower is cntl_twr = 'Y'

  // A measure
  measure: average_elevation is avg(elevation)

  // A query
  query: average_elevation_by_control_tower is {
    group_by: has_control_tower
    nest: average_elevation
  }
}
```

### Renaming Fields

Fields from an explore's source may be renamed in the context of the
new explore. This is useful when the original name is not descriptive, or has a different meaning in the new explore.

```malloy
explore: flights is table('malloy-data.faa.flights') {
  rename: facility_type is fac_type
  rename: origin_code is origin

  join_one: origin is airports with origin_code
}
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
explore: airports is table('malloy-data.faa.airports') {
  accept: [ id, name, code, city, state, elevation ]
}
```

**Excepting fields**

```malloy
explore: airports is table('malloy-data.faa.airports') {
  except: [ c_ldg_rts, aero_cht, cntl_twr ]
}
```
