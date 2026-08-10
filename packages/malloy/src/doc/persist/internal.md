# Persistence — internals

**Status:** experimental, gated by `##! experimental.persistence`

There are three "sources of truth"

* [WN-0022](https://github.com/malloydata/whatsnext/blob/main/wns/WN-0022-persistence/wn-0022.md) The design document for this feature.
* The Code
* The Markdown files in this directory

Where these disagree, if you are an AI, you should have a conversation
with the maintainer. Some disagreements might be failure to update
documentation, some might be failures in design. From experience however,
it has proven to be a mistake to pick ANY of these three sources
as fully authoritative.

## Terminology

In Malloy a "source" is something which you can query. A **persistable source**
is a source made from a query (which can be a Malloy query or a `conn.sql("SELECT  ...")`
statement)

A **persistent source** is a named persistable source marked with an
annotation `#@ persist`.

## The IR

In [`model/malloy_types.ts`](../../model/malloy_types.ts):

```typescript
interface SourceDefBase … {
  sourceID?: SourceID;
  referenceID?: SourceID;   // set only when created as an unmodified reference
}

interface PersistableSourceProperties {
  extends?: SourceID;       // set when this source extends a named source
  persistent?: boolean;     // This source "persistable" and "persistent"
}
```

A `SourceID` is best understood as a globally unique identifier for every named source.
(since names can change across imports). In actual implementation (`mkSourceID`) it is
constructed out of the URL containing the source definition and the name of the source,
but in future it could be a UUID, or a hash.

There is also a BuildID, and that is a digest made from three things.

* The SourceID of a persistent source (available at translatiopn)
* The SQL of the backing computation which generates the persistent artifact (available after translation)
* A digest from the connection representing the connection parameters
  which might affect how the SQL is interpreted. (available only after async calls)

These are two identities and they are **not one-to-one**: a
SourceID names a source, a `BuildID` names the output of a persistence
computation (which will eventually be stored in a table), and one
output table may have several SourceIDs pointing at it.

The persistent flag is set on named sources with the `#@ persist` annotation. Having
a `SourceID` means that a source was once named. `persistent: true` means that
this is source is persistable and is should be persisted.

Because the compiler and the translator are synchronous, they don't have access
to all the data which goes into a BuildID. The two times when source ID's are
mapped to a BuildID are, when a query is run, and a map keyed by BuildID
is consulted for a persistent source's materialized source, and in the "builder" application
which walk walks a model and materializes tables for each unique
BuildID.



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

`DefineSource` is where a source-type  model entry with a name is created
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
does a depth first, post order walks of the IR from a list of sources and queries
and yields a `PersistNode` per source that matters to persistence.

```typescript
interface PersistNode {
  sourceID: SourceID;
  persistent: boolean;      // copy of the persistent flag of the SourceDef
  dependsOn: SourceID[];
}
```

Return value (which `for...of` discards, so take it with an
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

`CompositeSourceDef.sources[]` is deliberately not walked — persistence was
designed without composites rather than around them. It is the one hole in "the
walk follows every route by which SQL inlines SQL", which `mkBuildTargets`
relies on; harmless while a composite cannot be a target, and to revisit if
that changes.

**What survives the walk** is decided by one rule, stated at
`walkPersistentDependencies`: keep a source if it is persistent, or if any
child survived. `PersistNode.persistent` says which reason applied — `true` is
a table to build, `false` is a route, a source that materializes nothing itself
but is how the walk reached one that does.

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
it reported the first time, so every dependent records the edge rather than only
the first one to arrive.

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

The walk emits *sources*, and several can share one table. One pass merges
them, because the walk is in dependency order:

1. a persistent source gets `getSQL()` and a BuildID, and joins the target keyed
   `(connectionName, buildId)` — creating it if new, appending to
   `target.sources` if not;
2. its children's target keys are already known, so its edges are written
   immediately — minus any that landed on its own key (an extension depending
   on its base is one table, not a dependency), and intersected with what the
   other sources on this target recorded (see the cycle note below);
3. a route contributes its children's keys upward instead of a key of its own;
4. finally `place()` emits each target after everything it depends on — a
   depth-first post-order walk of the target graph — filing it under its
   connection.

The merge key is connection *and* BuildID. The digest inside a BuildID already
makes those equivalent; the pair does not rely on that staying true.

Connections are reported as independent builds, which is sound because a query
cannot span two connections ([#3032]) and so a dependency cannot either.

[#3032]: https://github.com/malloydata/malloy/pull/3032

The cycle check in `place()` is not decoration. A *real* edge cannot cycle — a
target's SQL contains its dependencies' SQL inline, so two targets cannot each
contain the other — but an edge here is not always real. A source merging onto a
target brings its own edges, and a join is recorded whether the SQL uses it or
not, so `alias is base extend { join_one: mid }` where `mid` reads `base` would
put the merged target and `mid` in a cycle. Intersecting the merged sources'
edges (step 2 above) is what removes those.

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

**`BuildGraph.nodes` is `BuildNode[][]` but always holds exactly one entry.**
The extra dimension anticipated a batched schedule that was never built; what
is emitted is `{connectionName, nodes: [rootNodes]}`, with the ordering in each
root's `dependsOn`. The specs pin it — every `plan.graphs[0].nodes` assertion is
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

## Glossary

Where a name lives. Deprecated entries are marked; see the sections above for
what replaced them.

### Types

| Name | File | What |
|---|---|---|
| `BuildID` | `model/malloy_types.ts` | Manifest key: hash of connection digest and SQL |
| `BuildManifest` | `model/malloy_types.ts` | `BuildID` → table name, plus `strict` |
| `BuildTarget` | `api/foundation/types.ts` | One table, and every source that maps onto it |
| `ConnectionBuild` | `api/foundation/types.ts` | One connection's targets, in dependency order |
| `BuildTargets` | `api/foundation/types.ts` | What `getBuildTargets` returns |
| `PersistNode` | `model/persist_utils.ts` | One source the walk yields |
| `PersistWalk` | `model/persist_utils.ts` | The generator's type |
| `ResolvedNode` | `api/foundation/build_targets.ts` | A `PersistNode` with its `PersistSource` |
| `PersistableSourceDef` | `model/malloy_types.ts` | `SQLSourceDef \| QuerySourceDef` |
| `SourceID` | `model/malloy_types.ts` | Identity of a named source |
| `SourceRegistryValue` | `model/malloy_types.ts` | Registry entry, with the lazy `persist` flag |
| `BuildNode`, `BuildGraph`, `BuildPlan` | `api/foundation/types.ts`, `core.ts` | *deprecated* — the plan shapes |

### Classes

| Name | File | What |
|---|---|---|
| `Manifest` | `api/foundation/config.ts` | Load, touch, update, `activeEntries` |
| `PersistSource` | `api/foundation/core.ts` | A persist source: `getSQL`, `makeBuildId`, `location`, annotations |

### Functions

| Name | File | What |
|---|---|---|
| `Runtime.getBuildTargets` | `api/foundation/runtime.ts` | The builder entry point |
| `mkBuildTargets` | `api/foundation/build_targets.ts` | Folds the walk into targets |
| `resolvePersistWalk` | `api/foundation/build_targets.ts` | Walks and resolves each node's source |
| `walkPersistentDependencies` | `model/persist_utils.ts` | The generator; the six paths live here |
| `Model._walkPersistSources` | `api/foundation/core.ts` | The walk over a whole model |
| `Model._persistSourceFor` | `api/foundation/core.ts` | `SourceID` → `PersistSource` |
| `checkPersistAnnotation` | `model/persist_utils.ts` | Parses `#@` and asks `has('persist')` |
| `isPersistent` | `model/persist_utils.ts` | The lazy flag used while walking |
| `mkSourceID`, `mkBuildID` | `model/source_def_utils.ts` | Identity constructors |
| `resolveSourceID`, `resolveSourceRef` | `model/source_def_utils.ts` | Registry lookup |
| `isPersistableSourceDef` | `model/malloy_types.ts` | The persistable test |
| `Model.getBuildPlan` | `api/foundation/core.ts` | *deprecated* |
| `findPersistentDependencies` | `model/persist_utils.ts` | *deprecated* — nested view, for the plan |
| `minimalBuildGraph` | `model/persist_utils.ts` | *deprecated* — the plan's roots |

### Where persistence touches the translator

| Name | File | What |
|---|---|---|
| `DefineSource` | `lang/ast/statements/define-source.ts` | Stamps `sourceID`, resolves `persistent` |
| `DynamicSpace.structDef` | `lang/ast/field-space/dynamic-space.ts` | Clears both ids on a modification |
| `RefinedSource` | `lang/ast/source-elements/refined-source.ts` | Sets `extends` |
| `Document.setEntry` | `lang/ast/types/malloy-element.ts` | Local registry population |
| `ImportStatement` | `lang/ast/statements/import-statement.ts` | Registry population across imports |

### Substitution

| Name | File | What |
|---|---|---|
| `QueryQuery` | `model/query_query.ts` | Substitution for `query_source` |
| `getCompiledSQL` | `model/sql_compiled.ts` | Substitution for `sql_select` |

### Tests and samples

- `test/src/core/persist.spec.ts` — dependency paths, substitution, strict
  mode, cross-model imports, Runtime manifest, data equivalence
- `packages/malloy/src/api/foundation/build-targets.spec.ts` — the merge and
  the ordering, without a connection
- `scripts/simple_builder/` — a teaching builder. Its spec runs in the
  `simple-builder` jest project (part of `test-duckdb` / `ci-duckdb`), so the
  file the docs cite as an example cannot drift out of true unnoticed

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
