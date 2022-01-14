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
'malloy-data.faa.flights' | reduce flight_count is count()
```

**A query against an explore**

```malloy
--! {"isModel": true, "modelPath": "/inline/airports_mini.malloy"}
explore: airports is table('malloy-data.faa.airports'){
  measure: airport_count is count(*)

  query: by_state is {
    where: state != null
    group_by: state
    aggregate: airport_count
  }
}
```

**A query starting from another query**
```malloy
flights_by_carrier | project carrier limit 10
```

When a query is defined as part of an explore or inside
another query stage, the source is implicit.

```malloy
flights | reduce
  dep_year is dep_time.year
  by_carrier is (reduce
    carrier,
    flight_count is count()
  )
```

## Pipelines

A pipeline transforms the shape of an explore, and is made up of a series of stages.

A typical stage is either a `reduce`, `project`, or `index` transformation consisting of a set of fields, and optionally filters and ordering/limiting specification.

```malloy
flights | reduce
  : [ distance > 1000 ]            -- Filters
  top 2 order by flight_count desc -- Ordering/limiting
  carrier, flight_count is count() -- Fields
```

A reference to a [named query](nesting.md) (which defines its own pipeline) can be the first stage in a pipleline.

```malloy
flights | by_carrier
```

### Fields

In a query stage, fields (dimensions, measures, or nested
queries) may be specified either by referencing an existing
name or defining them inline.

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

See the [Filters](filters.md) section for more information.

### Ordering and Limiting

Query stages may also include ordering and limiting
specifications.

```malloy
flights | reduce top 10
  carrier
  flight_count
```

For detailed information on ordering and limiting, see the [Ordering and Limiting](order_by.md) section.