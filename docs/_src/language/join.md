# Joins

Joins in malloy are different than SQL joins.  When two explores are joined,
Malloy retains the graph nature of the the data relationships. This is unlike
SQL, which flattens them all into a single table space.

[Aggregate calculations](aggregates.md) use this graph to deduce
a locality of computation, so they always work regardless of join pattern.

In Malloy syntaxes for join are:

```malloy
join_one: <explore-name> [is <explore-exp>] with <foreign_key>
join_one: <explore-name> [is <explore-exp>] [on <boolean expression>]
join_many: <explore-name> [is <explore-exp>] on <boolean expression>
join_cross: <explore-name> [is <explore-exp>] [on <boolean expression>]
```

`join_one:` - the table we are joining has one row for each row in the source table.

`join_many:` - the table we are joining has many rows for each row in the source table

`join_cross:` - the join is a cross product and there will be many rows in each side of the join.

Malloy's joins are left outer joins by default.
Since Malloy deals in graphs, some SQL Join types don't make sense (RIGHT JOIN, for example).


## Join Types

### Foreign Key to Primary Key

The easiest, most error proof way to perform a join is with `join_one:/with`. The basic syntax is:

`join_one: <explore> with <foreign_key>`

To join a foreign key of the source explore to the `primary key` of a joined explore, reference the foreign key by name in the `with` clause.

```malloy
explore: users is table('malloy-data.ecomm.users') {
  primary_key: id
}

explore: order_items is table('malloy-data.ecomm.order_items') {
  join_one: users with user_id
}
```

## Naming Joined Explores

If no name is specified with `is`, the name of the join will be the name of the
explore being joined.

```malloy

explore: carriers is table('malloy-data.faa.carriers') {
  primary_key: code
}

explore: flights is table('malloy-data.faa.flights') {
  join_one: carriers with carrier
}
```

To give the joined explore a different name within the source explore, use `is` to specify the name of the explore.

```malloy
explore: airports is table('malloy-data.faa.airports') {
  primary_key: code
}

explore: flights is table('malloy-data.faa.flights') {
  join_one: origin_airport is airports with origin
}
```

## Inlining Joins

Explores do not need to be named before they are used in a join. if the join
uses `is` to give the join a name.

```malloy

explore: flights is table('malloy-data.faa.flights') {
  join_one: carriers is table('malloy-data.faa.carriers') { primary_key: code } with carrier
}
```

## Using Fields in Joined Explores

When an explore is joined in, it becomes a nested field within the source explore. Fields within the joined explore can be referenced by first naming the joined explore, then accessing a contained field using `.`.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size":"large"}
query: flights -> {
  group_by: carriers.nickname
  aggregate: flight_count is count()
}
```

Measures and queries defined in joined explores may be used in addition to dimensions.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size":"large"}
query: flights -> {
  group_by: destination_code
  aggregate: carriers.carrier_count
}
```

## Join Example

This example demonstrates the definition of several different joins in a model and their use in a query.
Entire subtrees of data can be joined.  In the example below, `aircraft` joins `aircraft_models`.  `flights`
joins aircraft (which already has a join to aircraft manufacturer).  The tree nature of the join relationship
retained.

  `group_by: aircraft.aircraft_models.manufacturer`

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "size":"large"}
explore: aircraft_models is table('malloy-data.faa.aircraft_models') {
  primary_key: aircraft_model_code
  measure: aircraft_model_count is count()
}

// Individual airplanes
explore: aircraft is table('malloy-data.faa.aircraft') {
  primary_key: tail_num
  measure: aircraft_count is count()
  join_one: aircraft_models with aircraft_model_code
}

// The airports that the aircraft fly to and from
explore: airports is table('malloy-data.faa.airports') {
  primary_key: code
  measure: airport_count is count()
}

explore: flights is table('malloy-data.faa.flights') {
  join_one: origin_airport is airports with origin
  join_one: destination_airport is airports with destination
  join_one: aircraft with tail_num
}

query: flights -> {
  group_by: aircraft.aircraft_models.manufacturer
  aggregate: [
    flight_count is count()
    aircraft_count is aircraft.count()
    aircraft_model_count is aircraft.aircraft_models.count()
  ]
}
```

For more examples and how to reason about aggregation across joins, review the [Aggregates](aggregates.md) section.

## SQL Joins

Inner join are joins where the the joined table has rows. The example below, suppose we only want users that have at least one row in the orders table. The following is the equivalent of a SQL <code>INNER JOIN</code>.

```malloy
explore users is table('users') {
  join_many: orders is table('orders') on id = orders.user_id and orders.user_id != null
}
```
