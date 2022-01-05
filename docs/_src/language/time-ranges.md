# Malloy time range expressions

## Range expressions

There are two forms of range expressions

* _expr_ `to` _expr_ ( `@2001 to @2003`)
* _expr_ `for` `N` _units_ ( `now for 15 minutes` )

A timestamp can be compared to a range. If the time stamp is within
the range it will be `=`. Before the range it will be `<` and after
the range it will be `>`. If you [apply](apply.md) a range, (for example, `eventDate: @2003 to @2004`) that will also check if the value is within the range.

## Range shortcuts

Because grouping and filtering by specific time ranges is such acommon operation for a data transformation task, Malloy has a number of expressive short cuts. The full power of the underlying SQL engine is also available for any type of truncation or extraction not supported by these shortcuts.

Malloy supports two time-related types, `timestamp` and `date`.
Both of these can be used with these techniques, though the exact
truncations or extractions available will vary depending on the
data type (e.g. it would make no sense to attempt to truncate a `date` object by `minute`).

## Truncation

To create truncation, use the `.` operator followed by the desired timeframe. 

By way of example, if the value of `expr` is `@2021-08-06 00:36`, then the below truncations will produce the results on the right:


 expression | result
 ---- | ----
`expr.minute` | 2021-08-06 00:36
`expr.hour`   | 2021-08-06 00:00
`expr.day`    | 2021-08-06
`expr.week`   | WK2021-08-01 _(the week containing the 10th)_
`expr.month`  | 2021-08
`expr.quarter` | Q2-2021
`expr.year`   | 2021

### Truncations as ranges

A truncation made this way (unlike a truncation make in SQL with
`TIMESTAMP_TRUNC()`) can also function as a range. The range begins
at the moment of truncation and the duration is the timeframe unit
used to specify the truncation, so for example `eventDate.year`
would be a range covering the entire year which contains `eventDate`

This is extremely useful with the [Apply operator](apply.md), `:`. To see if two events happen in the same calendar year, for example, the boolean expresison in Malloy is `oneEvent: otherEvent.year`

## Extraction

Another very common grouping for time related data is by particular components, and this extraction of a single component as an integer. In Malloy this gesture looks like a function call.

The "Result" column uses a value of `2021-08-06 00:55:05` for `expr`. 

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


## Literals

Time literals are specified in malloy with th `@` character. A literal
specified this way has an implied duration which means a literal
can act like a range.

For example the year `@2003` can be used with `eventTime : @2003` to test if the
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
`now` | _N/A_ | The current time, without implied duration

### Time Units

These are the time units currently supported by Malloy.

* `second`, `minute`, `hour`, `week`, `month`, `quarter`, `year`
