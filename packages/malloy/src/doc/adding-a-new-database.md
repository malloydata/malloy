# Adding a New Database Type to Malloy

Integrating a new database into Malloy requires two components: a **Dialect** that generates SQL for that database, and a **Connection** that communicates with it. The Dialect lives in `packages/malloy/src/dialect/{name}/`; the Connection gets its own package at `packages/malloy-db-{name}/`.

This guide draws on the experience of adding the Databricks dialect. We're happy to help — reach out on [Slack](https://malloy-community.slack.com/).

## Layout

```
packages/malloy/src/dialect/{name}/     ← Dialect (SQL generation)
packages/malloy-db-{name}/             ← Connection (database communication)
.github/workflows/db-{name}.yaml       ← CI workflow
test/src/databases.ts, malloy-config.json ← Test database entry
test/{name}/                            ← Data loader, container start/stop scripts
```

## Step 1: Implement the Dialect

The Dialect translates Malloy's intermediate representation into SQL for your database. See [dialect CONTEXT.md](../dialect/CONTEXT.md) for how the function template system works.

Start by copying a dialect close to your target — Databricks, for instance, began as a fork of the Trino dialect.

### Files to create

Create `packages/malloy/src/dialect/{name}/` with four files:

1. **`{name}.ts`** — A class extending `Dialect`. This is the bulk of the work.
   - Set boolean capability flags: `experimental`, `supportUnnestArrayAgg`, `supportsAggDistinct`, `supportsCTEinCoorelatedSubQueries`, etc. Start with `experimental = true` — experimental dialects aren't required to pass the full test suite, and a model file must carry `##! experimental.dialect.{name}` to use one. The test harness accepts the dialect under test for the whole run, so the shared suites need no such line.
   - Implement `sqlTypeToMalloyType()` to map your database's types to Malloy types.
   - Implement the SQL-generation methods: `sqlGroupSetTable`, `sqlAnyValue`, `sqlAggregateTurtle`, `sqlSumDistinctHashedKey`, `sqlGenerateUUID`, `sqlDateToString`, `sqlAlterTime`, `sqlCast`, `sqlRegexpMatch`, `sqlLiteralTime`, and others. The abstract base class makes it clear which are required.
   - Implement `getDialectFunctionOverrides()` and `getDialectFunctions()`.

2. **`function_overrides.ts`** — Overrides for standard library functions whose SQL differs in your database. Export a `MalloyStandardFunctionImplementations` object. You only need entries for functions that don't work with the default SQL.

3. **`dialect_functions.ts`** — Functions unique to your dialect. Export a `DefinitionBlueprintMap`. Prefer the `def()` shorthand and `T` convention for simple functions (see [dialect CONTEXT.md](../dialect/CONTEXT.md)).

4. **`index.ts`** — Barrel export.

### Register the dialect

- Import and register the class in `dialect_map.ts`
- Export it from `packages/malloy/src/dialect/index.ts` and `packages/malloy/src/index.ts`

### Decisions you'll face early

**Type mapping** (`sqlTypeToMalloyType`): Pay attention to timestamps. Malloy has `timestamp` (UTC wallclock) and `timestamp_tz` (with embedded offset). "Wallclock with no timezone" types (Spark's `TIMESTAMP_NTZ`, BigQuery's `DATETIME`) should map to `sql native` — Malloy doesn't support them natively. Also watch `DECIMAL`/`NUMERIC` precision and complex types (arrays, structs, maps), which every database represents differently in schema metadata.

**Nesting** (`sqlAggregateTurtle`): How does your database aggregate rows into arrays of structs? Most use `JSON_AGG` or `ARRAY_AGG`; Databricks uses `COLLECT_LIST(NAMED_STRUCT(...))`. Ordering within nested results is where things get tricky — some databases support `ORDER BY` inside the aggregate function, others need `ARRAY_SORT` or similar.

**Symmetric aggregates** (`sumDistinctByHash`): Malloy sums a value across a fanned-out join by adding each value to a hash of its row's key, so that `SUM(DISTINCT)` folds exactly the rows the join repeated. `Dialect.sqlSumDistinct` writes that SQL; your dialect supplies the hash in `sqlSumDistinctHashedKey` and says in `sumDistinctByHash` how a value fits beside it. If a sum of your hashes needs every digit of your widest exact decimal, use `form: 'shifty'` and return the hash as an integer below 2^92 typed `DECIMAL(38,0)`, as Trino, Databricks and Snowflake do; `dialect/shifty_sum_distinct.ts` explains the method and states its limits. Say in `roundsWideProducts` whether your database rounds a decimal product too wide for 38 digits, as Databricks and Trino do, or fails, as Presto and Snowflake do. If one decimal type holds that sum with fractional digits to spare, use `{form: 'direct', decimalType}` and return the hash in that type: MySQL has a 65 digit decimal, SQL Server hashes to 64 bits, and BigQuery scales its hash down. `resultType` casts the sum to the type your connection reads a number in. A database which can sum distinct rows without a hash overrides `sqlSumDistinct` itself, as DuckDB does.

**NULL ordering**: Malloy expects NULLS LAST for ascending order. If your database defaults otherwise, override `sqlOrderBy()`.

**Booleans** (`booleanType`): If your database has conditions but no boolean value, set `booleanType = 'none'`; [boolean-none.md](boolean-none.md) says what Malloy then accepts and refuses. `sqlTypeToMalloyType` maps no type to boolean. A standard library function with a boolean result is written as a condition in `function_overrides.ts`: `starts_with(carrier, 'A')` is `LEFT(carrier, LEN('A')) = 'A'`. The base `Dialect` writes `true` and `false` as `(1=1)` and `(1=0)`.

## Step 2: Implement the Connection

Create `packages/malloy-db-{name}/`. See [connection CONTEXT.md](../connection/CONTEXT.md) for the interface hierarchy and implementation patterns.

### Files to create

1. **`package.json`** — Depend on `@malloydata/malloy` and your database's client SDK. Copy the `repository` field and the `test` script from another `malloy-db-*` package: publishing requires the first, and the second checks that the database is reachable before it runs the package's tests.
2. **`tsconfig.json`** — Reference `../malloy` as a project dependency.
3. **`src/index.ts`** — Self-register via `registerConnectionType()` with a `displayName`, `factory`, and `properties` array describing config fields (host, token, etc.).
4. **`src/{name}_connection.ts`** — Extend `BaseConnection`. Implement `runSQL()`, `fetchTableSchema()`, `fetchSelectSchema()`, and `close()`.
5. **`src/{name}_connection.spec.ts`** — Tests for schema reading, data hydration, and type mapping.

### Wire it into the monorepo

- Add to `packages/malloy-connections/` (`package.json`, `src/index.ts`, `tsconfig.json`)
- Add to root `package.json` workspaces and root `tsconfig.json` references
- Add a line for your database to the remedy map in `scripts/check_dialect_connection.ts`, which the package's `test` script calls

The root `workspaces` entry is what publishes the package: the next release sends every workspace package to npm. A package name npm has never seen must be created there, and given a trusted publisher, by a maintainer before that release. Say in your PR that it adds a published package. See [workflows CONTEXT.md](../../../../.github/workflows/CONTEXT.md).

### Implementation notes

**Schema fetching**: Most databases support `DESCRIBE` or dry-run queries. Map raw type strings to Malloy types via `dialect.sqlTypeToMalloyType()`. For complex types you'll likely need a type-string parser — see [`TinyParser`](../dialect/tiny_parser.ts) in `@malloydata/malloy/internal`. The class comment is the reference for token rules and parser helpers.

**Async initialization**: You can't `await` in a constructor. Use the standard pattern: store an `init()` promise in the constructor, `await` it at the top of every public method.

**Error convention**: `fetchTableSchema()` and `fetchSelectSchema()` return `StructDef | string`. Return a string for expected errors (table not found, bad SQL) rather than throwing.

**setupSQL**: Support the `setupSQL` config property (SQL run at connection init). Include it in `getDigest()` since it can affect query results.

**Descriptions**: If the database stores table and column descriptions (comments), register `dbmetaProperty` and, when it is on, spread `dbmetaAnnotations({description})` (both from `@malloydata/malloy/connection`) into each field def, nested ones included, and into the table's `TableSourceDef`. Leave it out of `getDigest()`.

## Step 3: Set Up Test Data

All cross-database tests share parquet files in `test/data/malloytest-parquet/`. You need to load these into your database as tables in a `malloytest` schema. See [test CONTEXT.md](../../../../test/CONTEXT.md) for the full data inventory and how each existing dialect loads its data.

Cloud warehouses can't read local files via SQL, so you'll need an upload mechanism — Snowflake uses stages, Databricks uses Unity Catalog Volumes via REST API.

### Required tables

`aircraft`, `aircraft_models`, `airports`, `alltypes`, `carriers`, `flights`, `state_facts`, `ga_sample` — all in a `malloytest` schema.

A database that runs in a container gets `test/{name}/{name}_start.sh` and `{name}_stop.sh`. Start creates the container and loads the tables, so one command gives anyone a working test database, and CI runs the same script.

### Test database entry

Add your database to `test/src/malloy-config.json` with the bare minimum needed to make its connection, and to `test/src/databases.ts` with its dialect, `canStream` and `connectionTests` glob. Import the package in `test/src/test_database.ts`, which registers its connection type, and add it to `test/package.json`'s dependencies. The rules for both files, and for which tests run where, are in the Testing section of the [root CONTEXT.md](../../../../CONTEXT.md#testing).

## Step 4: Set Up CI

A dialect that ships as a published package has CI coverage of the parts it claims work. How much, and which tests, is decided per dialect.

Depending on the state of the experimental dialect, it may be necessary for the dialect to be published
before it is complete. Here's how we handled this for SQL Server, so that we could catch any breakages
of known working pieces of the dialect, while making progress towards full support. This maybe isn't the
only way to solve this problem, and if this doesn't work for the next experimental dialect, we will
have to figure something else out.

Support can be partial. `dbAllPassing` in the database's `databases.ts` entry lists the `db-all` files CI runs on it (globs, from `test/src`); `dbAllSkip` lists the ones it leaves out. `npm run dbtest {name}` runs exactly what CI runs: the connection tests, the `db-{name}` files, and the `db-all` files those lists allow. Start with `dbAllPassing: []`, so CI runs only the connection tests and the database's own files, and add files as they pass; CI must stay green. `MALLOY_DATABASE={name} npm test` runs every `db-all` file regardless, which is the inventory of what the dialect can't do yet: run it by hand and expect failures, which shrink as features land (Step 5).

Create `.github/workflows/db-{name}.yaml` by copying an existing one: `db-postgres.yaml` for a database that runs in a container, `db-snowflake.yaml` for one reached with a credential.
- `workflow_call` trigger, declaring any secrets it needs, and `permissions: {}`
- Steps: download and unpack the `workspace` artifact, set up Node, start or load the database, `npm run dbtest {name}`

In `run-tests.yaml`, add a job that calls your workflow with `needs: pull_and_build`, and add it to the `malloy-tests` needs list so the gate job waits for it. A job that receives secrets also needs `check-permission`. [workflows CONTEXT.md](../../../../.github/workflows/CONTEXT.md) is the authority on what a CI job may do and why.

A pull request from a fork runs the workflow files on `main`, not its own, so the new job does not appear in that PR's checks. A maintainer runs it before merging.

## Step 5: Iterate on Test Failures

With `experimental = true`, not all tests need to pass. Use `it.when(condition)` to skip tests for known limitations — this keeps skipped tests visible in output rather than silently absent.

Useful capability flags for gating tests:
- `testDatabase.dialect.supportsAggDistinct` — fanout aggregates
- `testDatabase.dialect.supportUnnestArrayAgg` — nesting
- `testDatabase.dialect.hasTimestamptz` — timestamptz type support

### Where to expect trouble

**Nesting** is the hardest area. Every database has different syntax for aggregating into arrays of structs and ordering within them. Budget time here.

**String aggregation ordering**: Some databases support `ORDER BY` inside aggregate calls; others (Databricks) don't and must skip ordering or use post-hoc sorting.

**Timestamp semantics**: Malloy's `timestamp` is UTC wallclock time. Verify your database's timestamp type aligns, and map wallclock-no-timezone types to `sql native`.

**LIKE escape**: Some databases treat `\` as an escape character in LIKE patterns by default; others don't. Override `sqlLikeEscape()` if needed.

**NULL ordering**: Check your database's default NULL sort position against Malloy's expectation (NULLS LAST for ASC, NULLS FIRST for DESC).

## Moving from Experimental to Fully Supported

When every `db-all` file passes, remove `experimental = true` and remove `dbAllPassing` from the database's entry:
- Users won't need `##! experimental.dialect.{name}` in their model files
- CI will run the complete test suite against your dialect
- The Malloy team will maintain your dialect as part of ongoing refactors
