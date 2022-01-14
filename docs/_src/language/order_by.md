# Ordering and Limiting

The following uses the [NTSB Flight Model](../examples/faa.md) for examples.

Often when querying data the amount of data returned to look at is much smaller than the full result set, so the ordering of the data makes a big difference in what you actually see. To make things easier, Malloy has some smart defaults in the way it presents data.  For the most part, you don't have to think too much about it, but in order to understand it, this document will show you how Malloy makes decisions about what to show you.


## Implicit Ordering

### Rule 1: Newest first
If a query stage has a [dimensional](fields.md#dimensions) column that represents a point in time, it is usually the most
important concept in the query.  Because the most recent data is usally the most relevant, Malloy sorts the newest data first.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size":"small" }
query: flights->{
  group_by: dep_month is dep_time.month
  aggregate: flight_count is count()
}
```

### Rule 2: Largest first
If there is a [measure](fields.md#measures) involved, Malloy sorts larger values first.

In the following example, Rule 1 doesn't apply, so the default behavior is to sort by first aggregate, `flight_count` with the largest values first.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size":"small" }
query: flights->{
  group_by: carrier
  aggregate: flight_count is count()
}
```

## Explicit Ordering

You can be explicit about result ordering by using the `order by` clause.

In the following example, the results are ordered by `carrier` in reverse alphabetical order.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size":"small" }
query: flights->{
  order_by: carrier desc
  group_by: carrier
  aggregate: flight_count is count()
}
```

Like in SQL, Malloy's `order by` always defaults to ascending order when `desc` is omitted. This is true for any column of any type. In the example below,
the results are ordered by `carrier` in alphabetical order.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size":"small" }
query: flights->{
  order_by: carrier
  group_by: carrier
  aggregate: flight_count is count()
}
```

## Limiting

In Malloy, you can limit the number of results returned using a `top: n` or `limit: n`.  Both are provided for readability.

In the exmaple below, the results are limited to 2 rows, which are sorted by `dep_month` with newest results first (due to Rule 1).

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size":"small" }
query: flights->{
  top: 2
  group_by: dep_month is dep_time.month
  aggregate: flight_count is count()
}
```
