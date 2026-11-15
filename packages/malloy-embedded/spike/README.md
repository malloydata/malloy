# SPIKE: the Foundation API in an embedded engine

Question: can a host such as the malloy-duckdb extension use Malloy's real
host API (`Runtime`, `URLReader`, `Connection`, `CacheManager`,
`extendModel`) inside QuickJS, instead of the JSON-string wrapper around
the experimental `API.stateless` that `src/index.ts` exposes?

Answer: yes. The extension's own test suite (`test/sql/malloy.test`,
66 statements) passes on the Foundation API, inside DuckDB, and repeat
compiles take a third of the time. See "In the extension" below.

## What the spike adds

- `src/runtime.ts` builds a second bundle, `dist/malloy-runtime.js`, which
  sets `globalThis.malloy` to `{Runtime, CacheManager, InMemoryModelCache,
  InMemoryURLReader, MalloyError, DuckDBCommon, HostDuckDBConnection,
  version}`.
- `src/host_duckdb_connection.ts`: `HostDuckDBConnection extends
  DuckDBCommon`. The host gives it only `query(sql) -> rows`, synchronously.
  Schemas (DESCRIBE), the type mapping and the schema cache are
  `DuckDBCommon`'s, the same code the Node and WASM connections use, so
  `duckdbSchema` is no longer needed.
- `malloy-db-duckdb` exports `./common` (`DuckDBCommon`) so that the
  bundle can reach it.
- `packages/malloy/src/model/persist_utils.ts` gets a one-line rewrite with
  the same meaning: QuickJS cannot compile `for (const id of yield* part)`.
  It fails with "stack underflow (op=110)" in QuickJS-ng and in Bellard
  QuickJS (the quickjs-emscripten 0.32.0 builds). The bundle that
  malloy-duckdb ships contains that line too, so check whether the
  QuickJS-ng commit the extension pins hits it.
- `spike/driver-foundation.js` shows what malloy-duckdb's `js/driver.js`
  becomes. There is no needs loop. It keeps one `Runtime` alive and builds
  the session model with `extendModel`. `listSources` uses the public
  `Explore` API, not the IR.

## Running it

    cd packages/malloy-embedded && npm run dev
    cd spike && npm install
    node duck.cjs test.db "CREATE TABLE flights AS ...; ..."   # tables from malloy-duckdb test/sql/malloy.test
    MALLOY_DUCKDB=/abs/path/to/malloy-duckdb node harness.mjs  # Foundation
    MALLOY_DUCKDB=/abs/path/to/malloy-duckdb node baseline.mjs # the PR's bundle + the extension's driver.js

The harnesses run the bundle in QuickJS-ng compiled to WASM, where `Intl`
is undefined. The host functions are synchronous, and `query` runs real
DuckDB (`duck.cjs`, a child process). The Foundation calls return
Promises, and the harness drains them with `executePendingJobs()`. They
settle in one drain, with no timers and no real IO.

## Results

Each DESCRIBE here costs about 125 ms because it starts a process; inside
DuckDB it is nearly free. Host calls are counted per call.

| Call | Stateless (PR + driver.js) | Foundation (spike) |
|---|---|---|
| first query, cold | 5.0 s, 2 reads, 2 DESCRIBEs | 6.4 s, 2 reads, 2 DESCRIBEs |
| another query, same model | 446 ms, 2 reads, 2 DESCRIBEs | 28 ms, 0 reads, 0 DESCRIBEs (2 mtime checks) |
| the same query again | 367 ms, 2 reads, 2 DESCRIBEs | 20 ms, 0 reads, 0 DESCRIBEs |
| a second model whose table was seen before | 286 ms, 1 read, 1 DESCRIBE | 22 ms, 0 DESCRIBEs (schema cache) |

Repeat compiles go from about 150-200 ms of compiler work, plus every file
read and DESCRIBE again, to about 20-30 ms with no IO. Each call does
compile the query again; only the model is cached.

The following also work under Foundation in QuickJS: time literals and
filter expressions with no `Intl`, arrays of records, and the session
model through `extendModel`. In the session model, a later statement
reuses the cached `flights` schema, and errors report positions relative
to the new statement's text, so `newFromLine` is no longer needed. Errors
come back as a rejected promise with `MalloyError` problems.

## Open items

- The first compile is slow in QuickJS-WASM either way (5-6 s, mostly the
  interpreter running the compiler for the first time). Measure it in the
  native QuickJS the extension embeds.
- The C++ side has to drain jobs (`JS_ExecutePendingJob`) until the
  promise settles. The spike does this in `harness.mjs:call`.
- Invalidation keys: the host's `mtime(url)`. If it returns `null`, the
  model isn't cached, which is today's behaviour.
- The catalog moves to the extension, built on `Explore` and `Field`.
  `describe()` in `driver-foundation.js` is a start. It still needs source
  filters, field definitions and grain; any of those missing from the
  public API should be added to Foundation.
- `HostDuckDBConnection` belongs in `malloy-db-duckdb`, next to the Node
  and WASM connections.

## In the extension

`malloy-duckdb.patch` (against lloydtabb/malloy-duckdb 479c5aa) ports the
extension to this bundle:

- `js/driver.js` keeps one `Runtime` and a `HostDuckDBConnection` whose only
  SQL is `DESCRIBE SELECT * FROM x`, answered by the existing
  `__malloyHost.describe`. There is no needs loop and no `duckdbSchema`.
  `define` (adding to the session model) is `extendModel`, so error
  positions are relative to the new statement. `compile` is
  `PreparedResult.toStableResult()`. The catalog still comes from
  `catalogOf(modelDef)`.
- Models are cached across statements. A cached model records the files it
  read and the DESCRIBE output of every table and SQL source it used; a hit
  reads and describes them again, which costs little inside DuckDB, and
  recompiles if anything differs. Foundation's `CacheManager` can't do this:
  its invalidation keys cover files only, and in DuckDB a table can change
  between statements (`CREATE OR REPLACE`) or exist only in one connection
  (a temporary table). That is a gap worth fixing in Foundation.
- `src/malloy_engine.cpp`: `Call` drains the job queue
  (`JS_ExecutePendingJob`) when the driver returns a Promise. About 30
  lines.
- `CMakeLists.txt` embeds `js/malloy-runtime.js` (copied from
  `dist/malloy-runtime.js`) in place of `js/malloy-embedded.js`.

Built with `scripts/quick-build.sh` (DuckDB v1.5.6, QuickJS-ng d7215b0):

- `scripts/run-tests-cli.py`: 66/66 pass, the same as the unmodified
  extension.
- `malloy_sql(...)` (compile only) against an installed model with a join,
  timed by the DuckDB CLI over 10 different queries: about 105 ms each
  before, about 33 ms each after.
- After `CREATE OR REPLACE TABLE flights AS SELECT *, 1 AS extra FROM
  flights`, a query grouping by `extra` compiles (100 ms, a recompile), so
  the cache notices schema changes.
- Cold start (the first Malloy statement in a process): about 3 s both
  ways, from loading the bundle and running the first compile.

The pinned QuickJS-ng compiles `for (const id of yield* part)` without
trouble, so the persist_utils.ts rewrite above is needed only for the older
QuickJS in the npm WASM builds.
