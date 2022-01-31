# Setup for Postgres Test Data

Assumes that postgres has been installed via nix (installs but doesn't configure).

ADD to environment: `export PGHOST=localhost`

**postgres_init.sh** - builds a database as the current user in .tmp/data/malloytestdb.  Starts server runing on localhost:5432
copies the test data in `malloytest-postgres.sql.gz` into the database.

**postgres_start.sh** - starts the postgres server, once it has been installed (use after a reboot, for example)

**postgres_stop.sh** - stops the postgres server

**state_fact.sql** - example file on how to insert data from json
