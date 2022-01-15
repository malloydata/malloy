# Percent of Total
In order to compute a percentage of total, you essentially have to run two queries, one for
the total and one where you wish to apply the calculation.  In Malloy, you can run these queries at
at the same time and combine them.

Let's suppose we wanted to look at our flight data by carrier and compute the percentage of all
flight performed by a particular carrier.

## Query for all flights ever made
```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "source": "faa/flights.malloy", "isPaginationEnabled": true, "pageSize":100, "size":"small"}
query: flights->{aggregate: flight_count}
```

## Query for Flights By Carrier
```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "source": "faa/flights.malloy", "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
query: flights->{
  group_by: carriers.nickname
  aggregate: flight_count
}
```

## In Malloy, can make both caculations at once with [*nested subtables*](nesting.md).
The results are returned as a single row in a table with two columns, `flight_count` and `main_query`.
```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "source": "faa/flights.malloy", "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
query: flights->{
  aggregate: flight_count
  nest: main_query is {
    group_by: carriers.nickname
    aggregate: flight_count
  }
}
```

## Use *project* to flatten the table and cross join
Using a pipeline with a `project` calculation to combine (essentially cross joining) the queries back into a single table.
We also add an additional column, the percentage of total calculation.
```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "source": "faa/flights.malloy", "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
query: flights->{
  aggregate: flight_count
  nest: main_query is {
    group_by: carriers.nickname
    aggregate: flight_count
  }
}->{
  project: [
    main_query.nickname
    main_query.flight_count
    flight_count_as_a_percent_of_total is main_query.flight_count/flight_count * 100.0
  ]
}

```

## Using a *wildcard* against the Nested Query
We can use a wildcard against the nested query to to make this pattern easier to write.
```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "source": "faa/flights.malloy", "isPaginationEnabled": true, "pageSize":100, "size":"medium"}
query: flights->{
  aggregate: flight_count
  nest: main_query is {
    group_by: carriers.nickname
    aggregate: flight_count
  }
}->{
  project: [
    main_query.*
    flight_count_as_a_percent_of_total is main_query.flight_count/flight_count * 100.0
  ]
}
```
