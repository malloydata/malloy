<!--
 Copyright Contributors to the Malloy project
 SPDX-License-Identifier: MIT
-->

# Malloy

Malloy is a modern open source language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database.

## This package

This package connects the `malloydata/malloy` library to Microsoft SQL Server 2017 and later, and to Azure SQL Database. The dialect is experimental: a model that uses it needs `##! experimental.dialect.sqlserver`.

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

Malloy reads. A login with `db_datareader` in the database runs every query:

```sql
CREATE LOGIN malloy WITH PASSWORD = '...';
USE sales;
CREATE USER malloy FOR LOGIN malloy;
ALTER ROLE db_datareader ADD MEMBER malloy;
```

A search index, and a query over a materialized result, create a table in a scratch schema: `tempdb.dbo` unless `scratchSchema` names another `database.schema`. The login needs `CREATE TABLE` in that database and `ALTER` on the schema, which `sysadmin` members have everywhere. `tempdb` is rebuilt at every server restart, so a grant made there is gone after one; a login that is not `sysadmin` is better given a schema of its own:

```sql
USE sales;
CREATE SCHEMA malloy_scratch AUTHORIZATION malloy;
GRANT CREATE TABLE TO malloy;
```

with `"scratchSchema": "sales.malloy_scratch"` on the connection. A table there is named for its query and its login, and stays until someone drops it. Cancelling a query uses the driver, so no `VIEW SERVER STATE` or `ALTER ANY CONNECTION` grant is needed.

## Which server features the dialect uses

| Feature | First in |
|---|---|
| `AT TIME ZONE`, `FOR JSON`, `OPENJSON`, `STRING_ESCAPE` | SQL Server 2016 |
| `STRING_AGG`, `TRIM` | SQL Server 2017 |
| Regular expressions (`REGEXP_LIKE` and friends) | SQL Server 2025; a model that uses `~ r'...'` or `regexp_extract` on this dialect gets a translation error |

The dialect writes its own JSON, truncates with `DATEADD`, lists group sets with `VALUES` and takes `greatest` and `least` as the first ordered row of a `VALUES` list, so it needs none of `JSON_OBJECT`, `DATETRUNC`, `GENERATE_SERIES`, `GREATEST` or `LEAST` from SQL Server 2022. That `VALUES` list is a subquery, which SQL Server accepts in a `select:`, a `where:` or a dimension but not in a `group_by:` or inside an aggregate. `ltrim` and `rtrim` with a character set, which only 2022's `LTRIM`/`RTRIM` provide, get a translation error; `trim` with a character set works everywhere. `byte_length` gets one too: a UTF-8 byte count needs the UTF-8 collations of SQL Server 2019. Also refused at translation, whatever the version: `string_agg_distinct`, a nested query of more than one stage, and `limit:` on a nested `select:`.

## How the dialect reads the server

- A `datetime`, `datetime2` or `smalldatetime` is a Malloy timestamp read as UTC. A `datetimeoffset` is the instant it names, and its clock functions read it at the offset it was written in. A query's `timezone:` is converted with `AT TIME ZONE` through the Windows name of the zone.
- The default collation compares case-insensitively; Malloy does not change that.
- A `text` or `ntext` column is `sql native`: the engine cannot group, compare or take `MAX` over one. Cast it to `NVARCHAR(MAX)` in a `sql()` dimension to use it.
- `bit` is Malloy's boolean; a comparison used as a value becomes `1`, `0` or `NULL`.
- Every result row travels as one `FOR JSON PATH` document, so a `bigint` beyond 2^53 loses precision on the way to JavaScript, and a `float` arrives with 16 significant digits, one short of a round trip.
