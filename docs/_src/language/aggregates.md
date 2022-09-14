# Aggregates

Malloy supports the standard aggregate functions `count`, `sum`, `avg`, `min`, and `max`. When these are used in a field's definition, they make that field a [measure](fields.md#measures).

## Basic Syntax

### Counts

The `count` aggregate function may be used to count the number of records appearing in a source.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: flights -> {
  aggregate: flight_count is count()
}
```

### Distinct Counts

Distinct counts may be used to count the number of distinct values of a particular field within a source.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "ecommerce/ecommerce.malloy"}
query: order_items -> {
  aggregate: order_count is count(distinct order_id)
}
```

### Sums

The `sum` function may be used to compute the sum of all records of a particular field.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: flights -> {
  aggregate: total_distance is sum(distance)
}
```

### Averages

The `avg` function may be used to compute the average of all records of a particular field.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft -> {
  aggregate: average_seats is avg(aircraft_models.seats)
}
```

### Minima

The `min` function may be used to compute the minimum of all records of a particular field.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "ecommerce/ecommerce.malloy"}
query: order_items -> {
  aggregate: cheapest_price is min(sale_price)
}
```

### Maxima

The `max` function may be used to compute the maximum of all records of a particular field.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: flights -> {
  aggregate: longest_distance is max(distance)
}
```

## Ungrouped Aggregates

In a query which is grouped by multiple dimensions, it is often useful to be able to perform an aggregate calculation on sub-groups to determine subtotals. The `all()` and `exclude` functions in Malloy allow control over grouping and ungrouping, making this simple:

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy"}
query: airports -> {
  group_by: state, faa_region
  aggregate:
    count_airports is count()
    overall_airports is all(count())
    percent_of_total is count() / all(count())*100.0
    airports_in_region is all(count(), faa_region)
    percent_in_region is count() / all(count(), faa_region)*100.0
}
```

Read more about Ungrouped Aggregates [here](ungrouped-aggregates.md).

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
query: aircraft -> {
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
query: aircraft_models -> {
  aggregate: average_seats is avg(seats)
}
```

However, this isn't actually the number you were interested in, because this measures the average number of seats across _all_ aircraft models, not just the ones with actively-registered aircraft.

Unfortunately, SQL doesn't have any native constructs to compute this value, and in practice analysts often resort to complicated [fact tables](https://www.zentut.com/data-warehouse/fact-table/) to perform this kind of query.

### The Solution

Malloy introduces the concept of _aggregate locality_, meaning that aggregates can be computed with respect to different points in the data graph. In the following query, `average_seats` is computed with respect to `aircraft_models`,
yielding the the average number of seats on aircraft models of aircraft listed in the `aircraft` table.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft -> {
  aggregate: average_seats is aircraft_models.avg(aircraft_models.seats)
}
```

For convenience, `aircraft_models.avg(aircraft_models.seats)` can be written as `aircraft_models.seats.avg()`.

### Examples

The following queries show six ways of calculating the average number of seats.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: flights -> {
  aggregate:
    aircraft_models_avg_seats is aircraft.aircraft_models.seats.avg()
    aircraft_avg_models_seats is aircraft.avg(aircraft.aircraft_models.seats)
    avg_aircraft_models_seats is avg(aircraft.aircraft_models.seats)
}
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft -> {
  aggregate:
    models_avg_seats is aircraft_models.seats.avg()
    avg_models_seats is avg(aircraft_models.seats)
}
```

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft_models -> {
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

The aggregate functions that support locality are `count`, `sum`, and `avg`.

The `min` and `max` aggregates do not support aggregate locality because the minimum and maximum values are the same regardless of where they are computed. Local aggregation removes duplicate values (those corresponding to the same row in the aggregate source location), and minimum and maximum values do not change if values are repeated more than once.

### Aggregates on Fields

Aggregating "on a field," e.g. `aircraft_models.seats.avg()` is exactly equivalent to aggregating that field with respect to its direct parent source, e.g. `aircraft_models.avg(aircraft_models.seats)`. This syntax is supported for the aggregate functions which benefit from aggregate locality and require a field, `avg` and `sum`.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy"}
query: aircraft -> {
  aggregate:
    avg_on_source is aircraft_models.avg(aircraft_models.seats)
    avg_on_field is aircraft_models.seats.avg()
}
```
