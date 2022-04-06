# Malloy by Example

This document will assumes a working knowledge of SQL and will rapidly take you through some of
Malloy's key language features.

Malloy is currently available as a VS Code extension and can query BigQuery and Postgres SQL databases.

[Install Instructions](https://github.com/looker-open-source/malloy/)

## SQL SELECT vs Malloy's `query`

The statement to run a query in Malloy is `query:`. There are two types of queries in Malloy, reductions which have `group_by:` or `aggregate:` statements, and projections which have `project:` statements and do not group or aggregate results.

### Projection: SELECT with no GROUP BY

In SQL
```sql
SELECT code, full_name, state, faa_region, fac_type, elevation
FROM `malloy-data.faa.airports`
ORDER BY code
```
Equivalent in Malloy

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
query: table('malloy-data.faa.airports') -> {
  project: code, full_name, state, faa_region, fac_type, elevation
  order_by: code
}
```

### Reduction: SELECT with GROUP BY and/or aggregation

In SQL
```sql
SELECT
   base.fac_type as fac_type,
   COUNT( 1) as airport_count
FROM `malloy-data.faa.airports` as base
WHERE base.state='CA'
GROUP BY 1
ORDER BY 2 desc
```

Equivalent in Malloy

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
query: table('malloy-data.faa.airports') -> {
  group_by: fac_type
  aggregate: airport_count is count()
  where: state = 'CA'
  order_by: airport_count desc
}
```

## Using this Guide

For every Malloy Query you can see the formatted result, or raw result as JSON, or the SQL used to produce the result.

Click tab to to see the  HTML, JSON or SQL result:  <img src="https://user-images.githubusercontent.com/1093458/154121968-6436d94e-94b2-4f16-b982-bf136a3fcf40.png" style="width:142px"> 👈👈


## Source: A data source for queries

Malloy separates a query from the source of the data. A source can be thought of as a table and a collection of computations and relationships which are relevant to that table.  ([Source Documentation](language/source.html)).

[Fields](language/fields.html) can be defined as part of a source.


* A `measure:` is a declared aggregate calculation (think function that operates across the table) which can be used in `aggregate:` elements in a query stage
* A `dimension:` is a declared scalar calculation which that can be used in `group_by:` or `project:` elements of a query stage

```malloy
--! {"isModel": true, "modelPath": "/inline/source1.malloy", "isHidden": false}
source: airports is table('malloy-data.faa.airports') {
  dimension: elevation_in_meters is elevation * 0.3048
  dimension: state_and_county is concat(state,' - ', county)
  measure: airport_count is count()
  measure: avg_elevation_in_meters is elevation_in_meters.avg()
}
```

## Querying against a Source

Queries can be run against `source:` objects and can utilize the modeled fields from that source, as well as introduce new ones. ([Query Documentation](language/query.html))


*using the above declared `airports` source*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/source1.malloy"}
query: airports -> {
  limit: 10
  where: fac_type = 'HELIPORT'
  group_by: state
  aggregate:
    airport_count           // <-- declared in source
    avg_elevation_in_meters // <-- declared in source
}
```

## Dimensional calculations are no different from columns

*using the above declared `airports` source*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/source1.malloy"}
query: airports -> {
  group_by: state_and_county // <-- declared in source
  aggregate: airport_count
  order_by: 1 desc
}
```


## Defining Named Queries inside a Source

A source can also contain a set of useful queries relating to that source.

*using the above declared `airports` source*


```malloy
--! {"isModel": true, "modelPath": "/inline/source2.malloy", "isHidden": false}

source: airports is table('malloy-data.faa.airports') {
  measure: airport_count is count()

  query: by_state is {        // <-- can be called by name
    group_by: state
    aggregate: airport_count
  }
}
```

Note that the source is implied, so the query operator (`->`) and source are not needed to define the named query.

##  Executing Named Queries

The simplest form of a query in Malloy is the name of a source, the query operator `->`, and the name of one of its contained queries.

*using the above declared `airports` source*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/source2.malloy"}
query: airports -> by_state
```



## Filtering a Source

You can filter a source by adding a filter expression using the `where:` keyword and then use this refined version of `airports` to run the `by_state` query.  ([Filter Documentation](language/filters.html))

*using the above declared `airports` source*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/source2.malloy"}
query: airports  {
  where: fac_type = 'SEAPLANE BASE'   // <- run the query with an added filter
}
-> by_state
```

## Filtering Measures

The input to an aggregate computation can be filtered.

*using the above declared `airports` source*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/source2.malloy"}
query: airports -> {
  group_by: state
  aggregate: airport_count
  aggregate: heliport_count is airport_count { where: fac_type = 'HELIPORT' } // <-- add a filter
}
```

## Composing with Queries

For the next section assume the following source declaration.

```malloy
--! {"isModel": true, "modelPath": "/inline/source3.malloy", "isHidden": false}
source: airports is table('malloy-data.faa.airports') {
  measure: airport_count is count()
  measure: avg_elevation is elevation.avg()

  query: top_5_states is {
    group_by: state
    aggregate: airport_count
    limit: 5
  }

  query: by_facility_type is {
    group_by: fac_type
    aggregate: airport_count
  }
}
```

## The `nest:` property embeds one query in another

Malloy allows you to create nested subtables easily in a query.
In the case below, the top level query groups by state and nested query groups by facility type.
This mechanism is really useful for understanding data and creating complex data structures. ([Nesting Documentation](language/nesting.html))

*using the above declared `airports` source*

```malloy
--! {"isRunnable": true, "isPaginationEnabled": false, "size":"medium","source": "/inline/source3.malloy"}
query: airports -> {
  group_by: state
  aggregate: airport_count
  limit: 5
  nest: by_facility_type is {
    group_by: fac_type
    aggregate: airport_count
  }
}
```

Queries can contain multiple nested queries.

*using the above declared `airports` source*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/source3.malloy"}
query: airports -> {
  group_by: faa_region
  aggregate: airport_count
  nest: top_5_states
  nest: by_facility_type
}
```

Queries can be nested to any level of depth.

*using the above declared `airports` source*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/source3.malloy"}
query: airports -> {
  group_by: faa_region
  aggregate: airport_count
  nest: by_state_and_county is {
    group_by: state
    aggregate: airport_count
    nest: by_county is {
      group_by: county
      aggregate: airport_count
      limit: 4
    }
  }
  nest: by_facility_type
}
```

## Refining a Named Query

The refinement gesture `{}` extends an existing object, creating a new version with added properties

For example we can add a limit and an order by to `by_state`

```malloy
query: airports -> by_state {
  order_by: state desc    // <-- add order by to query
  limit: 2
}
```

is the same as

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/source2.malloy"}
query: airports -> {
  group_by: state
  aggregate: airport_count
  order_by: state desc
  limit: 2
}
```

### You can add a measure or dimension

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/source3.malloy"}
query: airports -> by_facility_type {
  aggregate: avg_elevation
}
```

### You can nest another query

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/source3.malloy"}
query: airports -> top_5_states {
  nest: by_facility_type
}
```

## Composing with Queries

Changing the inner and outer query in the example above reveals very different information.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/source3.malloy"}
query: airports-> by_facility_type {
  nest: top_5_states
}
```


## Joining

First let's model some simple tables... ([Join Documentation](language/join.html))

### Carrier table
*simple source declaration used in example below*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
source: carriers is table('malloy-data.faa.carriers') {
  measure: carrier_count is count()
}

query: carriers-> {
    project: *
}
```

### Flights table

*simple source declaration used in example below*
```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
source: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}

query: flights -> {
  project: id2, tail_num, dep_time, carrier, origin, destination, distance, dep_delay
  limit: 10
}
```

## Declare a Join

Join carriers to flights.  Each flight has one carrier so we use `join_one:`.
([Join Documentation](language/join.html))

```malloy
--! {"isModel": true, "modelPath": "/inline/join1.malloy", "isHidden": false}
source: carriers is table('malloy-data.faa.carriers') {
  measure: carrier_count is count()
}

source: flights is table('malloy-data.faa.flights') {

  join_one: carriers on carrier=carriers.code

  measure:
    flight_count is count()
    total_distance is distance.sum()
    avg_distance is distance.avg()
}
```

###  Query the joined tables

*using the above declared `flights` source*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/join1.malloy"}
query: flights -> {
  group_by: carriers.nickname
  aggregate:
    flight_count
    total_distance
    avg_distance
}
```

## Aggregates can be computed from anywhere in the Join Tree

([Aggregate Documentation](language/aggregates.html))


*using the above declared `flights` source*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/join1.malloy"}
query: flights -> {
  limit: 10
  group_by: origin
  aggregate: carriers.carrier_count   // <-- calculation in joined table
  nest: top_3_carriers is {
    limit: 3
    group_by: carriers.nickname
    aggregate:
        flight_count
        total_distance
        avg_distance
  }
}
```

## More Complex Joins

The most common join pattern is a foreign key join. Malloy uses the `with:`
to declare these and generates more efficient SQL when these joins are used.

In the example below, we use a `with:` join for `carriers` and then model the more complex relationship with the `flights` originating from each `airport` using  `on:`.

Many `flights` have the same
`airport` as their origin so we use `join_many:`.


```malloy
--! {"isModel": true, "modelPath": "/inline/join2.malloy", "isHidden": false}
source: carriers is table('malloy-data.faa.carriers') {
  primary_key: code
  measure: carrier_count is count()
}

source: flights is table('malloy-data.faa.flights') {

  join_one: carriers with carrier  // <-- each flight has 1 carrier

  measure:
    flight_count is count()
    total_distance is distance.sum()
    avg_distance is distance.avg()
}

source: airports is table('malloy-data.faa.airports') {

  join_many: flights on code = flights.origin  // <-- each airport has many flights

  measure: airport_count is count()
  dimension: elevation_in_meters is elevation * 0.3048
  measure: avg_elevation_in_meters is elevation_in_meters.avg()

  query: by_state is {
    group_by: state
    aggregate: airport_count
  }
}
```

## Calculations work properly regardless of where you are in the graph

This query is very difficult to express in SQL. Malloy's understanding of source relationships allows it to compute aggregate computations at any node of the join path,unlike SQL which can only do aggregate computation at the. outermost level.
([Aggregate Documentation](language/aggregates.html))

*using the above declared `airports` source*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/join2.malloy"}
query: airports ->  {
  group_by: state
  aggregate:
    flights.carriers.carrier_count  // <-- 3 levels
    flights.flight_count
    flights.total_distance
    airport_count
    avg_elevation_in_meters         // <-- symmetric calculation
}
```

## Pipelines

The output of a query can be used as the source for the next query.

*Assume the following query as a starting point.*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}

source: airports is table('malloy-data.faa.airports') {
  measure: airport_count is count()
}

query: airports -> {
  where: fac_type = 'HELIPORT'
  group_by: state
  aggregate: airport_count
  nest: top_3_county is {
    limit: 3
    group_by: county
    aggregate: airport_count
  }
}
```

## Un-nesting in a pipeline flattens the table

Queries can be chained together (pipelined), the output of one becoming the input of the next one, by simply adding another `->` operator and a new query definition.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}

source: airports is table('malloy-data.faa.airports') {
  measure: airport_count is count()
}

query: airports -> {
  where: fac_type = 'HELIPORT'
  group_by: state
  aggregate: airport_count
  nest: top_3_county is {
    limit: 3
    group_by: county
    aggregate: airport_count
  }
}
-> {
  project:
    state
    top_3_county.county
    airports_in_state is airport_count
    airports_in_county is top_3_county.airport_count
    percent_of_state is top_3_county.airport_count/airport_count
}
```

## Pipelines can be named as queries in sources

Pipelines can do pretty complex things.  They can be built into source objects.

```malloy
source: airports is table('malloy-data.faa.airports') {
  measure: airport_count is count()
  query: county_rollup is  {
    where: fac_type = 'HELIPORT'
    group_by: state
    aggregate: airport_count
    nest: top_3_county is {
      limit: 3
      group_by: county
      aggregate: airport_count
    }
  }
  -> {
    project:
      state
      top_3_county.county
      airports_in_state is airport_count
      airports_in_county is top_3_county.airport_count
      percent_of_state is top_3_county.airport_count/airport_count
  }
}

query: airports -> county_rollup

```

## Refining Sources

As with a query, a source can be extended with the refinement gesture `{}` to create a new version of the source with additional properties.

```malloy
source: newname is from(oldname) {
  where: <some data limit>
  measure: added_calc is some_calc.sum()
}
```

## Sources based on Queries

### Named Query

*documentation bug: name should not be commented out* ([Source Documentation](language/source.html))

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium"}
query: /* q_airport_facts is */ table('malloy-data.faa.flights') -> {
  group_by:
    flight_year is dep_time.year
    origin
    carrier
  aggregate:
    num_flights is count()
    distance is distance.sum()
}
```

```malloy
--! {"isModel": true, "modelPath": "/inline/query1.malloy", "isHidden": true}
query: q_airport_facts is table('malloy-data.faa.flights') -> {
  group_by:
    flight_year is dep_time.year
    origin
    carrier
  aggregate:
    num_flights is count()
    distance is distance.sum()
}
```

### Source based on a query

```malloy
--! {"isModel": true, "modelPath": "/inline/query2.malloy", "source":"/inline/query1.malloy", "isHidden": false}

source: airport_facts is from(-> q_airport_facts) {  // <-- 'from' instead of 'table'
                                                      //      '->' indicates a query name
  measure: flight_count is num_flights.sum()
  measure: total_distance is distance.sum()

  query: flights_by_year is {
    group_by: flight_year
    aggregate:
      flight_count
      carrier_count is count(distinct carrier)
      origin_count is count(distinct origin)
  }

  query: flights_by_origin is {
    group_by: origin
    aggregate:
      flight_count
      carrier_count is count(distinct carrier)
  }
}
```

### Querying the Summary source

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/query2.malloy"}
query: airport_facts -> flights_by_year
```

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/query2.malloy"}
query: airport_facts -> flights_by_origin
```

## Other Interesting Language Features:

### SQL BLocks ([SQL Block Documentation](language/sql_block.html))

### Named Queries from SQL Blocks ([SQL Block Documentation](language/sql_block.html))

### Case statement improved with  `pick` ([Expression Documentation](language/expression.html))

### Group by on Joined Subtrees

### Date/Timestamp filters and Timezones ([Time Documentation](expressions.html#time-ranges))

### Nested data and Symmetric aggregates  ([Aggregates Documentation](language/aggregates.html))

### Import ([Import Documentation](language/imports.html))

### Data styles and rendering ([Rendering Documentation](visualizations/dashboards.html))
