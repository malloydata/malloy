# Malloy by Example

## SQL SELECT vs Malloy's `query`

The statement to run a query in malloy is `query:`.  Malloy's queries have two types, `project:` and `group_by:`/ `aggregate:`.

### SELECT with no GROUP BY

*Click the SQL Tab to see the generated SQL query*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
query: table('malloy-data.faa.airports') -> {
  project: [code, full_name, state, faa_region, fac_type, elevation]
  order_by: code
}
```

### SELECT with only Aggregate Functions

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
query: table('malloy-data.faa.airports') -> {
  aggregate: airport_count is count()
}
```

### SELECT with GROUP BY

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
query: table('malloy-data.faa.airports') -> {
  group_by: fac_type
  aggregate: airport_count is count()
  where: state = 'CA'
  order_by: airport_count desc
}
```

## Explore: adding calculations to tables

Malloy can create reusable calculations and tie them to tables (and other data sources).
These new object are called `explore:`.


* `measure:` is an calculation that can be used in the `aggregate:` element in a query
* `dimension:` is a scalar calculation that can be be used in a `group_by:` or `project:` element of a query

```malloy
--! {"isModel": true, "modelPath": "/inline/explore1.malloy", "isHidden": false}
explore: airports is table('malloy-data.faa.airports') {
  dimension: elevation_in_meters is elevation * 0.3048
  dimension: state_and_county is concat(state,' - ', county)
  measure: airport_count is count()
  measure: avg_elevation_in_meters is elevation_in_meters.avg()
}
```

## Querying against an Explore

[fabio]: what does the arrow mean?
[fabio]: array vs double declarations.

Queries can be run against `explore:` objects and can utilize the built in calculations.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/explore1.malloy"}
query: airports -> {
  limit: 10
  where: fac_type = 'HELIPORT'
  group_by: state
  aggregate: [
    airport_count           // <-- declared in explore
    avg_elevation_in_meters // <-- declared in explore
  ]
}
```

## Dimensional calculations are no different than columns

[fabio]: had to jump back to the explore definition

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/explore1.malloy"}
query: airports -> {
  group_by: state_and_county // <-- declared in explore
  aggregate: airport_count
  order_by: 1 desc
}
```


## Named Queries inside Explore object

Queries can be declared inside an explore and then called by name.

```malloy
--! {"isModel": true, "modelPath": "/inline/explore2.malloy", "isHidden": false}

explore: airports is table('malloy-data.faa.airports') {
  measure: airport_count is count()

  query: by_state is {        // <-- can be called by name
    group_by: state
    aggregate: airport_count
  }
}
```

###  Executing Named Queries

Instead of writing the elements of the query, we simply write the name of the query.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/explore2.malloy"}
query: airports -> by_state
```



## Filtering Queries

The refinement gesture `{ }` adds declarations to things (more on that later).  We can add a filter to `airports`
and run the named query `by_state`

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/explore2.malloy"}
query: airports  {
  where: fac_type = 'SEAPLANE BASE'   // <- run the query with an added filter
}
-> by_state
```

## Filtering Measures

Measures can also be filtered.

[fabio]: what is the difference between an aggregate and a measure?

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/explore2.malloy"}
query: airports -> {
  group_by: state
  aggregate: airport_count
  aggregate: heliport_count is airport_count { where: fac_type = 'HELIPORT' } // <-- add a filter
}
```

## Composing with Queries

For the next section assume the following explore declaration.

```malloy
--! {"isModel": true, "modelPath": "/inline/explore3.malloy", "isHidden": false}
explore: airports is table('malloy-data.faa.airports') {
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

[fabio]: anytime want a limit, I want an order by?

Malloy allows you to create nested subtable easily in query by declaring queries inside of queries.
In the case below, the top level query groups by state.  The nested query groups by facility type.
This mechanism is really useful for understanding data and creating complex data structures.

```malloy
--! {"isRunnable": true, "isPaginationEnabled": false, "size":"medium","source": "/inline/explore3.malloy"}
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

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/explore3.malloy"}
query: airports -> {
  group_by: faa_region
  aggregate: airport_count
  nest: top_5_states
  nest: by_facility_type
}
```

Queries can be nested to any level of depth.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/explore3.malloy"}
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

The refine gesture `{ }` adds declarations to things.  We can add elements to a query by refining it.

For example we can add a limit and an order by to `by_state`

```malloy
query: airports -> by_state {
  order_by: state desc    // <-- add order by to query
  limit: 2
}
```

is the same as

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"small","source": "/inline/explore2.malloy"}
query: airports -> {
  group_by: state
  aggregate: airport_count
  order_by: state desc
  limit: 2
}
```

## Refinements allow you to add elements to queries.

Refinements are a way of modifying declared things as you use them.  This becomes useful when the
declared thing isn't exactly as you would like.

### You can add limits, ordering, filtering and even fields to queries when you use them.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/explore3.malloy"}
query: airports -> by_facility_type {
  limit: 2
}
```

[fabio]: go further in refinement examples and deep nesting.  Reproduce the nested example more simply


### You can add a measure or dimension

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/explore3.malloy"}
query: airports -> by_facility_type {
  aggregate: avg_elevation
}
```

### You can even add another query

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/explore3.malloy"}
query: airports -> top_5_states {
  nest: by_facility_type
}
```

### Changing the inner and outer query it around shows something very different

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/explore3.malloy"}
query: airports-> by_facility_type {
  nest: top_5_states
}
```


## Joining ...

First let's model some simple tables...

### Carrier table

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
explore: carriers is table('malloy-data.faa.carriers') {
  measure: carrier_count is count()
}

query: carriers-> {
    project: *
}
```

### Flights table

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
explore: flights is table('malloy-data.faa.flights') {
  measure: flight_count is count()
}

query: flights -> {
  project: [ id2, tail_num, dep_time, carrier, origin, destination, distance, dep_delay ]
  limit: 10
}
```

## Foreign Key / Primary Key Join

[fabio]: cardinality of joins is hard...

Join carriers to flights.  Each flight has one carrier so we use `join_one:`.  We are joining
with a primary key in carriers and foreign key in flights so we can use the `with` keyword
to name the foreign key in flights.

```malloy
--! {"isModel": true, "modelPath": "/inline/join1.malloy", "isHidden": false}
explore: carriers is table('malloy-data.faa.carriers') {
  primary_key: code                   // <-- name the primary key of the table
  measure: carrier_count is count()
}

explore: flights is table('malloy-data.faa.flights') {

  join_one: carriers with carrier  // <-- with names foreign_key

  measure: [
    flight_count is count()
    total_distance is distance.sum()
    avg_distance is distance.avg()
  ]
}
```

###  Query the joined tables

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/join1.malloy"}
query: flights -> {
  group_by: carriers.nickname
  aggregate: [
    flight_count
    total_distance
    avg_distance
  ]
}
```

## Aggregates can be computed from anywhere in the Join Tree


```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/join1.malloy"}
query: flights -> {
  limit: 10
  group_by: origin
  aggregate: carriers.carrier_count   // <-- calculation in joined table
  nest: top_3_carriers is {
    limit: 3
    group_by: carriers.nickname
    aggregate: [
        flight_count
        total_distance
        avg_distance
    ]
  }
}
```

## Graph, more complicated Joins

[fabio]: simplify model, get rid of extraneous stuff.
[fabio]: graph isn't introduce.
[fabio]: warning if need to generate a primary key.
[fabio]: symmetric should be 'correct calculation'

```malloy
--! {"isModel": true, "modelPath": "/inline/join2.malloy", "isHidden": false}
explore: carriers is table('malloy-data.faa.carriers') {
  primary_key: code
  measure: carrier_count is count()
}

explore: flights is table('malloy-data.faa.flights') {

  join_one: carriers with carrier  // <-- each flight has 1 carrier

  measure: [
    flight_count is count()
    total_distance is distance.sum()
    avg_distance is distance.avg()
  ]
}

explore: airports is table('malloy-data.faa.airports') {

  join_many: flights on code = flights.origin  // <-- each airport has many flights
                                               // <-- join ON like SQL

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

Malloy has full pathing instead of one level like SQL.  This query is very difficult to express in SQL.
The calculations in flights and airports will be accurate even though the join pattern fans out the data.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/join2.malloy"}
query: airports-> {
  group_by: state
  aggregate: [
    flights.carriers.carrier_count  // <-- 3 levels
    flights.flight_count
    flights.total_distance          // <-- symmetric calculation
    airport_count
    avg_elevation_in_meters         // <-- symmetric calculation
  ]
}
```

## Pipelines

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}

explore: airports is table('malloy-data.faa.airports') {
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
## Unnesting in a pipeline flattens the table
[fabio]: still don't know what a pipeline is
[fabio]: setup section is not obvious

Next stage of a pipeline can be a `group_by` or `project`.  Calculations can be computed
relative to the level of nesting.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}

explore: airports is table('malloy-data.faa.airports') {
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
  project: [
    state
    top_3_county.county
    airports_in_state is airport_count
    airports_in_county is top_3_county.airport_count
    percent_of_state is top_3_county.airport_count/airport_count
  ]
}
```

## Pipelines can be named as queries in explores

```malloy
explore: airports is table('malloy-data.faa.airports') {
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
    project: [
      state
      top_3_county.county
      airports_in_state is airport_count
      airports_in_county is top_3_county.airport_count
      percent_of_state is top_3_county.airport_count/airport_count
    ]
  }
}

query: airports -> county_rollup

```

## Refining Explores

(add section)

```malloy
explore: newname is from(oldname) {
  where: <some data limit>
  measure: added_calc is some_calc.sum()
}
```

## Explores based on Queries

### Named Source Query

*documentation bug: name should not be commented out*

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium"}
query: /* q_airport_facts is */ table('malloy-data.faa.flights') -> {
  group_by: [
    flight_year is dep_time.year
    origin
    carrier
  ]
  aggregate: [
    num_flights is count()
    distance is distance.sum()
  ]
}
```

```malloy
--! {"isModel": true, "modelPath": "/inline/query1.malloy", "isHidden": true}
query: q_airport_facts is table('malloy-data.faa.flights') -> {
  group_by: [
    flight_year is dep_time.year
    origin
    carrier
  ]
  aggregate: [
    num_flights is count()
    distance is distance.sum()
  ]
}
```

### Explore based on a query

```malloy
--! {"isModel": true, "modelPath": "/inline/query2.malloy", "source":"/inline/query1.malloy", "isHidden": false}

explore: airport_facts is from(-> q_airport_facts) {  // <-- 'from' instead of 'table'
                                                      //      '->' indicates a query name
  measure: flight_count is num_flights.sum()
  measure: total_distance is distance.sum()

  query: flights_by_year is {
    group_by: flight_year
    aggregate: [
      flight_count
      carrier_count is count(distinct carrier)
      origin_count is count(distinct origin)
    ]
  }

  query: flights_by_origin is {
    group_by: origin
    aggregate: [
      flight_count
      carrier_count is count(distinct carrier)
    ]
  }
}
```

### Querying the Summary explore

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/query2.malloy"}
query: airport_facts -> flights_by_year
```

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "size":"medium","source": "/inline/query2.malloy"}
query: airport_facts -> flights_by_origin
```

## Missing examples:

### SQL BLocks

### Named Queries from SQL Blocks

### Case statement improved with  `pick`

### Group by on Joined Subtrees

### Date/Timestamp filters and Timezones

### Nested data and Symmetric aggregates

### import

### data styles and rendering
