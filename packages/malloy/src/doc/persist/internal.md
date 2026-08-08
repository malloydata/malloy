# Persistence — internals

**Status:** experimental, gated by `##! experimental.persistence`

How `#@ persist` is implemented in `@malloydata/malloy`. For the annotation,
the manifest format, and the builder contract, see [api.md](api.md). The design
of record is **WN-0022** in the
[whatsnext](https://github.com/malloydata/whatsnext) repository
(`wns/WN-0022-persistence/`); this document describes the implementation, and
where the two disagree, WN-0022 says what was meant.

## Terminology

A **persistable source** is one backed by a computation — a `QuerySourceDef`
(`source: x is y -> {...}`) or an `SQLSourceDef` (`source: x is conn.sql(...)`).
Those are the only sources whose result can be materialized to a table.
`isPersistableSourceDef()` is the test. Table sources have nothing to compute;
composite sources are excluded by design.

A **persistent source** is a *named* persistable source carrying `#@ persist`.
Named gives it a `SourceID`; the annotation sets `persistent: true` on the IR.
Manifest substitution gates on `persistent`, never on `sourceID` — which is why
a non-persistent query source used as a join never reaches the manifest.

## The IR

In [`model/malloy_types.ts`](../../model/malloy_types.ts):

```typescript
interface SourceDefBase … {
  sourceID?: SourceID;      // this source's own identity, "name@modelURL"
  referenceID?: SourceID;   // set only when created as an unmodified reference
}

interface PersistableSourceProperties {
  extends?: SourceID;
  persistent?: boolean;
}
```

`sourceID` is on **every** source, not just persistable ones — it is general
identity that persistence happens to consume, gated by
`isPersistableSourceDef()`. `referenceID` is set when a source was created as an
unmodified reference to another (`source: a is b`, a plain join) and holds the
referenced source's `sourceID`; it is absent when the source defines its own
shape or was modified/extended. Only `extends` and `persistent` are
persistence's own.

`SourceID` is `"name@url"` (`mkSourceID`), and only named sources get one —
anonymous sources, inline queries, and intermediate pipeline stages never do.
`BuildID` is the content hash described [below](#buildid-and-connection-digests).

These are the two identities WN-0022 says a builder has to understand, and they
are **not one-to-one**: a SourceID names a source, a BuildID names a table, and
one table routinely has several SourceIDs pointing at it. Nothing in the model
reconciles them, because a BuildID cannot be computed without a connection. That
is the whole job of `getBuildTargets` — treating a plan node as a table is the
mistake the shape invites. The readable form of a SourceID is for debugging
only; it is conceptually opaque, and nothing should parse it.

The manifest types:

```typescript
interface BuildManifestEntry { tableName: string; }

interface BuildManifest {
  entries: Record<BuildID, BuildManifestEntry>;
  strict?: boolean;
  loadError?: string;
}
```

`loadError` exists so a strict-mode throw can say *why* the manifest looks
empty. The Runtime sets it when the file was present but unreadable as a
manifest; `entries` stays `{}` so non-strict compiles still fall through.

**The factories do not spread.** `mkQuerySourceDef` and `mkSQLSourceDef` in
[`model/source_def_utils.ts`](../../model/source_def_utils.ts) explicitly list
the fields they copy, dropping `sourceID` / `referenceID` / `extends` /
`persistent`, so a freshly derived source never inherits another source's
identity. The translator does the opposite deliberately: it spreads to *carry*
`sourceID`/`referenceID` through an unmodified reference, `DefineSource` then
sets them, and `DynamicSpace` clears `referenceID` on the modification path.

## Where `persistent` is decided

`DefineSource` in
[`lang/ast/statements/define-source.ts`](../../lang/ast/statements/define-source.ts),
after merging annotations onto the entry:

```typescript
entry.sourceID = mkSourceID(this.name, this.location?.url);
if (isPersistableSourceDef(entry)) {
  entry.persistent = checkPersistAnnotation(entry).persist;
}
```

`checkPersistAnnotation()` (in
[`model/persist_utils.ts`](../../model/persist_utils.ts)) parses the source's
annotations on the `@` route and asks `tag.has('persist')`. Because the entry's
annotations already carry `inherits` from the base at this point, extending a
persist source yields `persist` again, and `#@ -persist` removes the property
and stops the chain. The flag is resolved once, at translation time, and baked
into the IR.

## The source registry

Persistence needs to turn a `SourceID` into a `SourceDef` — for dependency
walking, for annotation checks, for the build plan. Within one model, names in
`modelDef.contents` would do. Across an import they will not: the imported model
is gone, only what was imported into the local namespace survives, and an
imported source's persistent dependencies may not have been imported at all.

`ModelDef.sourceRegistry` maps `SourceID → SourceRegistryValue`:

```typescript
type SourceRegistryEntry = SourceRegistryReference | PersistableSourceDef;

interface SourceRegistryValue {
  entry: SourceRegistryEntry;
  persist?: boolean;   // lazily computed
}
```

- A **`SourceRegistryReference`** means the source is in this model's namespace;
  it stores the name and resolution goes through `modelDef.contents`.
- A **`PersistableSourceDef`** means it is not; the definition is stored
  directly. This is the hidden-dependency case.

`resolveSourceRef()` resolves either form to a `SourceDef`;
`resolveSourceID()` narrows to a `PersistableSourceDef`. The registry also
backs `referenceID` resolution (`sourceNamespaceReference()`), so it is not
purely a persistence structure.

**Local population** happens in `Document.setEntry`
([`lang/ast/types/malloy-element.ts`](../../lang/ast/types/malloy-element.ts)):
every named source with a `sourceID` gets a `SourceRegistryReference`.

**Import population** happens in
[`lang/ast/statements/import-statement.ts`](../../lang/ast/statements/import-statement.ts).
For each persistable source being imported, it runs
`walkPersistentDependencies(source, importedModel)` — the walk happens *in the
imported model*, where the definitions still exist — and collects **every**
sourceID in the resulting graph into `neededSourceIDs`, routes included. Each
one not already registered locally is looked up in the imported model's
registry and, if it is a reference there, resolved to the actual `SourceDef`
before being registered here (the importer cannot resolve it by name; it is not
in the importer's namespace).

The result: a model's registry contains everything needed to build its full
dependency graph. A grandchild defines persistent `source_a`, a child extends it
as non-persistent `source_b`, a parent imports `source_b` — the parent's
registry holds `source_a` as a stored definition, though the parent never
imported it and it is in no namespace of the parent's.

The `persist` flag has two resolution paths for the same reason. Eagerly on the
IR at `DefineSource` time, which is what compiler substitution reads; and
lazily by `isPersistent()` during dependency walking, which is what a hidden
dependency needs — it arrived through an import and never went through
`DefineSource` here.

## Dependency walking

`walkPersistentDependencies(roots, modelDef, tagParseLog)` in
[`model/persist_utils.ts`](../../model/persist_utils.ts) is a **generator**. It
walks the IR from a list of sources and queries and yields a `PersistNode` per
source that matters to persistence, each one *after* everything it depends on.

```typescript
interface PersistNode {
  sourceID: SourceID;
  persistent: boolean;      // a table, or a route to one
  dependsOn: SourceID[];    // already yielded, by the time you see this
}
```

Edges are sourceIDs rather than nested nodes. Nothing shares an object, nothing
recurses, and a consumer folds the stream in a single pass — by the time a
source arrives, every dependency is already in whatever map the consumer is
building. Its return value (which `for...of` discards, so take it with an
explicit `.next()` loop) is what the roots themselves reached.

It takes a *list* of roots so one memo covers the whole model: a subtree two
model objects both reach is walked once and yielded once.

The six ways a `SourceDef` can be referenced — this list is the walk:

1. `Query.structRef` — the FROM clause
2. `Query.pipeline[].extendSource[]` — joins in extend blocks
3. `SourceDef.fields[]` — joins defined on a source
4. `PersistableSourceDef.extends` — the extend chain
5. `SQLSourceDef.selectSegments[]` — `%{ }` interpolation
6. `QuerySourceDef.query` — the inner query of a query source

`CompositeSourceDef.sources[]` is deliberately not walked.

**What survives the walk.** One rule, applied on the way back up:

> keep me if I am persistent, or if any child survived

The second clause needs no lookahead. A child only survived under this same
rule, so a surviving child *is* the proof that something persistent lies below.
For `a (persist) → b → c (persist) → d`: `d` has nothing beneath it and is
dropped, `c` is kept for being persistent, `b` is kept for leading to `c`.

So a source is emitted for one of two reasons, and `PersistNode.persistent`
says which. `true` is a table to build. `false` is a route — a source that
materializes nothing itself but is how the walk reached one that does.

**Three consumers, three folds.** None of them builds a graph.

`import-statement.ts` keeps every sourceID, routes included, because those are
what the importing model must be able to re-traverse. A `#@ -persist` wrapper
that adds a join is not a table, but it can be the only way to reach the tables
beneath it; copy just the persistent ones and an imported source silently
arrives with no dependencies at all.

`mkBuildTargets()` keeps a `sourceID → target keys` map. A persistent source
becomes (or joins) a target and contributes its own key; a route contributes
whatever its children contributed. That is how an edge survives a route, and
it costs one line rather than a pass.

`findPersistentDependencies()` folds the stream back into the nested
`BuildNode[]` that `Model.getBuildPlan()` returns. It exists only for that
deprecated call.

**Memoized, not merely visited**: a source reached a second time reports what
it reported the first time. Returning nothing on a second visit — what this did
until the build-schedule work — left the second dependent claiming no
dependencies, which a dependencies-first flatten happened to survive (the
dependency got built on the first dependent's account) and a schedule of
independent batches does not.

`minimalBuildGraph(deps)` takes the flat forest collected from every model
object and returns the **roots** — sourceIDs that nothing else depends on —
with their original nested structure intact.

## Build targets

`Runtime.getBuildTargets(model)` in
[`api/foundation/runtime.ts`](../../api/foundation/runtime.ts) is what a builder
consumes. `Model._walkPersistSources()` supplies the stream — every named source
and query plus the unnamed queries, as one walk — and `mkBuildTargets(nodes,
model, connectionDigests)` in
[`api/foundation/build_targets.ts`](../../api/foundation/build_targets.ts) folds
it. That split is where the async/sync boundary falls: fetching a digest per
connection is async, the fold is not, so the Runtime materializes the walk,
collects the digests it names, and hands both to the fold.

The walk emits *sources*; a builder needs *tables*, and the two counts differ by
construction — `#@ persist` is inherited and `extend` never changes the SQL, so
an extension or a rename of a persisted source is another sourceID naming the
same BuildID. One pass does it, because the walk is in dependency order:

1. a persistent source gets `getSQL()` and a BuildID, and joins the target keyed
   `(connectionName, buildId)` — creating it if new, appending to
   `target.sources` if not;
2. its children's target keys are already known, so its edges are written
   immediately, minus any that landed on its own key (an extension depending on
   its base is one table, not a dependency);
3. a route contributes its children's keys upward instead of a key of its own;
4. finally, targets are grouped by connection and leveled by longest path, so
   one sits strictly after everything it reads however many routes reach it.

Keying the merge on connection *and* BuildID rather than BuildID alone says what
a target is. The digest inside a BuildID makes them equivalent in practice; the
pair does not depend on that being true.

Connections come first in the result because no dependency crosses one — a
query cannot — so each is an independent build. Levels are numbered across the
whole model and then compacted per connection, so one connection's chain never
pushes another's first table down a level.

The cycle check in the leveling is unreachable for a well-formed model: a
target's BuildID SQL contains its dependencies' SQL inline, so two targets
cannot each contain the other. It throws rather than hangs if that stops
holding.

## The build plan (deprecated)

`Model.getBuildPlan()` in
[`api/foundation/core.ts`](../../api/foundation/core.ts) requires
`##! experimental.persistence`, read off `modelAnnotations` (the import/extend
fold) so the flag carries across extend. It walks every entry in
`modelDef.contents` plus `modelDef.queryList` through
`findPersistentDependencies()`, unions the forests, takes `minimalBuildGraph()`,
builds a `PersistSource` for every sourceID it saw, and groups the roots by
connection name.

`getBuildTargets` does not use it, and it is slated for removal once the
builders have moved. Two things it gets wrong are why:

**Its roots are computed by sourceID**, and a sourceID cannot answer an artifact
question. Roots are the sources nothing depends on — so for a persisted source
with an extension, the root is the extension and the declaring source is never
named at the top level, though they are one table.

**`BuildGraph.nodes` is `BuildNode[][]` but always has exactly one level.** The
type anticipates the leveled schedule WN-0022 describes; what is emitted is
`{connectionName, nodes: [rootNodes]}`, with the ordering in each root's
`dependsOn`. The specs pin this — every `plan.graphs[0].nodes` assertion is
`toHaveLength(1)`, including the case named "dependent sources in different
levels".

## BuildID and connection digests

```typescript
function mkBuildID(connectionDigest: string, sql: string): BuildID {
  return makeDigest(connectionDigest, sql);
}
```

`makeDigest` (in [`model/utils.ts`](../../model/utils.ts)) length-prefixes each
part before hashing — `("ab","c")` and `("a","bc")` must not collide — treats
`undefined` as distinct from `""`, and returns a SHA-256 hex string.

A BuildID is therefore content-addressed: the same SQL on the same connection is
the same entry, whatever the source is called and whatever model it came from.
Any change to the SQL, or to the connection's digest, is a different entry and
so a rebuild.

**What a connection digest contains today.** Each backend implements
`getDigest()` itself, and today they all hash the dialect name plus the
connection's identifying configuration:

| Backend | Hashed |
|---|---|
| DuckDB | database path, working directory, setup SQL |
| Postgres | host, port, username, database name, connection string, setup SQL |
| BigQuery | project id, setup SQL |
| MySQL | host, port, user, database, setup SQL |
| Snowflake | account, username, role, database, schema, scratch space, setup SQL |
| Trino / Presto | server, port, catalog, schema, user, setup SQL |
| Databricks | host, path, default catalog, default schema, setup SQL |
| Publisher | project name, connection name |

Postgres falls back to hashing the connection *name* when its config is
supplied as an async reader, since `getDigest()` is synchronous. Trino and
Presto share `TrinoPrestoConnection.getDigest()`, which tags both as `trino`.

Two consequences worth knowing. Settings that change generated SQL — a DuckDB
working directory, a setup SQL statement — correctly invalidate the cache. But
so does pure connection plumbing: the same logical warehouse reached from a
different host, port, or user produces a different digest and therefore a
different BuildID, so a manifest built in one environment does not apply in
another. Separating "which logical database and what SQL semantics" from "how
we dialed it" is a known design question, not something the code does today.

Digests are **computed, never stored** — always taken fresh from
`connection.getDigest()`. Config drifts, digest changes, entries stop matching.

The compiler is synchronous and `lookupConnection()` is not, so digests cannot
be fetched mid-compile. The Runtime precomputes a `Record<connectionName,
digest>` before entering the compiler and passes it as
`PrepareResultOptions.connectionDigests`; substitution sites index into it by
connection name.

## Compiler substitution

Two sites, one per persistable source type, both gated on `persistent`, both
reached only when `buildManifest` *and* `connectionDigests` are present.

**`query_source`** — in `getStructSourceSQL()`
([`model/query_query.ts`](../../model/query_query.ts)), when the structRef is a
query source: compile the inner query **with empty options** to get
manifest-ignorant SQL, `mkBuildID(connDigest, sql)`, look it up. On a hit,
return `entry.tableName` — as-is, not re-quoted, because manifest table names
are required to be canonical and are validated on every path in. On a miss with
`strict`, throw `runtime-manifest-strict-miss`, appending `loadError` when the
manifest carries one. Otherwise compile normally with the real options, so
nested dependencies can still resolve.

**`sql_select`** — `expandPersistableSource()` in
[`model/sql_compiled.ts`](../../model/sql_compiled.ts) handles `%{ source }`
segments the same way, except a hit substitutes `(SELECT * FROM <tableName>)`,
since a segment must be usable as a subquery.

The invariant tying the two halves together: **the BuildID is always computed
from manifest-ignorant SQL**. Both sites recompile with empty options rather
than reusing whatever SQL they are about to emit, so the key a query looks up is
the key the builder wrote — regardless of how much of the dependency tree
happened to be materialized on either side.

The other half of that invariant is `PersistSource.getSQL()`, which compiles
with `finalize=false`. On a dialect with a final stage (Postgres wraps in
`row_to_json`) a finalized SQL would hash differently from what
`query_query.ts` recomputes at serve time, and the table would be materialized
under a key nothing ever looks up.

## Runtime manifest resolution

`Runtime._resolveBuildManifest()`
([`api/foundation/runtime.ts`](../../api/foundation/runtime.ts)):

1. An explicit `_buildManifest` (constructor option or setter) wins outright.
2. Otherwise, if `config.manifestURL` is set, read it through the `URLReader`
   and cache the promise, so concurrent compiles share one round trip. A read
   failure soft-misses to `undefined`; a parse or shape failure returns
   `{entries: {}, loadError}`.
3. No URL, `undefined`.

The setter clears the cached promise so a later compile cannot see a stale soft
miss.

`QueryMaterializer.loadPreparedResult()` then decides what the compiler
actually gets: per-query `options.buildManifest` if given, else the resolved
Runtime manifest; every `tableName` re-validated as canonical; an empty
non-strict manifest dropped to `undefined` (nothing to substitute, so skip the
work); a surviving manifest checked against `##! experimental.persistence` —
throwing for an explicitly-passed manifest, silently ignoring a config-supplied
one. Only then does it call `getBuildPlan()` to learn which connection names
matter and fetch a digest for each.

That last step is why compiling a persistence query costs a build plan. It is
noted as inefficient in the code; a `listConnections()` on `LookupConnection`,
or caching, would remove it.

## Key files

**Core**

- [`api/foundation/config.ts`](../../api/foundation/config.ts) — `Manifest`, `MalloyConfig`
- [`api/foundation/core.ts`](../../api/foundation/core.ts) — `Model.getBuildPlan()`, `BuildPlan`, `PersistSource`
- [`api/foundation/runtime.ts`](../../api/foundation/runtime.ts) — manifest resolution
- [`api/foundation/types.ts`](../../api/foundation/types.ts) — `BuildNode`, `BuildGraph`, `CompileQueryOptions`, `EMPTY_BUILD_MANIFEST`
- [`model/malloy_types.ts`](../../model/malloy_types.ts) — the IR and manifest types
- [`model/persist_utils.ts`](../../model/persist_utils.ts) — `walkPersistentDependencies()`, `findPersistentDependencies()`, `minimalBuildGraph()`, `checkPersistAnnotation()`
- [`model/source_def_utils.ts`](../../model/source_def_utils.ts) — `mkSourceID()`, `mkBuildID()`, registry resolution, source factories
- [`model/query_query.ts`](../../model/query_query.ts) — substitution for `query_source`
- [`model/sql_compiled.ts`](../../model/sql_compiled.ts) — substitution for `sql_select`

**Translation**

- [`lang/ast/statements/define-source.ts`](../../lang/ast/statements/define-source.ts) — `sourceID` and `persistent`
- [`lang/ast/types/malloy-element.ts`](../../lang/ast/types/malloy-element.ts) — local registry population
- [`lang/ast/statements/import-statement.ts`](../../lang/ast/statements/import-statement.ts) — registry population across imports

**Tests and samples**

- [`test/src/core/persist.spec.ts`](../../../../../test/src/core/persist.spec.ts) — dependency paths, substitution, strict mode, cross-model imports, Runtime manifest, data equivalence
- [`scripts/simple_builder/`](../../../../../scripts/simple_builder/) — a teaching builder. Its spec runs in the `simple-builder` jest project (part of `test-duckdb` / `ci-duckdb`) and covers the incremental cycle, GC, dependency chains, and table naming — so the file the docs cite as an example can't drift out of true unnoticed

## Design decisions

- **Sources, not queries.** Sources are the unit of reference in Malloy;
  queries just run them.
- **Content-addressed.** BuildID = hash(connection digest, SQL). Identity comes
  from what would be computed, not from what it is called.
- **The manifest is flat.** One `entries` map keyed by BuildID, no per-model
  nesting, because the BuildID is already globally unique.
- **`strict` rides on the manifest** rather than being a separate compiler
  option, so it travels through every piece of plumbing the manifest already
  travels through.
- **`persistent` is an IR flag**, resolved once at `DefineSource` time.
  Substitution gates on it rather than on `sourceID`, so ordinary named sources
  never touch the manifest.
- **Builder metadata stays with the builder.** Timestamps, scheduling, history,
  freshness policy: the core knows only whether a BuildID is present in the
  manifest.
- **JSON, not MOTLY, for config and manifest** — applications need to read,
  modify, and write these programmatically.
- **No SQLite.** VS Code has browser contexts where native bindings fail, and
  manifests are small.
