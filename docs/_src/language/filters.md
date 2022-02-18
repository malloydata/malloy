# Filters

Filtering which data is used in a query is an incredibly important aspect of data analysis. Malloy makes it easy to target specific parts of a query to apply individual filters.

## Filter Syntax

Regardless of the placement of a filter, the syntax looks the same.

```malloy
source { where: [ filter_one, filter_two ] }
```

Each filter be any expression of type `boolean`, whether that's a boolean field `is_commercial_flight`, a comparison `distance > 1000`, or any of the other kinds of boolean expressions that Malloy supports. For examples see [the table below](#examples-of-filter-expressions), or for detailed information on the kinds of expressions Malloy supports, see the [Expressions](expressions.md) section.

Logically, the comma-separated list of filters are `and`ed together, though in reality different conditions are checked in different places in the generated SQL, depending on what types of computation occurs in the expression.

<!--
TODO "see where vs having for more information on how Malloy generates SQL for filters"
-->

## Filter Placement

A filter can be applied to the source of a query, to just one stage of a query, or even to a particular field or expression (measure or nested query).

### Filtering a Query's Source

When filtering a query's source, the filter applies to the whole query.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size":"large"}
query: flights { where: distance > 1000 } -> { aggregate: flight_count }
```

### Filtering in a Query Stage

A filter can also be applied to an individual query stage.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size":"large"}
query: flights -> {
  group_by: carrier
  aggregate: flight_count
} -> {
  where: carrier: 'UA' | 'AA'
  project: [ carrier, flight_count ]
}
```

### Filtering Aggregate Calculations

Any measure can be filtered by adding a where clause.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size":"large"}
query: flights -> {
  aggregate: [
    ca_flights is flight_count { where: origin.state = 'CA' }
    ny_flights is count() { where: origin.state = 'NY' }
    avg_km_from_ca is avg(distance / 0.621371) { where: origin.state = 'CA' }
  ]
}
```

### Filtering Complex Measure

Even complex measures can be filtered.  A common use case is to create a filtered
measure and then create that as a percent of total.


```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size":"large"}
// add a couple of measures to the `flights` explore
source: my_flights is flights {
  measure: delayed_flights is flight_count { where: dep_delay > 30 }
  measure: percent_delayed is delayed_flights / flight_count
}

query: my_flights -> {
  aggregate: [
    ca_flights is flight_count { where: origin.state = 'CA' }
    ca_delayed_flights is delayed_flights { where: origin.state = 'CA' }
    ca_percent_delayed is percent_delayed { where: origin.state = 'CA' }
    ny_flights is flight_count { where: origin.state = 'NY' }
    ny_delayed_flights is delayed_flights { where: origin.state = 'NY' }
    ny_percent_delayed is percent_delayed { where: origin.state = 'NY' }
  ]
}
```

### Filtering Nested Queries

Even complex measures can be filtered.  A common use case is to create a filtered
measure and then create that as a percent of total.


```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size":"large"}
// add a couple of measures to the `flights` explore
source: my_flights is flights {
  measure: delayed_flights is flight_count { where: dep_delay > 30 }
  query: delay_stats is {
    aggregate: [
      flight_count
      delayed_flights
      percent_delayed is delayed_flights / flight_count
    ]
  }
}

query: my_flights -> {
  nest: [
    ca_stats is delay_stats { where: origin.state = 'CA' }
    ny_stats is delay_stats { where: origin.state = 'NY' }
  ]
}
```

## Common Patterns in Filters

This section describes some of the more common patterns used in filter expressions. For a more detailed description of the possible kinds of expressions, see the [Expressions](expressions.md) section.

### Comparisons

All the usual comparison operators behave as expected, and are some of the most common kinds of filters.

Example| Meaning
--- | ---
`size = 10` | Does `size` equal 10
`size > 10` | Is `size` > 10
`size != 10` | `size` is not equal to 10

### Combining Filters

Filters can be logically combined using `and`, `or`, and `not`.

Operation | Example
---|---
Logical union | `distance_miles > 1000 or duration_hours > 8`
Logical conjunction | `size >= 10 and size < 100`
Logical negation | `not is_commercial_flight`

### Ranges

A range of numeric or time values can be constructed
with the `to`operator, e.g. `10 to 100`. The `~` operator will check to
see if a value is within a range.

Example| Meaning
--- | ---
`size ~ 10 to 20` | `size` is in the range [10, 20)
`event_time ~ @2003` | `event_time` occurs within the year 2003

### String "Like" Matching

When comparing strings, the `=` operator checks for pure equality, whereas the `~` and `!~` operators, <code>LIKE</code> and <code>NOT LIKE</code>.

Example| Meaning
 --- | ---
`name ~ 'M%'` | The first letter of `name` is M
`name !~ '%Z%'` | `name` does not contain a Z

In the right hand (pattern) string, the following syntax is used:
* A percent sign <code>%</code> matches any number of characters
* An underscore <code>_</code> matches a single character

### Regular Expressions

When the right hand side of a `~` or `!~` operator is a regular expression,
Malloy checks whether the left hand side matches that regular expression. In Standard SQL, Malloy uses the <code>REGEXP_COMPARE</code> function.

Example| Meaning
 --- | ---
`state ~ r'^(CA\|NY)$'` | `state` is `'CA'` or `'NY'`
`name !~ r'Z$'` | `name` does not end with a Z

### Alternation

Checking equality against multiple possible values is extremely common, and can be achieved succinctly using the [apply operator](expressions.md#application) and [alternation](expressions.md#alternation).

Example| Meaning
 --- | ---
`color: 'red' \| 'green' \| 'blue'` | `color` is one of the primary colors
`email ~ '%.com' \| '%.org'` | `email` has `.com` or `.org` domain

## Examples of Filter Expressions

Use this table as a quick reference for common types of filter expressions.

Example| Meaning
 --- | ---
`size = 10` | `size` is equal to 10
`size > 10` | `size` is greater than 10
`size != 10` | `size` is not equal to 10
`size:  10 to 100` | `size` is greater than or equal to 10 and less than 100
`size >= 10 and size < 100` | `size` is greater than or equal to 10 and less than 100
`size: >= 10 & < 100` | `size` is greater than or equal to 10 and less than 100
`color : 'red' \| 'green' \| 'blue'` | `color` is red, green or blue
`size: 14 \| 42 \| > 100` | `size` is 14, 42, or greater than 100
`time: @2003 to @2013` | `time` is between the years 2003 and 2013 (excluding 2013)
`time > 1591129283 + 10 hours` | `time` greater than 10 hours after 1591129283 (epoch timestamp)
`time: now.date` | `time` is today
`time: now.month - 1` | `time` is in the previous calendar month
`name ~ 'M%'` | first letter of `name` is a capital M
`name !~ '%z%'` | `name` does not contain a lower case Z
`state ~ r'^(CA\|NY)$'` | `state` is 'CA' or 'NY'
`name !~ r'Z$'` | `name` does not end with a Z
