# Nested Queries

Nested queries, more formally known as "aggregating subqueries" are queries included in other queries. A nested query produces a subtable per row in the query in which it is embedded. In Malloy, queries can be named and referenced in other queries. The technical term "aggregating subquery" is a bit of a mouthful, so we more often refer to it as a "nested query."

When a named query is nested inside of another query, it produces an aggregating subquery and the results include a nested subtable.

```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "source": "faa/airports.malloy"}
query: airports->{
  group_by: state
  aggregate: airport_count
  nest: by_facility is {
    group_by: fac_type
    aggregate: airport_count
  }
}
```

## Nesting Nested Queries

Aggregating subqueries can be nested infinitely, meaning that a nested query can contain another nested query.

```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "source": "faa/airports.malloy", "size": "large"}
query: airports->{
  group_by: state
  aggregate: airport_count
  nest: top_5_counties is {
    top: 5
    group_by: county
    aggregate: airport_count
    nest: by_facility is {
      group_by: fac_type
      aggregate: airport_count
    }
  }
}
```

## Filtering Nested Queries

Filters can be applied at any level within nested queries.

```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "source": "faa/airports.malloy", "size": "large"}
query: airports->{
  where: state: 'CA'|'NY'|'MN'
  group_by: state
  aggregate: airport_count
  nest: top_5_counties is {
    top: 5
    group_by: county
    aggregate: airport_count
    nest: major_facilities is {
      where: major:'Y'
      group_by: name is concat(code, ' - ', full_name)
    }
    nest: by_facility is {
      group_by: fac_type
      aggregate: airport_count
    }
  }
}
```