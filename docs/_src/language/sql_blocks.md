# SQL Blocks

Sometimes it is useful to add SQL statements into a Malloy file. You can do so by using the `sql:` keyword in combination with SQL literals, which are enclosed between an
opening `||` and a closing `;;`.


```malloy
--! {"isRunnable": true, "showAs":"html", "runMode": "auto", "size": "large", "sqlBlockName": "my_sql_query" }
sql: my_sql_query is ||
  SELECT
    first_name,
    last_name,
    gender
  FROM malloy-data.ecomm.users
  LIMIT 10
;; on "bigquery"
```

## Sources from SQL Blocks

Sources can be created from a SQL block, e.g.

```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "size": "large" }
sql: my_sql_query is ||
  SELECT
    first_name,
    last_name,
    gender
  FROM malloy-data.ecomm.users
  LIMIT 10
;; on "bigquery"

source: limited_users is from_sql(my_sql_query) {
  measure: user_count is count()
}

query: limited_users -> {
  aggregate: user_count
}
```