# Joins

Currently, all joins in Malloy are left outer joins, and must be between the primary key of one table and a foreign key in the [explore](explore.md) being joined to.

## Join Types

### Foreign Key to Primary Key

To join a foreign key of the source explore to the `primary key` of a joined explore, reference the foreign key by name in the `on` clause.

```malloy
explore: users is table('malloy-data.ecomm.users'){
  primary_key: id
}

explore: order_items is table('malloy-data.ecomm.order_items'){
  join: users on user_id
}
```

## Naming Joined Explores

To preserve the name of the explore being joined in, use `join on`.

```malloy

explore: carriers is table('malloy-data.faa.carriers') {
  primary_key: code
}

explore: flights is table('malloy-data.faa.flights'){
  join: carriers on carrier
}
```

To give the joined explore a different name within the source explore, specify the name of the explore being joined in between `join` and `on`.

```malloy
explore: airports is table('malloy-data.faa.airports') {
  primary_key: code
}

explore: flights is table('malloy-data.faa.flights'){
  join: origin_airport is airports on origin
}
```

## Inlining Joins

Explores do not need to be named before they are used in a join.

```malloy

explore: flights is table('malloy-data.faa.flights'){
  join: carriers is  table('malloy-data.faa.carriers'){primary_key: code} on carrier
}
```

## Using Fields in Joined Explores

When an explore is joined in, it becomes a nested field within the source explore. Fields within the joined explore can be referenced by first naming the joined explore, then accessing a contained field using `.`.

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
jois aircraft (which already has a join to aircraft manufacturer).  The tree nature of the join relationship
retained.

  `group_by: aircraft.aircraft_models.manufacturer`

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "size":"large"}
explore: aircraft_models is table('malloy-data.faa.aircraft_models') {
  primary_key: aircraft_model_code
  measure: aircraft_model_count is count()
}

/* Individual airplanes */
explore: aircraft is table('malloy-data.faa.aircraft') {
  primary_key: tail_num
  measure: aircraft_count is count()
  join: aircraft_models on aircraft_model_code
}

/* The airports that the aircraft fly to and from */
explore: airports is table('malloy-data.faa.airports') {
  primary_key: code
  measure: airport_count is count()
}

explore: flights is table('malloy-data.faa.flights') {
  join: origin_airport is airports on origin
  join: destination_airport is airports on destination
  join: aircraft on tail_num
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