# Malloy Configuration

How users and host applications configure Malloy: the `malloy-config.json` file format, overlay references for values that don't belong in a file, configuration discovery, and how a host embeds `MalloyConfig` into a `Runtime`.

This is the user-facing guide. For the internals (how the pipeline is built, security invariants, failure modes), see [`packages/malloy/src/api/foundation/CONTEXT.md`](../api/foundation/CONTEXT.md). For per-backend connection properties, see [`packages/malloy/src/connection/CONTEXT.md`](../connection/CONTEXT.md).

## Audiences

Configuration serves four user types, in order of increasing complexity:

- **Soloist** — Opens VS Code, creates a Malloy file, wants to query. Should never need to write a config file.
- **Shop** — Small team, shared repo in git, one or two databases. Credentials can't be checked in, but each developer needs them.
- **Developer** — Writes Malloy intended to run in another environment (Publisher, production). Needs local connections to differ from shipped ones.
- **Publisher** — Hosts Malloy models as a service. Source of truth is a database, not a file.

Each step up the ladder adds one mechanism. Soloists use registry defaults; shops add a config file; developers add overlays for secrets; Publisher-style hosts assemble a POJO programmatically and install custom overlays.

## The Config File

A Malloy project is configured by a `malloy-config.json` file at the project root:

```json
{
  "connections": {
    "warehouse": {
      "is": "duckdb",
      "databasePath": "data/warehouse.duckdb"
    },
    "prod": {
      "is": "postgres",
      "host": "prod.example.com",
      "password": {"env": "PG_PASSWORD"}
    }
  }
}
```

Top-level keys:

| Key | Purpose |
|---|---|
| `connections` | Named connection entries. Each has an `is` field naming a registered backend, plus backend-specific properties. |
| `manifestPath` | Directory where the build manifest lives, relative to the config file. Defaults to `MANIFESTS`. May be a string literal or a sync-resolving overlay reference (e.g. `{"env": "MALLOY_MANIFEST_PATH"}`). |
| `givensPath` | File where per-runtime [given](givens.md) values live, relative to the config file. JSON object of `name → value` pairs. May be a string literal or a sync-resolving overlay reference. |
| `virtualMap` | URL rewrite rules for sources that reference virtual locations. Literal — no overlay expansion. |
| `includeDefaultConnections` | If `true`, fabricate one entry per registered backend type not already listed. See below. |

Any non-`json`-typed property value — both inside `connections` and at the top level (`manifestPath`, `givensPath`) — may be a reference instead of a literal. See [Overlay References](#overlay-references). Top-level references carry one extra constraint: the overlay must resolve synchronously, because these values are read at construction time.

## Overlay References

Some values don't belong in a file — secrets, host-specific paths, session tokens. These are referenced rather than written literally. A reference is a single-key object where the key names the overlay source and the value is the path into it:

```json
{
  "password": {"env": "PG_PASSWORD"},
  "workingDirectory": {"config": "rootDirectory"},
  "token": {"session": ["credentials", "accessToken"]}
}
```

Built-in overlay sources:

- **`env`** — environment variables. `{env: "NAME"}` resolves to `process.env.NAME` on Node, or whatever the host wires up on WASM/browser builds.
- **`config`** — host context. Built internally by `MalloyConfig` from the typed `configURL` and `rootDirectory` fields the host supplies (or that `discoverConfig` computed). The `config` slot is reserved by `MalloyConfig`; hosts pass the values directly via the constructor's options object instead of writing an overlay function.

Hosts can register additional overlays — VS Code adds a `secret` overlay backed by VS Code's SecretStorage; Publisher adds a `session` overlay backed by the request. A `malloy-config.json` that uses only `{env: ...}` references is portable between hosts. One that uses `{secret: ...}` is not — only VS Code has a `secret` overlay.

Overlays may be synchronous or asynchronous — an overlay's return type is `unknown | Promise<unknown>`. Use sync for purely in-memory sources (env vars, context dicts); use async for anything that touches IO (secret stores, session fetches, enterprise-injected values). Reference resolution is deferred to connection-lookup time (already async), so async overlays don't force the host to change anything else.

**Sync-only at the top level.** Top-level string settings written as references (`manifestPath: {env: "..."}`, `givensPath: {env: "..."}`) must resolve synchronously. They feed into `manifestURL` and `givensURL`, which are computed once in the `MalloyConfig` constructor — and constructors can't `await`. If an overlay returns a Promise for one of these, `MalloyConfig` pushes a loud warning to `config.log` and drops the value; without the warning, persistence (or per-runtime givens) would silently stop working.

### Failure Modes

References fail in four distinguishable ways, each handled differently:

1. **Unknown overlay source** (`{zzz: "foo"}` when no `zzz` overlay is registered) — logged as a warning to `config.log`; the property is dropped. Almost always a typo or host/config mismatch.
2. **Known overlay returns `undefined`** (`{env: "MISSING_VAR"}` — env var unset) — silently dropped. Legitimate "value not present" state. If the dropped property was required, the connection factory complains when the connection is built (lazy, at lookup time), not at config-build time.
3. **Unresolved reference inside a default** — silently dropped. Defaults are hints, not requirements.
4. **Async overlay used in a sync-only slot** (e.g. `manifestPath: {secret: "X"}` when `secret` returns a Promise) — logged as a loud warning to `config.log` and dropped. Top-level string settings are read at construction time and can't `await`; this is misuse, not a missing value. The same rule applies to `configURL` on the host-supplied `config` overlay.

A consequence: a typo'd env var and an unset env var are indistinguishable. This matches established behavior.

Mode 1 fires at construction time for top-level references and at first lookup for connection-property references — a consequence of when each is resolved. Mode 4 only fires at construction time, since it's specific to the sync-only slots. Modes 2 and 3 are silent in both cases.

### The `json` Property Type

Some connection properties (Trino's `ssl`, `session`, `extraHeaders`, etc.) are declared as `type: 'json'` in the registry. These pass through literally — their contents are never interpreted as overlay references. `{env: "X"}` inside a `json` property is literal data.

This is a security invariant: `json`-typed slots can't smuggle overlay lookups. Only properties declared with a scalar type can carry references.

## Defaults

Two mechanisms fill in missing values, from two different directions:

**Property defaults** — each registered connection property can declare a default value. If a connection entry doesn't set the property, the registered default fills it in. Applies uniformly to every entry, whether the user wrote it or it was fabricated.

DuckDB's `workingDirectory` default, for example, is `{config: "rootDirectory"}`. Any duckdb entry that doesn't explicitly set `workingDirectory` picks up the project root from the `config` overlay. The user never has to know that `workingDirectory` exists.

**`includeDefaultConnections`** — a boolean flag at the top of the config. When `true`, the resolver fabricates one connection entry per registered backend type not already named in `connections`. The fabricated entry has no explicit properties; property defaults then fill it in as usual.

A soloist can get working connections with nothing but:

```json
{"includeDefaultConnections": true}
```

…which yields `duckdb`, `bigquery`, `postgres`, etc. — each with registry defaults applied. A host with no config file at all typically does the same thing by constructing `new MalloyConfig({includeDefaultConnections: true})` as a fallback.

The fabricator skips a type `T` only if some existing entry is *named* `T`. The `is` of user entries doesn't enter into it: writing `{dankdb: {is: 'duckdb'}}` leaves the slot named `duckdb` free, so a phantom `duckdb` is still added and both are reachable. Writing `{duckdb: {is: 'postgres', ...}}` does occupy the `duckdb` slot — naming wins, regardless of the backend it points at.

## Discovery

Local hosts (VS Code, CLI, AI tools) find the config file by walking up from the Malloy file toward a ceiling URL (the workspace root or `--projectDir`):

```typescript
const config = await discoverConfig(startURL, ceilingURL, urlReader);
```

At each level, the walker looks for `malloy-config.json` and `malloy-config-local.json`. On a hit it returns a fully-constructed `MalloyConfig` with the `config` overlay already wired. On a miss it returns `null` — the host decides what to do (typically build a minimal `MalloyConfig` with `includeDefaultConnections: true`).

A **file-not-found** at a given level is normal — the walker moves on. A file that *is* present but unparseable is a hard error — silently skipping would hide typos.

### The `-local` Variant

`malloy-config-local.json` sits next to `malloy-config.json`, and is intended to be `.gitignore`'d. It holds developer-specific values — credentials, local paths. When both files exist at the same level, the local file **supersedes the shared file entirely** — no merging of connections or any other section. The developer writing the local file is responsible for including everything they need.

### `rootDirectory` vs. `configURL`

`MalloyConfig` carries two distinct filesystem anchors as readonly fields, both URL-shaped strings:

- **`config.configURL`** — where the config file lives. The base for resolving `manifestPath` and `givensPath`. Set by `discoverConfig` to the URL of the matched file. POJO callers pass it directly in the constructor's options.
- **`config.rootDirectory`** — the project root. Available to connection-property defaults via the `{config: 'rootDirectory'}` overlay-reference shape. Set by `discoverConfig` to the ceiling of the discovery range. Opaque to foundation — consumers (e.g. DuckDB) decide what to do with it.

DuckDB's `workingDirectory` binds to `rootDirectory`, not to the config file's directory. This means relative data paths in Malloy files stay stable regardless of where a developer chose to put their `malloy-config.json`.

### DuckDB Working Directory

DuckDB resolves relative file paths (`read_parquet('foo.parquet')`) against a connection-level anchor. Without a stable answer to "what does `foo.parquet` mean?", the same Malloy source means different things depending on which file imports it. The config system answers this with a contract: any host that knows where the project lives populates `config.rootDirectory`, and DuckDB's registered default wires `workingDirectory` to it. No DuckDB-specific code, no per-file injection — the policy lives in one `default` field on one property in one registry entry.

## Manifest

When a model uses `#@ persist` sources, the Runtime needs a build manifest to substitute persisted table names. `MalloyConfig` computes `manifestURL = (manifestPath ?? 'MANIFESTS')/malloy-manifest.json` relative to `configURL`. Three ways to provide the actual manifest content:

- **Auto-read (default).** The Runtime lazily reads `manifestURL` on the first persistence query, caches it, and soft-misses to `undefined` if the file is missing or malformed.
- **Constructor option.** Pass `buildManifest:` to `new Runtime(...)` — wins over auto-read.
- **Setter.** `runtime.buildManifest = manifest` — clears the auto-read cache so the next compile sees the new value.

To bypass substitution entirely:

```typescript
import {EMPTY_BUILD_MANIFEST} from '@malloydata/malloy';
const rawSQL = await runtime
  .loadQuery(modelURL, {buildManifest: EMPTY_BUILD_MANIFEST})
  .getSQL();
```

## Givens

When a model declares [givens](givens.md) (named values supplied at run time), the per-runtime layer of values can live in a JSON file pointed at by `givensPath`:

```jsonc
// malloy-config.json
{
  "givensPath": "./local-givens.json"
}
```

The values file is a flat JSON object of `name → value` pairs:

```jsonc
// local-givens.json
{
  "TENANT": "acme",
  "USER_ROLE": "admin",
  "CUTOFF_DATE": "2024-01-01"
}
```

Per-environment routing is the canonical use of the env-overlay form on `givensPath`:

```jsonc
{
  "givensPath": {"env": "MALLOY_GIVENS_FILE"}
}
```

A developer sets `MALLOY_GIVENS_FILE` to a local fixture; CI sets it to a test fixture; production sets it to a deployment-managed file. Same project config everywhere; the env-var binding chooses the actual file.

**Resolution.** `MalloyConfig` computes `givensURL` from `givensPath` joined against `configURL`. The Runtime lazily reads the file on the first compile that needs givens, parses JSON, and uses the values as defaults for every query that runs through it. Per-query supply via `.run({givens: ...})` overrides the per-runtime layer per-key.

**Failure policy.** Stricter than the manifest: a missing `givensPath` file or malformed JSON throws on the first compile, with the resolved URL in the error message. The per-runtime givens layer is a configured contract, not an opportunistic read; a misconfigured path should fail loudly at the first compile, not silently degrade.

**Type validation.** Each value is validated against the type declared in the model's `given:` block. Mismatches throw at the API boundary with a path that points at the offending location (e.g. `givens.SESSION.user_id: expected string, got number`). For the per-type accepted JS shapes (strings, numbers, dates, compound types), see [the givens language doc](givens.md).

If `givensPath` is set but no `configURL` is available, `MalloyConfig` warns at construction time — the path can't be resolved against any anchor, so the per-runtime layer won't be loaded. Pass `configURL` in the constructor's options to fix.

## Embedding

### Local host (VS Code, CLI, AI tooling)

```typescript
import '@malloydata/malloy-connections'; // registers all backends
import {Runtime, MalloyConfig, discoverConfig} from '@malloydata/malloy';

const config =
  (await discoverConfig(startURL, projectRootURL, urlReader)) ??
  new MalloyConfig(
    {includeDefaultConnections: true},
    {rootDirectory: projectRootURL.toString()}
  );

const runtime = new Runtime({config, urlReader});
```

VS Code layers three levels with strict priority — project config (discovered) → global config (from `globalConfigDirectory`) → settings + defaults (legacy/soloist). First match wins, no merging between levels. The presence of a config file is the trust boundary: once a file is active, settings connections don't leak in unless the file opts in via `includeDefaultConnections: true`.

### Data-center host (Publisher)

The source of truth is a database, not a file. Assemble a POJO from state, and install custom overlays:

```typescript
const config = new MalloyConfig(publisher.buildConfig(packageId), {
  configURL: publisher.configURL(packageId),
  rootDirectory: publisher.packageRoot(packageId),
  overlays: {session: sessionOverlay(request)},
});
const runtime = new Runtime({config, urlReader});
```

The `env` overlay is inherited from the defaults; the `config` overlay is built internally from `configURL` + `rootDirectory`; `session` is an additional host-defined overlay.

### Decorating the connection lookup

Hosts that need per-name behavior (settings fallbacks, session attachments) wrap the lookup in place:

```typescript
config.wrapConnections(base => ({
  lookupConnection: async name => {
    const c = await base.lookupConnection(name);
    attachHostBehavior(c);
    return c;
  },
}));
```

`wrapConnections` mutates `config`. After wrapping, `config.connections` returns the wrapped version. Runtime doesn't know or care.

### Releasing connections

```typescript
await runtime.releaseConnections();
```

Signals every connection the runtime has handed out to release its resources (pools, sockets, file handles, in-process DBs). The contract is one `MalloyConfig` per `Runtime`. Long-running hosts should call this; one-shot CLIs can skip it.

## Backward Compatibility

These construction modes all continue to work:

- `new Runtime({connection: myConnection})` — single explicit `Connection`
- `new Runtime({connections: myLookup})` — explicit `LookupConnection`
- `new MalloyConfig(jsonText)` — legacy string form for existing `malloy-config.json` files
- The soloist path — no config file, just registered defaults

Existing `malloy-config.json` files work as-is. The `{env: "NAME"}` syntax has been in use since before overlays existed; the new design recognizes it as a general-purpose overlay reference shape.

**Constructor options shape.** The `MalloyConfig` constructor's second argument used to be a `ConfigOverlays` dict — a map of overlay-name → function. It now accepts a typed options object:

```typescript
new MalloyConfig(pojo, {
  configURL?: string,
  rootDirectory?: string,
  overlays?: ConfigOverlays,  // env, host-defined; `config` slot reserved
});
```

The legacy `ConfigOverlays`-dict shape is detected at runtime and adapted automatically (with `@deprecated` markers on the affected overload). Callers can migrate when convenient — the old form keeps compiling and running.
