# SQL Blocks

Sometimes it is useful to add SQL statements into a Malloy file. You can do so by using the `sql:` keyword in combination with SQL literals, which are enclosed between an
opening `||` and a closing `;;`.


```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto", "size": "large", "sqlBlockName": "my_sql_query" }
sql: my_sql_query is ||
  SELECT * FROM malloy-data.ecomm.users
  LIMIT 10
;;
```
