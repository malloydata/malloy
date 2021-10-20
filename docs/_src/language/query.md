# Queries

The basic syntax for a query in Malloy consists of an [_explore_](explore.md)
and a "pipeline" of one or more _stages_ seperated by a vertical bar (or "pipe"). The shape of the data defined in the original explore is transformed by each stage.

```malloy
-- The explore
flights
  -- The first stage of the pipeline
  | reduce carrier, flight_count is count()
  -- Another stage
  | project flight_count
```

## Pipelines

A pipeline transforms a the shape of an explore, and is made up of a series of stages.

A typical stage is either a `reduce`, `project`, or `index` transformation consisting of a set of fields, and optionally filters and ordering/limiting specification.

```malloy
flights | reduce
  -- Filters
  : [ distance > 1000 ]
  -- Ordering/limiting specification
  top 2 order by flight_count desc
  -- Fields
  carrier, flight_count is count()
```

A [named query](nesting.md), which has a pipeline inside of it, can be the first stage in a pipleline.

```malloy
define flights is (explore 'malloy-data.faa.flights'
  by_carrier is (reduce carrier, flight_count is count())
)

flights | by_carrier
```

### Fields

In a query stage, fields (dimensions, measures, or nested
queries) may be specified either by referencing an existing
name or defining them inline:

```malloy
flights | reduce
  carrier
  flight_count is count()
```

When referencing existing fields, wildcard expressions `*`, `**`, and `some_join.*` may be used.

<!-- TODO explain what these all do. -->

See the [Fields](fields.md) section for more information
about the different kinds of fields and how they can be
defined.

### Filters

Filters specified at the top level of query stage apply to
the whole stage.

```malloy
flights | reduce : [ distance > 1000 ]
  distance
  flight_count
```

Filters may also be applied to a [query's source](), an [entire explore](explore.md#filtering-explores), or to a [measure](expressions.md).

<!-- TODO: improve link for filtering a measure. -->

### Ordering and Limiting

Query stages may also include ordering and limiting
specifications.

```malloy
flights | reduce top 10
  carrier
  flight_count
```

For detailed information on ordering and limiting, see the [Ordering and Limiting](order_by.md) section.