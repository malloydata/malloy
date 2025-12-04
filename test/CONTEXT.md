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

Test data is organized by database and includes:
- Schema definitions
- Sample datasets
- Expected query results
- Edge cases and error conditions

Test data should be:
- Small enough for fast test execution
- Comprehensive enough to cover important cases
- Consistent across databases (where applicable)

## Important Notes

- Cross-database tests are critical for verifying Malloy's dialect abstraction
- Custom matchers help handle legitimate database differences
- Database setup scripts must be run before database-specific tests
- CI has access to more databases than typical development environments
- Test data should be committed to the repository (except for large binary files)
