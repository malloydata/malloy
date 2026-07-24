# Persistence — the API

**Status:** experimental, gated by `##! experimental.persistence`

Persistence lets an expensive source be computed once, written to a table, and
substituted for its own SQL when a query uses it. Three pieces:

- **The annotation** — `#@ persist` marks a source as one that should be
  materialized. It changes nothing about what the source *means*.
- **The builder** — an application that walks the model, runs `CREATE TABLE`,
  and records what it built in a *manifest*.
- **The manifest** — a map from `BuildID` (a hash of the source's SQL and its
  connection) to a table name. The compiler consults it and substitutes the
  table for the source's SQL.

The core provides exactly those three primitives: annotation, a
dependency-ordered build plan, and compile-time substitution. When to build,
what to name tables, how to invalidate, what to do about failures, and how to
handle environments are all the builder's business — see
[Building persistent sources](#building-persistent-sources).

For the implementation, see [internal.md](internal.md).

## Malloy syntax

```malloy
##! experimental.persistence

source: flights is duckdb.table('flights.parquet') extend {
  measure: flight_count is count()
}

#@ persist name=by_carrier
source: by_carrier is flights -> {
  group_by: carrier
  aggregate: flight_count
}

// Persistence is inherited through extend
source: enriched_carriers is by_carrier extend {
  dimension: upper_carrier is upper(carrier)
}

// ...and opted out of
#@ -persist
source: not_persisted is by_carrier extend { /* ... */ }

// %{ } interpolation resolves against the manifest too
#@ persist name=embeddings
source: embeddings is conn.sql("""
  SELECT * FROM ML.GENERATE_EMBEDDING(
    MODEL `my_model`,
    (SELECT content, id FROM %{ by_carrier })
  )
""")
```

Only sources backed by a computation can be persisted: `query_source`
(`source: x is y -> {...}`) and `sql_select` (`source: x is conn.sql("...")`).
A table source has nothing to materialize; a composite source is not supported.

`#@` is the persistence route (see [Prefix and route](../../../../../CONTEXT.md)).
The core reads exactly one thing from it: whether `persist` is present.
Everything else in the annotation is builder metadata. `name=` is a convention
of `malloy-cli build`, which uses it as the table name and errors without it;
another builder is free to name tables its own way. The value is MOTLY, so
anything beyond a bare identifier needs quoting — `name="sales.by_carrier"`,
not `name=sales.by_carrier`.

Inheritance falls out of annotation inheritance: an extending source inherits
the base's annotations, so it inherits `persist`. `#@ -persist` removes the
property and breaks the chain.

The `##! experimental.persistence` flag is required, and it travels: a model
that extends or imports a model carrying the flag has it too.

## The manifest file

```json
{
  "entries": {
    "3f9a…": {"tableName": "by_carrier"},
    "b241…": {"tableName": "analytics.origin_summary"}
  },
  "strict": true
}
```

The default location is `<configDir>/MANIFESTS/malloy-manifest.json`, where
`MANIFESTS` is the config's `manifestPath` (ALL CAPS to signal a generated
artifact; no dot prefix so it stays visible). `Manifest.loadText()` also
accepts the legacy flat form — `{"<buildId>": {"tableName": …}, …}` with no
`entries` key.

Every `tableName` must be a canonical table path for its dialect. This is
enforced everywhere a name can enter the system: `Manifest.update()`,
`Manifest.loadText()`, the Runtime's file read, and again at compile time.

`strict` controls what happens when a persist source's BuildID is *not* in the
manifest — see [Strict mode](#strict-mode).

## Running queries against persisted tables

This is the query runner's view: VS Code, a notebook server, a query service.

```typescript
import '@malloydata/malloy-connections'; // registers connection factories
import {Runtime, discoverConfig} from '@malloydata/malloy';

const config = await discoverConfig(startURL, ceilingURL, urlReader);
const runtime = new Runtime({config, urlReader});

const result = await runtime.loadQuery(modelURL).run();
```

That is the whole setup. On the first query that could use persistence, the
Runtime reads `config.manifestURL` through its `URLReader`, caches the result,
and substitutes tables for any persist source it finds an entry for. If the
manifest is absent or empty, sources expand inline and persistence is
invisible.

A manifest can also be supplied directly, which bypasses the auto-read:

```typescript
const runtime = new Runtime({config, urlReader, buildManifest});
// ...or later
runtime.buildManifest = buildManifest;   // undefined clears it
```

and overridden for one query:

```typescript
import {EMPTY_BUILD_MANIFEST} from '@malloydata/malloy';

// The SQL as if nothing had ever been built
const rawSQL = await runtime
  .loadQuery(modelURL, {buildManifest: EMPTY_BUILD_MANIFEST})
  .getSQL();
```

Precedence: per-query `options.buildManifest` > explicit `Runtime` manifest
(constructor or setter) > lazily-read `config.manifestURL` > none. Setting the
Runtime property drops the cached auto-read promise, so the next compile sees
the new value rather than a stale soft miss.

### What happens when things are missing

- **No manifest file** — soft miss. No substitution, no error. This is the
  ordinary case for a project that does not use persistence.
- **Manifest file present but unparseable** — the Runtime yields
  `{entries: {}, loadError}`. Non-strict compiles still fall through to inline
  SQL; strict compiles include the load error in the throw, so the user learns
  *why* every entry appears to be missing.
- **Empty and non-strict** — treated as no manifest at all; persistence checks
  are skipped entirely.
- **Manifest without `##! experimental.persistence` on the model** — an
  explicitly-passed non-empty manifest throws
  (`runtime-manifest-needs-persistence-flag`), because the caller clearly meant
  it. A manifest that merely came from config is silently ignored.

### Strict mode

When `strict` is true, a persist source whose BuildID is not in the manifest
throws (`runtime-manifest-strict-miss`) instead of falling through to inline
SQL. That is the difference between finding out at compile time that a table
was never built and finding out from the bill for the query that ran instead.

Strict lives in the manifest file so it travels with it, and an application can
override it before handing the manifest to a Runtime:

```typescript
manifest.strict = false;
```

`malloy-cli build` sets `strict: true` on a manifest it creates, and never
changes the flag on one that already exists — so the setting is yours to keep
once made.

The useful spectrum: **no manifest** during development, everything inline;
**partial manifest** for incremental builds, some sources built and some not,
which the compiler does not care about; **full manifest, strict** in
production.

## Building persistent sources

`malloy-cli build` is the production builder;
[`scripts/simple_builder/build.ts`](../../../../../scripts/simple_builder/build.ts)
is a teaching implementation of the same contract with the config discovery,
multi-connection support, and error reporting stripped out. Read it alongside
this section.

### The build plan

```typescript
const model = await runtime.loadModel(modelURL).getModel();
const plan = model.getBuildPlan();   // throws without ##! experimental.persistence
```

`BuildPlan` is `{graphs, sources, tagParseLog}`:

- `graphs: BuildGraph[]` — one per connection, so a builder can work several
  databases in parallel.
- `sources: Record<SourceID, PersistSource>` — every persist source reachable
  from the model, keyed by `sourceID` (`"name@modelURL"`).
- `tagParseLog: LogMessage[]` — errors from parsing the `#@` annotations.
  Report these; a malformed annotation is a build problem.

**Walk `dependsOn`, not the levels.** `BuildGraph.nodes` is typed
`BuildNode[][]`, which anticipates a leveled schedule, but `getBuildPlan()`
currently emits a single level holding the *root* nodes — the sources nothing
else depends on. Each root carries its dependency tree in `dependsOn`, and a
builder that iterates only `graph.nodes` will never build a dependency. Flatten
depth-first, dependencies first, as
[`scripts/simple_builder/build_graph.ts`](../../../../../scripts/simple_builder/build_graph.ts)
and `malloy-cli`'s copy of it both do:

```typescript
for (const node of flattenBuildNodes(graph.nodes.flat())) { /* build it */ }
```

Flattening the whole graph in one call also collapses the repeats a diamond
produces. (The CLI flattens per root and dedups by `sourceID` afterwards, which
comes to the same thing; left alone, a repeat visit would simply find the entry
in the manifest and touch it.)

### PersistSource

From `plan.sources[sourceID]`:

| Member | Meaning |
|---|---|
| `name`, `sourceID` | The source's name, and its stable `"name@modelURL"` identity |
| `connectionName`, `dialectName`, `dialect` | Where and how it will be built |
| `annotations`, `modelAnnotations` | `annotations.parseAsTag('@')` reads the builder's own `#@` properties |
| `getSQL(options?)` | The SQL for this source |
| `makeBuildId(connectionDigest, sql)` | The cache key |

`tagParse()`, `getTaglines()`, and `annotation` are deprecated in favor of
`annotations`.

### Two SQLs, and why

`getSQL()` answers differently depending on whether it is given a manifest, and
a builder needs both answers:

- **BuildID SQL** — `getSQL()` with no options. Fully inlined, no substitution.
  This is what gets hashed. Because it never mentions a materialized table, the
  BuildID is the same no matter what has been built already, so build order
  cannot change a cache key.
- **Build SQL** — `getSQL({buildManifest, connectionDigests})`. Dependencies
  already in the manifest are replaced by their table names. This is what you
  execute: it reads from the tables you just built instead of recomputing them
  inline.

`getSQL()` compiles with `finalize=false`, so what comes back is the bare
source `SELECT`. The build-time key must equal the key the compiler recomputes
at serve time; on a dialect with a final stage (Postgres) a finalized SQL would
diverge from it and the table would be materialized under a key nothing ever
looks up.

### The Manifest class

`Manifest` is the builder's handle on manifest state. It does no IO — the
caller reads and writes the file with whatever it already has.

```typescript
const manifest = new Manifest();
manifest.loadText(jsonText);          // replaces all state

manifest.buildManifest;               // live BuildManifest — a stable reference
manifest.strict;                      // get/set
manifest.update(buildId, {tableName});// add or replace, and mark active
manifest.touch(buildId);              // mark active without changing it
manifest.activeEntries;               // only what this run touched or updated
```

Two properties carry the weight:

`buildManifest` is a **stable reference** — `loadText()` and `update()` mutate
the same object. That is what makes a dependency chain work inside one build
run: `update()` a source and the very next `getSQL({buildManifest, …})` sees its
table name instead of its inline SQL. It also means a Runtime handed this
reference always sees current data without reassignment.

`activeEntries` is **how garbage collection works**. Write it, not
`buildManifest`, and entries from previous builds that this run never
referenced are pruned. A separate pass can then drop the orphaned tables.

### The builder contract

1. **Load** the existing manifest, if any, with `Manifest.loadText()`.
2. **Compile** the model. Do not pass the manifest here; substitution happens
   in step 4.
3. **Plan** with `model.getBuildPlan()`, and cache one `connection.getDigest()`
   per connection name.
4. **Build**, walking each graph's roots and their `dependsOn` trees
   dependencies-first. Per source: hash `getSQL()` (no options) with the
   connection digest to get the BuildID; if the manifest already has it,
   `touch()` and move on; otherwise `CREATE TABLE` from
   `getSQL({buildManifest, connectionDigests})` and `update()` the manifest
   immediately, so dependents see the table.
5. **Write** `manifest.activeEntries`.

Over several model files, keep one `Manifest` for the whole run. `touch()` and
`update()` accumulate across files, so `activeEntries` prunes against
everything the run referenced rather than against the last file.

### Turning a name into a table

`#@ persist name=…` is user-supplied text, and the manifest requires a
canonical table path. `PersistSource.dialect.sqlValidateTableName(name)` is the
bridge — it returns `{ok: true, canonical}` or `{ok: false, error}`.

**Build with the canonical form and record that same form in the manifest.**
For most dialects `canonical` is the input verbatim, so the distinction is easy
to miss; DuckDB's file-path branch is the exception, quoting the input to make
it a legal table reference. Create one name and record the other and the
manifest ends up naming a table that was never created — sometimes loudly, when
the raw text isn't canonical anywhere and `update()` rejects it, and sometimes
silently, when it happens to be canonical in some *other* dialect's grammar.

Note that a name is only consulted when a source is actually built. Because the
BuildID hashes SQL, editing `name=` alone leaves the BuildID unchanged: the
existing entry still matches, gets touched, and keeps its old table name. A
rename takes effect the next time the source's SQL changes, or when you force a
rebuild.

### Freshness is yours

The core knows only whether a BuildID is present in the manifest. It has no
notion of age, and no notion of whether the table the entry names still exists.
A manifest routinely outlives its database — a file deleted, a project copied
without its data directory, a restore that skipped it — and a builder that
trusts the entry blindly reports "up to date" over nothing at all.

`malloy-cli` handles this by probing before it trusts a skip: it compiles
`source: __x is <conn>.table('<tableName>')` and rebuilds if that fails. Going
through a real compile means success proves the entry can actually back a
query, not merely that something exists in the catalog. Any policy of this kind
— age limits, schedules, environment rules — belongs to the builder and is
invisible to the core.

## Limitations

- Parameterized sources are not supported with persistence.
- Composite sources are not supported with persistence; their `sources[]` are
  deliberately not walked for dependencies.
