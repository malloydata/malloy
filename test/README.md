## Tests

By default, tests run against BigQuery, Postgres, and DuckDB.

Tests can also be run against a specific database, using the DATABASES environment variable, such as: `DATABASES=x,y npm run test`

Setting up postgres:

# Setup for Postgres Test Data

Assumes that postgres has been installed via nix (installs but doesn't configure).

ADD to environment: `export PGHOST=localhost`

**postgres_init.sh** - builds a database as the current user in .tmp/data/malloytestdb. Starts server runing on localhost:5432
copies the test data in `malloytest-postgres.sql.gz` into the database.

**postgres_start.sh** - starts the postgres server, once it has been installed (use after a reboot, for example)

**postgres_stop.sh** - stops the postgres server

**state_fact.sql** - example file on how to insert data from json

Setting up DuckDB:

# Building test database for duckdb

1. At top-level, run `npx ts-node scripts/build_duckdb_test_database.ts`
2. A file called `duckdb_test.db` should be created in the test/data/duckdb folder - tests will automatically look there.
