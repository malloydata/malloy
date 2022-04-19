## How Malloy Generates SQL
Basic structure of a Malloy Query:

```
query: <source> {
  join_one: <source> with …
  join_many: <source> on …
} -> {
   group_by:
    <field/dimension>
    <field/dimension>
   aggregate:
    <aggregation/measure>
    <aggregation/measure>
   nest:
    <named_query OR query_def>
    <named_query OR query_def>
   where: <filter_expression>, <filter_expression>, …
   having: <aggregate_filter_expression>, <aggregate_filter_expression>
   order_by: <field/dimension>, <aggregation/measure>, …
   limit: <limit>
}
```

This maps to the below SQL query structure:

```
SELECT
   <group_by>, <group_by>, …
   <aggregate>, <aggregate>, …
   <nest>, <nest>, …  			-- very much a simplification
FROM <source>
LEFT JOIN <source> ON …
LEFT JOIN <source> ON …
WHERE (<filter_expression>) AND (<filter_expression>) AND …
GROUP BY <group_by>, <group_by>, …
HAVING <aggregate_filter_expression> AND <aggregate_filter_expression> AND …
ORDER BY <group_by> | <aggregate>
LIMIT <limit>
```

## SQL to Malloy
### Components of a Query

| SQL                                                                   | Malloy                                                         | Notes                                                                                                                                   |
|-----------------------------------------------------------------------|----------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| <code> userName AS user_name malloy-data.ecomm.users AS users </code> | ``` user_name is userName users is malloy-data.ecomm.users ``` | **AS**: Aliasing: names come first in Malloy. This gesture is different so we think a different keywords is appropriate: `is` vs `AS`.  |
| <code>SELECT id FROM order_items</code>                               | `query: order_items -> {project: id}`                          | **SELECT / FROM**: [Malloy by Example](https://looker-open-source.github.io/malloy/documentation/index.html)                            |
|                                                                       |                                                                |                                                                                                                                         |