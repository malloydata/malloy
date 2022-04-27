# Expressions

Expressions in Malloy are much like expressions in any other language; they can have variables and operators and function calls in
the same syntax users are familiar with. However, Malloy also introduces several other kinds of expressions useful for the task of data analysis and transformation.

| Section | Examples |
| ---------| ----- |
| [Identifiers](#identifiers)<br/>Fields referenced by name | `origin.city`<br/>`` `year` `` |
| [Mathematical operations](#mathematical-operators) | `x * 100`<br/>`-cost`<br/>`(a + b) / c` |
| [Comparison operators](#comparison-operators) | `x > 200`<br/>`state != null` |
| [Boolean operators](#boolean-operators)<br/>Logically combine booleans | `height > 10 and height < 100`<br/>`is_cancelled or is_delayed`</br>`not is_commercial_flight` |
| [SQL functions](#sql-functions) | `floor(10.35)`<br/>`concat(first_name, ' ', last_name)`<br/>`sqrt(x)` |
| [Aggregation](#aggregation) | `sum(distance)` <br/> `aircraft.count()` <br/> `aircraft_models.seats.avg()` |
| [Filtered expressions](#filtered-expressions) | `avg(age) : [state: 'CA']`<br/>`flight_count : [origin.county != null]` |
| [Safe type cast](#safe-type-cast) | `total_distance::string`<br/>`some_date::timestamp` |
| [Pick expressions](#pick-expressions)<br/>Malloy's take on <code>CASE</code> statements  | `pick 'S' when size < 3 else 'L'`<br/>`kind: pick 'other' when null` |
| [Time ranges](#time-ranges)<br/>Ranges with start and end or duration |  `start_time for 3 hours`<br/>`@2003 for 10 months` <br/> `@2003 to @2005` |
| [Numeric ranges](#numeric-ranges)<br/>Numeric ranges with start and end | `10 to 20` |
| [Time truncation](#time-truncation) | `event_time.quarter` <br/> `now.year` |
| [Time extraction](#time-extraction)<br/>Extract one part of a time value | `day_of_year(event_time)` <br/> `minute(now)` |
| [Interval extraction](#interval-extraction)<br/>Extract the interval between two times  | `days(created_at to shipped_at)` |
| [Time literals](time-ranges.md#literals) | `@2003-04-19`<br/>`@2020-Q4`<br/>`@2021-10-24 10:00:00`
| [Partial comparison](#partial-comparison)<br/>Reusable conditions | `> 42`<br/>`!= null`<br/>`~ r'C.*'` |
| [Alternation](#alternation)<br/>Logically combine conditions | `> 5 & < 10`</br> `'red' \| 'blue'`  |
| [Application](#application)<br/>Apply conditions to values | `state: 'CA'`<br/> `weight: > 100 & < 1000` |

## Identifiers

<!-- * `distance` -->
<!-- * `origin.city` -->
<!-- * `` `year` `` -->

Fields may be referenced by name, and fields in joins or nested structures can be described using `.`s.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size": "large"}
query: flights -> {
  where: origin.county != null
  group_by: origin.state
  nest: by_county is {
    group_by: origin.county
    aggregate: flight_count
  }
} -> {
  project: by_county.county
  limit: 3
}
```

Identifiers that share a name with a keyword in Malloy must be enclosed in back ticks `` ` ``, e.g. `` `year` ``.

## Mathematical Operators

<!-- * `x * 100` -->
<!-- * `-cost` -->
<!-- * `(a + b) / c` -->

Typical mathematical operators `+`, `-`, `*`, and `/` work as expected, and parentheses may be used to override precedence, e.g. `six is 10 * (3 - 2) / 2 + 1`.

The unary minus / negation operator is also allowed, e.g. `value is -cost`.

## Logical Operators

### Comparison Operators

<!-- * `distance > 1000` -->
<!-- * `state = 'CA'` -->
<!-- * `name != null` -->

<!-- TODO discuss null checking and how it uses `!=` not `is not` -->

Standard comparison operators `>`, `<`, `>=`, `<=`, and `=` are available in Malloy. "Not equals" is expressed using the `!=` operator.

### Boolean Operators

<!-- * `is_x and is_y` -->
<!-- * `is_a or is_b` -->
<!-- * `not is_c` -->

Malloy includes the basic binary boolean operators `and` and `or`, as well as the unary `not` operator.

## SQL Functions

<!-- * `floor(10.35)` -->
<!-- * `concat(first_name, ' ', last_name)` -->
<!-- * `sqrt(x)` -->

Many functions available in SQL are available unchanged in Malloy. See [here](https://cloud.google.com/bigquery/docs/reference/standard-sql/syntax) for documentation on functions available in BigQuery.

The intention is to be able to call from Malloy any function which
you could call from Standard SQL. This is not well implemented at
the moment. If you experience type check errors, use the `::type`
typecast to work around the errors in typing.

## Aggregation

Aggregations may included in an expression to create [measures](fields.md#measures), e.g. `count()`, `sum(distance)`, or `aircraft_models.seats.avg()`. For detailed information, see the [Aggregates](aggregates.md) section.

<!-- TODO more info on symmetric aggregates -->

## Filtered Expressions
<!-- * `avg(age) : [state: 'CA']` -->
<!-- * `flight_count : [origin.county != null]` -->

Aggregate expressions may be filtered, using the [usual filter syntax](filters.md).

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size": "large"}
query: flights -> {
  aggregate:
    distance_2003 is sum(distance) { where: dep_time: @2003 }
    ca_flights is count() { where: origin.state: 'CA' }
}
```

## Safe Type Cast

<!-- * `total_distance::string` -->
<!-- * `some_date::timestamp` -->

Safe type casting may be accomplished with the `::type` syntax.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size": "large"}
query: flights -> {
  aggregate: distance_summary is concat(total_distance::string, ' miles')
}
```

## Pick Expressions

The `pick` construction in Malloy is similar to <code>CASE</code> statements in SQL.

```malloy
pick 'small'  when size < 10
pick 'medium' when size < 20
else 'large'
```

Pick expressions are also compatible with the [apply operator](#apply-operator) and partial comparisons.

```malloy
size:
  pick 'small' when < 10
  pick 'medium' when < 20
  else 'large'
```

Pick can be used to "clean" data, combining similar dirty values into one clean value. In the following example, the `pick` statement collects all the "this actually
shipped" statuses, and because there is no `else`, leaves the other
status values alone.

```malloy
shipping_status:
  pick 'shipped' when 'will call' | 'shipped'
  pick 'ignore' when 'bad1' | 'bad2' | 'testing'
```

Another common kind of cleaning is to have a small set you want to group
by and all other values are compressed into `null`. A `pick` clause with no value
picks an applied value when the condition is met.

```malloy
status:
  pick when 'good' | 'ok' | 'fine' // leave these alone
  else null                        // ignore the rest
```

## Time Expressions

Malloy has built in constructs to simplify many time-related operations, which are described here.

### Time Ranges

<a id="numeric-ranges"></a>

Ranges between a start and end time can be constructed with the `to` operator, e.g. `@2003 to @2006`. This kind of range is also possible for numbers, e.g. `10 to 20`.

Time ranges can also be constructed with a start time and duration using the `for` operator, e.g. `@2003 for 6 years` or `now for 20 minutes`.

A time value can be compared to a range. If the time is within the range it will be `=`, before the range it will be `<`, and after the range it will be `>`. If you [apply](#apply-operator) a time to a range, (for example, `event_time: @2003 to @2004`) that will also check if the value is within the range.

### Time Truncation

To truncate a time value to a given timeframe, use the `.` operator followed by the timeframe, e.g. `event_time.quarter` or `now.year`.

By way of example, if the value of `time` is `@2021-08-06 00:36`, then the below truncations will produce the results on the right:


truncation | result
 ---- | ----
`time.minute` | 2021-08-06 00:36
`time.hour`   | 2021-08-06 00:00
`time.day`    | 2021-08-06
`time.week`   | WK2021-08-01 _(the week containing the 10th)_
`time.month`  | 2021-08
`time.quarter` | Q2-2021
`time.year`   | 2021

A truncation made this way (unlike a truncation make in SQL with
`TIMESTAMP_TRUNC()`) can also function as a range. The range begins
at the moment of truncation and the duration is the timeframe unit
used to specify the truncation, so for example `time.year`
would be a range covering the entire year which contains `time`.

This is extremely useful with the [apply operator](#apply-operator), `:`. To see if two events happen in the same calendar year, for example, the boolean expression in Malloy is `one_time: other_time.year`.

### Time Extraction

Another very common grouping for time related data is by particular components, and this extraction of a single component as an integer. In Malloy this gesture looks like a function call.

The "Result" column uses a value of `@2021-08-06 00:55:05` for `expr`.

expression | meaning | result
---- | ---- | ----
`day_of_year(expr)` | day of year, 1-365 | 218
`day(expr)` | day of month 1-31 | 5
`day_of_week(expr)` | day of week 1-7 | 6 _(Note: 1 represents Sunday)_
`week(expr)` | week in year, 1-53 | 31
`quarter(expr)` | quarter in year 1-4 | 3
`hour(expr)` | hour of day 0-23 | 0
`minute(expr)` | minute of hour 0-59 | 55
`second(expr)` | second of minute 0-59 | 5

### Interval extraction

To measure the difference between two times, pass a range expression to
one of the below extraction functions. This is Malloy's take on SQL's <code>DATE_DIFF()</code> and <code>TIMESTAMP_DIFF()</code> :

expression | meaning
---- | ----
`seconds(t1 to t2)` | Number of seconds from t1 until t2
`minutes(t1 to t2)` | ... minutes ...
`hours(t1 to t2)` | ... hours ...
`days(t1 to t2)` | ... days ...
`weeks(t1 to t2)` | ... weeks ...
`months(t1 to t2)` | ... months ...
`quarters(t1 to t2)` | ... quarters ...
`years(t1 to t2)` | ... years ...

These will return a negative number if t1 is later than t2.

### Time Literals

<!-- * `@2003-04-19` -->
<!-- * `@2020-Q4` -->
<!-- * `@2021-10-24 10:00:00` -->
<!-- * `now` -->

Time literals are specified in Malloy with the `@` character. A literal
specified this way has an implied duration which means a literal
can act like a range.

For example the year `@2003` can be used with `event_time: @2003` to test if the
event happened in the year 2003.

Literal pattern | Duration | Begins
---- | ---- | ----
`@DDDD` | One year | The first day of that year
`@DDDD-QN` | Three months | The first day of that quarter
`@DDDD-MM` | One month | The first day of that month
`@WKDDDD-MM-SS` | Seven days | Sunday of the week containing that day
`@DDDD-MM-DD` | One day | Midnight on the specified date
`@DDDD-MM-DD HH:MM` | One Minute | The specified time
`@DDDD-MM-DD HH:MM:SS` | One Second | the specified time
`now` | _n/a_ | The current time, without implied duration

## Special Filter Expression Syntax

As filtering is an incredibly common operation in data analysis, Malloy has special syntax to make filter expressions succinct and powerful. In addition to regular comparison and boolean operators, Malloy includes _partial comparisons_, _alternation_, and _application_, as described below.

### Partial Comparison

<!-- * `> 42` -->
<!-- * `!= null` -->
<!-- * `~ r'C.*'` -->

Partial comparisons, or "partials" are written with a binary comparison operator followed by a value, e.g. `> 42` or `!= null`. These can be thought of as conditions-as-values, or as functions that return a boolean.

### Alternation

<!-- * `> 5 & < 10` -->
<!-- * `'CA' | 'NY'` -->

Conditions can be logically combined with the two alternation operators, `&` and `|`. These are different from `and` and `or` in that they operate on conditions which return boolean values, rather than boolean values directly.

The _union alternation_ operator `|` represents the logical union of two conditions. An expression like `x | y` can be read "if either `x` or `y`." For example `= 'CA' | = 'NY'` represents the condition "is either CA or NY".

The _conjunction alternation_ operator `&` represents the logical conjunction of two conditions. An expression like "`x & y` can be read "if both `x` and `y`." For example, `> 5 & < 10` represents the condition "is greater than 5 and less than 10".

Values can be used directly with the alternation operators, in which case the operator is assumed to be `=`. For example, `'CA' | 'NY'` is equivalent to `= 'CA' | = 'NY'`.
### Application

<!-- * `state: 'CA'` -->
<!-- * `weight: > 100 & < 1000` -->
<!-- * `kind: pick 'other' when null` -->

The apply operator `:` "applies" a value to another value, condition, or computation. This is most often used with partial comparisons or alternations.

Applying a value to a condition is like filling in the condition with the given value. For example, `height: > 5 & < 10` is equivalent to `height > 5 and height < 10`.

Applying a value to another value applies a default comparison on the two values:

| Left | Right | Example| Meaning |
|------|-------|--------|---------|
| `number` | `number` | `size: 10` | `size = 10` |
| `string` | `string` | `state: 'CA'` | `state = 'CA'` |
| `string` | regular expression | `name: r'Z$'` | `name ~ r'Z$'` |
| `boolean` | `boolean` | `is_cool: true` | `is_cool = true` |
| `number` | numeric range | `x: 10 to 20` | `x >= 10 and x < 20` |
| `date` or `timestamp` | `date` or `timestamp` | `time: @2003` | `time` is during 2003 |

Values can be applied to [pick expressions](#pick-expressions) to make them more succinct.

```malloy
size:
  pick 'small' when < 10
  pick 'medium' when < 20
  else 'large'
```
