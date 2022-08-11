# Ungrouping Aggregate Sub-expressions

In a query which is grouped my multiple dimensions, it is often useful to be
able to perform an aggregate calculation on sub-groups.

### **all(aggregateExpression)**

This will perform the aggregate computation ignoring the grouping in the
current_query.

```
...
   aggregate: pct_of_all is count() / all(count())*100.0
```

### **all(aggregateExpression, groupingDimension, ...)**

This will retain grouping by the named dimensions, but still group by the un-named dimensions.

```
...
  group_by: name, state
  aggregate: count_in_state is all(count(), state)
```

Grouping imensions named in `all()` must be names selected as grouping dimensions in the current query.

### **exclude(aggregateExpression, groupingDimension)**

Similar to `al()` this allows you to control which grouping dimensions are
used to compute `aggregateExpression`. In this case, this list is dimenions
which should NOT be used, for example the previous code fragment could
also have ben written ...

```
...
  group_by: name, state
  aggregate: count_in_state is exclude(count(), name)
```

The main difference is that in a nested query, it is legal to name a grouping dimension from a outer query which contains the inner query.
