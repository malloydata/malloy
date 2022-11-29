# SQL Blocks

Sometimes it is useful to add SQL statements into a Malloy file. You can do so by using the `sql:` keyword.
An SQL statement has two properties.

* `select:` -- Has a string value which is bracketed with triple quotes `"""`
* `connection:` -- A string value which is the name of the connection
   _(if not specified the default connection will be used)_


```malloy
--! {"isRunnable": true, "showAs":"html", "runMode": "auto", "size": "large", "sqlBlockName": "my_sql_query" }
sql: my_sql_query is {
  select: """
    SELECT
      first_name,
      last_name,
      gender
    FROM malloy-data.ecomm.users
    LIMIT 10
  """
}
```

## Sources from SQL Blocks

Sources can be created from a SQL block, e.g.

```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "size": "large" }
sql: my_sql_query is {
  select: """
    SELECT
      first_name,
      last_name,
      gender
    FROM malloy-data.ecomm.users
    LIMIT 10
  """
}

source: limited_users is from_sql(my_sql_query) {
  measure: user_count is count()
}

query: limited_users -> {
  aggregate: user_count
}
```
