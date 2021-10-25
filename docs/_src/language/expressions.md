# Expressions

Expressions in Malloy are much like expressions in any other computer
language; they can have variables and operators and function calls in
the same syntax users are familiar with.

| Section | Examples |
| ---------| ----- |
| [Identifiers](#identifiers) | `origin.city`<br/>`` `year` `` |
| [Mathematical operations](#mathematical-operators) | `x * 100`<br/>`-cost`<br/>`(a + b) / c` |
| Filtered sub-expressions | `avg(age) : [state: 'CA']`<br/>`flight_count : [origin.county != null]` |
| Safe type casting | `total_distance::string`<br/>`some_date::timestamp` |
| Ranges | `1 to 100` |
| [Duration time ranges](time-ranges.md) | `start_time for 3 hours`<br/>`@2003 for 10 months` |
| Partial comparison | `> 42`<br/>`!= null`<br/>`~ r'C.*'` |
| Alternation | `> 5 & < 10`</br> `'red' \| 'blue'`  |
| [Application](apply.md) | `state: 'CA'`<br/> `weight: > 100 & < 1000` |
| Asymmetric aggregation | `aircraft.aircraft_models.seats.avg()` |
|  [Pick expressions](pick-expressions.md)  | `pick 'small' when size < 3 else 'large'`<br/>`kind: pick 'other' when null` |
| [Time literals](time-ranges.md#literals) | `@2003-04-19`<br/>`@2020-Q4`<br/>`@2021-10-24 10:00:00`
| [Time Truncation](time-ranges.md#truncation) | `event_time.quarter` <br/> `now.year` |

## Identifiers

Fields may be referenced by name, and fields in joins or nested structures can be described using `.`s.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size": "large"}
explore flights
| reduce : [origin.county != null]
  origin.state
  by_county is (reduce
    origin.county
    flight_count
  )
| project limit 3
  by_county.county
```

## Mathematical Operators

Typical mathematical operators `+`, `-`, `*`, and `/` work as expected, and parentheses may be used to override precedence, e.g. `six is 10 * (3 - 2) / 2 + 1`.

The unary minus / negation operator is also allowed, e.g. `value is -cost`.

## Advanced Expressions

To support the task of data transformation and constructing a data model, Malloy includes several other kinds of specialized expressions.

### Filtering

Aggregate expressions may be filtered, using the [usual filter syntax](filters.md).

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size": "large"}
explore flights
| reduce
  distance_2003 is sum(distance) : [dep_time: @2003]
  ca_flights is count() : [origin.state: 'CA']
```

### Safe Type Cast

Safe type casting may be accomplished with the `::type` syntax, e.g. `distance::string` or `some_date::timestamp`.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size": "large"}
explore flights
| reduce
  distance_summary is concat(total_distance::string, ' miles')
```

### "To" Ranges

Numeric and time ranges can be constructed with `to`, e.g. `10 to 20` or `@2003 to @2006`.

### "For" Ranges

Time ranges can be constructed with `for`, e.g. `@2003 for 6 years` or `now for 20 minutes`.

### Partial Comparison

Partial comparisons, or "partials" are written with a binary comparison operator followed by a value, e.g. `~ 'X%'`, `> 10`, or `!= null`.

See the [Apply](apply.md) section for more information.

### Alternation

The two alternation operators `|` and `&` create an alternation, e.g. `'CA' | 'NY'` or `> 10 & < 100`.

See the [Apply](apply.md) section for more information.

### Application

The apply operator `:` "applies" a value to another value, comparison, or computation.

See the [Apply](apply.md) section for more information.

### Asymmetric Aggregation

Aggregations may be asymmetrically applied to a particular
field, e.g. `aircraft.aircraft_models.seats.avg()`.

<!-- TODO more info on symmetric aggregates -->

### Pick Expressions

The `pick` construction in Malloy is similar to <code>CASE</code> statements in SQL.

```malloy
pick 'small'  when size < 10
pick 'medium' when size < 20
else 'large'
```

Pick expressions are also compatible with the apply operator and partial comparisons.

```malloy
size:
  pick 'small' when < 10
  pick 'medium' when < 20
  else 'large'
```

### Time Truncation




## SQL Functions

Many functions available in SQL are available unchanged in Malloy, e.g. `floor(10.35)`, `concat(first_name, ' ', last_name)`, `sqrt(x)`, etc.. See [here](https://cloud.google.com/bigquery/docs/reference/standard-sql/syntax) for documentation on functions available in BigQuery.

The intention is to be able to call from Malloy any function which
you could call from Standard SQL. This is not well implemented at
the moment. If you experience type check errors, use the `::type`
typecast to work around the errors in typing.






To support the task of data transformation and constructing a data model,
Malloy expressions provide the below syntax:

# SQL functions

The intention is to be able to call from Malloy any function which
you could call from Standard SQL. This is not well implemented at
the moment. If you experience type check errors, use the `::type`
typecast to work around the errors in typing.
