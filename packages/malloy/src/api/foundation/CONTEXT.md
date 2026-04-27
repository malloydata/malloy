# Foundation API Internals

This directory implements the Foundation API: `Runtime`, `Model`, `PreparedQuery`, and the `MalloyConfig` pipeline that feeds them. For the public surface and how the four API layers relate, see [../CONTEXT.md](../CONTEXT.md). For the user-facing view of configuration, see [../../doc/configuration.md](../../doc/configuration.md).

This file is about the parts that are fragile and easy to break.

## File Layout

| File | Contents |
|---|---|
| `config.ts` | `MalloyConfig` class (constructor pipeline, `wrapConnections`, `releaseConnections`, `readOverlay`) and standalone `Manifest` |
| `config_overlays.ts` | `Overlay` (sync-or-async), `ConfigOverlays`, `envOverlay()`, `contextOverlay()`, `defaultConfigOverlays()` |
| `config_compile.ts` | Schema-directed POJO → typed tree. Section compilers. The **security boundary**. |
| `config_resolve.ts` | `prepareConfig()` — synchronous extraction of top-level sections; fabricates default-connection entries. No overlay IO. |
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
- `computeManifestURL` is the one construction-time exception — it sync-peeks the `config` overlay for `configURL`. **The `config` overlay MUST resolve `configURL` synchronously**; other keys (`rootDirectory`, etc.) may be async. If the peek sees a Promise, `computeManifestURL` pushes a loud warning to `config.log` and sets `manifestURL = undefined` — failing audibly instead of silently dropping persistence. Hosts that build a `config` overlay from mixed sync/async sources should branch on the key.

**Log timing.** Warnings about unknown overlay sources fire at lookup time, not construction time. The `log` array is mutable and shared — callers that read `config.log` before any connection lookup won't see resolution warnings; reading after a lookup will. This is an intentional consequence of deferred resolution: we don't pay for warnings on connections nobody asks about.

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
- `compileVirtualMap`, `compileManifestPath`, `compileIncludeDefaultConnections` are pass-through. `{env: "X"}` *inside* `virtualMap` is literal JSON, not a reference.

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

### Three Failure Modes

Cases and observed behavior: [configuration.md → Failure Modes](../../doc/configuration.md#failure-modes). Why each behaves the way it does — the rationale that matters when you're tempted to "improve" them in code:

| Case | Why it behaves this way |
|---|---|
| Unknown overlay source → warning + drop | Almost always a typo or host/config mismatch. Silent-dropping would hide real bugs; throwing would punish a host that hasn't yet registered an optional overlay. The `config.log` warning splits the difference. |
| Known overlay returns `undefined` → silent drop | Legitimate "value not present" state, matching env-var semantics. A required-field violation surfaces at connection-build time (lazy, at lookup), not here — keeping the resolver out of policy decisions about what's required. |
| Unresolved reference in a `default` → silent drop | A default is a hint, not a requirement. "No default applicable" is a normal terminal state, not a failure. |

Consequence: cases 2 and 3 make "typo'd env var" and "legitimately unset env var" indistinguishable. Matches today's behavior. Typo detection would need the resolver to know which properties are required by which factory — not worth crossing that line.

## Property Defaults vs. `includeDefaultConnections`

User-facing description of both mechanisms is in [configuration.md → Defaults](../../doc/configuration.md#defaults). Internals notes that don't belong in the user doc:

- **Orthogonality.** Two mechanisms answering different questions ("what fills in a missing property" vs. "what fills in a missing connection"). Don't conflate them in code — they share neither state nor a code path. Property defaults run *after* fabrication and apply uniformly, so a fabricated entry and a user-written one are indistinguishable downstream.

- **Pipeline order.** `prepareConfig` fabricates first (`config_resolve.ts`), then `lookupConnection` applies property defaults (`config_lookup.ts`). The fabricator never reads `default` fields; the resolver doesn't care whether an entry was fabricated.

- **Fabricator invariant.** *A phantom default named T exists iff no user entry is named T.* The skip is purely name-based; the `is` of user entries is irrelevant. This is what `lookupConnection` and host UIs (e.g. the VS Code connections sidebar) agree on — UI lists defaults by name, runtime must resolve those same names. An earlier version also skipped on type-already-in-use, which broke the agreement: a user with `{dankdb: {is: 'duckdb'}}` saw `duckdb` in the sidebar but got "No connection named 'duckdb'" at runtime.

## DuckDB rootDirectory — The Contract

User-facing description: [configuration.md → DuckDB Working Directory](../../doc/configuration.md#duckdb-working-directory).

The internals point: there is **no DuckDB-specific code anywhere in the config system**. The entire policy lives in one `default` field on one property in one registry entry — `workingDirectory: {default: {config: 'rootDirectory'}}`. Property defaults + the `config` overlay do the rest. This is the template for any backend quirk: declare the property, declare the default, let hosts populate the overlay. If you find yourself reaching for a DuckDB-shaped branch in the resolver, you're solving it wrong.

## Manifest URL — State Table

`MalloyConfig.manifestURL` is computed once in the constructor from the overlay's `configURL` and the resolved `manifestPath`:

```typescript
if (configURL) {
  const path = resolved.manifestPath ?? 'MANIFESTS';
  const dirURL = joinAsDirectory(new URL(path, configURL));
  this.manifestURL = new URL('malloy-manifest.json', dirURL);
}
```

| Construction | `manifestURL` |
|---|---|
| Built by `discoverConfig` | computed from `configURL` + `manifestPath` |
| POJO form with `contextOverlay({configURL})` by hand | computed |
| POJO form with `contextOverlay({rootDirectory})` but no `configURL` | **undefined** |
| POJO form, no overlays | **undefined** |
| String form | **undefined** |

When `manifestURL` is undefined, the Runtime's lazy-read silently does nothing — the caller must pass `buildManifest:` explicitly to get persistence. Not an error.

A subtlety: `configURL` in the overlay doesn't have to be where the config text actually came from. It's the base that `manifestURL` is computed against. A caller reading text from one URL but wanting the manifest to hang off a different directory can pass whatever they want. The semantic is "where do you want the manifest to live," not "where did this text come from."

## `wrapConnections` — In-Place Mutation

```typescript
config.wrapConnections(wrapper: (base: LookupConnection) => LookupConnection): void
```

Mutates `config` in place. After wrapping, `config.connections` returns the wrapped version. Runtime just calls `config.connections` and gets whatever the final lookup is. Multiple wraps compose — each sees the previous result as `base`.

This is why `MalloyConfig.connections` is defined as a getter, not a readonly field: the returned object can change after construction.

VS Code uses this to layer settings connections below the config layer. Publisher uses it to attach session-specific behavior to resolved connections.

## `releaseConnections`

User-facing description: [configuration.md → Releasing connections](../../doc/configuration.md#releasing-connections).

Implementation specifics:

- `MalloyConfig` owns no connection resources directly — pools, sockets, file handles all live inside individual `Connection` objects. What the managed lookup owns is a lazily-populated `name → Connection` cache.
- `releaseConnections()` walks that cache and calls `Connection.close()` on each. Connections that were never looked up were never constructed and are skipped.
- Wrappers installed via `wrapConnections()` don't interfere — the managed lookup under the wrap still holds the cache, and `runtime.releaseConnections()` forwards through to `config.releaseConnections()` directly, not through the wrap.
- Legacy constructor forms (`new Runtime({connections})` / `new Runtime({connection})`) build a Runtime with no `MalloyConfig` to forward to; `releaseConnections()` is a no-op and the caller owns whatever they passed in.

## Discovery

`discoverConfig(startURL, ceilingURL, urlReader, extraOverlays?)`:

1. Walk upward from `startURL` to `ceilingURL` via `new URL('..', current)`.
2. At each level, try `malloy-config-local.json` then `malloy-config.json` via `urlReader`.
3. **File-not-found is normal** — move on to the parent.
4. **Matched-but-unparseable is a hard error** — throw with the offending URL. Silently skipping would let a typo'd project config be ignored in favor of a grandparent config, and the user would never learn why.
5. On a hit, build:
   ```typescript
   new MalloyConfig(pojo, {
     ...defaultConfigOverlays(),
     config: contextOverlay({rootDirectory: ceilingURL.toString(), configURL: matchedURL.toString()}),
     ...extraOverlays,
   });
   ```
6. Return the built `MalloyConfig`, or `null` if the walk reached the ceiling with no match.

`extraOverlays` merge on top via plain spread. A caller who passes `{config: ...}` clobbers the `rootDirectory`/`configURL` that discovery built. Callers who want both should build `MalloyConfig` by hand.

URL-based (not filesystem-based) so the helper works in browser-safe environments through `URLReader`.

## Testing Notes

- `config.spec.ts` covers the constructor pipeline, section compilers, overlay resolution, property defaults, `includeDefaultConnections` fabrication (name-based skip), reference failure modes, and the manifest URL state table.
- `runtime.spec.ts` covers the manifest lazy-read, explicit `buildManifest` wins, `EMPTY_BUILD_MANIFEST`, and `releaseConnections` forwarding.
- When adding a new backend with a registry default that references an overlay, add a test that the default is dropped (not errored) when the overlay is the no-op.

## Things That Look Like They Should Be Simple But Aren't

- **A single-key object isn't always a reference.** In `json`-typed slots and in `virtualMap`, it's literal data. The section-compiler boundary is what makes this safe.
- **`manifestURL` computation uses `configURL`, not `rootDirectory`.** The manifest hangs off the config file's directory, not the project root. These are different URLs when the config file lives in a subdirectory.
- **Property defaults run *after* overlay resolution of explicit values**, so a user who sets a property to a reference that resolves to `undefined` gets the same silent-drop as if they'd omitted the property — and then the default fills in. This is intentional and composes cleanly; don't "fix" it by conflating the phases.
- **Reference resolution is deferred to `lookupConnection`.** `MalloyConfig`'s constructor stays sync and zero-IO so it's safe to build anywhere. Overlays with async dependencies (secret stores, session reads) get a natural async seam at lookup. A consequence: `config.log` is populated incrementally as connections are looked up — warnings for a never-used connection never appear.
- **`wrapConnections` can be called multiple times.** Each wrap sees the previous wrap's result as `base`. Hosts that need ordered layering (VS Code's three-level resolution) rely on this.
