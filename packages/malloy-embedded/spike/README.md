# SPIKE: the Foundation API in an embedded engine

Question: can a host such as the malloy-duckdb extension use Malloy's real
host API (`Runtime`, `URLReader`, `Connection`, `CacheManager`,
`extendModel`) inside QuickJS, instead of the JSON-string wrapper around
the experimental `API.stateless` that `src/index.ts` exposes?

Answer: yes. See the numbers below.

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
