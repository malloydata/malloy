# Foundation API Internals

This directory implements the Foundation API: `Runtime`, `Model`, `PreparedQuery`, and the `MalloyConfig` pipeline that feeds them. For the public surface and how the four API layers relate, see [../CONTEXT.md](../CONTEXT.md). For the user-facing view of configuration, see [../../doc/configuration.md](../../doc/configuration.md).

This file is about the parts that are fragile and easy to break.

## File Layout

| File | Contents |
|---|---|
| `config.ts` | `MalloyConfig` class (constructor pipeline, `wrapConnections`, `shutdown`, `readOverlay`) and standalone `Manifest` |
| `config_overlays.ts` | `Overlay` (sync-or-async), `ConfigOverlays`, `envOverlay()`, `contextOverlay()`, `defaultConfigOverlays()` |
| `config_compile.ts` | Schema-directed POJO → typed tree. Section compilers. The **security boundary**. |
| `config_resolve.ts` | `prepareConfig()` — synchronous extraction of top-level sections; fabricates default-connection entries. Sync-peeks overlays for top-level string references (e.g. `manifestPath: {env: "X"}`); async overlays warn + drop. |
| `config_lookup.ts` | `buildManagedLookup()` — async, per-lookup reference resolution + property defaults + factory invocation. Where overlay calls actually happen. |
| `config_discover.ts` | `discoverConfig()` URL walk; returns a fully-built `MalloyConfig` or `null` |
| `runtime.ts` | `Runtime`, materializers, lazy manifest read |
| Other files | Model/Query/Result classes — see parent CONTEXT.md |

## The Pipeline

```
authored (JSON/POJO)                           — what users write
   │
   ▼  MalloyConfig constructor  (sync, zero IO)
   │
   │  1. normalize input (string → JSON.parse; POJO → as-is)
   │  2. compile with TOP_LEVEL_SECTIONS dispatch
   │
   ▼
compiled (typed tree: ConfigDict | ConfigLiteral | ConfigReference)
   │
   │  3. merge overlays onto defaults ({...defaultConfigOverlays(), ...passed})
   │  4. prepareConfig: extract non-connection sections (manifestPath,
   │     virtualMap); pull out compiled connection subtrees untouched.
   │     Sync-peek overlays for top-level string references (manifestPath
   │     can be {env: "X"} etc.); async returns warn + drop.
   │     If includeDefaultConnections: fabricate bare {is: typeName}
   │     compiled entries for registered types not already present.
   │  5. buildManagedLookup: package compiled connection subtrees + overlays
   │     into a ManagedConnectionLookup. No overlay calls yet.
   │
   ▼
MalloyConfig instance (what Runtime consumes; references not yet resolved)
   │
   ▼  lookupConnection(name)  (async, overlays may do IO)
   │
   │  6. walk the compiled entry; await each ConfigReference's overlay
   │  7. apply property defaults (resolving reference-shaped defaults
   │     through the same overlays)
   │  8. hand fully resolved POJO to the registered factory
   │  9. cache the Connection by name
   │
   ▼
Connection (cached; subsequent lookups skip the pipeline)
```

The compiled tree exists from step 2 onward and is held by `ManagedConnectionLookup` for the lifetime of the `MalloyConfig`. Callers never see it — they see resolved `Connection` instances.

**Sync/async boundary.** Construction is synchronous and does zero IO. All overlay calls — and anything they might do (secret stores, session fetches, enterprise-injected values) — happen at `lookupConnection` time, which is already async. This means:

- An `Overlay` is `(path: string[]) => unknown | Promise<unknown>`. The resolver `await`s every overlay result, so sync and async overlays are interchangeable from the caller's perspective.
- `readOverlay()` on `MalloyConfig` is async for the same reason.
- Construction-time overlay peeks are the exception to the deferred-resolution rule. Two cases peek synchronously: (1) `computeManifestURL` reads `configURL` from the `config` overlay; (2) `prepareConfig`'s `resolveSyncStringSetting` resolves top-level string references like `manifestPath: {env: "X"}`. **All sync-peek overlays MUST return synchronously**; if any returns a Promise, the resolver pushes a loud warning to `config.log` and drops the value — failing audibly instead of silently breaking persistence or losing the setting. Inside the `config` overlay, only `configURL` is sync-only; other keys (`rootDirectory`, etc.) can still be async because they're consumed at lookup time. Hosts that build overlays from mixed sync/async sources should branch on the key.

**Log timing.** The `log` array is mutable and shared — entries arrive in waves matching the resolution timeline:

1. *Construction* — compile-time validation warnings, plus resolution warnings for the two sync-only slots (top-level string references and `configURL`).
2. *First lookup of each connection* — resolution warnings for that connection's property references and reference-shaped defaults.

Callers that read `config.log` before any connection lookup see only the construction-time entries; warnings for a never-used connection never appear. This is an intentional consequence of deferred resolution — we don't pay for warnings on connections nobody asks about.

Manifest reading happens lazily in the Runtime; discovery (which does IO) is a separate helper that *builds* a `MalloyConfig`, it's not part of the constructor.

## Security Invariant: Section Compilers

**The compiler is not a generic recursive tree walker that looks for overlay references everywhere.** It's a dispatch over named top-level sections:

```typescript
type SectionCompiler = (value: unknown, log: LogMessage[]) => ConfigNode | undefined;
const TOP_LEVEL_SECTIONS: Record<string, SectionCompiler> = {
  connections: compileConnections,
  manifestPath: compileManifestPath,
  virtualMap: compileVirtualMap,
  includeDefaultConnections: compileIncludeDefaultConnections,
};
```

- `compileConnections` is the **only** dynamic section. For each entry, it looks up `is` in the connection registry, walks the declared properties, and at each *non-`json`* property (the reference slots) accepts either a literal or a single-key `{source: path}` reference. At each `json`-typed property it passes raw data through as `ConfigLiteral` — no reference interpretation.
- `compileManifestPath` accepts either a literal string or a reference shape. Resolution happens synchronously in `prepareConfig` — see the sync-peek discussion under [Sync/async boundary](#the-pipeline) above.
- `compileVirtualMap`, `compileIncludeDefaultConnections` are pass-through. `{env: "X"}` *inside* `virtualMap` is literal JSON, not a reference.

Consequences:

- No reference injection into `virtualMap` or other literal-dict slots.
- No recursive reference expansion anywhere.
- Connection factories only ever see fully resolved values.

**If you add a new top-level section**, register a section compiler. Don't reach into the generic tree walker — there isn't one. **If you add a new reference slot inside `connections`**, it's purely a registry change; `compileConnections` picks it up from the property definition automatically.

## Reference Shape and Resolution

A reference is a single-key object where the key names an overlay source and the value is a path:

```typescript
{env: "PG_PASSWORD"}           // path = ["PG_PASSWORD"]
{config: "rootDirectory"}       // path = ["rootDirectory"]
{session: ["credentials", "token"]}  // path = ["credentials", "token"]
```

The single-key constraint is a runtime invariant — TypeScript can't express "exactly one key." `compileConnections` validates it.

An overlay is `(path: string[]) => unknown | Promise<unknown>`. `ConfigOverlays` is `Record<string, Overlay>`. Overlays can be sync or async; the resolver awaits every result. Async fits naturally because resolution is deferred to `lookupConnection` (already async).

### Merge Semantics

```typescript
const merged = {...defaultConfigOverlays(), ...passed};
```

Plain spread. This gives callers three moves without any extra API:

- **Add** — passing a new key adds it (`session`).
- **Replace** — passing an existing key clobbers the default (`config` → discovery-populated or Publisher's).
- **Disable** — omit; the default is already a no-op for `config`.

### Four Failure Modes

Cases and observed behavior: [configuration.md → Failure Modes](../../doc/configuration.md#failure-modes). Why each behaves the way it does — the rationale that matters when you're tempted to "improve" them in code:

| Case | Why it behaves this way |
|---|---|
| Unknown overlay source → warning + drop | Almost always a typo or host/config mismatch. Silent-dropping would hide real bugs; throwing would punish a host that hasn't yet registered an optional overlay. The `config.log` warning splits the difference. |
| Known overlay returns `undefined` → silent drop | Legitimate "value not present" state, matching env-var semantics. A required-field violation surfaces at connection-build time (lazy, at lookup), not here — keeping the resolver out of policy decisions about what's required. |
| Unresolved reference in a `default` → silent drop | A default is a hint, not a requirement. "No default applicable" is a normal terminal state, not a failure. |
| Async overlay used in a sync-only slot → loud warning + drop | A construction-time peek can't `await`. This is misuse rather than absence, so silent drop would hide a wiring bug; throwing would brittly couple to a stack the host might still be assembling. The loud warning gets the host's attention while keeping construction infallible. Applies to `configURL` and to top-level string references like `manifestPath`. |

Consequence: cases 2 and 3 make "typo'd env var" and "legitimately unset env var" indistinguishable. Matches today's behavior. Typo detection would need the resolver to know which properties are required by which factory — not worth crossing that line.

Case 1 fires at *construction time* for top-level references (resolved in `prepareConfig`) and at *first lookup* for connection-property references (resolved in `buildManagedLookup`). This is a consequence of when each kind is consumed — not a behavior to "unify."

## Property Defaults vs. `includeDefaultConnections`

User-facing description of both mechanisms is in [configuration.md → Defaults](../../doc/configuration.md#defaults). Internals notes that don't belong in the user doc:

- **Orthogonality.** Two mechanisms answering different questions ("what fills in a missing property" vs. "what fills in a missing connection"). Don't conflate them in code — they share neither state nor a code path. Property defaults run *after* fabrication and apply uniformly, so a fabricated entry and a user-written one are indistinguishable downstream.

- **Pipeline order.** `prepareConfig` fabricates first (`config_resolve.ts`), then `lookupConnection` applies property defaults (`config_lookup.ts`). The fabricator never reads `default` fields; the resolver doesn't care whether an entry was fabricated.

- **Fabricator invariant.** *A phantom default named T exists iff no user entry is named T.* The skip is purely name-based; the `is` of user entries is irrelevant. This is what `lookupConnection` and host UIs (e.g. the VS Code connections sidebar) agree on — UI lists defaults by name, runtime must resolve those same names. An earlier version also skipped on type-already-in-use, which broke the agreement: a user with `{dankdb: {is: 'duckdb'}}` saw `duckdb` in the sidebar but got "No connection named 'duckdb'" at runtime.

## DuckDB rootDirectory — The Contract

User-facing description: [configuration.md → DuckDB Working Directory](../../doc/configuration.md#duckdb-working-directory).

The internals point: there is **no DuckDB-specific code anywhere in the config system**. The entire policy lives in one `default` field on one property in one registry entry — `workingDirectory: {default: {config: 'rootDirectory'}}`. Property defaults + the `config` overlay do the rest. This is the template for any backend quirk: declare the property, declare the default, let hosts populate the overlay. If you find yourself reaching for a DuckDB-shaped branch in the resolver, you're solving it wrong.

## Manifest URL — State Table

`MalloyConfig.manifestURL` is computed once in the constructor from the typed `configURL` (passed via `MalloyConfigOptions`) and the resolved `manifestPath`. It is exposed as a URL-shaped string, not a `URL` object:

```typescript
if (configURL) {
  const path = resolved.manifestPath ?? 'MANIFESTS';
  const dirURL = joinAsDirectory(new URL(path, configURL));
  this.manifestURL = new URL('malloy-manifest.json', dirURL).toString();
}
```

| Construction | `manifestURL` |
|---|---|
| Built by `discoverConfig` | computed from `configURL` + `manifestPath` |
| POJO form with `{configURL}` in options | computed |
| POJO form with `{rootDirectory}` but no `configURL` | **undefined** |
| POJO form, no options | **undefined** |
| String form | **undefined** |

`manifestURL` and `givensURL` are exposed as URL-shaped strings (`URL.toString()`), not `URL` objects — public API stays in string-land. URL parsing is foundation-internal; URLReader plugins still receive `URL` because they're the IO-layer abstraction.

When `manifestURL` is undefined, the Runtime's lazy-read silently does nothing — the caller must pass `buildManifest:` explicitly to get persistence. Not an error.

A subtlety: `configURL` doesn't have to be where the config text actually came from. It's the base that `manifestURL` and `givensURL` are computed against. A caller reading text from one URL but wanting paths to anchor at a different directory can pass whatever they want. The semantic is "what is the anchor for path settings," not "where did this text come from."

## Givens — per-runtime supply path

**Architectural keystone: `GivenID` is global.** Every given declaration produces a `GivenID` keyed on `(name, source URL)`. `givenRef` IR nodes carry that id, and that id is the only thing any consumer needs. Imported IR is **never rewritten** — a `givenRef` in B's IR pointing at `b.MAX` still says `b.MAX` after B is imported anywhere. This is why the import path can copy declarations untouched and the compiler never walks namespaces.

**Two phases of resolution.**
- *Phase 1 (translator)*: `$NAME` → `GivenID`, scoped to the current file's visible givens. Bakes the id into the `givenRef` node. Sites: `lang/ast/expressions/expr-given.ts`, `lang/ast/statements/define-given.ts`.
- *Phase 2 (compiler)*: `GivenID` → bound value. Lookup by id in `prepareResultOptions.resolvedGivens`; fall back to the declaration's default; throw if neither. Sites: `model/expression_compiler.ts:case 'given'`, `generateGivenFragment`.

The `resolvedGivens` map is built **at the foundation boundary** (`PreparedQuery.getPreparedResult`), not inside the compiler. The compiler trusts it.

**Foundation-layer pieces a reader needs to find:**

- **`MalloyConfig.givensPath` / `givensURL` / `finalizeGivens`** — config fields. `givensPath` accepts literal string or `{env: "..."}` overlay reference; `givensURL` is the resolved URL-string. `finalizeGivens` is an array of given names locked at the runtime layer.
- **`Runtime` constructor `givens?` option** — direct in-process supply for hosts that have values in hand (multi-tenant servers, tests).
- **`Runtime.getGivens()`** — async, returns the merged file+constructor view; constructor wins per-key. The honest "what does this runtime supply?" surface.
- **`Runtime._resolveGivens()`** — lazy + cached file read of `config.givensURL`. Stricter error policy than `_resolveBuildManifest`: missing file or malformed JSON throws on the first compile, with the URL in the message. `Runtime._invalidateGivensCache()` clears the cached promise (file-watching hosts; tests).
- **`Runtime._withRuntimeContext(model)`** — re-wraps a Model returned from `Malloy.compile()` with this runtime's `RuntimeContext` (currently `{finalizedGivens?}`). The wart-as-bridge between `Malloy.compile` (runtime-unaware) and the runtime-aware `Model.givens` filtering. New runtime-aware concerns add fields to `RuntimeContext` rather than parallel `_with*` methods.
- **`QueryMaterializer.loadPreparedResult`** — does the three-layer per-key merge (file → constructor → per-query, higher wins), then per-query rejection for finalized names + query-scoped sanity validation. Explicit `undefined` values are rejected at the boundary (in `Runtime` constructor and `resolveSuppliedGivens`).
- **`PreparedQuery.getPreparedResult`** — calls `resolveSuppliedGivens(options.givens, this._modelDef)` to convert JS values into `Map<GivenID, Expr>` before handing to `compileQuery`. The compiler trusts the resolved map.

`Model` carries an optional `runtimeContext?: RuntimeContext` constructor parameter. The "Model wears two hats" abstraction violation (compiler artifact + host-facing inspection) is acknowledged as a future structural cleanup; today the `_withRuntimeContext` re-wrap pattern is the tactical bridge.

## `wrapConnections` — In-Place Mutation

```typescript
config.wrapConnections(wrapper: (base: LookupConnection) => LookupConnection): void
```

Mutates `config` in place. After wrapping, `config.connections` returns the wrapped version. Runtime just calls `config.connections` and gets whatever the final lookup is. Multiple wraps compose — each sees the previous result as `base`.

This is why `MalloyConfig.connections` is defined as a getter, not a readonly field: the returned object can change after construction.

VS Code uses this to layer settings connections below the config layer. Publisher uses it to attach session-specific behavior to resolved connections.

## `shutdown`

User-facing description: [configuration.md → Releasing connections](../../doc/configuration.md#releasing-connections).

`Runtime.shutdown(connections)` and `MalloyConfig.shutdown(connections)` apply
one of two policies to every connection in the lazy `name → Connection`
cache:

- `'close'` (default) — destructive. Walks the cache and calls
  `Connection.close()` on each, then drops the cache. Subsequent operations
  on those Connection objects may fail. Use at real shutdown: process exit,
  extension deactivate, config-file change.

- `'idle'` — reversible. Walks the cache and calls `Connection.idle()` on
  each. The cache is preserved so the same Connection objects are reused on
  next lookup; backend state made stale by release may be invalidated. The next
  operation transparently reattaches whatever backend resources `idle()`
  released. Use this between operations in long-lived hosts (a VS Code
  extension, an MCP server, anything that builds Runtimes per request) so
  that other writers can claim resources during idle gaps.

Implementation specifics:

- `MalloyConfig` owns no connection resources directly — pools, sockets, file handles all live inside individual `Connection` objects. What the managed lookup owns is a lazily-populated `name → Connection` cache.
- Connections that were never looked up were never constructed and are skipped by both modes.
- Aliases which resolve to the same `Connection` identity are cleaned up once, in first-seen order. Cleanup is deliberately sequential so two distinct connection identities cannot race over external locks during a bulk shutdown; aggregated errors preserve that same deterministic order.
- An identity remains quarantined while cleanup is active, and a successfully closed identity is permanently retired from that managed cache. A factory cannot reintroduce either object under a new alias and bypass the lifecycle barrier; a rejected alias construction is removed so a later lookup may retry with a genuinely new object.
- Wrappers installed via `wrapConnections()` don't interfere — the managed lookup under the wrap still holds the cache, and `runtime.shutdown(...)` forwards through to `config.shutdown(...)` directly, not through the wrap.
- Legacy constructor forms (`new Runtime({connections})` / `new Runtime({connection})`) build a Runtime with no `MalloyConfig` to forward to; `shutdown()` is a no-op and the caller owns whatever they passed in.
- `releaseConnections()` is preserved as a deprecated alias for `shutdown('close')`. Existing callers continue to work; new code should call `shutdown(...)` directly.

## Discovery

`discoverConfig(startURL, ceilingURL, urlReader, extraOverlays?)`:

1. Walk upward from `startURL` to `ceilingURL` via `new URL('..', current)`.
2. At each level, try `malloy-config-local.json` then `malloy-config.json` via `urlReader`.
3. **File-not-found is normal** — move on to the parent.
4. **Matched-but-unparseable is a hard error** — throw with the offending URL. Silently skipping would let a typo'd project config be ignored in favor of a grandparent config, and the user would never learn why.
5. On a hit, build:
   ```typescript
   new MalloyConfig(pojo, {
     configURL: matchedURL.toString(),
     rootDirectory: ceilingURL.toString(),
     overlays: extraOverlays,
   });
   ```
6. Return the built `MalloyConfig`, or `null` if the walk reached the ceiling with no match.

`overlays` (the third option-bag field) is for non-`config` slots only — `env`, host-defined session/secret slots, etc. The `config` slot is reserved by `MalloyConfig` and built internally from `configURL` + `rootDirectory`. Hosts that pass `overlays: {config: ...}` get a warning + drop, not a silent merge.

URL-based (not filesystem-based) so the helper works in browser-safe environments through `URLReader`.

## Testing Notes

- `config.spec.ts` covers the constructor pipeline, section compilers, overlay resolution, property defaults, `includeDefaultConnections` fabrication (name-based skip), reference failure modes, and the manifest URL state table.
- `runtime.spec.ts` covers the manifest lazy-read, explicit `buildManifest` wins, `EMPTY_BUILD_MANIFEST`, `shutdown` forwarding (close + idle modes; deprecated `releaseConnections` alias), and the givens supply path (file resolution, cache invalidation, `getGivens()` merge, undefined rejection at construction).
- When adding a new backend with a registry default that references an overlay, add a test that the default is dropped (not errored) when the overlay is the no-op.

## Things That Look Like They Should Be Simple But Aren't

- **A single-key object isn't always a reference.** In `json`-typed slots and in `virtualMap`, it's literal data. The section-compiler boundary is what makes this safe.
- **`manifestURL` computation uses `configURL`, not `rootDirectory`.** The manifest hangs off the config file's directory, not the project root. These are different URLs when the config file lives in a subdirectory.
- **Property defaults run *after* overlay resolution of explicit values**, so a user who sets a property to a reference that resolves to `undefined` gets the same silent-drop as if they'd omitted the property — and then the default fills in. This is intentional and composes cleanly; don't "fix" it by conflating the phases.
- **Connection-property reference resolution is deferred to `lookupConnection`.** `MalloyConfig`'s constructor stays sync and does no overlay IO for connection properties, so it's safe to build anywhere. Overlays with async dependencies (secret stores, session reads) get a natural async seam at lookup. A consequence: warnings about connection-property references arrive in `config.log` incrementally as connections are looked up — warnings for a never-used connection never appear. Top-level string references and `configURL` are the exceptions: they resolve synchronously at construction time and any warnings about them appear immediately.
- **`wrapConnections` can be called multiple times.** Each wrap sees the previous wrap's result as `base`. Hosts that need ordered layering (VS Code's three-level resolution) rely on this.
