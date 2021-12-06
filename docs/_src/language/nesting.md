# Nested Queries

Nested queries, more formally known as "aggregating subqueries" are queries included in other queries. A nested query produces a subtable per row in the query in which it is embedded. In Malloy, queries can be named and referenced in other queries. The technical term "aggregating subquery" is a bit of a mouthful, so we more often refer to it as a "nested query."

When a named query is nested inside of another query, it produces an aggregating subquery and the results include a nested subtable.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy"}
explore airports | reduce
  state
  airport_count
  by_facility is (reduce
    fac_type
    airport_count
  )
```

## Nesting Nested Queries

Aggregating subqueries can be nested infinitely, meaning that a nested query can contain another nested query.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy", "size": "large"}
explore airports
| reduce
  state
  airport_count
  top_5_counties is (reduce top 5
    county
    airport_count
    by_facility is (reduce
      fac_type
      airport_count
    )
  )
```

## Filtering Nested Queries

Filters can be applied at any level within nested queries.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy", "size": "large"}
explore airports
| reduce : [state : 'CA'|'NY'|'MN']
  state
  airport_count
  top_5_counties is (reduce top 5
    county
    airport_count
    major_facilities is (reduce : [major:'Y']
      name is concat(code, ' - ', full_name)
    )
    by_facility is (reduce
      fac_type
      airport_count
    )
  )
```