# Malloy Quick Start for SQL Programmers

Consider the query below.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true}
explore 'malloy-data.faa.airports'
| reduce
  state
  airport_count is count()
```

## FROM before everything

In Malloy a data source can be either a physical SQL table or some modeled data (a table or set of tables with some relationships and or calculations built in).  In Malloy, to reference a table in the database, simply put the path and name of the table in a quoted string.

### The phrase below tells malloy to query the physical table `'malloy-data.faa.airports'`

```malloy
explore 'malloy-data.faa.airports'
```

## Pipes

In Malloy, data is piped from one command to the next.  The left hand side of a pipe is a data source, the right hand side is a command.

## SELECT is two things in Malloy.  `reduce` and `project`

In SQL, the <code>SELECT</code> command does two very different things.  A <code>SELECT</code> with a <code>GROUP BY</code> aggregates data according to the <code>GROUP BY</code> clause and produces aggregate calculation against every calculation not in the <code>GROUP BY</code>.  In Malloy, this kind of command is called a `reduce`.

The second type of <code>SELECT</code> in SQL is just making a copy of some part of the data source.  In Malloy, this command is called `project`.

When using `reduce`, malloy is smart enough to know which expressions to group by and which expressions to use as aggregate calculations.  In the query below, the data will be grouped by `state` and will produce an aggregate calculation for `airport_count`

### Group by state, calculate airport_count
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true}
explore 'malloy-data.faa.airports'
| reduce
  state,
  airport_count is count(*)
```

### Show the data by facility type.  Count can be written without the `*`.  You can compute multiple things.  Commas are optional.
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true}
explore 'malloy-data.faa.airports'
| reduce
  fac_type
  airport_count is count()
  max_elevation is max(elevation)
```

## Everything has a Name.  Expressions are very similar to SQL
In Malloy, all output fields are named.  Malloy uses `<fieldname> is <expression>` instead of SQL's `<expression> as <fieldname>` so that the object being named comes first.  Having the output column name written first makes imagining the structure the output table easier.

Mostly, your SQL expressions just work.  In Malloy, you can use almost all the same functions you can use in SQL (there are some new ones for convienece).

### The output of this query is pretty obvious.  Expressions are similar to SQL
```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true}
explore 'malloy-data.faa.airports'
| reduce
  state_and_county is concat(state,', ', county )
  airport_count is count()
  max_elevation is max(elevation)
  min_elevation is min(elevation)
  avg_elevation is avg(elevation)
```
## Malloy's data types are more simple.
String, number, boolean are the basic types.

## You can resue your expressions by putting them into the model.
One of the main benefits of Malloy is to be able to build calculations you might want to use
again into a data model.  In the example below, we create an *explore* object named `airports` and
add calculations for `state_and_county` and `airport_count`.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true}
define airports is (explore 'malloy-data.faa.airports'
  state_and_county is concat(state,', ', county )
  airport_count is count()
);

explore airports
| reduce
  state_and_county
  airport_count
```

## Ordering and Limits (top and order by)
In Malloy, ordering and limiting work pretty much the same way they do in SQL.  Malloy
has some more [reasonable defaults](order_by.md).

### Top 2 States (by default sorts by the first measure descending.)

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true}
explore 'malloy-data.faa.airports'
| reduce top 2
  state
  airport_count is count(*)
```

### Show the states in alphabetical order.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true}
explore 'malloy-data.faa.airports'
| reduce order by 1
  state
  airport_count is count(*)
```

## Filtering
In data, filtering is something you do in almost every query.  Malloy's filtering is different from SQL's because it is more powerful and expressive.   When querying data, we want to first isolate the data we are interested in (filter it) and then perform aggregations and calculations on the data we've isolated (shape it).  Malloy lets you filter, with a consistent syntax, in lots of different places in a query.  Malloy's unique filter syntax is both easy to read and write.

### A filter on the table limits the data coming out of the table.  In this case, filter all the input data to just airports in california.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true}
explore 'malloy-data.faa.airports' : [state : 'CA']
| reduce top 2
  county
  airport_count is count()
```

### A filters on an aggregate calculation limits the data used in the calculation.  In the example below, the calculations for `airports` and `heliports` are limited by filters.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true}
explore 'malloy-data.faa.airports'
| reduce top 5
  state
  all_facilities is count()
  airports is count() : [ fac_type : 'AIRPORT' ]
  heliports is count() : [fac_type : 'HELIPORT']
```

### Filters can be applied in `reduce` and `project` command too (this will become more important later when we have more than one reduce in a query).

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true}
explore 'malloy-data.faa.airports'
| reduce : [state : 'AL'|'KY'] top 5
  state
  all_facilities is count(*)
  airports is count(*) : [fac_type : 'AIRPORT']
  heliports is count(*) : [fac_type : 'HELIPORT']
```

## Timeframes and Timezones.
Time is a big deal in data.  Malloy has built in contructs to easily handle time, relative time filtering, date ranges and time stamps.  We'll write more about this when the syntax is finalized.

## Turtles
In malloy queries can nest in other queries.

### Examples use the following model.
```malloy
define airports is (explore 'malloy-data.faa.airports'
    airport_count is count(*)
);
```

### Turtles are queries nested in other queries.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy"}

explore airports
| reduce
  state
  airport_count
  by_facility is (reduce
    fac_type
    airport_count
  )
```

##   Turtles in Turtles

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy", "size": "large"}
explore airports
| reduce
  state
  airport_count
  top_5_counties is (reduce top 5
    county
    airport_count
    by_facility is (reduce
      fac_type
      airport_count
    )
  )
```
##   Turtles and Filters can be applied at any level, any number of Turtles

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy", "size": "large"}
explore airports
| reduce : [state : 'CA'|'NY'|'MN']
  state
  airport_count
  top_5_counties is (reduce top 5
    county
    airport_count
    major_facilities is (reduce : [major : 'Y']
      name is concat(code, ' - ', full_name)
    )
    by_facility is (reduce
      fac_type
      airport_count
    )
  )
```

## Piping - Multi stage Queries.

Take the output from one query and use it as input to the next into another.

Let's start with this query.
```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy", "size": "large"}
explore airports
| reduce : [state : 'CA'|'NY']
  state
  airport_count
  by_county is (reduce
    county
    airport_count
  )
```

And use it as input for the following query.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy", "size": "large"}
explore airports
| reduce : [state : 'CA'|'NY']
  state
  airport_count
  by_county is (reduce
    county
    airport_count
  )
| project top 10 order by 4 desc
  by_county.county
  airport_count
  county_airport_count is by_county.airport_count
  percent_airports_in_county is by_county.airport_count/airport_count * 100
```

## Comments

Malloy code can include both line and block comments. Line comments, which begin with `--`,
may appear anywhere within a line, and cause all subsequent characters on that line to be ignored.
Block comments, which are enclosed between <code>/\*</code> and <code>\*/</code>, cause all enclosed characters to be ignored
and may span multiple lines.

```malloy
-- The total number of flight entries
flights | reduce
  flight_count -- Defined simply as `count()`

/*
 * A comparison of the total number of flights
 * for each of the tracked carriers.
 */
flights | reduce
  carrier
  flight_count
  /* total_distance */
```

## Joins are between primary and foriegn keys.


## Full graph of the data is available to query

## Sums and Counts and average are a little different.

## Calculations can correctly occur anywhere in the graph