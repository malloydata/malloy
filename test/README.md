# Tests

By default, tests run against BigQuery, Postgres, and DuckDB.

Tests can also be run against a specific database, using the MALLOY_DATABASE or MALLOY_DATABASES environment variable, such as: `MALLOY_DATABASES=bigquery,postgres npm run test`

# Test Databases Setup

## Postgres

Assumes that postgres has been installed via nix (installs but doesn't configure).

**postgres_init.sh** - builds a database as the current user in .tmp/data/malloytestdb. Starts server runing on localhost:5432
copies the test data in `malloytest-postgres.sql.gz` into the database.

### common errors

_initdb: could not look up effective user ID NNNNNN: user does not exist_

This likely means that your user is not in your `/etc/passwd` file, quite possibly because you are on a corp machine that may use nss cache.

There are various workarounds, but the simplest is to add your user to `/etc/passwd` by editing the file with `sudo vipw`.  Your user will take a form similar to:

```
my_user_name:x:727027:89939:Lloyd Toy:/usr/local/my_company/home/my_user_name:/bin/bash
```

**postgres_start.sh** - starts the postgres server, once it has been installed (use after a reboot, for example)

**postgres_stop.sh** - stops the postgres server

**state_fact.sql** - example file on how to insert data from json

## DuckDB

1. At top-level, run `npx ts-node scripts/build_duckdb_test_database.ts`
2. A file called `duckdb_test.db` should be created in the test/data/duckdb folder - tests will automatically look there.

## BigQuery

set up your gcloud credentials to connect to the malloy-data gcp project

```
gcloud auth application-default login
```