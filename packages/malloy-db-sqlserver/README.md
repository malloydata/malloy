<!--
 Copyright Contributors to the Malloy project
 SPDX-License-Identifier: MIT
-->

# Malloy

Malloy is a modern open source language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database.

## This package

This package connects the `malloydata/malloy` library to Microsoft SQL Server 2017 and later, and to Azure SQL Database. The dialect is experimental: a model that uses it needs `##! experimental.dialect.sqlserver`, and the section below says what it does not do yet.

## Connecting

The five fields most connections need:

```json
{
  "name": "warehouse",
  "type": "sqlserver",
  "server": "db.example.com",
  "port": 1433,
  "database": "sales",
  "user": "malloy",
  "password": "..."
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
| A boolean held as a value where SQL expects a condition: a boolean dimension in `where:` or `pick … when`, a `bit` column in `where:`, `where: starts_with(...)` | Fails at the server (error 4145): SQL Server has no boolean value, so a named boolean is a `1`/`0` value. A comparison written in `where:` or `having:` works, and a boolean dimension in `group_by:` or `select:` comes back as `1` or `0` |
| `all()`, `exclude()` | Compile error: ungrouped aggregates share the nest machinery |
| `x ~ r'...'` | Error when SQL is generated: no regular expressions before SQL Server 2025 |
| `regexp_extract`, `replace` with a regular expression | Server error: the functions arrive in SQL Server 2025 |
| A `timezone:` name absent from the CLDR table | Compile error rather than a located one |
| `greatest`, `least`, `ltrim`/`rtrim` with a character set | Server error before SQL Server 2022, which has `GREATEST`, `LEAST` and the two-argument `LTRIM`/`RTRIM` |
| `string_agg_distinct`, `byte_length` | Server error: `STRING_AGG` has no `DISTINCT`; a UTF-8 byte count needs the UTF-8 collations of SQL Server 2019 |
| A dimension that is a constant (`group_by: x is 1`) | Server error: T-SQL refuses a constant in GROUP BY |
| `datetimeoffset` columns | `sql native`; reading one as a timestamp with its offset is a later change |
| Materialized tables, `#@ persist`, the search index | Not available: the connection is read-only |
| NULL ordering | SQL Server's default, NULL first in ascending order; other dialects sort NULL last |

## What the server sees

Every Malloy query is one T-SQL batch: the session settings `SET DATEFIRST 7`, `QUOTED_IDENTIFIER ON`, `ANSI_NULLS ON` and `ANSI_WARNINGS ON`, then any `setupSQL`, then a chain of CTEs ending in the query's `SELECT`. Row limits are `TOP`, grouping is by expression rather than ordinal, and a CTE stage carries no `ORDER BY` unless it also has a limit. A SQL block becomes a derived table, so one that ends in `ORDER BY` without `TOP` is refused by the server; drop the ordering or add `TOP`.

## How the dialect reads the server

- A `datetime`, `datetime2` or `smalldatetime` is a Malloy timestamp read as UTC. A query's `timezone:` is converted with `AT TIME ZONE` through the Windows name of the zone, whose daylight-saving history differs from IANA's for older dates.
- Every string literal is written `N'...'`, so text outside the database's code page compares as itself.
- The default collation compares case-insensitively; Malloy does not change that.
- `bit` is Malloy's boolean. `uniqueidentifier`, `text`, `ntext`, `time`, `binary`, `varbinary`, `xml`, `geography` and the other types the map does not name are `sql native`, to be passed through or cast in a `sql()` dimension.
- A `bigint` arrives as the driver's text and is read as a number, so a value above 2^53 loses precision.
- `sample: n` takes the first `n` rows, not a random sample; `TABLESAMPLE` returns whole pages.

## Which server features the dialect uses

| Feature | First in |
|---|---|
| `AT TIME ZONE`, `DATEDIFF_BIG` | SQL Server 2016 |
| `STRING_AGG`, `TRIM` | SQL Server 2017 |

The dialect truncates with `DATEADD`, lists group sets with `VALUES` and uses nothing from SQL Server 2019 or later, so 2017, 2019, 2022 and Azure SQL Database run the same SQL.
