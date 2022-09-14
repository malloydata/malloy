# Ungrouped Aggregates

In a query which is grouped by multiple dimensions, it is often useful to be able to perform an aggregate calculation on sub-groups.

### **all(aggregateExpression)**

The `all()` function will perform the specified aggregate computation, ignoring the grouping in the
current_query to provide an overall value.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy"}
query: airports -> {
  group_by: faa_region
  aggregate: percent_of_total is count() / all(count())*100.0
}
```

### **all(aggregateExpression, groupingDimension, ...)**

When the optional grouping dimension argument is provided, `all()` will preserve grouping by the named dimensions (`faa_region`), but will not group by un-named dimensions (`state`).

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy"}
query: airports -> {
  group_by: faa_region, state
  aggregate:
    airports_in_state is count()
    airports_in_region is all(count(), faa_region)
  order_by: airports_in_state desc
}
```

Dimensions named in `all()` must be included in a `group_by` in the current query.

### **exclude(aggregateExpression, groupingDimension)**

Similar to `al()`,  `exclude()` allows you to control which grouping dimensions are
used to compute `aggregateExpression`. In this case, dimensions which should NOT be used are listed. For example, these two aggregates will do the exact same thing:

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "faa/airports.malloy"}
query: airports -> {
  group_by: faa_region, fac_type
  aggregate:
    count_airports is count()
    count_in_region_exclude is exclude(count(), fac_type)
    count_in_region_all is all(count(), faa_region)
}
```

The main difference is that in a nested query, it is legal to name a grouping dimension from an outer query which contains the inner query.
