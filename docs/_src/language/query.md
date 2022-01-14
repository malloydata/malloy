# Queries

The basic syntax for a query in Malloy consists of a source
and a "pipeline" of one or more _stages_ seperated by a vertical bar (or "pipe"). The shape of the data defined in the original explore is transformed by each stage.

```malloy
flights | reduce carrier, flight_count is count()
```

## Sources

The source of a query can be a table, an [explore](explore.md), or a [named query](statement.md#queries).

**A query against a table**

```malloy
query: table('malloy-data.faa.flights')->{aggregate: flight_count is count()}
```

**A query against an explore**

```malloy
--! {"isModel": true, "modelPath": "/inline/airports_mini.malloy"}
explore: flights is table('malloy-data.faa.flights'){}

query: flights->{aggregate: flight_count is count()}

```

**A query starting from another query**
```malloy
query: flights_by_carrier is table('malloy-data.faa.flights'){
  group_by: carrier
  aggregate: flight_count
}

query: flights_by_carrier->{project: carrier; limit: 2}
```

When a query is defined as part of an explore or nested inside
another query stage, the source is implicit.

```malloy
query: table('malloy-data.faa.flights'){
  group_by:  dep_year is dep_time.year
  nest: by_carrier is {
    group_by: carrier
    aggregate: flight_count is count()
  }
}
```

## Pipelines

A pipeline transforms the shape of an explore, and is made up of a series of stages.

A typical stage is has either `group_by`/`aggregate` or `project`, or `index` transformation consisting of a set of fields, and optionally filters and ordering/limiting specification.

```malloy
query: flights->{
  where: distance > 1000            -- Filters
  top: 2
  order_by: flight_count desc -- Ordering/limiting
  group_by: carrier
  aggregate: flight_count is count()
}
```

A reference to a [named query](nesting.md) (which defines its own pipeline) can be the first stage in a pipleline.

```malloy
query: flights->by_carrier
```

### Fields

In a query stage, fields (dimensions, measures, or
queries) may be specified either by referencing an existing
name or defining them inline.

```malloy
query: flights->{}
  group_by: carrier
  aggregate: flight_count is count()
}
```

When referencing existing fields, wildcard expressions `*`, `**`, and `some_join.*` may be used.

<!-- TODO explain what these all do. -->

See the [Fields](fields.md) section for more information
about the different kinds of fields and how they can be
defined.

### Filters

Filters specified at the top level of query stage apply to
the whole stage.

At the query level
```malloy
query: flights{where: distance > 1000}->{
  group_by: distance
  aggregate: flight_count
```

or in the stage.
```malloy
query: flights->{
  where: distance > 1000
  group_by: distance
  aggregate: flight_count
```

Filters may also be applied to a [query's source](), an [entire explore](explore.md#filtering-explores), or to a [measure](expressions.md).

<!-- TODO: improve link for filtering a measure. -->

See the [Filters](filters.md) section for more information.

### Ordering and Limiting

Query stages may also include ordering and limiting
specifications.

```malloy
query: flights->{
  top: 10
  group_by: carrier
  aggregate: flight_count
}
```

For detailed information on ordering and limiting, see the [Ordering and Limiting](order_by.md) section.