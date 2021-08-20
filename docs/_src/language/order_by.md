# Ordering and Limiting Results.

The following uses the [NTSB Flight Model](../examples/faa.md) for examples.

## Malloy is smart about ordering your data

When querying data the order in which it is presented controls what you see.  Often times,
the number of results returned to look at are much larger than the results in their entirity.
To make things easier, Malloy has some smart defaults in the way it presents data.  For the
most part, you don't have to think too much about it, but in order to understand it, this
document will show you how Malloy makes decisions about what to show you.

## ORDER BY is explicit.
All that said, in Malloy you can use the clause `order by` in a `reduce` or `project` and Malloy
will show you exactly what you asked for.

## Don't say anything and you will usually get what you want.


## Rule #1 - If there is a time frame involved, show the results newest first.
If there is [dimensional](somewhere) column that represents a timeframe, it is probably the most
important concept in the query.  Generally, when looking at data, newest first is how you think
about thigns.  Graphs generally do not care which direction time is represented in (forward or reverse),
so Malloy always shows queries with timeframes newest first.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size":"small" }
explore flights 
| reduce
  dep_month is dep_time.month
  flight_count is count()
```

## Rule #2 - If there is a measure (aggregate calculation) involved, show results larger values first.
In this case, Rule #1 doesn't apply, we have a measure, flight_count, so we show the reuslts in order of
flight_count with the larges values first.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size":"small" }
explore flights 
| reduce
  carrier
  flight_count is count()
```
## ORDER BY
You can be explicit about how you want the result order by using an <code>ORDER BY</code> clause.
In this case we are going to show the results by carrier in reverse alphabetical order.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size":"small" }
explore flights 
| reduce order by carrier desc
  carrier
  flight_count is count()
```

Like SQL, Malloy's `order by` always defaults to ascending order so not writing `desc`
in query will produce ascending orders for any column of any type.  In the example below
the results are order by carrier in alphabetical order.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size":"small" }
explore flights 
| reduce order by carrier
  carrier
  flight_count is count()
```

## Limiting results with `top <n>`
In Malloy, you can limit the number of results returned using a `top n` clause on `reduce` or `project` statement.
Notice that in the exmaple below, rule #1 is appled for ordering the results.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size":"small" }
explore flights 
| reduce top 2
  dep_month is dep_time.month
  flight_count is count()
```

## `order by` with `top N`
You can also use the full `order by` clause if you would like with `top n`.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size":"small" }
explore flights 
| reduce top 2 order by flight_count desc
  dep_month is dep_time.month
  flight_count is count()
```
