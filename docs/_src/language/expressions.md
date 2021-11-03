# Expressions

Expressions in Malloy are much like expressions in any other language; they can have variables and operators and function calls in
the same syntax users are familiar with. However, Malloy also introduces several other kinds of expressions useful for the task of data analysis and transformation.
<!--
| Section | Examples |
| ---------| ----- |
| [Identifiers](#identifiers) | `origin.city`<br/>`` `year` `` |
| [Mathematical operations](#mathematical-operators) | `x * 100`<br/>`-cost`<br/>`(a + b) / c` |
| [SQL functions](#sql-functions) | `floor(10.35)`<br/>`concat(first_name, ' ', last_name)`<br/>`sqrt(x)` |
| [Filtered expressions](#filtered-expressions) | `avg(age) : [state: 'CA']`<br/>`flight_count : [origin.county != null]` |
| [Safe type cast](#safe-type-cast) | `total_distance::string`<br/>`some_date::timestamp` |
| [To ranges](#to-ranges) | `1 to 100` <br/> `@2003 to @2005` |
| [For ranges](#for-ranges) | `start_time for 3 hours`<br/>`@2003 for 10 months` |
| [Partial comparison](#partial-comparison) | `> 42`<br/>`!= null`<br/>`~ r'C.*'` |
| [Alternation](#alternation) | `> 5 & < 10`</br> `'red' \| 'blue'`  |
| [Application](#application) | `state: 'CA'`<br/> `weight: > 100 & < 1000` |
| [Aggregation](#aggregation) | `sum(distance)` <br/> `aircraft.count()` <br/> `aircraft_models.seats.avg()` |
|  [Pick expressions](#pick-expressions)  | `pick 'small' when size < 3 else 'large'`<br/>`kind: pick 'other' when null` |
| [Time literals](time-ranges.md#literals) | `@2003-04-19`<br/>`@2020-Q4`<br/>`@2021-10-24 10:00:00`
| [Time Truncation](time-ranges.md#truncation) | `event_time.quarter` <br/> `now.year` | -->

## Identifiers

* `distance`
* `origin.city`
* `` `year` ``

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

Identifiers that share a name with a keyword in Malloy must be enclosed in back ticks `` ` ``, e.g. `` `year` ``.

## Mathematical Operators

* `x * 100`
* `-cost`
* `(a + b) / c`

Typical mathematical operators `+`, `-`, `*`, and `/` work as expected, and parentheses may be used to override precedence, e.g. `six is 10 * (3 - 2) / 2 + 1`.

The unary minus / negation operator is also allowed, e.g. `value is -cost`.

## Comparison Operators

* `distance > 1000`
* `state = 'CA'`
* `name != null`

<!-- TODO discuss null checking and how it uses `!=` not `is not` -->

Standard comparison operators `>`, `<`, `>=`, `<=`, and `=` are available in Malloy. "Not equals" is expressed using the `!=` operator.

## Boolean Operators

* `is_x and is_y`
* `is_a or is_b`
* `not is_c`

Malloy includes the basic binary boolean operators `and` and `or`, as well as the unary `not` operator.

## SQL Functions

* `floor(10.35)`
* `concat(first_name, ' ', last_name)`
* `sqrt(x)`

Many functions available in SQL are available unchanged in Malloy. See [here](https://cloud.google.com/bigquery/docs/reference/standard-sql/syntax) for documentation on functions available in BigQuery.

The intention is to be able to call from Malloy any function which
you could call from Standard SQL. This is not well implemented at
the moment. If you experience type check errors, use the `::type`
typecast to work around the errors in typing.

## Filtered Expressions
* `avg(age) : [state: 'CA']`
* `flight_count : [origin.county != null]`

Aggregate expressions may be filtered, using the [usual filter syntax](filters.md).

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size": "large"}
explore flights
| reduce
  distance_2003 is sum(distance) : [dep_time: @2003]
  ca_flights is count() : [origin.state: 'CA']
```

## Safe Type Cast

* `total_distance::string`
* `some_date::timestamp`

Safe type casting may be accomplished with the `::type` syntax.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size": "large"}
explore flights
| reduce
  distance_summary is concat(total_distance::string, ' miles')
```

## To Ranges

* `1 to 100`
* `@2003 to @2005`

Numeric and time ranges can be constructed with `to`, e.g. `10 to 20` or `@2003 to @2006`.

## For Ranges

* `start_time for 3 hours`
* `@2003 for 10 months`

Time ranges can be constructed with `for`, e.g. `@2003 for 6 years` or `now for 20 minutes`.

## Partial Comparison

* `> 42`
* `!= null`
* `~ r'C.*'`

Partial comparisons, or "partials" are written with a binary comparison operator followed by a value. These can be used in a variety of contexts, including [filters](filters.md) and [pick expressions](#pick-expressions.md).

See the [Apply](apply.md) section for more information.

## Alternation

* `> 5 & < 10`
* `'CA' | 'NY'`

The two alternation operators `|` and `&` create an alternation.

See the [Apply](apply.md) section for more information.

## Application

* `state: 'CA'`
* `weight: > 100 & < 1000`
* `kind: pick 'other' when null`

The apply operator `:` "applies" a value to another value, comparison, or computation.

See the [Apply](apply.md) section for more information.

## Aggregation

Aggregations may included in an expression to create [measures](fields.md#measures). For detailed information, see the [Aggregates](aggregates.md) section.

<!-- TODO more info on symmetric aggregates -->

## Pick Expressions

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

For more information, see the [Pick Expressions](pick-expressions.md) section.

## Time Literals

* `@2003-04-19`
* `@2020-Q4`
* `@2021-10-24 10:00:00`
* `now`

## Time Truncation

* `event_time.quarter`
* `now.year`