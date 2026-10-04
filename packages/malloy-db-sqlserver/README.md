<!--
 Copyright Contributors to the Malloy project
 SPDX-License-Identifier: MIT
-->

# Malloy

Malloy is a modern open source language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database.

## This package

This package connects the `malloydata/malloy` library to Microsoft SQL Server 2017 and later, and to Azure SQL Database. The dialect is experimental: a model that uses it needs `##! experimental.dialect.sqlserver`, and the section below says what it does not do yet.

## Connecting

The five fields most connections need, in `malloy-config.json`:

```json
{
  "connections": {
    "warehouse": {
      "is": "sqlserver",
      "server": "db.example.com",
      "port": 1433,
      "database": "sales",
      "user": "malloy",
      "password": {"env": "MSSQL_PASSWORD"}
    }
  }
}
```

`server` also accepts the `host,port` form SQL Server Management Studio writes. `authentication` chooses the credential kind: `sql` (default), `azure-default`, `azure-service-principal`, `azure-msi`, `azure-access-token` or `ntlm`; the `azure-*` kinds are Microsoft Entra ID through the driver. A `connectionString` may replace the structured fields, never accompany them. Named instances (`instanceName`), availability groups (`readOnlyIntent`, `multiSubnetFailover`) and a certificate issued to another name (`hostNameInCertificate`) are advanced fields.

The connection is encrypted by default. `trustServerCertificate` accepts a certificate the client cannot verify, such as a local container's; leave it off for a server you do not control. A query may run for `requestTimeoutMs` (ten minutes unless set) on one of `poolMax` pooled connections (four); cancelling it goes through the driver. Kerberos and an interactive or device-code Azure sign-in are not supported. The driver is `mssql` over tedious, pure JavaScript: no ODBC driver or platform binary to install.

### The database user

The connection writes nothing. A login with `db_datareader` in the database runs every query:

```sql
CREATE LOGIN malloy WITH PASSWORD = '...';
USE sales;
CREATE USER malloy FOR LOGIN malloy;
ALTER ROLE db_datareader ADD MEMBER malloy;
```

Cancelling a query uses the driver, so no `VIEW SERVER STATE` or `ALTER ANY CONNECTION` grant is needed. Because nothing is written, Malloy does not build a search index for this connection.

## What works

Sources from tables (`table('schema.table')`, `[bracketed]` names, three-part `db.schema.table`) and SQL blocks; `select`, `group_by`, `aggregate`, `where`, `having`, `order_by`, `limit`; expressions as dimensions; joins with symmetric aggregates across a fan-out; multi-stage pipelines and a query used as a source; dates, timestamps, truncation, extraction, intervals, and `timezone:` with IANA names through `AT TIME ZONE`; the standard function library in its T-SQL spellings.

## What does not work yet

Each of these is a later change, not a promise.

| Feature | State |
|---|---|
| `nest:` | Refused at translation (`supportsNesting` is false) |
| Arrays and records, in table data or as literals | Declared unsupported; a JSON column is a string |
| A boolean where SQL expects a condition: a boolean dimension in `where:`, `having:` or `pick … when`; a `bit` column in `where:` | Server error (4145). A comparison, `starts_with`, `ends_with`, `is_nan` or `is_inf` written there directly works, and a boolean **declared** as a dimension or measure is a `1`/`0` value (the translator's CASE for `booleanType: 'none'`) that groups and selects but is not a condition |
| `x::boolean` | Compile error: there is no boolean to cast to |
| `not x` on any boolean, `x !~ 'pattern'` | Server error (4145): the compiler writes `COALESCE(NOT x, TRUE)` and `COALESCE(x LIKE p, true)`, and a condition is not a value `COALESCE` can take. `x != y` works; `not (x = y)` does not |
| `all()`, `exclude()` | Compile error: ungrouped aggregates share the nest machinery |
| `x ~ r'...'` | Error when SQL is generated: no regular expressions before SQL Server 2025 |
| `regexp_extract`, `replace` with a regular expression | Server error: the functions arrive in SQL Server 2025 |
| A `timezone:` name absent from the CLDR table | Compile error rather than a located one |
| `greatest`, `least`, `ltrim`/`rtrim` with a character set | Server error before SQL Server 2022, which has `GREATEST`, `LEAST` and the two-argument `LTRIM`/`RTRIM` |
| `string_agg_distinct`, `byte_length` | Server error: `STRING_AGG` has no `DISTINCT`; a UTF-8 byte count needs the UTF-8 collations of SQL Server 2019 |
| Materialized tables, `#@ persist`, the search index | Not available: the connection is read-only |
| NULL ordering | SQL Server's default, NULL first in ascending order; other dialects sort NULL last |

## What the server sees

Every Malloy query is one T-SQL batch: the session settings `SET DATEFIRST 7`, `QUOTED_IDENTIFIER ON`, `ANSI_NULLS ON` and `ANSI_WARNINGS ON`, then any `setupSQL`, then a chain of CTEs ending in the query's `SELECT`. A row limit is `OFFSET 0 ROWS FETCH NEXT n ROWS ONLY` on the stage's `ORDER BY` (`ORDER BY (SELECT NULL)` when the stage has none); an ordered stage carries `OFFSET 0 ROWS` even without a limit, which is what makes its `ORDER BY` legal inside a CTE, and the server sorts it, so an ordered stage that feeds another stage costs a sort; leave `order_by` off a stage whose output is only read by another stage. grouping is by expression rather than ordinal, a dimension that reads no column is left out (T-SQL refuses a constant there) and a query of only constant dimensions groups by `()`, one group. A SQL block becomes a derived table, so one that ends in a bare `ORDER BY` is refused by the server; drop the ordering, or give it `OFFSET 0 ROWS` or `TOP`, either of which makes it legal.

## How the dialect reads the server

- A `datetime`, `datetime2` or `smalldatetime` is a Malloy timestamp read as UTC. A query's `timezone:` is converted with `AT TIME ZONE` through the Windows name of the zone, whose daylight-saving history differs from IANA's for older dates.
- A `datetimeoffset` is a Malloy `timestamptz`, an instant. Its clock is read at UTC, or in the query's `timezone:`, never at the offset the value was written in: `hour(t)`, `t.day` and `t::date` give the same answer for `12:34:56 -05:00` as for `17:34:56 +00:00`. Comparison, `DATEDIFF` and `MAX` already work on the instant. A `timestamptz` literal, `@2024-03-20 12:34:56[America/Chicago]::timestamptz`, is written with `AT TIME ZONE`.
- Every string literal is written `N'...'`, so text outside the database's code page compares as itself.
- The default collation compares case-insensitively; Malloy does not change that.
- `bit` is an integer, read as 0 or 1. `uniqueidentifier`, `text`, `ntext`, `time`, `binary`, `varbinary`, `xml`, `geography` and the other types the map does not name are `sql native`, to be passed through or cast in a `sql()` dimension.
- A `bigint` arrives as the driver's text and is read as a number, so a value above 2^53 loses precision.
- The connection's digest, which names the tables it may persist and the cache it may share, is built from the server, port, instance, database, authentication kind and the configured principal: the `user`, `domain\user`, or `clientId`. An ambient identity, `azure-default` or `azure-msi` with no `clientId`, is unknown until the first token request, so two such connections to one database share a digest. To tell them apart, set `clientId` (a user-assigned identity) or use `azure-service-principal`.
- `sample: n` and `sample: n%` read a base table through `TABLESAMPLE`, which returns whole pages, so a row count is approximate. A sample on any other source (a SQL block, a query) is ignored: `TABLESAMPLE` reads nothing but a table.

## Which server features the dialect uses

| Feature | First in |
|---|---|
| `TABLESAMPLE` | SQL Server 2005 |
| `datetimeoffset`, `SWITCHOFFSET` | SQL Server 2008 |
| `OFFSET … FETCH` | SQL Server 2012 |
| `AT TIME ZONE`, `DATEDIFF_BIG` | SQL Server 2016 |
| `STRING_AGG`, `TRIM` | SQL Server 2017 |

The dialect truncates with `DATEADD`, lists group sets with `VALUES` and uses nothing from SQL Server 2019 or later, so 2017, 2019, 2022 and Azure SQL Database run the same SQL.
