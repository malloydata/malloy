# Ungrouping Aggregate Sub-expressions

In a query which is grouped by multiple dimensions, it is often useful to be
able to perform an aggregate calculation on sub-groups.

### **all(aggregateExpression)**

This will perform the aggregate computation ignoring the grouping in the
current_query.

```
  group_by: name
  aggregate: percent_of_total is count() / all(count())*100.0
```

### **all(aggregateExpression, groupingDimension, ...)**

This will retain grouping by any named dimensions (`state`), but will not group by un-named dimensions (`name`).

```
  group_by: name, state
  aggregate: count_in_state is all(count(), state)
```

Dimensions named in `all()` must be included in a `group_by` in the current query.

### **exclude(aggregateExpression, groupingDimension)**

Similar to `al()`,  `exclude()` allows you to control which grouping dimensions are
used to compute `aggregateExpression`. In this case, dimensions which should NOT be used are listed, for example these two aggregates will do the exact same thing:

```
  group_by: name, state
  aggregate: count_in_state_with_exclude is exclude(count(), name)
  aggregate: count_in_state_with_all is all(count(), state)
```

The main difference is that in a nested query, it is legal to name a grouping dimension from an outer query which contains the inner query.
