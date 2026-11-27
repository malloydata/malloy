# Test Infrastructure

Which tests run where, and the rules for where a test goes, are in the Testing section of the [root CONTEXT.md](../CONTEXT.md#testing). This file covers the mechanics of `test/src`.

## Layout of `test/src`

The directory is the subject; the filename's `db-` part says which databases run it.

| Directory | Subject |
|---|---|
| `sources/` | `table()`, a source from a query, `extend`, `rename:`, `primary_key:`, `accept:`/`except:`, source `where:`. Sub-features: `sql.*` (`conn.sql(...)`, `%{ }` interpolation), `composite.*` (`compose(...)`, partition composites), `virtual.*` (`conn.virtual()`, `type:` and `::Shape`, the virtualMap) |
| `joins/` | `join_one`/`join_many`/`join_cross`, `with`/`on`, join types, filtered joins |
| `aggregates/` | `count`/`sum`/`avg`/`min`/`max`, locality, symmetric aggregates, filtered measures, `all()`/`exclude()` |
| `expressions/` | operators, `pick`/`case`, `::` and `:::`, `??`, `like`/regex, apply `?` and alternation |
| `functions/` | functions that don't need `calculate:` (stdlib, `name!type()`, `sql_*`) |
| `calculations/` | `calculate:`, windows, `partition_by:` |
| `filters/` | `where:` and `having:` |
| `filter_expressions/` | the `f'…'` filter language |
| `time/` | truncation, extraction, literals, ranges, measurement, `timestamptz`, `timezone:` |
| `nesting/` | `nest:` |
| `views/` | `view:`, refinement with `+` |
| `queries/` | `run:`, `query:`, pipelines, output naming |
| `ordering/` | top-level `order_by:` and `limit:` |
| `datatypes/` | `basic_atomic.*` (integers, bigint, floats, booleans, `sql native`), `compound_atomic.*` (arrays, records, repeated records, unnesting, array queries) |
| `index/` | `index:`, `sample:`, the search index |
| `quoting/` | literal escaping, identifier quoting, reserved words |
| `tags/` | annotations |
| `parameters/` | source parameters |
| `givens/` | `given:` |
| `persistence/` | `#@ persist`, build plans, manifests |
| `restricted_mode/` | restricted queries |
| `experimental_dialects/` | the `##! experimental.dialect` gate |
| `api/` | `Runtime`, materializers, `validate()`, events, caching, `MalloyConfig`, streaming |
| `render/` | render tags, rendering a result |
| `bigquery/`, `duckdb/`, `postgres/`, `presto_trino/`, `sqlserver/` | what only that database has: its functions, native types, table-path syntax |
| `test_tools/` | `TestSelect` and the result matchers |
| `malloy_npm/` | the published packages themselves: circular imports across `packages/` |

A named Malloy feature that behaves its own way on one database goes in the feature's directory, in that database's file: `time/time.db-postgres.spec.ts`.

## The test database

`test/src/test_database.ts` is the harness. It builds on `test/src/core_database.ts`, which holds the pieces that import nothing from beside them, so the renderer's tests can import that file directly.

- **`testDatabase`** is this run's database: the stand-in (`duckdb`) in a plain spec, `MALLOY_DATABASE` in a database file. `.name` is its name in the test config, `.dialect` its dialect and `.canStream` whether its connection streams (both from `databases.ts`, checked against the connection on the first query), `.runtime` a `Runtime` whose one connection is named `db`. All of these are available while the file loads, so they can gate tests with `test.when`; the connection is made on the first query. `await testDatabase.connection()` returns the connection for a test that runs SQL on it directly. Call `afterAll(() => testDatabase.shutdown())` in any file that uses it.
- **`coreDatabase()`** is a new read-only DuckDB connection on the test data, for a run-once test that depends on DuckDB itself. Same shape; `connection()` returns the `DuckDBConnection`. Shut it down the same way. A test that writes builds its own `DuckDBConnection`.
- `wrapTestModel(testDatabase, source)` and `mkTestModel(testDatabase, sources)` (from `@malloydata/malloy/test`) make a `TestModel` for the result matchers.
- A test that applies to particular databases checks `testDatabase.name` (`testDatabase.name === 'presto'`), not the dialect: `duckdb_wasm` shares DuckDB's dialect.
- An experimental dialect under test is accepted once per process when its runtime is made, so the shared files carry no `##! experimental.dialect.NAME` lines. What CI runs for an experimental dialect is set by `dbAllPassing`/`dbAllSkip` in `databases.ts`; see [adding-a-new-database.md](../packages/malloy/src/doc/adding-a-new-database.md).
- The connection is built from `malloy-config.json` through the connection registry. The `duckdb_wasm` entry builds the Node WASM class through a registration that exists only in the harness, since the registered type builds the browser class. Likewise the `postgres` entry builds `PooledPostgresConnection`: the registered type's unpooled connection opens a session per query, so the temporary table `model.search()` makes is gone before the query that reads it. The pooled connection passes only because tests run one query at a time and reuse one session.
- The `motherduck` entry has never been run. It passes no token and relies on DuckDB reading `MOTHERDUCK_TOKEN` from the environment, which is what `db-motherduck.yaml` sets; `npm run dbtest motherduck` with a real token is the check.

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
`TestModel` (`{model, dialect}`) — `wrapTestModel(testDatabase, source)` makes one from
the test database, or `mkTestModel(testDatabase, ...)` to define inline data.

**Usage:**
```typescript
const tm = wrapTestModel(testDatabase, '');      // or mkTestModel(...)
await expect(`run: db.table('malloytest.state_facts') -> { ... }`)
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
test.when(testDatabase.dialect.supportsNestedProjectionLimit)(
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

### PostgreSQL, MySQL, Trino, Presto, SQL Server
These databases require Docker containers to be running.

**Starting database containers:**
Each database has a startup script in the test directory:
- `test/postgres/postgres_start.sh`
- `test/mysql/mysql_start.sh`
- `test/trino/trino_start.sh`
- `test/presto/presto_start.sh`
- `test/mssql/mssql_start.sh`

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

## Test Data

### The test corpus

The shared cross-database parquet files live in `test/data/malloytest-parquet/` (~15 MB, checked into git). They are the only description of the test data: every database is loaded from them by a script in the repo (BigQuery excepted, see below). When the parquet changes, the loaders run again; there is no dump to edit. DuckDB-only files remain in `test/data/duckdb/`.

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

Tests reference tables as `db.table('malloytest.{table}')` (schema-qualified). Every dialect must create a `malloytest` schema containing these tables with matching data.

### How each dialect loads test data

| Dialect | Method | Files | Notes |
|---|---|---|---|
| DuckDB | DuckDB `CREATE TABLE AS SELECT FROM read_parquet()` | `test/duckdb/load_test_data.sh` (wraps `load_test_data.ts`) | Run via `sh test/duckdb/load_test_data.sh` (or `npm run build-duckdb-db`). Creates `test/data/duckdb/duckdb_test.db` |
| PostgreSQL | DuckDB's `postgres` extension: `ATTACH` the server, `CREATE TABLE AS SELECT FROM read_parquet()` | `test/postgres/load_test_data.sh` (wraps `load_test_data.ts`) | Run by `test/postgres/postgres_start.sh` and by CI against a running server; connects with the `PG*` variables. No `ga_sample` (no anonymous record type) |
| MySQL | DuckDB's `mysql` extension, likewise | `test/mysql/load_test_data.sh` (wraps `load_test_data.ts`) | Run by `test/mysql/mysql_start.sh`; connects with the `MYSQL_*` variables. No `ga_sample`, and `alltypes` without its array columns |
| SQL Server | DuckDB's community `mssql` extension, likewise | `test/mssql/load_test_data.sh` (wraps `load_test_data.ts`) | Run by `test/mssql/mssql_start.sh`, which sets the `MSSQL_*` variables for the loader; the `sqlserver` and `mssql_via_duckdb` entries in `test/src/malloy-config.json` read the same variables. Waits for the server itself. Same table set as MySQL. In CI, `db-sqlserver.yaml` runs the same script on SQL Server 2017, the oldest the dialect supports |
| Trino/Presto | The hive connector reads the parquet in place: each file is mounted into the container and declared as an external table | `test/trino/hive_ddl.ts`, `test/trino/hive.properties`, `test/presto/hive.properties` | `trino_start.sh` / `presto_start.sh` derive the DDL from the parquet schemas at container start. The hive metastore lowercases names, so a table with nested columns (`ga_sample`) is a `_hive` table plus a view that casts the nested field names back; top-level column names stay lowercase, since Trino lowercases those in every connector |
| BigQuery | Pre-loaded manually in `malloydata-org` project | (none) | No loader script in repo. Data assumed to exist. |
| Snowflake | SQL: `PUT` local parquet → stage, `COPY INTO` table | `test/snowflake/load_test_data.sh` (wraps `load_test_data.sql`) | Run via `sh test/snowflake/load_test_data.sh` (needs the `snowsql` CLI) |
| Databricks | TS script: upload to Volume via REST, `CREATE TABLE AS SELECT FROM read_files()` | `test/databricks/load_test_data.sh` (wraps `load_test_data.ts`) | Run manually with the `DATABRICKS_*` env vars set: `sh test/databricks/load_test_data.sh`. From a network that reaches the workspace only through a proxy, `DATABRICKS_HTTPS_PROXY` is the connection's `proxy` setting for the tests and `diag_databricks.ts`; the loader uploads with `fetch`, which does not use it |

The DuckDB-driven loaders share `test/data/parquet_loader.ts`, which runs everything through Malloy's own `DuckDBConnection`, so a database is built by the same DuckDB the tests read it with. It reads the table list from the parquet directory and takes a `LoadPlan` naming what a target cannot hold.

### The flights timestamps

`flights.dep_time` and `arr_time` are UTC instants whose digits are the local clock at the departure and arrival airport. The source recorded each airport's wall clock and the zone was not kept, so a 6:45 pm departure from LAX is the instant 18:45 UTC. The parquet declares them so (`tz=UTC`), every dialect holds them as instants, and under Malloy's UTC session pin every dialect renders the airport clock. An instant is the one time type every dialect can hold; Malloy has no wall-clock type, and several dialects have none either. Elapsed time between the two columns is not computable from them on a route that crosses zones; `flight_time`, `taxi_out` and `taxi_in` carry it.

A loader must carry the instant through unchanged. Malloy's `DuckDBConnection`, which the loaders run through, pins its session zone to UTC, so a target without a zoned type (MySQL `datetime`) receives the same digits, where a loader in the machine's zone would shift them. Trino and Presto read the parquet's UTC microseconds directly.

### Cloud warehouse considerations

Cloud SQL warehouses (BigQuery, Snowflake, Databricks) can't read local files via SQL. Each needs a mechanism to get parquet data into the warehouse:
- **Snowflake**: `PUT` uploads local files to a stage, then `COPY INTO` reads from the stage
- **BigQuery**: Data pre-loaded (could use `bq load` from local parquets)
- **Databricks**: Uploads parquets to a Unity Catalog Volume via REST API, then `CREATE TABLE AS SELECT FROM read_files()` to create tables

An ideal future state would be publishing the parquets to a well-known cloud storage location that all warehouses could read from, but the hosting/cost question is still open.

## Authoring Malloy source from JavaScript

When a test programmatically constructs Malloy source (e.g. injecting adversarial values for escape testing), be aware that Malloy has several string-literal forms with different escape rules. The `r'...'` and `/.../` regex forms — and all triple-quoted strings — are *raw*: backslash is preserved verbatim, no escape processing. Doubling backslashes on the JavaScript side will produce a different string than intended.

The full table is in [`../packages/malloy/src/lang/CONTEXT.md`](../packages/malloy/src/lang/CONTEXT.md) under "String literal forms". `test/src/quoting/` holds a worked example.

## Important Notes

- Cross-database tests are critical for verifying Malloy's dialect abstraction
- Custom matchers help handle legitimate database differences
- Database setup scripts must be run before database-specific tests
- CI has access to more databases than typical development environments
- Test data should be committed to the repository (except for large binary files)
