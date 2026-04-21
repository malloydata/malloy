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
| `manifestPath` | Directory where the build manifest lives, relative to the config file. Defaults to `MANIFESTS`. |
| `virtualMap` | URL rewrite rules for sources that reference virtual locations. Literal — no overlay expansion. |
| `includeDefaultConnections` | If `true`, fabricate one entry per registered backend type not already listed. See below. |

Any non-`json`-typed property value may be a reference instead of a literal (see [Overlay References](#overlay-references)).

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
- **`config`** — host context. Discovery populates this with `rootDirectory` (the project root) and `configURL` (the location of the matched file). Defaults to a no-op that returns `undefined` for everything.

Hosts can register additional overlays — VS Code adds a `secret` overlay backed by VS Code's SecretStorage; Publisher adds a `session` overlay backed by the request. A `malloy-config.json` that uses only `{env: ...}` references is portable between hosts. One that uses `{secret: ...}` is not — only VS Code has a `secret` overlay.

Overlays may be synchronous or asynchronous — an overlay's return type is `unknown | Promise<unknown>`. Use sync for purely in-memory sources (env vars, context dicts); use async for anything that touches IO (secret stores, session fetches, enterprise-injected values). Reference resolution is deferred to connection-lookup time (already async), so async overlays don't force the host to change anything else.

**One exception.** The `config` overlay must resolve the `configURL` key synchronously. `manifestURL` is computed once in the `MalloyConfig` constructor from `configURL` + `manifestPath`, and that single peek is the one place overlay IO can't be awaited. If a host's `config` overlay returns a Promise for `configURL`, `MalloyConfig` pushes a warning to `config.log` and leaves `manifestURL` undefined (persistence silently stops working otherwise). Other keys in the `config` overlay — `rootDirectory`, host-specific context — can still be async; only `configURL` is sync-only.

### Failure Modes

References fail in three distinguishable ways, each handled differently:

1. **Unknown overlay source** (`{zzz: "foo"}` when no `zzz` overlay is registered) — logged as a warning to `config.log` when the affected connection is looked up (not at construction time); the property is dropped. Almost always a typo or host/config mismatch.
2. **Known overlay returns `undefined`** (`{env: "MISSING_VAR"}` — env var unset) — silently dropped. Legitimate "value not present" state. If the dropped property was required, the connection factory complains when the connection is built (lazy, at lookup time), not at config-build time.
3. **Unresolved reference inside a default** — silently dropped. Defaults are hints, not requirements.

A consequence: a typo'd env var and an unset env var are indistinguishable. This matches established behavior.

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

The fabricator skips a type `T` if some existing entry either has `is: "T"` or is *named* `T`. The second rule lets a user write `{duckdb: {is: 'postgres', ...}}` — naming an entry `duckdb` but pointing it at a different backend — without the fabricator silently adding a second entry of the same name.

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

The ceiling is the **project root** — exposed as `config.rootDirectory`. The config file's directory is **incidental** — exposed as `config.configURL` separately, for tools that care.

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

## Embedding

### Local host (VS Code, CLI, AI tooling)

```typescript
import '@malloydata/malloy-connections'; // registers all backends
import {Runtime, MalloyConfig, discoverConfig, contextOverlay} from '@malloydata/malloy';

const config =
  (await discoverConfig(startURL, projectRootURL, urlReader)) ??
  new MalloyConfig(
    {includeDefaultConnections: true},
    {config: contextOverlay({rootDirectory: projectRootURL.toString()})}
  );

const runtime = new Runtime({config, urlReader});
```

VS Code layers three levels with strict priority — project config (discovered) → global config (from `globalConfigDirectory`) → settings + defaults (legacy/soloist). First match wins, no merging between levels. The presence of a config file is the trust boundary: once a file is active, settings connections don't leak in unless the file opts in via `includeDefaultConnections: true`.

### Data-center host (Publisher)

The source of truth is a database, not a file. Assemble a POJO from state, and install custom overlays:

```typescript
const config = new MalloyConfig(publisher.buildConfig(packageId), {
  config: publisherOverlay(packageId),
  session: sessionOverlay(request),
});
const runtime = new Runtime({config, urlReader});
```

The `env` overlay is inherited from the defaults; `config` is replaced with a Publisher-specific one that knows package roots; `session` is added.

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
