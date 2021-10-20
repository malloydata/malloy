# Fields

Fields constitute all kinds of concrete data in Malloy. They
can represent dimensional attributes sourced directly from
tables in a database, constant values to be used in later analyis, computed metrics derived from other fields, or even nested structures created from aggregating subqueries.

## Defining Fields

Fields are defined in the same way whether part of an
explore or a query stage. In either case, they are defined using the `is` keyword.

**In an explore**

```malloy
define users is (explore 'malloy-data.ecomm.users'
  age_in_dog_years is age * 7
);
```

**In a query stage**

```malloy
users | reduce
  age_in_dog_years is age * 7
```

The right hand side of this kind of definition can be any
field expression. See the [Expressions](expressions.md)
section for more information.

Query fields (see [below](#queries)) can also be defined as
part of an explore or query stage. When a query field is defined in a query stage, it is known as a "nested query" or an "aggregating
subquery." See the [Nesting](nesting.md) section for a
detailed discussion of nested queries.

```malloy
flights | reduce
  carrier
  by_month is (reduce
    departure_month is dep_time.month
    flight_count is count()
  )
```

Like in a top level query, a query field's pipeline may start with a named query.

```malloy
define flights is (explore 'malloy-data.faa.flights'
  flight_count is count()
  by_carrier is (reduce carrier, flight_count)
  top_carriers is (by_carrier | project carrier limit 5)
);
```

## Kinds of Fields

Malloy includes three different _kinds_ of fields: _dimensions_, _measures_, and _queries_.

### Dimensions

Dimensions are fields representing scalar values. All fields
inherited directly from a table are dimensions.

Dimensions are be defined using expressions that contain no
aggregate functions.

```malloy
define users is (explore 'malloy-data.ecomm.users'
  full_name is concat(first_name, ' ', last_name)
);
```

Dimensions may be used in both `reduce` and `project`
queries.

```malloy
-- Show the top 10 full names by number of occurrances
users | reduce top 10
  full_name
  occurances is count()

-- Show 10 users' full names
users | project limit 10 full_name
```

### Measures

Measures are fields representing aggregated data over
multiple records.

Measures may not be used in `project` queries. However, any measures that appear in a `reduce` query stage are "dimensionalized" as part of the query, and are therefore usable as dimensions in subsequent stages.

```malloy
flights
  | reduce
    carrier
    flight_count is count()
  | project flight_count
```

### Queries

Queries represent a pipelined data transformation including a source and one or more transformation stages. There are
three places a query may be defined, but only two of these
are considered "fields."

When a query is defined as part of an explore, its source
is implicity the explore itself.

```malloy
define flights is (explore 'malloy-data.faa.flights'
  by_carrier is (reduce
    carrier
    flight_count is count()
  )
);
```

In this case, `by_carrier` implicitly has a source of `flights` and can only be used in queries against `flights`.

Similarly, when a query is defined as part of a pipeline
stage, its source is implicitly the same as that of the
stage in which it is defined.

```malloy
define flights is (explore 'malloy-data.faa.flights'
  flight_count is count()
  carrier_dashboard is (reduce
    carrier
    by_year is (reduce
      dep_time_year is dep_time.year
      flight_count
    )
    by_origin is (reduce
      origin_code
      flight_count
    )
  )
)
```

In this case, both `by_year` and `by_origin` have a source
of `flights`.

A query can also be defined outside of any explore, in which
case it must specify its source. This kind of query is not considered a field.

```malloy
define flights_by_carrier is (flights | reduce
  carrier
  flight_count is count()
);
```
