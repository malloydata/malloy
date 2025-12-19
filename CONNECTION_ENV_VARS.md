# Database Connection Environment Variable Support

This document summarizes which database connections support environment variable configuration in Malloy.

## Connections with Environment Variable Support

### MySQL
**Environment Variables:**
- `MYSQL_USER` (required)
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

**Note:** MySQL connections are **only** configurable via environment variables. There is no VSCode UI support for MySQL configuration.

**Implementation:** `packages/malloy-db-mysql/src/mysql_connection.ts` - `MySQLExecutor.getConnectionOptionsFromEnv()`

### Snowflake
**Environment Variables:**
- `SNOWFLAKE_ACCOUNT` (required)
- `SNOWFLAKE_USER`
- `SNOWFLAKE_PASSWORD`
- `SNOWFLAKE_WAREHOUSE`
- `SNOWFLAKE_DATABASE`
- `SNOWFLAKE_SCHEMA`

**Additional Configuration:** Also supports TOML file at `~/.snowflake/connections.toml`

**Implementation:** `packages/malloy-db-snowflake/src/snowflake_executor.ts` - `SnowflakeExecutor.getConnectionOptionsFromEnv()`

### Trino
**Environment Variables:**
- `TRINO_SERVER` (required)
- `TRINO_USER` (required)
- `TRINO_PASSWORD`
- `TRINO_CATALOG`
- `TRINO_SCHEMA`

**Implementation:** `packages/malloy-db-trino/src/trino_executor.ts` - `TrinoExecutor.getConnectionOptionsFromEnv('trino')`

### Presto
**Environment Variables:**
- `PRESTO_HOST` (required)
- `PRESTO_PORT` (defaults to 8080)
- `PRESTO_USER`
- `PRESTO_PASSWORD`
- `PRESTO_CATALOG`
- `PRESTO_SCHEMA`

**Implementation:** `packages/malloy-db-trino/src/trino_executor.ts` - `TrinoExecutor.getConnectionOptionsFromEnv('presto')`

### MotherDuck (via DuckDB)
**Environment Variables:**
- `MOTHERDUCK_TOKEN` or `motherduck_token` (required for MotherDuck connections)

**Note:** Used when connecting to MotherDuck databases (database path starts with `md:` or `motherduck:`)

**Implementation:** `packages/malloy-db-duckdb/src/duckdb_connection.ts` - checks `process.env['motherduck_token']` or `process.env['MOTHERDUCK_TOKEN']`

## Connections WITHOUT Environment Variable Support

### BigQuery
Uses Google Cloud authentication via:
- `gcloud auth login --update-adc` (OAuth)
- Service account key file

**Implementation:** `packages/malloy-db-bigquery/src/bigquery_connection.ts` - uses BigQuery SDK which reads from gcloud credentials

### PostgreSQL
Uses connection configuration object (host, port, username, password, database, connectionString)

**Implementation:** `packages/malloy-db-postgres/src/postgres_connection.ts` - no environment variable support

### DuckDB
Uses file paths or in-memory databases. No authentication required.

**Implementation:** `packages/malloy-db-duckdb/src/duckdb_connection.ts` - no environment variable support (except for MotherDuck token)






