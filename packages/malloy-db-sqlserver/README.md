<!--
 Copyright Contributors to the Malloy project
 SPDX-License-Identifier: MIT
-->

# Malloy

Malloy is a modern open source language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database.

## This package

This package connects the `malloydata/malloy` library to Microsoft SQL Server 2022 and later, and to Azure SQL Database. The dialect is experimental: a model that uses it needs `##! experimental.dialect.sqlserver`.

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

`server` also accepts the `host,port` form SQL Server Management Studio and Looker use. `authentication` chooses the credential kind: `sql` (default), `azure-default`, `azure-service-principal`, `azure-msi`, `azure-access-token` or `ntlm`; the `azure-*` kinds are Microsoft Entra ID through the driver. A `connectionString` may replace the structured fields, never accompany them. Named instances (`instanceName`), availability groups (`readOnlyIntent`, `multiSubnetFailover`) and a certificate issued to another name (`hostNameInCertificate`) are advanced fields.

The connection is encrypted by default. `trustServerCertificate` accepts a certificate the client cannot verify, such as a local container's; leave it off for a server you do not control.

### The database user

Malloy reads. A login with `db_datareader` in the database is enough:

```sql
CREATE LOGIN malloy WITH PASSWORD = '...';
USE sales;
CREATE USER malloy FOR LOGIN malloy;
ALTER ROLE db_datareader ADD MEMBER malloy;
```

A search index or a query over a materialized result creates a table in `tempdb`, which every login may do. Cancelling a query uses the driver, so no `VIEW SERVER STATE` or `ALTER ANY CONNECTION` grant is needed.

## Which server features the dialect uses

| Feature | First in |
|---|---|
| `AT TIME ZONE`, `FOR JSON`, `OPENJSON` | SQL Server 2016 |
| `STRING_AGG`, `TRIM` | SQL Server 2017 |
| `JSON_OBJECT`, `JSON_ARRAY`, `DATETRUNC`, `GENERATE_SERIES`, two-argument `LTRIM`/`RTRIM` | SQL Server 2022 |
| Regular expressions (`REGEXP_LIKE` and friends) | SQL Server 2025; a model that uses `~ r'...'` or `regexp_extract` on this dialect gets a translation error |

## How the dialect reads the server

- A `datetime`, `datetime2` or `smalldatetime` is a Malloy timestamp read as UTC. A `datetimeoffset` is the instant it names, and its clock functions read it at the offset it was written in. A query's `timezone:` is converted with `AT TIME ZONE` through the Windows name of the zone.
- The default collation compares case-insensitively; Malloy does not change that.
- `bit` is Malloy's boolean; a comparison used as a value becomes `1`, `0` or `NULL`.
- Every result row travels as one `FOR JSON PATH` document, so a `bigint` beyond 2^53 loses precision on the way to JavaScript.
