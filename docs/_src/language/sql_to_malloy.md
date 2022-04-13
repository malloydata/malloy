## How Malloy Generates SQL
Basic structure of a Malloy Query:

```malloy
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

```sql
SELECT
   <group_by>, <group_by>, …
   <aggregate>, <aggregate>, …
   <nest>, <nest>, …  		       -- very much a simplification; read more in Nesting Queries doc.
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
This document is intended to serve as a reference for those who already know SQL and may find it helpful to map Malloy concepts and syntax to SQL.

### Components of a Query

| SQL | Malloy | Description / Docs |
|---|---|---|
| <pre><code>userName AS user_name</code><code>malloy-data.ecomm.users AS users</code></pre>  | <pre> `user_name is userName  ` `users is malloy-data.ecomm.users `</pre> | **AS**: Aliasing: names come first in Malloy. This gesture is different so we think a different keywords is appropriate: `is` vs <code>AS</code>.  |
| <pre><code>SELECT id FROM order_items</code></pre>   | <pre> `query: order_items -> {project: id}`</pre> | **SELECT / FROM**: [Malloy by Example](https://looker-open-source.github.io/malloy/documentation/index.html) |
| <pre><code>LEFT JOIN users</code><code> ON users.id = order_items.user_id </pre></code> | <pre> `join_one: users on users.id = order_items.user_id`</pre> | **JOIN** [Join Documentation](https://looker-open-source.github.io/malloy/documentation/language/join.html) - example is the simplest case of a foreign key join; documentation covers more join types and relationships. [Example](https://looker-open-source.github.io/malloy/documentation/language/sql_to_malloy.html#more-complex-example) |
| <pre><code> SELECT </code> <code>  status</code> <code>  , COUNT(*) AS items_count</code> <code>FROM order_items </code> <code>GROUP BY 1</code> </code></pre>  | <pre> `query: order_items -> {` `  group_by: status` `  aggregate: items_count is count()` `}`</pre> | **GROUP BY**: Any field included in Malloy’s group_by selection will be included in both the generated <code>SELECT</code> and <code>GROUP BY</code>. |
| <pre><code>WHERE status = 'Complete'</code></pre>  | <pre> `where: status = 'Complete'`</pre> | **WHERE** |
| <pre><code>ORDER BY flight_count, avg_elevation</code></pre>  | <pre> `order_by: flight_count, avg(elevation)`</pre> | **ORDER BY**. By default, <code>ORDER BY</code> is generated following [implicit rules](https://looker-open-source.github.io/malloy/documentation/language/order_by.html); this can be overridden.  |
| <pre><code>HAVING flight_count > 5</code></pre>  | <pre> `having: flight_count > 5`</pre> | **HAVING** |
| <pre> <code>LIMIT 100</code> <code>TOP 100</code> </pre>  | <pre> `limit: 100` `top: 100`</pre> | **LIMIT / TOP**: Both are accepted.  |
| <pre><code> SELECT ... FROM (   SELECT     ...   FROM order_items ) </code></pre>  | <pre> `order_items -> {...} -> {...}`</pre> | **Pipelines** allow the output of one query to be used as the input to the next.  |
| <pre><code> WITH user_facts AS (...) … </code></pre>  | <pre> `sql: user_facts is \|\| ... ;;` --OR-- `source: user_facts is from(...)` </pre> | **Subqueries** can be achieved through [Pipelines](https://looker-open-source.github.io/malloy/documentation/language/basic.html#pipelines-and-multi-stage-queries), [Sources from queries](https://looker-open-source.github.io/malloy/documentation/language/source.html#sources-from-queries), and/or [SQL Blocks](https://looker-open-source.github.io/malloy/documentation/language/sql_blocks.html). [Example](https://looker-open-source.github.io/malloy/documentation/language/sql_to_malloy.html#subqueries-ctes-)  |


### Expressions
Many SQL functions supported by the database can simply be used unchanged in Malloy. In certain cases we have implemented what we feel are improvements and simplifications of certain SQL functions. This is intended to serve as a quick reference, more complete documentation can be found [here](https://looker-open-source.github.io/malloy/documentation/language/expressions.html).

| SQL | Malloy | Description / Docs |
|---|---|---|
| <pre><code>SUM(), AVG(), MAX(), MIN(), COUNT(), etc </code></prE> | <pre> `sum(), avg(), max(), min(), count(), etc...` </pre> | Basic SQL aggregations are supported verbatim, but it’s worth learning about Malloy’s additional [aggregate locality](https://looker-open-source.github.io/malloy/documentation/language/aggregates.html#aggregate-locality) / [symmetric aggregate](https://help.looker.com/hc/en-us/articles/360023722974-A-Simple-Explanation-of-Symmetric-Aggregates-or-Why-On-Earth-Does-My-SQL-Look-Like-That-) handling. |
| <pre> <code>CASE</code> <code>  WHEN size_n < 3 THEN 'S'</code> <code>  WHEN size_n <5 THEN 'M'</code> <code>ELSE 'L' END</code> </pre> | <pre> `size_n:` `  pick 'S' when < 3` `  pick 'M' when <5` `  else 'L' ` </pre> | Pick is Malloy’s improvement of SQL’s <code>CASE</code> statement. [Doc](https://looker-open-source.github.io/malloy/documentation/language/expressions.html#pick-expressions). [Example](https://looker-open-source.github.io/malloy/documentation/language/sql_to_malloy.html#more-complex-example)  |
| <pre> <code>COUNT(CASE WHEN status = 'Returned' THEN 1 END),</code> <code>AVG(CASE WHEN brand = 'Levi\'s' THEN price END)</code> </pre> | <pre> `count() {where: status = 'Returned'}` `avg_price {where: brand = 'Levi\'s'}` </pre> | Aggregates may be filtered using filter expressions. [Doc](https://looker-open-source.github.io/malloy/documentation/language/expressions.html#filtered-expressions) |
| <pre> <code>CAST(distance AS string),</code> <code>distance::string</code> </pre> | <pre>`distance::string`</pre> | [Safe Type Cast](https://looker-open-source.github.io/malloy/documentation/language/expressions.html#safe-type-cast). Also worth reviewing [Types](https://looker-open-source.github.io/malloy/documentation/language/types.html) doc. |


#### Working with Time
The [Time Expressions](https://looker-open-source.github.io/malloy/documentation/language/expressions.html#time-expressions) reference contains substantially more detail and examples.


| SQL | Malloy | Docs |
|---|---|---|
| <pre> <code>TIMESTAMP_TRUNC(created_at, WEEK),</code> <code>DATE_TRUNC(order_items.shipped_at, MONTH)</code> </pre> | <pre> `created_at.week` `shipped_at.month` </pre> | [Truncation](https://looker-open-source.github.io/malloy/documentation/language/expressions.html#time-truncation) |
| <pre> <code>EXTRACT(DAYOFWEEK FROM shipped_at),</code> <code>EXTRACT(HOUR FROM created_at)</code> | <pre> `day_of_week(shipped_at)` `hour(created_at)` </pre> | [Extraction](https://looker-open-source.github.io/malloy/documentation/language/expressions.html#time-extraction) |
| <pre> <code>DATE_DIFF(DATE(CURRENT_TIMESTAMP()),DATE(created_at), DAY),</code> <code>TIMESTAMP_DIFF(TIMESTAMP(shipped_at), created_at, HOUR)</code></pre> | <pre> `days(created_at to now)` `hours(created_at to shipped_at)` </pre> | [Intervals](https://looker-open-source.github.io/malloy/documentation/language/expressions.html#time-intervals) |
| <pre><code>created_at >= TIMESTAMP('2003-01-01', 'UTC') AND created_at < TIMESTAMP('2004-01-01', 'UTC') </code></pre> <pre><code>created_at >= TIMESTAMP(DATETIME_SUB(DATETIME(CURRENT_TIMESTAMP()),INTERVAL 1 YEAR)) AND created_at < TIMESTAMP(DATETIME_ADD(DATETIME(TIMESTAMP(DATETIME_SUB(DATETIME( CURRENT_TIMESTAMP()),INTERVAL 1 YEAR))),INTERVAL 1 YEAR)) </code></pre> <pre><code>(EXTRACT(DAYOFWEEK FROM created_at)) NOT IN (1,7) </code></pre> | <pre> `created_at = @2003` </pre> <pre> `created_at = now - 1 year for 1 year` </pre> <pre>`day_of_week(created) != 1 & 7`</pre> | [Filter Expressions](https://looker-open-source.github.io/malloy/documentation/language/expressions.html#time-expressions) |



### Not Supported and/or Coming Soon

Feature requests are tracked using [Issues on Github](https://github.com/looker-open-source/malloy/issues).

| SQL | Notes |  |
|---|---|---|
| <pre><code>FIRST_VALUE(product_brand) OVER (PARTITION BY user_id ORDER BY created_at ASC) </code></pre> | **Window Functions**: For now, reach out for advice on achieving what you need (much is possible with nesting, pipelines, or [SQL Blocks](https://looker-open-source.github.io/malloy/documentation/language/sql_blocks.html)). [Example](https://looker-open-source.github.io/malloy/documentation/language/sql_to_malloy.html#subqueries-ctes-). |  |
| _NA_ | Querying arrays as nested objects |  |
| <pre> <code>SELECT</code> <code> id</code> <code>  , ( SELECT COUNT(*)</code> <code>    FROM orders o</code> <code>    WHERE o.id <= orders.id</code> <code>    AND o.user_id = orders.user_id</code> <code>  ) as sequence_number</code> <code>FROM orders …</code> | **Correlated Subqueries**: coming soon; note that functionality will be dependent on the database dialect. |  |


### Full Query Examples

Many of the above concepts are best understood in the context of complete queries.

#### The Basics
We’ll start with a relatively simple SQL query:
```SQL
SELECT
  TIMESTAMP_TRUNC(created_at, DAY) as order_date,
  SUM(sale_price) as total_sale_price,
  COUNT(DISTINCT order_id) as order_count
FROM `malloy-data.ecomm.order_items`
WHERE created_at>=TIMESTAMP('2021-01-01', 'UTC')
  AND created_at<TIMESTAMP('2021-04-01', 'UTC')
  AND status NOT IN ('Returned','Cancelled')
GROUP BY 1
ORDER BY 1 ASC
```

In Malloy, this is expressed:
```malloy
query: table('malloy-data.ecomm.order_items') -> {
 where: created_at = @2021-Q1, status != 'Cancelled' & 'Returned'
 group_by: order_date is created_at.day
 aggregate:
   total_sale_price is sale_price.sum()            -- names come before definitions
   order_count is count(distinct order_id)
 order_by: order_date asc
}
```

#### More Complex Example
```SQL
SELECT
 CASE
   WHEN (100.0*(ii.product_retail_price-ii.cost)) / (NULLIF(ii.product_retail_price,0)) >=55 THEN 'High (over 55%)'
   WHEN (100.0*(ii.product_retail_price-ii.cost)) / (NULLIF(ii.product_retail_price,0))>=45 THEN 'Medium (45% to 55%)'
   ELSE 'Low (up to 45%)' END AS gross_margin_pct_tier,
 SUM(ii.product_retail_price) AS total_retail_price,
 AVG((ii.product_retail_price-ii.cost)) AS avg_gross_margin
FROM `malloy-data.ecomm.inventory_items` AS ii
LEFT JOIN `malloy-data.ecomm.order_items` AS oi
 ON ii.id=oi.inventory_item_id
LEFT JOIN `malloy-data.ecomm.users` AS u
 ON oi.user_id = u.id
WHERE
 oi.status NOT IN ('Returned','Cancelled')
 AND (u.country='USA')
GROUP BY 1
ORDER BY 3 ASC
```

In Malloy, this can be expressed in a query:
```malloy
query: inventory_items is table('malloy-data.ecomm.inventory_items'){
  join_one: order_items is table('malloy-data.ecomm.order_items') on id = order_items.inventory_item_id
  join_one: users is table('malloy-data.ecomm.users') on order_items.user_id = users.id
} -> {
declare:					–- declare reusable metrics for use in query
  gross_margin is (product_retail_price - cost)
  gross_margin_pct is 100.0 * gross_margin / nullif(product_retail_price,0)
group_by:
  gross_margin_pct_tier is gross_margin_pct:
    pick 'High (over 55%)' when >=55
    pick 'Medium (45% to 55%)' when >=45
    else 'Low (up to 45%)'
aggregate:
  total_retail_price is product_retail_price.sum()
  avg_gross_margin is gross_margin.avg()
where:
  order_items.status != 'Cancelled' & 'Returned',
  users.country = 'USA'
order_by: avg_gross_margin asc
}
```


Note that if we intend to query these tables and re-use these field definitions frequently, thinking about placing reusable definitions into the model will begin to save us a lot of time in the future.

```malloy
source: users is table('malloy-data.ecomm.users')
source: order_items is table('malloy-data.ecomm.order_items'){
 join_one: users on user_id = users.id
 dimension: valid_order is status != 'Cancelled' & 'Returned'
}
source: inventory_items is table('malloy-data.ecomm.inventory_items'){
 join_one: order_items on id = order_items.inventory_item_id
 dimension:
   gross_margin is (product_retail_price - cost)
   gross_margin_pct is 100.0* gross_margin / nullif(product_retail_price,0)
   gross_margin_pct_tier is gross_margin_pct:
     pick 'High (over 55%)' when >=55
     pick 'Medium (45% to 55%)' when >=45
     else 'Low (up to 45%)'
 measure:
   total_retail_price is product_retail_price.sum()
   avg_gross_margin is gross_margin.avg()
}

query: inventory_items -> {
 group_by: gross_margin_pct_tier
 aggregate:
   total_retail_price
   avg_gross_margin
 where: order_items.valid_order, order_items.users.country = 'USA'
 order_by: avg_gross_margin asc
}
```
#### Subqueries / CTEs:
How much of our sales come from repeat customers vs loyal, repeat customers? Written in SQL:

```SQL
WITH user_facts AS (
 SELECT
   user_id as user_id,
   COUNT( 1) as lifetime_orders
 FROM `malloy-data.ecomm.order_items`
 GROUP BY 1
 ORDER BY 2 desc
)
SELECT
  CASE WHEN user_facts.lifetime_orders=1 THEN 'One-Time' ELSE 'Repeat' END AS customer_category,
  SUM(order_items.sale_price) AS total_sale_price,
  COUNT(DISTINCT order_items.order_id) AS order_count
FROM `malloy-data.ecomm.order_items` AS order_items
LEFT JOIN user_facts
 ON order_items.user_id = user_facts.user_id
GROUP BY 1
ORDER BY 2 desc
```

In Malloy, the user_facts CTE becomes a source of its own, defined from a query using `from()`. Any aggregates in this query (for now, just lifetime_orders) become dimensions of that source.
```malloy
source: user_facts is from(
  table('malloy-data.ecomm.order_items') -> {
    group_by: user_id
    aggregate: lifetime_orders is count()
  }
)
source: order_items is table('malloy-data.ecomm.order_items'){
  join_one: user_facts on user_id = user_facts.user_id
}

query: order_items -> {
  group_by: customer_category is lifetime_orders:
    pick 'One-Time' when = 1
    else 'Repeat'
  aggregate:
    total_sale_price is sale_price.sum()
    order_count is count(distinct order_id)
}
```

One can also define a [SQL block](https://looker-open-source.github.io/malloy/documentation/language/sql_blocks.html) to be used as a source in Malloy.

```malloy
sql: order_facts is ||
 SELECT
   order_id
   , user_id
   , ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY created_at) as user_order_sequence_number
 FROM malloy-data.ecomm.order_items
;;

sql: order_items_sql is ||
 SELECT
   id
   , order_id
   , created_at
 FROM malloy-data.ecomm.order_items
 WHERE status NOT IN ('Cancelled', 'Returned')
;;

source: order_items is from_sql(order_items_sql){
 join_one: order_facts is from_sql(order_facts) on order_id = order_facts.order_id
 measure: order_count is count(distinct order_id)
}

query: order_items -> {
 group_by: order_facts.user_order_sequence_number
 aggregate: order_count
}
```