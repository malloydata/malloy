# What is an "Aggregating Subquery?"

Aggregating Subqueries are queries nested in other queries. A nested query produces a subtable per row in the query in which it is embedded. In Malloy, queries can be named and referenced in other queries. The technical term of "Aggregating Subquery" is a bit of a mouthful, so we more often refer to it as "nesting a query," or a "nested subtable."

An Aggregating Subquery utilizes a Named Query, which might look like this when defined in the model, or within a query:

```malloy
  airports_by_facility is (reduce
    fac_type
    airport_count
    )
```

When a Named Query is nested inside of another query, this forms a nested subtable.

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

This named query can additionally be used to build out other computations, for example:

```malloy
  airports_in_ca is airports_by_facility [ state : 'CA' ]
```

## Nesting Nested Queries
Aggregating subqueries can be nested infinitely

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

## Filter
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