# Malloy Internal API Overview

This document describes the layered API architecture in Malloy, from the internal compiler machinery up through the various public API styles.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PUBLIC API LAYERS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐      │
│  │ Foundation  │   │  Stateless  │   │  Sessioned  │   │ Asynchronous│      │
│  │    API      │   │    API      │   │    API      │   │    API      │      │
│  │             │   │             │   │             │   │             │      │
│  │ Runtime     │   │ compileModel│   │ compileModel│   │ compileModel│      │
│  │ Model       │   │ compileQuery│   │ compileQuery│   │ compileQuery│      │
│  │ PreparedQry │   │             │   │ +sessions   │   │ +auto-fetch │      │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘      │
│         │                 │                 │                 │             │
│         │                 └────────┬────────┴─────────────────┘             │
│         │                          │                                        │
│         │                          ▼                                        │
│         │                 ┌─────────────────┐                               │
│         │                 │    Core API     │                               │
│         │                 │                 │                               │
│         │                 │ statedCompile   │                               │
│         │                 │ Model/Query()   │                               │
│         │                 └────────┬────────┘                               │
│         │                          │                                        │
└─────────┼──────────────────────────┼────────────────────────────────────────┘
          │                          │
          │    ┌─────────────────────┘
          │    │
          ▼    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTERNAL COMPILER (IR)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐         ┌──────────────────────┐                  │
│  │   MalloyTranslator   │         │     QueryModel       │                  │
│  │   (src/lang/)        │         │   (src/model/)       │                  │
│  │                      │         │                      │                  │
│  │ Source text → IR     │         │ IR → SQL             │                  │
│  │ (ModelDef, Query)    │         │                      │                  │
│  └──────────────────────┘         │  .compileQuery()     │                  │
│                                   │       │              │                  │
│                                   │       ▼              │                  │
│                                   │  ┌────────────┐      │                  │
│                                   │  │ QueryQuery │      │                  │
│                                   │  │            │      │                  │
│                                   │  │ SQL gen    │      │                  │
│                                   │  └────────────┘      │                  │
│                                   └──────────────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Internal Compiler (IR)

**Location:** `packages/malloy/src/model/` and `packages/malloy/src/lang/`

These are the actual compiler internals that do the work. Not a public API.

### MalloyTranslator (`src/lang/`)
- Parses Malloy source text into IR types (`ModelDef`, `Query`, `SourceDef`, etc.)
- Runs as a sequence of named steps (`ParseStep` → `ImportsAndTablesStep` → `ASTStep` → `TranslateStep`, plus IDE-facing steps); synchronous, so async fetches happen through a `translate()` ↔ `update(ParseUpdate)` pause-and-resume protocol
- `translate()` returns either the final `ModelDef`, a `DataRequestResponse` listing `urls` / `tables` / `compileSQL` / `connectionDialects` it needs, or errors
- See [`../lang/CONTEXT.md`](../lang/CONTEXT.md) for the step machinery, the needs protocol, and the AST integration entry points (`DocStatement.execute`, `ExpressionDef.getExpression`)

### QueryModel (`src/model/query_model_impl.ts`)
- Takes a compiled `ModelDef` and compiles queries to SQL
- Entry point: `new QueryModel(modelDef).compileQuery(query)`
- Internally creates `QueryQuery` instances

### QueryQuery (`src/model/query_query.ts`)
- The actual SQL generation engine
- Created via `QueryQuery.makeQuery()` factory
- Subclasses: `QueryQueryProject`, `QueryQueryReduce`, `QueryQueryIndex`, `QueryQueryRaw`
- Key method: `generateSQLFromPipeline()` → produces SQL string + output schema

### IR Types (`src/model/malloy_types.ts`)
- `ModelDef` - compiled model with sources, queries, exports
- `Query` - internal query representation with `structRef`, `pipeline`, filters
- `SourceDef` - source/explore definition
- `TurtleDef` - view/query definition within a source

---

## Layer 2: Foundation API

**Location:** `packages/malloy/src/api/foundation/`

The fluent object-oriented API. The primary way to work with Malloy programmatically.

For the configuration pipeline internals (three states, section compilers, overlay resolution, failure modes), see [foundation/CONTEXT.md](foundation/CONTEXT.md). For the user-facing view of configuration, see [../doc/configuration.md](../doc/configuration.md).

### File Structure

| File | Contents |
|------|----------|
| `types.ts` | `Loggable`, `ParseOptions`, `CompileOptions`, `CompileQueryOptions` |
| `readers.ts` | `EmptyURLReader`, `InMemoryURLReader`, `FixedConnectionMap`, helpers |
| `cache.ts` | `ModelCache`, `CacheManager`, `CachedModel`, `InMemoryModelCache` |
| `document.ts` | `Parse`, `DocumentSymbol`, `DocumentRange`, `DocumentPosition`, `DocumentCompletion` |
| `core.ts` | `Model`, `PreparedQuery`, `PreparedResult`, `Explore`, Field classes, enums |
| `result.ts` | `Result`, `DataArray`, `DataRecord`, scalar Data classes |
| `writers.ts` | `WriteStream`, `DataWriter`, `JSONWriter`, `CSVWriter` |
| `runtime.ts` | `Runtime`, Materializers, `FluentState` |
| `config.ts` | `MalloyConfig`, `Manifest` |
| `config_overlays.ts` | `Overlay`, `ConfigOverlays`, `envOverlay`, `contextOverlay`, `defaultConfigOverlays` |
| `config_compile.ts` | Schema-directed compiler: POJO → `ConfigDict`/`ConfigLiteral`/`ConfigReference` tree |
| `config_resolve.ts` | Walks the compiled tree against a `ConfigOverlays` dict → `ResolvedConfig` POJO |
| `config_discover.ts` | URL-walking `discoverConfig()` helper for local hosts — returns a built `MalloyConfig` |
| `compile.ts` | `Malloy` static class, `MalloyError` |
| `index.ts` | Barrel file re-exporting everything |

### Classes

| Class | Purpose |
|-------|---------|
| `Runtime` | Entry point. Holds connections, URL reader, and optional `buildManifest`. Creates `ModelMaterializer`s. |
| `Model` | Wraps `IR.ModelDef`. Provides access to explores, queries, preparedQuery. Use `getContent(name)` for safe contents lookup (backed by a `Map`, immune to prototype pollution). |
| `Explore` | Wraps `IR.SourceDef`. Provides field introspection and schema access. |
| `PreparedQuery` | Wraps `IR.Query` + a `Model` reference. Defers SQL generation until needed. |
| `PreparedResult` | Holds generated SQL + schema. Ready to execute. |
| `PersistSource` | Wraps a persistable source definition. Provides SQL compilation for persistent sources. |
| `Result` | Query result with data + schema + metadata. |

### Reading annotations

Every class above implements `Taggable` and exposes annotations through an
`annotations` view (`packages/malloy/src/api/foundation/annotation.ts`):

```ts
model.annotations.parseAsTag()           // empty route — renderer tags
field.annotations.parseAsTag('docs')     // route `docs`, parsed as MOTLY
field.annotations.texts('!')             // raw strings on the `!` route
field.annotations.forRoute('vite')       // text + source offsets, BYO parser
```

`.annotations` sees both single-line and multi-line annotations and routes
by the prefix grammar in
[`src/lang/annotation-prefix.ts`](../lang/annotation-prefix.ts). The legacy
`tagParse({prefix: RegExp})` and `getTaglines(RegExp)` methods are
`@deprecated` and cannot see multi-line annotations — migrate to the view.

For callers that hold a flat `Malloy.Annotation[]` (the stable wire shape
from `@malloydata/malloy-interfaces`) rather than a Foundation entity, the
same route grammar is exposed through free helpers in
[`api/annotation-utils.ts`](./annotation-utils.ts):
`routeOf` / `payloadOf` / `annotationsForRoute` / `tagFromAnnotations`.

### Flow: Load Model → Get SQL for Named Query

```
runtime.loadModel(url)
  └→ ModelMaterializer (lazy)
       └→ Model (wraps IR.ModelDef)
            └→ model.preparedQuery  OR  model.getPreparedQueryByName(name)
                 └→ PreparedQuery (wraps IR.Query + IR.ModelDef)
                      └→ preparedQuery.getPreparedResult()
                           └→ model._queryModel (cached)
                                └→ queryModel.compileQuery(query)
                                     └→ IR.QueryQuery.makeQuery()
                                          └→ generateSQLFromPipeline()
                           └→ PreparedResult (has SQL)
```

### Characteristics
- Direct access to IR types (`model._modelDef`, `preparedQuery._query`)
- Stateful objects that hold compiled state
- Lazy evaluation via Materializers
- QueryModel cached at Model level for digest persistence

### Creating a Runtime

**Minimal** — just a connection:
```typescript
const runtime = new Runtime({connection: myConnection});
```

**With config** — build a `MalloyConfig` directly, or use `discoverConfig()` for filesystem-style discovery. `discoverConfig()` walks up from a start URL to a ceiling, finds `malloy-config.json` (and optional `malloy-config-local.json`), and returns a fully-constructed `MalloyConfig` with the right `config` overlay already wired:
```typescript
import '@malloydata/malloy-connections'; // registers connection factories
import {
  MalloyConfig,
  Runtime,
  discoverConfig,
} from '@malloydata/malloy';

const config = await discoverConfig(startURL, ceilingURL, urlReader);
if (!config) throw new Error('No malloy-config.json found');

// Or purely sync from a JSON string (no discovery, no overlays):
// const config = new MalloyConfig(configJsonText);

const runtime = new Runtime({config, urlReader});

// Queries automatically resolve persist sources against the manifest.
// The first persistence query lazily reads MANIFESTS/malloy-manifest.json
// (relative to the discovered config file) via `urlReader`. A missing or
// malformed file is a soft miss — no substitution happens, no error thrown.
const result = await runtime.loadQuery(modelURL).run();

// Pass empty manifest to get unsubstituted SQL
import {EMPTY_BUILD_MANIFEST} from '@malloydata/malloy';
const rawSQL = await runtime.loadQuery(modelURL, {buildManifest: EMPTY_BUILD_MANIFEST}).getSQL();
```

**Layering extra overlays on discovery** — pass a `session` (or any other) overlay to `discoverConfig` and it merges on top of the `config` overlay discovery built. Replacing the `config` entry directly clobbers `rootDirectory`/`configURL`, so callers that want both should skip discovery and build `MalloyConfig` by hand.

```typescript
const config = await discoverConfig(startURL, ceilingURL, urlReader, {
  session: sessionOverlay(request),
});
```

**Manifest can also be set explicitly** — bypass the auto-read entirely by passing `buildManifest:` to the `Runtime` constructor or via the setter after construction:
```typescript
const runtime = new Runtime({config, urlReader, buildManifest: explicitManifest});
// ... or later ...
runtime.buildManifest = explicitManifest;
```
Explicit `buildManifest` always wins over the auto-read.

### Config and Manifest Classes

| Class | Purpose |
|-------|---------|
| `MalloyConfig` | Synchronous wrapper around a config POJO or JSON string. Constructor pipeline: normalize input → compile to typed tree → merge config overlays → `prepareConfig()` extracts top-level sections and fabricates default-connection entries → `buildManagedLookup()` packages the compiled connection subtrees plus overlays into a `ManagedConnectionLookup`. **Reference resolution and property-default application are deferred to `lookupConnection()`** (async), so overlays that touch IO (secret stores, session reads) have a natural async seam. Construction stays sync and zero-IO. Exposes `connections`, `virtualMap`, `manifestPath`, `manifestURL`, and validation `log` (populated incrementally as lookups occur). `wrapConnections()` decorates the connection lookup in place. `shutdown('close' \| 'idle')` tells every cached connection what to do with its backend resources — `'close'` (default) is destructive; `'idle'` is reversible (releases file locks/sockets while keeping connection objects for lazy reattach; backends may invalidate stale cache state). Most callers should use `Runtime.shutdown(...)`, which forwards here. The legacy `releaseConnections()` is a deprecated alias for `shutdown('close')`. |
| `Manifest` | Standalone in-memory manifest store with no IO, used by builders. `loadText(json)` parses a manifest JSON string directly. `update()` and `touch()` for builders, `activeEntries` for writing. The `buildManifest` getter returns a stable `BuildManifest` reference (`{entries, strict}`) — mutations are visible without re-assignment. Not attached to `MalloyConfig`; the Runtime reads manifest files directly via `config.manifestURL`. |

**Config overlays.** Config references such as `{env: "PG_PASSWORD"}`, `{config: "rootDirectory"}`, or `{session: ["credentials", "token"]}` are resolved through a `ConfigOverlays` dict at **`lookupConnection()` time** (not at construction). The constructor merges the host-supplied overlays on top of `defaultConfigOverlays()` (which wires `env` to `process.env` and leaves `config` as a no-op) via plain spread, giving Add / Replace / Disable semantics for any overlay slot. Overlays may be sync or async (`(path) => unknown | Promise<unknown>`) — the resolver `await`s every result. References on `json`-typed connection properties are **never** interpreted — the value passes through literally. One sync-only carve-out: `config.configURL` is peeked synchronously at construction time to compute `manifestURL`; an async `configURL` triggers a loud warning on `config.log` rather than silently dropping persistence.

**Discovery.** Local hosts can use `discoverConfig(startURL, ceilingURL, urlReader, extraOverlays?)` to walk up from `startURL` toward `ceilingURL`, trying `malloy-config-local.json` and `malloy-config.json` at each level. It returns a fully-constructed `MalloyConfig` (with a `config` overlay carrying `rootDirectory` and `configURL`) or `null`. Extra overlays are merged on top via plain spread — replacing the `config` entry clobbers what discovery built, so callers that want both should read discovery's context keys back off or build `MalloyConfig` by hand. Because it takes a `URLReader`, it is browser-safe as long as the host provides a URL reader that understands its filesystem substitute.

**Manifest handling.** `MalloyConfig` stays synchronous and does no IO. It exposes `manifestURL`, computed from `manifestPath` (default: `MANIFESTS`) resolved against the `configURL` context value and joined with `malloy-manifest.json`. The `Runtime` lazily reads that URL on the first persistence query via its `URLReader`, caches the resolved promise, and soft-misses to `undefined` on missing or malformed files. Explicit `buildManifest` (constructor option or setter) always wins over the auto-read; the setter clears the cached promise so a later compile sees the new value.

`MalloyConfig` is the standard entry point for both the CLI (`malloydata/malloy-cli`) and the VS Code extension.

### Restricted-mode compilation

`ModelMaterializer.loadRestrictedQuery(text: string): QueryMaterializer` compiles `text` against the materialized trusted model with the translator's `restrictedMode` flag set. Forbidden constructs in `text` (`import`, `given:`, `##!`, `connection.table`, `connection.sql`, `name!type`, and the `sql_*` raw-SQL function family) are rejected at translate time and surface as `MalloyError` problems tagged `errorTag: 'restricted-mode'`.

The signature deliberately takes a string, not a URL: restricted text arrives from an untrusted caller as bytes the host already has in hand, so there is no host-side trust mechanism for fetching it. The method exists only on `ModelMaterializer` for the same reason — a restricted compile is meaningful only as part of the trusted-then-restricted pattern.

Two-layer enforcement, both in `packages/malloy/src/lang/`:
- **AST-level rejection** at each forbidden construct's integration method (`ImportStatement.execute`, `DefineGivens.executeList`, `ModelAnnotation.execute`, `TableMethodSource.getTableInfo`, `SQLSource.getSourceDef`, `ExprFunc.getExpression` — both for `isRaw` and for calls to the `sql_*` family). Each produces the user-visible diagnostic with the offending source text quoted.
- **Zone lock** on the four needs-bearing zones (`importZone`, `schemaZone`, `sqlQueryZone`, `connectionDialectZone`) at the top of `MalloyTranslator.translate()`. After the lock, `reference()`/`define()`/`updateFrom()` are silent no-ops, so the translator is structurally unable to ask the host for outward resources regardless of whether each AST-level rejection fires.

API-level documentation lives in the JSDoc on `ModelMaterializer.loadRestrictedQuery`.

### Non-throwing validation

`QueryMaterializer.validate(options?)` and `ModelMaterializer.validate()` return `Promise<LogMessage[]>` — empty array means clean compile, otherwise the array carries structured problems (`code`, `severity`, optional `at: DocumentLocation`). The query-level method surfaces both translator-time errors (possibly several) and SQL-compile errors (at most one — the compiler is fail-fast). The model-level method surfaces only translator-time errors; SQL-compile is per-query.

`getPreparedResult()` / `getSQL()` / `run()` still throw `MalloyError` on failure; the thrown `.problems` is the same array. A `validate()` followed by a no-options consumer reuses one cached compile via `QueryMaterializer._compileAttempt`.

SQL-compile errors that are user-actionable throw `MalloyCompileError` (`packages/malloy/src/model/malloy_compile_error.ts`) at the throw site, carrying `{message, code, at?}`. The materializer's `_compileAndCollect` helper translates it to a `LogMessage`. Invariant violations stay as bare `Error` and surface with `code: 'compiler-bug'`.

API-level documentation lives in the JSDoc on the two `validate` methods.

---

## Layer 3: Core API

**Location:** `packages/malloy/src/api/core.ts`

The implementation layer that the Stateless / Sessioned / Asynchronous APIs build on. Synchronous, stateless-ish (uses explicit state objects).

### Key Functions

| Function | Purpose |
|----------|---------|
| `newCompileModelState(request)` | Creates compilation state with `MalloyTranslator` |
| `statedCompileModel(state)` | Advances compilation one step, returns model or needs |
| `statedCompileQuery(state)` | Compiles query, generates SQL via `IR.QueryModel` |
| `updateCompileModelState(state, needs)` | Feeds fetched dependencies back into state |

### State Objects
- `CompileModelState` - holds `MalloyTranslator`, tracks `done`, `hasSource`
- `CompileQueryState` - extends above with `defaultRowLimit`

### Flow

```
Core.newCompileModelState(request)
  └→ state (contains MalloyTranslator)

Core.statedCompileModel(state)
  └→ translator.translate()
       └→ { model, modelDef } OR { compilerNeeds } OR { logs (errors) }

Core.statedCompileQuery(state)  [when model is ready]
  └→ new IR.QueryModel(modelDef)
       └→ queryModel.compileQuery(query)
            └→ IR.QueryQuery internally
  └→ returns { sql, schema, connection_name, ... }
```

### Characteristics
- Uses stable types from `malloy-interfaces` for input/output
- Synchronous - doesn't fetch anything itself
- Iterative compilation via `compilerNeeds` pattern
- Directly instantiates `IR.QueryModel` for SQL generation

---

## Layer 4 — request-response APIs (experimental)

Three sibling APIs share a request-response shape designed to be wire-friendly:
consumers transact in `Malloy.*` types from `@malloydata/malloy-interfaces`,
not in Foundation class instances. They all sit on the Core layer above.

These are **experimental.** Their surface, error semantics, and feature
coverage are still settling — see "The Fundamental Problem" section below
for the load-bearing limitation. **Foundation is the production surface
today;** the trio is appropriate for use cases that can't hold class
instances (network services, multi-language hosts, REST/serverless) and are
willing to live with the rough edges.

## Layer 4a: Stateless API

**Location:** `packages/malloy/src/api/stateless.ts`

Thin wrappers around Core. ~28 lines of code.

```typescript
export function compileModel(request: Malloy.CompileModelRequest): Malloy.CompileModelResponse {
  return Core.compileModel(request);
}
```

### Characteristics
- Pure functions, no state between calls
- Caller must handle the `compilerNeeds` loop externally
- Uses stable types (API.*)
- Designed for: REST APIs, serverless functions

### The Fatal Flaw
To compile a named query, you must pass it as text:
```typescript
compileQuery({
  model_url: '...',
  query_malloy: 'run: my_named_query'  // TEXT, not object reference
})
```

There's no way to say "compile query #3 from the model I just compiled" without text round-tripping.

---

## Layer 4b: Sessioned API

**Location:** `packages/malloy/src/api/sessioned.ts`

Core + session state management. ~379 lines.

### Additional Features
- `SessionManager` tracks compilation state between calls
- Session IDs allow resuming compilation
- TTL for session expiration
- Avoids recompiling unchanged parts

```typescript
const r1 = API.sessioned.compileModel(request, { ttl: {seconds: 60} });
// r1.session_id returned

const r2 = API.sessioned.compileQuery(queryRequest, { session_id: r1.session_id });
// Reuses cached compilation state
```

### Characteristics
- Synchronous (like stateless)
- Caller still handles `compilerNeeds` loop
- Server-side session state
- Designed for: interactive clients with multi-step workflows

---

## Layer 4c: Asynchronous API

**Location:** `packages/malloy/src/api/asynchronous.ts`

Core + automatic dependency fetching. ~263 lines.

### Key Difference
Handles the `compilerNeeds` loop internally:

```typescript
export async function compileModel(request, fetchers): Promise<Malloy.CompileModelResponse> {
  const state = Core.newCompileModelState(request);
  while (true) {
    const result = Core.statedCompileModel(state);
    if (result.model || hasErrors(result.logs)) return result;

    // Auto-fetch needed schemas, files, etc.
    const needs = await fetchNeeds(result.compiler_needs, fetchers);
    Core.updateCompileModelState(state, needs);
  }
}
```

### Characteristics
- Async functions
- Requires `fetchers` object with `connections` and `urls` readers
- Most "complete" of the request-response APIs — handles iteration internally
- Designed for: Node.js environments with database access

---

## Comparison Matrix

| Aspect | Foundation | Core | Stateless | Sessioned | Async |
|--------|------------|------|-----------|-----------|-------|
| **Location** | api/foundation/ | api/core.ts | api/stateless.ts | api/sessioned.ts | api/asynchronous.ts |
| **Style** | OO classes | Functions + state | Pure functions | Functions + sessions | Async functions |
| **Types** | Internal (IR.*) | Stable (API.*) | Stable | Stable | Stable |
| **Sync/Async** | Mixed | Sync | Sync | Sync | Async |
| **Handles needs loop** | Internally | No | No | No | Yes |
| **Session state** | In objects | Explicit | None | Server-side | None |
| **Direct IR access** | Yes | Partial | No | No | No |
| **Query by reference** | Yes | No | No | No | No |

---

## The Fundamental Problem with the request-response APIs

The Stateless / Sessioned / Asynchronous trio was designed for a web client that would:
1. Fetch a model
2. Let user modify a query (as API.Query object)
3. Convert API.Query → Malloy text → recompile → get SQL

This works for that use case, but creates a fundamental limitation:

**There is no path from API.Query → IR.QueryQuery**

The only way to get SQL is:
```
API.Query → queryToMalloy() → text → MalloyTranslator → IR.Query → IR.QueryModel → IR.QueryQuery → SQL
```

This means you cannot:
- Inspect a compiled query's structure with compiler context
- Add methods to API.Query that require IR.QueryQuery
- Avoid the text round-trip for query manipulation

The Foundation API doesn't have this problem because `PreparedQuery` holds the actual `IR.Query` and creates `IR.QueryModel`/`IR.QueryQuery` directly.

---

## Recommendations

1. **For production use today:** Use the Foundation API (`api/foundation/`)
2. **For network services:** Async API is most practical (handles the loop)
3. **For request-response API improvements:** Need direct API.Query → IR.QueryQuery path
4. **For new features:** Experiment in Foundation API first, then figure out wire-shape exposure
