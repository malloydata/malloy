# Aggregates

Malloy supports the standard aggregate functions `count`, `sum`, `avg`, `min`, and `max`. When these are used in a field's definition, they make that field a [measure](fields.md#measures).

## Basic Syntax

### Counts

The `count` aggregate function may be used to count the number of records appearing in an explore.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: flights->{
  aggregate: flight_count is count()
}
```

### Distinct Counts

Distinct counts may be used to count the number of distinct values of a particular field within an explore.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "ecommerce/ecommerce.malloy"}
query: order_items->{
  aggregate: order_count is count(distinct order_id)
}
```

### Sums

The `sum` function may be used to compute the sum of all records of a particular field.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: flights->{
  aggregate: total_distance is sum(distance)
}
```

### Averages

The `avg` function may be used to compute the average of all records of a particular field.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft->{
  aggregate: average_seats is sum(aircraft_models.seats)
}
```

### Minima

The `min` function may be used to compute the minimum of all records of a particular field.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "ecommerce/ecommerce.malloy"}
query: order_items->{
  aggregate: cheapest_price is min(sale_price)
}
```

### Maxima

The `max` function may be used to compute the maximum of all records of a particular field.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: flights->{
  aggregate: longest_distance is max(distance)
}
```

## Aggregate Locality

In SQL, some kinds of aggregations are difficult to express because locality of aggregation is restricted to the top level of a query. Malloy
offers more control over this behavior, allowing these types of analysis to be
expressed much more easily.

### The Problem

Suppose you were interested in learning more about the number of seats on
commercial aircraft. First you might look at the average number of seats
on all registered aircraft.

To do this, you would start with the `aircraft` table and join in `aircraft_models` to get access to the number of seats, then take
the average of `aircraft_models.seats`.

```sql
SELECT
    AVG(aircraft_models.seats)
FROM aircraft
LEFT JOIN aircraft_models
    ON aircraft.aircraft_model_code = aircraft_models.aircraft_model_code
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft->{
  aggregate: average_seats is avg(aircraft_models.seats)
}
```

You're also interested in knowing the average number of seats on the kinds of aircraft that are in use, or in other words, the average number of seats of the aircraft models of registered aircraft.

To do this, you might decide to start with the `aircraft_models` table instead.

```sql
SELECT AVG(seats)
FROM aircraft_models
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft_models->{
  aggregate: average_seats is avg(seats)
}
```

However, this isn't actually the number you were interested in, because this measures the average number of seats across _all_ aircraft models, not just the ones with actively-registered aircraft.

Unfortunately, SQL doesn't have any native constructs to compute this value, and in practice analysists often resort to complicated [fact tables](https://www.zentut.com/data-warehouse/fact-table/) to perform this kind of query.

### The Solution

Malloy introduces the concept of _aggregate locality_, meaning that aggregates can be computed with respect to different points in the data graph. In the following query, `average_seats` is computed with respect to `aircraft_models`,
yielding the the average number of seats on aircraft models of aircraft listed in the `aircraft` table.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft->{
  aggregate: average_seats is aircraft_models.avg(aircraft_models.seats)
}
```

For convenience, `aircraft_models.avg(aircraft_models.seats)` can be written as `aircraft_models.seats.avg()`.

### Examples

The following queries show six ways of calculating the average number of seats.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: flights->{
  aggregate: [
    aircraft_models_avg_seats is aircraft.aircraft_models.seats.avg()
    aircraft_avg_models_seats is aircraft.avg(aircraft.aircraft_models.seats)
    avg_aircraft_models_seats is avg(aircraft.aircraft_models.seats)
  ]
}
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft->{
  aggregate: [
    models_avg_seats is aircraft_models.seats.avg()
    avg_models_seats is avg(aircraft_models.seats)
  ]
}
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft_models->{
  aggregate: avg_seats is avg(seats)
}
```

This table summarizes the meaning of each of these calculations.

| Field Definition and Source | Is the average number of seats... |
|-------------|---------|
| `avg(seats)` in `aircraft_models`  | ...of all aircraft models. |
| `avg(aircraft_models.seats)` in `aircraft` | ...on aircraft. |
| `aircraft_models.seats.avg()` in `aircraft` | ...of the aircraft models of aircraft. |
| `avg(aircraft.aircraft_models.seats)` in `flights` | ...on flights. |
| `aircraft.avg(aircraft.aircraft_models.seats)` in `flights` | ...on aircraft that fly. |
| `aircraft.aircraft_models.seats.avg()` in `flights` | ...of the aircraft models of aircraft that fly.|

### Aggregates that Support Locality

The aggregate fuctions that support locality are `count`, `sum`, and `avg`.

The `min` and `max` aggregates do not support aggregate locality because the minimum and maximum values are the same regardless of where they are computed. Local aggregation removes duplicate values (those corresponding to the same row in the aggregate source location), and minimum and maximum values do not change if values are repeated more than once.

### Aggregates on Fields

Aggregating "on a field," e.g. `aircraft_models.seats.avg()` is exactly equivalent to aggregating that field with respect to its direct parent explore, e.g. `aircraft_models.avg(aircraft_models.seats)`. This syntax is supported for the aggregate functions which benefit from aggregate locality and require a field, `avg` and `sum`.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft->{
  aggregate: [
    avg_on_explore is aircraft_models.avg(aircraft_models.seats)
    avg_on_field is aircraft_models.seats.avg()
  ]
}
```





<!--
In SQL, it is easy to make mistakes when computing sums and averages,
particularly when joins are involved. An approach known as _symmetric aggregates_ solves one such common mistake by making the behavior of
aggregate functions consistent regardless of the structure of the query.

### The Problem

Consider a simple SQL query with an aggregate, like the following query,
which gives the average age of all users.

```sql
SELECT AVG(age)
FROM users
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "ecommerce/ecommerce.malloy"}
explore users
| reduce average_age is avg(age)
```

If we instead calculate the average age of users in a query against the
order items table joining in the users table, we get a different answer.

```sql
SELECT AVG(users.age)
FROM order_items
JOIN users ON order_items.user_id = users.id
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "ecommerce/ecommerce.malloy"}
explore order_items
| reduce users is avg(users.age)
```

The reason for this is that we're actually _not_ computing the average user age at all. To explain this, we'll look at a sample of the users table:

```sql
SELECT id, age
FROM users
LIMIT 5
ORDER BY id ASC
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "ecommerce/ecommerce.malloy", "pageSize": 20}
explore users
| project top 20 order by id
  id
  age
```

And we'll compare this to the composite table that is generated when you join `users` onto `order_items`.

```sql
SELECT order_items.id as order_item_id, users.id as user_id, age
FROM order_items
JOIN users ON order_items.user_id = users.id
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "ecommerce/ecommerce.malloy", "pageSize": 20}
explore order_items
| project top 20 order by order_items_id asc
  order_items_id is id
  user_id is users.id
  users.age
```

Here we can see that some `user_id`s appear more than once, and others not at all; so when we compute the average age over this table, we end up with the
average user age _weighted by number of items purchased_.

### The Solution

In SQL, a query containing a join first computes a composite table, then performs aggregations on it. In Malloy, the two steps can be logically combined so that aggregates are computed based on the primary key of the table that is joined in.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "ecommerce/ecommerce.malloy"}
query: order_items->{
  aggregate: [
    symmetric_avg is users.age.avg()
    asymmetric_avg is avg(users.age)
  ]
}
```


In SQL, when computing an aggregate such as a sum or an average, it is important
to do so against the base table in the <code>FROM</code> statement,
rather than against a combination table resulting from a join. Failing to do
so


In SQL, when you compute a sum or an average, you have to be computing it against the base table in the FROM statement.

`orders` -- only `orders.sum()` or or `avg(orders.whatever)`. If you try to compute an aggregate in something else, it's going to be wrong.

This makes it really easy to make mistakes. You can write a query, then add a join, and suddenly your query no longer works.

Simple example:

```sql
SELECT AVG(age) FROM users
```

44.3964

Add a JOIN

```sql
SELECT AVG(age) FROM users
JOIN orders on orders.user_id = users.id
```

45.4151

```sql
SELECT
  users.id AS user_id
  , users.age AS age
  -- , orders.id AS order_id
FROM users
-- LEFT JOIN orders ON orders.user_id = users.id
ORDER BY users.id
LIMIT 10
```

```sql
SELECT
  users.id AS user_id
  , users.age AS age
  , orders.id AS order_id
FROM users
LEFT JOIN orders ON orders.user_id = users.id
ORDER BY users.id
LIMIT 10
```

When orders is joined in, SQL makes a new table that is the combination table of users and orders, so each user is repeated by the number of times they made an order. Therefore, the average age is weighted by their number of orders.

In SQL, first you do the relations to build a joined table, then you do the aggregations. In Looker, the two steps are logically combined, so we aggregate as we join. The aggregates are computed based on the primary key of the table that you're joining into.

This radically simplifies the way that you write queries. -->
