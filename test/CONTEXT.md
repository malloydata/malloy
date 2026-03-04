# Test Infrastructure

This directory contains the test infrastructure for Malloy, including cross-database tests, database-specific tests, and custom testing utilities.

## Test Organization

Tests are organized into several categories:

### Core Tests (`test/src/core/`)
Tests for core Malloy functionality that don't require database execution:
- AST generation
- IR generation
- Model semantics
- Type checking
- Error handling

### Database-Specific Tests (`test/src/databases/{database}/`)
Tests that verify database-specific behavior:
- `test/src/databases/bigquery/` - BigQuery-specific tests
- `test/src/databases/postgres/` - PostgreSQL-specific tests
- `test/src/databases/duckdb/` - DuckDB-specific tests
- etc.

Each database may have unique features, SQL syntax, or limitations that require specific testing.

### Cross-Database Tests (`test/src/databases/all/`)
Tests that run against **all** supported databases to ensure consistent behavior across dialects:
- Query semantics
- Data type handling
- Function behavior
- Join operations
- Aggregations

These tests are particularly important for verifying that Malloy's abstraction works correctly across all supported SQL dialects.

## Custom Test Utilities

### malloyResultMatches Matcher
Custom Jest matcher for comparing query results across different databases.

**Purpose:**
Different databases may format results slightly differently (date formatting, float precision, etc.). This matcher provides fuzzy comparison that accounts for these differences while still verifying semantic correctness.

**Usage:**
```typescript
expect(actualResult).malloyResultMatches(expectedResult);
```

**What it handles:**
- Float precision differences
- Date/timestamp format variations
- Null vs undefined equivalence
- Result ordering (when not semantically important)

## Database Setup

### DuckDB
DuckDB tests require building the test database:

```bash
npm run build-duckdb-db  # Creates test/data/duckdb/duckdb_test.db
```

This creates a local DuckDB database file populated with test data.

### PostgreSQL, MySQL, Trino, Presto
These databases require Docker containers to be running.

**Starting database containers:**
Each database has a startup script in the test directory:
- `test/postgres/postgres_start.sh`
- `test/mysql/mysql_start.sh`
- `test/trino/trino_start.sh`
- `test/presto/presto_start.sh`

These scripts start Docker containers with appropriate test configurations and data.

### BigQuery
BigQuery tests require:
- Valid GCP authentication
- Access to test datasets in BigQuery
- Proper environment variables set

BigQuery tests typically run only in CI environments with appropriate credentials.

### Snowflake
Snowflake tests require:
- Valid Snowflake account and credentials
- Access to test databases
- Proper environment variables set

## CI-Specific Test Commands

The CI system runs different test suites optimized for parallel execution:

- **`npm run ci-core`** - Core tests (no database required)
- **`npm run ci-duckdb`** - DuckDB-specific tests only
- **`npm run ci-bigquery`** - BigQuery-specific tests only
- **`npm run ci-postgres`** - PostgreSQL-specific tests only

These commands are optimized for CI and may not work correctly in local development environments.

## Test Data

### The test corpus

The shared cross-database parquet files live in `test/data/malloytest-parquet/` (~60 MB total, checked into git). These are the source of truth — every dialect loads from or mirrors this data. DuckDB-only files remain in `test/data/duckdb/`.

#### Shared parquets (`test/data/malloytest-parquet/`)

| File | Rows | Description |
|---|---|---|
| flights.parquet | 344,827 | FAA flight records |
| aircraft_models.parquet | 60,461 | Aircraft model reference |
| airports.parquet | 19,793 | US airports |
| ga_sample.parquet | 2,556 | Google Analytics sample |
| aircraft.parquet | 3,599 | FAA aircraft registry |
| state_facts.parquet | 51 | US state statistics |
| carriers.parquet | 21 | Airline carriers |
| alltypes.parquet | 1 | Type testing fixture |

#### DuckDB-only files (`test/data/duckdb/`)

| File | Description |
|---|---|
| duckdb_test.db | Built artifact (from `npm run build-duckdb-db`) |
| test.json | DuckDB-only test fixture |
| flights/ (part.0-2.parquet) | DuckDB glob/partitioned read test |
| flights_partitioned.parquet | Snowflake partition test |
| numbers.parquet | DuckDB-only (numbers 1–1000) |
| words.parquet | DuckDB-only (word list) |
| words_bigger.parquet | DuckDB-only (extended word list) |

### Common pattern

All cross-database tests (`test/src/databases/all/`) reference tables as `malloytest.{table}` (schema-qualified). Every dialect must create a `malloytest` schema containing these tables with matching data.

### How each dialect loads test data

| Dialect | Method | Files | Notes |
|---|---|---|---|
| DuckDB | TS script: `CREATE TABLE AS SELECT FROM parquet_scan()` | `scripts/build_duckdb_test_database.ts` | Run via `npm run build-duckdb-db`. Creates `test/data/duckdb/duckdb_test.db` |
| PostgreSQL | Compressed SQL dump loaded via Docker `psql` | `test/data/postgres/malloytest-postgres.sql.gz` | Docker script: `test/postgres/postgres_start.sh` |
| MySQL | Compressed SQL dump loaded via Docker | `test/data/mysql/malloytest.mysql.gz` | Docker script: `test/mysql/mysql_start.sh` |
| BigQuery | Pre-loaded manually in `malloydata-org` project | (none) | No loader script in repo. Data assumed to exist. |
| Snowflake | SQL: `PUT` local parquet → stage, `COPY INTO` table | `test/snowflake/uploaddata.sql` | Run via `snowsql -f uploaddata.sql` from `test/snowflake/` |
| Trino/Presto | Docker containers with pre-loaded data | `test/trino/trino_start.sh` | Uses Docker volumes |
| Databricks | TS script: upload to Volume via REST, `CREATE TABLE AS SELECT FROM read_files()` | `test/databricks/upload_data.ts` | Run manually: `source ~/env/databricks && npx tsx test/databricks/upload_data.ts` |

### Cloud warehouse considerations

Cloud SQL warehouses (BigQuery, Snowflake, Databricks) can't read local files via SQL. Each needs a mechanism to get parquet data into the warehouse:
- **Snowflake**: `PUT` uploads local files to a stage, then `COPY INTO` reads from the stage
- **BigQuery**: Data pre-loaded (could use `bq load` from local parquets)
- **Databricks**: Uploads parquets to a Unity Catalog Volume via REST API, then `CREATE TABLE AS SELECT FROM read_files()` to create tables

An ideal future state would be publishing the parquets to a well-known cloud storage location that all warehouses could read from, but the hosting/cost question is still open.

## Important Notes

- Cross-database tests are critical for verifying Malloy's dialect abstraction
- Custom matchers help handle legitimate database differences
- Database setup scripts must be run before database-specific tests
- CI has access to more databases than typical development environments
- Test data should be committed to the repository (except for large binary files)
