# Malloy Internal API Overview

This document describes the layered API architecture in Malloy, from the internal compiler machinery up through the various public API styles.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PUBLIC API LAYERS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │ Foundation  │   │  Stateless  │   │  Sessioned  │   │ Asynchronous│     │
│  │    API      │   │    API      │   │    API      │   │    API      │     │
│  │             │   │             │   │             │   │             │     │
│  │ Runtime     │   │ compileModel│   │ compileModel│   │ compileModel│     │
│  │ Model       │   │ compileQuery│   │ compileQuery│   │ compileQuery│     │
│  │ PreparedQry │   │             │   │ +sessions   │   │ +auto-fetch │     │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘     │
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
│                         INTERNAL COMPILER (IR)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐         ┌──────────────────────┐                 │
│  │   MalloyTranslator   │         │     QueryModel       │                 │
│  │   (src/lang/)        │         │   (src/model/)       │                 │
│  │                      │         │                      │                 │
│  │ Source text → IR     │         │ IR → SQL             │                 │
│  │ (ModelDef, Query)    │         │                      │                 │
│  └──────────────────────┘         │  .compileQuery()     │                 │
│                                   │       │              │                 │
│                                   │       ▼              │                 │
│                                   │  ┌────────────┐      │                 │
│                                   │  │ QueryQuery │      │                 │
│                                   │  │            │      │                 │
│                                   │  │ SQL gen    │      │                 │
│                                   │  └────────────┘      │                 │
│                                   └──────────────────────┘                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Internal Compiler (IR)

**Location:** `packages/malloy/src/model/` and `packages/malloy/src/lang/`

These are the actual compiler internals that do the work. Not a public API.

### MalloyTranslator (`src/lang/`)
- Parses Malloy source text into IR types (`ModelDef`, `Query`, `SourceDef`, etc.)
- Handles imports, schema fetching requests, iterative compilation
- Returns `translator.translate()` results with either final `ModelDef` or `needs` for more info

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
| `compile.ts` | `Malloy` static class, `MalloyError` |
| `index.ts` | Barrel file re-exporting everything |

### Classes

| Class | Purpose |
|-------|---------|
| `Runtime` | Entry point. Holds connections + URL reader. Creates `ModelMaterializer`s. |
| `Model` | Wraps `IR.ModelDef`. Provides access to explores, queries, preparedQuery. |
| `PreparedQuery` | Wraps `IR.Query` + `IR.ModelDef`. Defers SQL generation until needed. |
| `PreparedResult` | Holds generated SQL + schema. Ready to execute. |
| `Result` | Query result with data + schema + metadata. |

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

---

## Layer 3: Core API

**Location:** `packages/malloy/src/api/core.ts`

The implementation layer that the "stable" APIs build on. Synchronous, stateless-ish (uses explicit state objects).

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
- Most "complete" of the stable APIs - handles iteration internally
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

## The Fundamental Problem with Stable APIs

The stable APIs (stateless, sessioned, async) were designed for a web client that would:
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
3. **For stable API improvements:** Need direct API.Query → IR.QueryQuery path
4. **For new features:** Experiment in Foundation API first, then figure out stable exposure
