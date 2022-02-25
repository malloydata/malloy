# Queries

The basic syntax for a query in Malloy consists of a source and a "pipeline" of one or more _stages_ separated by `->`. The shape of the data defined in the original source is transformed by each stage.

```malloy
query: flights -> { group_by: carrier; aggregate: flight_count is count() }
```

## Sources

The source of a query can be a table, a [source](source.md), or a [named query](statement.md#queries).

**A query against a table**

```malloy
--! {"isRunnable": true, "showAs":"html", "runMode": "auto", "isPaginationEnabled": true}
query: table('malloy-data.faa.flights') -> { aggregate: flight_count is count() }
```

**A query against a source**

```malloy
--! {"isRunnable": true, "showAs":"html", "runMode": "auto", "isPaginationEnabled": true}
source: flights is table('malloy-data.faa.flights')

query: flights -> { aggregate: flight_count is count() }
```

**A query starting from another query**

The leading `->` is used when the source is a query:

```malloy
query: flights_by_carrier is table('malloy-data.faa.flights') -> {
  group_by: carrier
  aggregate: flight_count is count()
}

query: -> flights_by_carrier -> { project: carrier; limit: 2 }
```

**Implicit Sources**
When a query is defined as part of a source or nested inside another query stage, the source is implicit.

Defined as part of a source:
```malloy
source: flights is table('malloy-data.faa.flights'){
  query: flights_by_carrier is {
    group_by: carrier
    aggregate: flight_count is count()
  }
}
```

Nested inside another query stage:
```malloy
query: table('malloy-data.faa.flights') -> {
  group_by: dep_year is dep_time.year
  nest: by_carrier is {
    group_by: carrier
    aggregate: flight_count is count()
  }
}
```

## Pipelines

A each stage of a pipeline performs transformation on the the source or a previous stage.

A stage can do one of:
* a Reduction: a query containing `group_by`/`aggregate` which includes aggregation and/or a group_by to reduce the grain of the data being transformed
* a Projection: select fields without reducing using `project`.

Example of a Reduction:
```malloy
query: flights -> {
  where: distance > 1000        // Filtering
  top: 2                        // Limiting
  order_by: flight_count desc   // Ordering
  group_by: carrier             // Reducing
  aggregate: flight_count is count()
}
```

Example of a Projection:
```malloy
  query: flights -> {
    project: *
    limit: 20
  }
```

Note that the operations in a stage are not order-sensitive like SQL; they can be arranged

A reference to a [named query](nesting.md) (which defines its own pipeline) can be the first stage in a pipeline.

```malloy
query: flights -> by_carrier
```

### Fields

In a query stage, fields (dimensions, measures, or
queries) may be specified either by referencing an existing
name or defining them inline.

```malloy
query: flights -> {
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
query: flights { where: distance > 1000 } -> {
  group_by: distance
  aggregate: flight_count
}
```

or in the stage.
```malloy
query: flights -> {
  where: distance > 1000
  group_by: distance
  aggregate: flight_count
}
```

Filters may also be applied to a [query's source](), an [entire source](source.md#filtering-sources), or to a [measure](expressions.md).

<!-- TODO: improve link for filtering a measure. -->

See the [Filters](filters.md) section for more information.

### Ordering and Limiting

Query stages may also include ordering and limiting
specifications.

```malloy
query: flights -> {
  top: 10
  group_by: carrier
  aggregate: flight_count
}
```

For detailed information on ordering and limiting, see the [Ordering and Limiting](order_by.md) section.