# Pivot Limits

Or really, limiting results based on secondary queries.

Let's suppose we wanted to look flight data but only at only the top 5 carriers and only the top 5 destinations.

## Carriers by destination produces 1958 rows
```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "isPaginationEnabled": true, "pageSize":100, "size":"small"}
query: flights->{
  group_by: [
    carriers.nickname
    destination_code
  ]
  aggregate: flight_count
}
```

## Query for the top 5 carriers
Query to find the most interesting carriers.
```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "isPaginationEnabled": true, "pageSize":100, "size":"small"}
query: flights->{
  top: 5
  group_by: carriers.nickname
  aggregate: flight_count
}
```

## Top 5 Destinstinations
```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "isPaginationEnabled": true, "pageSize":100, "size":"small"}
query: flights->{
  top: 5
  group_by: destination_code
  aggregate: flight_count
}
```

## Run all three queries together as Aggregating Subqueries.
Produces a table with a single row and three columns.  Each column essentially contains a table
```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "isPaginationEnabled": true, "pageSize":100, "size":"small"}
query: flights->{
  nest: main_query is {
    group_by: [
      carriers.nickname
      destination_code
    ]
    aggregate: flight_count
  }
  nest: top_carriers is {
    top: 5
    group_by: carriers.nickname
    aggregate: flight_count
  }
  nest: top_destinations is {
    top:5
    group_by: destination_code
    aggregate: flight_count
  }
}
```

## Project the main query and use the *top* nested queries to limit the results
Project produces a cross join of the tables.  The filter essentially does an inner join, limiting the main queries results to
dimensional values that are produce in the filtering queries.
```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "isPaginationEnabled": true, "pageSize":100, "size":"small"}
query: flights->{
  nest: main_query is {
    group_by: [
      carriers.nickname
      destination_code
    ]
    aggregate: flight_count
  }
  nest: top_carriers is {
    top: 5
    group_by: carriers.nickname
    aggregate: flight_count
  }
  nest: top_destinations is {
    top:5
    group_by: destination_code
    aggregate: flight_count
  }
}->{
  where:
    main_query.nickname = top_carriers.nickname and
    main_query.destination_code = top_destinations.destination_code
  project: main_query.*
}
```

## Render the results as a pivot table
```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/flights.malloy", "isPaginationEnabled": true, "pageSize":100, "size":"small"}
query: flights->{
  nest: main_query is {
    group_by: [
      carriers.nickname
      destination_code
    ]
    aggregate: flight_count
  }
  nest: top_carriers is {
    top: 5
    group_by: carriers.nickname
    aggregate: flight_count
  }
  nest: top_destinations is {
    top:5
    group_by: destination_code
    aggregate: flight_count
  }
}->{
  where:
    main_query.nickname = top_carriers.nickname and
    main_query.destination_code = top_destinations.destination_code
  group_by: main_query.nickname
  nest: destination_pivot is {
    project: [
      main_query.destination_code
      main_query.flight_count
    ]
  }
}
```