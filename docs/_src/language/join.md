# Joins

Currently, all joins in Malloy are left outer joins, and must be between the primary key of one table and a foreign key in the [explore](explore.md) being joined to.

## Join Types

### Foreign Key to Primary Key

To join a foreign key of the source explore to the `primary key` of a joined explore, reference the foreign key by name in the `on` clause.

```malloy
order_items is (explore 'malloy-data.ecomm.order_items'
  order_items is join on user_id
);
```

### Primary Key to Foreign Key

To join the `primary key` of the source explore to a foreign key on a joined explore, reference the field from the joined explore in the `on` clause.

```malloy
users is (explore 'malloy-data.ecomm.users'
  primary key id
  order_items is join on order_items.user_id
);
```

## Naming Joined Explores

To preserve the name of the explore being joined in, use `join on`.

```malloy
flights is (explore 'malloy-data.faa.flights'
  primary key id2
  carriers is join on carrier
);
```

To give the joined explore a different name within the source explore, specify the name of the explore being joined in between `join` and `on`.

```malloy
flights is (explore 'malloy-data.faa.flights'
  primary key id2
  origin_airport is join airports on origin
);
```

## Inlining Joins

Explores do not need to be named before they are used in a join.

```malloy
order_items is (explore 'malloy-data.ecomm.order_items'
  users is join ('malloy-data.ecomm.users'
    primary key id
  ) on user_id
);
```

## Using Fields in Joined Explores

When an explore is joined in, it becomes a nested field within the source explore. Fields within the joined explore can be referenced by first naming the joined explore, then accessing a contained field using `.`.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size":"large"}
explore flights
| reduce
  carriers.nickname
  flight_count is count()
```

Measures and queries defined in joined explores may be used in addition to dimensions.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "size":"large"}
explore flights
| reduce
  destination_code
  carriers.carrier_count
```

## Join Example

This example demonstrates the definition of several different joins in a model and their use in a query.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "size":"large"}
/* Data about particular kinds of aircraft */
define aircraft_models is (explore 'malloy-data.faa.aircraft_models'
  primary key aircraft_model_code
);

/* Individual airplanes */
define aircraft is (explore 'malloy-data.faa.aircraft'
  primary key tail_num
  aircraft_models is join on aircraft_model_code
);

/* The airports that the aircraft fly to and from */
define airports is (explore 'malloy-data.faa.airports'
  primary key code
);

/* Each individual flight */
define flights is (explore 'malloy-data.faa.flights'
    aircraft is join on tail_num
    origin_airport is join airports on origin
    destination_airport is join airports on destination
  );

explore flights : [
  dep_time : @2003-01,
  origin_airport.code : 'SJC'
] | reduce
  destination_code is destination_airport.code
  flight_count is count()
  aircraft_count is aircraft.count()
  aircraft_model_count is aircraft.aircraft_models.count()
```

For more examples and how to reason about aggregation across joins, review the [Aggregates](aggregates.md) section.