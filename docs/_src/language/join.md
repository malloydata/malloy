# Joins

Joins in Malloy differ from SQL joins.  When two explores are joined,
Malloy retains the graph nature and hierarchy of the the data relationships. This is unlike
SQL, which flattens everything into a single table space.

[Aggregate calculations](aggregates.md) navigate this graph to deduce
the locality of computation, so they are always computed correctly regardless of join pattern, avoiding the fan and chasm traps.

In Malloy, syntaxes for join are:

```malloy
join_one: <explore-name> [is <explore-exp>] on <boolean expression>
join_one: <explore-name> [is <explore-exp>] with <foreign_key>        -- slightly more concise; works with primary to foreign key joins
join_many: <explore-name> [is <explore-exp>] on <boolean expression>
join_cross: <explore-name> [is <explore-exp>] [on <boolean expression>]
```

Examples of the above, with `orders` as the implied source explore.:
```malloy
join_one: users is table('malloy-data.ecomm.users') on orders.user_id = users.id
join_one: users on orders.user_id = users.id
join_one: users with user_id
join_many: order_items on order_items.id = orders.id
join_cross: order_items2 is table('malloy-data.ecomm.order_items') on user_id = order_items2.user_id
```

`join_one:` - the table we are joining has one row for each row in the source table.

`join_many:` - the table we are joining has many rows for each row in the source table

`join_cross:` - the join is a cross product and there will be many rows in each side of the join.


Malloy's joins are left outer by default.
Since Malloy deals in graphs, some SQL Join types don't make sense (RIGHT JOIN, for example).


## Join Types

### Foreign Key to Primary Key

The easiest, most error-proof way to perform a join is using the following syntax:

`join_one: <explore> with <foreign_key>`

To join a foreign key of the source explore to the `primary_key` of a joined explore, reference the foreign key by name in the `with` clause.

```malloy
source: users is table('malloy-data.ecomm.users'){
  primary_key: id
}

source: order_items is table('malloy-data.ecomm.order_items'){
  join_one: users with user_id
}
```

This syntax for the join expresses exactly the same thing a bit more explicitly:
```
source: order_items is table('malloy-data.ecomm.order_items'){
  join_one: users on order_items.user_id = users.id
}
```


## Naming Joined Explores

If no alias is specified using `is`, the name of the join will be the name of the
explore being joined.

```malloy

source: carriers is table('malloy-data.faa.carriers') {
  primary_key: code
}

source: flights is table('malloy-data.faa.flights'){
  join_one: carriers with carrier
}
```

To give the joined explore a different name within the source explore, use `is` to alias the explore.

```malloy
source: airports is table('malloy-data.faa.airports') {
  primary_key: code
}

source: flights is table('malloy-data.faa.flights'){
  join_one: origin_airport is airports with origin
}
```

## In-line Joins

Explores do not need to be modeled before they are used in a join, though the join must be named using `is`.

```malloy

source: flights is table('malloy-data.faa.flights'){
  join_one: carriers is table('malloy-data.faa.carriers'){primary_key: code} with carrier
}
```

## Using Fields from Joined Explores

When an explore is joined in, its fields become nested within the parent explore. Fields from joined explores can be referenced using `.`:

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size":"large"}
query: flights->{
  group_by: carriers.nickname
  aggregate: flight_count is count()
}
```

Measures and queries defined in joined explores may be used in addition to dimensions.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size":"large"}
query: flights->{
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
source: aircraft_models is table('malloy-data.faa.aircraft_models') {
  primary_key: aircraft_model_code
  measure: aircraft_model_count is count()
}

/* Individual airplanes */
source: aircraft is table('malloy-data.faa.aircraft') {
  primary_key: tail_num
  measure: aircraft_count is count()
  join_one: aircraft_models with aircraft_model_code
}

/* The airports that the aircraft fly to and from */
source: airports is table('malloy-data.faa.airports') {
  primary_key: code
  measure: airport_count is count()
}

source: flights is table('malloy-data.faa.flights') {
  join_one: origin_airport is airports with origin
  join_one: destination_airport is airports with destination
  join_one: aircraft with tail_num
}

query: flights->{
  group_by: aircraft.aircraft_models.manufacturer
  aggregate: [
    flight_count is count()
    aircraft_count is aircraft.count()
    aircraft_model_count is aircraft.aircraft_models.count()
  ]
}
```

For more examples and how to reason about aggregation across joins, review the [Aggregates](aggregates.md) section.

## Inner Joins

Inner join are essentially left joins with an additional condition that the parent table has matches in the joined table. The example below functions logically as an INNER JOIN, returning only users that have at least one row in the orders table, and only orders that have an associated user.

```malloy
explore users is table('users') {
  join_many: orders is table('orders') on id=orders.user_id and orders.user_id != null
}
```