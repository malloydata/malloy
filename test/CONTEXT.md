# Test Infrastructure

This directory contains the test infrastructure for Malloy, including cross-database tests, database-specific tests, and custom testing utilities.

## Test Organization

Tests are organized into several categories:

### Core Tests (`test/src/core/`)
Tests for core Malloy functionality. The directory holds two flavors:

- **Pure translator/IR tests** — AST generation, IR generation, type checking, error handling (no SQL execution).
- **End-to-end query tests** — single-dialect tests (almost always DuckDB) that load a Malloy model, run a query, and assert on results. They exercise the full Foundation API path (`runtime.loadModel(...).loadQueryByName(...).run(...)`) including SQL generation and execution against the loaded test database.

Both live here. The end-to-end ones use `runtimeFor('duckdb')` and read from the `malloytest.*` tables (e.g. `state_facts`, `aircraft`, `flights`) loaded into `test/data/duckdb/duckdb_test.db` by `npm run build-duckdb-db`. They follow the dialect-gating pattern with `MALLOY_DATABASE` so they auto-skip when DuckDB isn't selected:

```ts
let describe = globalThis.describe;
if (!envDatabases.includes('duckdb')) describe = describe.skip;
```

This is the right home for any feature test that requires SQL execution but only needs to verify *language behavior* (not dialect-specific quirks). For features whose behavior must hold across every dialect, write a cross-database test in `test/src/databases/all/` instead.

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

### Consumer-contract canary (`test/consumer-canary/`)
Not a normal test — it consumes the *built* `@malloydata/*` packages the way a downstream app does (esbuild bundle + plain ts-jest, no babel) to catch native/ESM leaks that malloy's own CI is blind to. Run locally with `npm run test-consumer-canary` (it builds first). See [`test/consumer-canary/CONTEXT.md`](consumer-canary/CONTEXT.md).

## Custom Test Utilities

### Result matchers (`toMatchResult` / `toEqualResult` / `toMatchRows` / `toMatchPaths`)
Custom Jest matchers (in `packages/malloy/src/test/resultMatchers.ts`) for asserting
Malloy query results. The **subject is the query string** and the matcher runs it
internally, does schema-aware nested comparison, and — critically — **prints the
generated SQL when the query fails or a value mismatches** (the fastest way to
diagnose a dialect issue). There is **no** `malloyResultMatches` matcher (an older
name; these replaced it).

**Setup:** `import '@malloydata/malloy/test/matchers';` to register them, and build a
`TestModel` (`{model, dialect}`) — `wrapTestModel(runtime, source)` makes one from a
live DB runtime, or `mkTestModel(...)` to define inline data.

**Usage:**
```typescript
const tm = wrapTestModel(runtime, '');           // or mkTestModel(...)
await expect(`run: ${db}.table('malloytest.state_facts') -> { ... }`)
  .toMatchResult(tm, {f1: 'A', names: [{popular_name: 'Ava'}]});  // partial: extra rows/fields ok
await expect(`run: ...`).toEqualResult(tm, [{...}, {...}]);        // exact rows + fields
await expect(`run: ...`).toMatchPaths(tm, {'by2.names.popular_name': 'Ava'}); // dotted-path probe
```
Pass `{debug: true}` (or a `# test.debug` tag) to force a data + SQL dump even on pass.
Expected values are plain POJOs shaped like the data (nested arrays/records included);
the matcher navigates them, so you never index the raw result yourself. It handles
cross-dialect value differences (bigint/number, MySQL boolean 0/1, date/timestamp).
**Rejections** (a query that should error) aren't a result match — use
`await expect(runQuery(tm.model, src)).rejects.toThrow(/.../)`.

### test.when — conditional tests (`test/jest.setup.ts`)
For a test that only applies to some dialects/conditions, use `test.when` —
**not** an `if` wrapping a `test()` call.

```typescript
test.when(runtime.dialect.supportsNestedProjectionLimit)(
  'limit on a projection nest caps array length',
  async () => { ... }
);
```

`test.when(condition)` returns `test` when the condition holds and a skipping
`test` otherwise, so the test name is **always declared statically**. That's
what lets the VS Code Jest decorators (the per-test run/debug gutter icons)
discover and run it individually. Writing `if (condition) { test(...) }` hides
the `test()` call inside a branch, so the IDE can't see it and the
run-single-test affordance disappears. `it.when` is the same for `it`.

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
| flights/ (part.0-2.parquet) | DuckDB multi-file glob read test |

### Common pattern

All cross-database tests (`test/src/databases/all/`) reference tables as `malloytest.{table}` (schema-qualified). Every dialect must create a `malloytest` schema containing these tables with matching data.

### How each dialect loads test data

| Dialect | Method | Files | Notes |
|---|---|---|---|
| DuckDB | TS script: `CREATE TABLE AS SELECT FROM parquet_scan()` | `test/duckdb/load_test_data.sh` (wraps `load_test_data.ts`) | Run via `sh test/duckdb/load_test_data.sh` (or `npm run build-duckdb-db`). Creates `test/data/duckdb/duckdb_test.db` |
| PostgreSQL | Compressed SQL dump loaded via Docker `psql` | `test/data/postgres/malloytest-postgres.sql.gz` | Docker script: `test/postgres/postgres_start.sh` |
| MySQL | Compressed SQL dump loaded via Docker | `test/data/mysql/malloytest.mysql.gz` | Docker script: `test/mysql/mysql_start.sh` |
| BigQuery | Pre-loaded manually in `malloydata-org` project | (none) | No loader script in repo. Data assumed to exist. |
| Snowflake | SQL: `PUT` local parquet → stage, `COPY INTO` table | `test/snowflake/load_test_data.sh` (wraps `load_test_data.sql`) | Run via `sh test/snowflake/load_test_data.sh` (needs the `snowsql` CLI) |
| Trino/Presto | Docker containers with pre-loaded data | `test/trino/trino_start.sh` | Uses Docker volumes |
| Databricks | TS script: upload to Volume via REST, `CREATE TABLE AS SELECT FROM read_files()` | `test/databricks/load_test_data.sh` (wraps `load_test_data.ts`) | Run manually with the `DATABRICKS_*` env vars set: `sh test/databricks/load_test_data.sh` |

### Cloud warehouse considerations

Cloud SQL warehouses (BigQuery, Snowflake, Databricks) can't read local files via SQL. Each needs a mechanism to get parquet data into the warehouse:
- **Snowflake**: `PUT` uploads local files to a stage, then `COPY INTO` reads from the stage
- **BigQuery**: Data pre-loaded (could use `bq load` from local parquets)
- **Databricks**: Uploads parquets to a Unity Catalog Volume via REST API, then `CREATE TABLE AS SELECT FROM read_files()` to create tables

An ideal future state would be publishing the parquets to a well-known cloud storage location that all warehouses could read from, but the hosting/cost question is still open.

## Authoring Malloy source from JavaScript

When a test programmatically constructs Malloy source (e.g. injecting adversarial values for escape testing), be aware that Malloy has several string-literal forms with different escape rules. The `r'...'` and `/.../` regex forms — and all triple-quoted strings — are *raw*: backslash is preserved verbatim, no escape processing. Doubling backslashes on the JavaScript side will produce a different string than intended.

The full table is in [`../packages/malloy/src/lang/CONTEXT.md`](../packages/malloy/src/lang/CONTEXT.md) under "String literal forms". `test/src/databases/all/escape.spec.ts` is a worked example.

## Important Notes

- Cross-database tests are critical for verifying Malloy's dialect abstraction
- Custom matchers help handle legitimate database differences
- Database setup scripts must be run before database-specific tests
- CI has access to more databases than typical development environments
- Test data should be committed to the repository (except for large binary files)
