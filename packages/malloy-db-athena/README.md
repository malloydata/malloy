# Malloy

Malloy is a modern open source language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. See the [Malloy package](https://github.com/malloydata/malloy/blob/main/packages/malloy/README.md) for more.

## This package

`@malloydata/db-athena` connects Malloy to [Amazon Athena](https://aws.amazon.com/athena/) running engine version 3. The dialect is **experimental**: a model that uses it must start with `##! experimental.dialect.athena`.

Athena engine version 3 is Trino reached through the AWS API, so the dialect is a subclass of Malloy's Trino dialect and the connection is the shared Trino/Presto connection over a runner that drives the API: `StartQueryExecution`, a poll of `GetQueryExecution`, then `GetQueryResults` in pages of 1000. Tables live in the Glue Data Catalog and their data in S3.

## Configuration

```json
{
  "name": "athena",
  "type": "athena",
  "region": "us-east-1",
  "workGroup": "malloy",
  "database": "analytics"
}
```

| Property | Meaning |
| --- | --- |
| `region` | AWS region of the workgroup. The SDK default applies when unset. |
| `workGroup` | Workgroup that runs the statements. It must run engine version 3; `test()` refuses another version. |
| `catalog` | Data catalog; `AwsDataCatalog` when unset. |
| `database` | Default database for an unqualified table name. |
| `outputLocation` | S3 location for query results. Leave unset for a workgroup that enforces its own; Athena rejects a statement that names another. |
| `resultReuseMaxAgeMinutes` | Serve a statement identical to one that read the same tables within this many minutes from that earlier result. Athena reuses only statements that read a table. |
| `accessKeyId`, `secretAccessKey`, `sessionToken` | Static credentials. When unset the AWS SDK's default chain applies: environment variables, a shared config or SSO profile, an instance or pod role. |

There is no `setupSQL`: Athena keeps no session between statements.

The IAM identity needs `athena:StartQueryExecution`, `athena:GetQueryExecution`, `athena:GetQueryResults` and `athena:StopQueryExecution` on the workgroup, `glue:GetDatabase`, `glue:GetTable` and `glue:GetTables` on the catalog, and read on the tables' S3 locations plus read and write on the output location.

## What does not work

| | Engine fact | What happens |
| --- | --- | --- |
| A pipelined nest (`nest: x is { ... } -> { ... }`) | The later stages run as a correlated subquery over the first stage's array, which Athena rejects: `Given correlated subquery is not supported`. | Compile error: `'athena' does not support a multi-stage pipeline ('->') in a nested query`. |
| Reading a table's or SQL block's own `row` or `array` column | `GetQueryResults` returns a compound value as Presto's text, `{a=1, b=x}`, which nothing reads back. | The column is `sql native` (`readsNestedData`, `supportsArraysInData` and `compoundObjectInSchema` are false) and its value is that text. Nests, records and arrays the dialect builds are unaffected: they travel as JSON, and a record's fields are read with `json_extract`. |
| `group_by` on a record or array | A record or array the dialect builds is JSON, and Athena's `json` type is not orderable. | `TYPE_MISMATCH: Type json is not orderable`. |
| `map` and `varbinary` columns | No Malloy type. | `sql native`. |
| A bigint or decimal past 2^53 | The text is exact; Malloy reads a JavaScript number (`supportsBigIntPrecision` is false). A number field of a record is read back as `DOUBLE`, whatever its declared width. | The nearest double. |
| Sub-millisecond timestamps | Athena keeps a literal's microseconds and a Hive `timestamp` column is milliseconds; the shared Trino result converter reads a timestamp into a JavaScript `Date`, which holds milliseconds. | Truncated to milliseconds on the way out. |
| Persistence (`#@ persist`, temporary tables) | Athena writes only through `CREATE TABLE AS` and `UNLOAD` to S3 and has no temporary table. | `canPersist()` is false; not implemented. |
| Engine version 2 workgroups | Presto 0.217, whose SQL the Trino dialect does not target. | `test()` reports the workgroup's engine version and fails. |
| Statement latency | Every statement, including a schema fetch, is an API round trip of 0.3 to 3 seconds; account quotas cap concurrent statements. | Slow first compile of a model; a large test suite runs for minutes. |
| A row limit on a query | The connection stops fetching pages at the limit; the statement runs whole, because wrapping it in a `LIMIT` subquery would let the engine drop its `ORDER BY`. | Bytes scanned, and so cost, are those of the whole statement. |

## Engine facts the connection is built on

Recorded against engine version 3 with the AWS CLI before the code was written.

- Every cell is text, typed by `ColumnInfo.Type`; a NULL is an absent value; a `decimal` carries its precision and scale beside a bare `decimal`; a 32-bit float is spelled `float` here and `real` elsewhere.
- Row 0 of a DML statement's first page is the header; a `DESCRIBE`, `SHOW` or DDL result has none. Pages hold 1000 rows and the header does not repeat.
- `CAST(x AS JSON)` of a named `ROW` is a JSON object with the field names; `timestamp` and `date` encode as their text; `timestamp with time zone` does not cast to JSON and `to_iso8601` is used instead. JSON casts back to a `ROW` of every scalar type but the time types, so those are declared `VARCHAR` in the cast and re-typed by a `transform` lambda.
- `UNNEST` of an array of rows yields the row as one column, Presto's legacy shape; `LEFT JOIN UNNEST(...) WITH ORDINALITY ... ON TRUE` works and a NULL array joins as one row of NULLs. `r.*` does not expand a row column.
- `DESCRIBE` answers in Hive's type spelling (`struct<a:int>`); `information_schema.columns` and `EXPLAIN` answer in Trino's (`row(a integer)`). `DESCRIBE OUTPUT` does not exist, so a SQL block's schema is read from its `EXPLAIN` plan.
- The parser rejects `QUALIFY`; `json` is not orderable; `version()` is not a function, and every execution reports `EngineVersion.EffectiveEngineVersion`.
- A parser error is an `InvalidRequestException` from `StartQueryExecution`; a semantic error is the execution's `StateChangeReason`.
- Glue lowercases every identifier and resolves a reference case-insensitively; Trino exposes a struct's field names lowercased too.

## Testing

The tests run against a live engine version 3 workgroup and skip when `ATHENA_WORKGROUP` is unset.

```
ATHENA_REGION=us-east-1 ATHENA_WORKGROUP=malloytest ATHENA_DATABASE=malloytest \
ATHENA_RESULT_REUSE_MINUTES=60 npm run ci-athena
```

`ATHENA_CATALOG` and `ATHENA_OUTPUT_LOCATION` are read the same way. Credentials come from the AWS default chain; for a local run, `AWS_PROFILE=<profile>` on the same command line.

The malloytest tables are loaded once with `sh test/athena/load_test_data.sh`, which also needs `ATHENA_TEST_DATA_LOCATION=s3://bucket/prefix/`. It uploads each parquet file and declares an external table over it in the Glue database `malloytest`; `ga_sample` and the array columns of `alltypes` are left out (see above).
