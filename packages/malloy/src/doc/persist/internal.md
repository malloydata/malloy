# Persistence — internals

**Status:** experimental, gated by `##! experimental.persistence`

This is the maintainer's document: what has to stay true for persistence to be
correct, the decisions behind the shape of the code, and where each piece
lives. The builder's and query runner's contract is [api.md](api.md). This
directory and the code are the design of record; where they disagree, fix the
one that is wrong here. The feature began as
[WN-0022](https://github.com/malloydata/whatsnext/blob/main/wns/WN-0022-persistence/wn-0022.md),
which is history, not authority.

## Terminology

A **persistable source** is a source backed by a computation: a `query_source`
(`source: x is y -> {...}`) or a `sql_select` (`source: x is conn.sql("...")`).
A **persistent source** is a named persistable source whose annotations carry
`#@ persist`, directly or by inheritance through `extend`.

A persistable source's **relation** is the SQL its table would be built from:
the inner query of a `query_source`, or the `SELECT` of a `sql_select` with its
`%{ }` segments expanded. A `where:` added by `extend` is not part of the
relation; the query that reads the table applies it.

A **route** is a source the dependency walk passes through on the way to a
persistent one: a `#@ -persist` wrapper, a join, an unmarked source over a
persisted one. It builds no table of its own.

A **SourceID** names a source: `name@modelURL`, stable across imports and
renames. A **BuildID** names a table: a hash of the connection's digest and the
relation's SQL. The two are not one-to-one — a persisted source and every
`extend` of it have the same SQL and so the same BuildID, and one table
routinely has several names.

A relation's SQL is generated under a **context**: the `virtualMap` (which
table each virtual source reads) and the bound given values. The context is
part of what the SQL says, so it is part of the key.

The **manifest** maps BuildID to table name, plus `strict`. The **BuildID SQL**
is the relation generated with every dependency inlined; the **build SQL** is
the same relation with dependencies already in the manifest read from their
tables. [api.md](api.md#two-sqls-and-why) has the builder's view of the pair.

## Invariants

Each of these, broken, produces a wrong table or a wrong answer rather than an
error. Check a change in this area against the list.

**One key, computed the same way on both sides.** The builder computes a
BuildID from the relation's SQL when it plans; the compiler recomputes it from
the same relation when a query runs and looks it up. The two must be the same
string: generated under the same context, through the same code path, never
finalized, and never with a manifest in hand. Enforced by routing both through
`PersistSource._compileSQL` under a `BuildIdOptions` — a type that cannot carry
a manifest — with the given values bound by `bindGivens` on both sides
(`mkBuildTargets` for the build, `persistedTableFor` for the query). Pinned by
`persist.spec.ts` ("and the query finds the table the plan named", and the
per-value tests under "a persisted source that reads a given").

**The key SQL and the executed SQL differ only in ways that do not change
rows.** The one permitted difference is manifest substitution: a built table
standing in for its own SQL. Anything else that changes the SQL a query would
run — a given's value, a virtual source's table — has to be in the context, and
so in the key. A value that changes the SQL but not the key is a table served
to callers it was not built for.

**The walk follows every route by which SQL inlines SQL.** The six paths at
`walkPersistentDependencies` are the whole list; `CompositeSourceDef.sources[]`
is the one deliberate hole, and composites are documented as incompatible with
persistence because of it. `mkBuildTargets` intersects the dependency sets of
sources that share a table on the strength of this list (see
[The fold](#the-fold)); a path missing from the walk makes a table build from
inlined SQL instead of reading the one below it, with no error.

**Identity does not leak through derivation.** `sourceID`, `referenceID`,
`extends`, and `persistent` belong to the source that was declared, never to
one derived from it. The factories in `model/source_def_utils.ts` list the
fields they copy and leave these out; `DynamicSpace.structDef` clears the ids
on the modification path. A derived source that kept its base's identity would
substitute its base's table for a different computation.

**Table names are canonical everywhere they enter.** A manifest `tableName` is
a canonical table path for its dialect, checked at `Manifest.update()`,
`Manifest.loadText()`, the Runtime's file read, and again at compile time. The
builder creates the table under the canonical form and records that same form
([api.md](api.md#turning-a-name-into-a-table)).

**Digests are computed, never stored.** A connection digest is taken fresh
from `connection.getDigest()` every time; a stored one would keep matching
after the connection it described had changed.

## Design decisions

- **Sources, not queries.** Sources are the unit of reference in Malloy;
  queries just run them.
- **Content-addressed.** BuildID = hash(connection digest, SQL). Identity comes
  from what would be computed, not from what it is called.
- **The context is in the SQL, not beside the key.** A given's value or a
  virtual source's table changes the SQL, and the SQL is hashed, so nothing is
  added to the BuildID for them. A persisted source that reads a given has one
  table per value, built by running the plan once per value.
- **The builder's context is the Runtime's, plus a per-call layer.** A build
  binds givens from the config file, the constructor, and
  `getBuildTargets(model, {givens})`, in that order, exactly as a query binds
  from the same three layers plus `.run({givens})`. A finalized given is
  refused per call either way.
- **A source with no key is reported, not thrown.** `getBuildTargets` plans
  the rest of the model and returns the source in `unbuildable` with the
  problem. Whether that fails the build is the builder's call.
- **A persisted source an importer cannot supply is a translate error.** A
  builder builds what a model reaches, so a model that imports a persisted
  source must be able to bind every given its relation reads; one that cannot
  has imported something nothing in it can build or query.
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

## How the pieces fit

Each section says what a piece is responsible for and names where it lives.
The reasoning for any one decision inside a piece is at the code.

### Translator

`DefineSource` (`lang/ast/statements/define-source.ts`) stamps `sourceID` on
every named source and, for a persistable one, resolves `persistent` from the
`@` route of its annotations (`checkPersistAnnotation`). The annotations
already carry what the base contributed, so an `extend` of a persisted source
is persistent and `#@ -persist` stops the chain.

`Document.setEntry` registers every named source in the **source registry**,
`ModelDef.sourceRegistry`, which turns a `SourceID` into a definition. The
registry exists for imports: an imported source's persistent dependencies may
not have been imported into the importer's namespace, so `ImportStatement`
walks each imported persistable source *in the imported model*, where the
definitions still exist, and registers every source the walk touched — routes
included, because a `#@ -persist` wrapper can be the only way to reach the
tables beneath it. An entry is a name when the source is in this model's
namespace and a stored definition when it is not. `isPersistent` resolves the
flag lazily for a stored definition, which never went through this model's
`DefineSource`.

`ImportStatement` also records each persistent source it reaches in
`Document.importedPersistSources`, and `Document.compile()` checks them
(`checkPersistSourceGivenSatisfiability`) against the final namespace: a given
the relation reads that this model neither surfaces nor can default is
`unsatisfied-given-in-persist-source`, at the import.

### The walk

`walkPersistentDependencies(roots, modelDef)` (`model/persist_utils.ts`) is a
generator over the IR, depth first and post order, yielding a `PersistNode`
(`sourceID`, `persistent`, `dependsOn`) for every source that is persistent or
leads to one. It is memoized across all its roots, so a source reached twice
reports the same dependencies to every dependent, and a consumer can fold the
stream in one pass because a node arrives after everything it depends on.
Joins are followed whether or not a query activates them, which
over-approximates dependencies and never under-approximates them.

Its three consumers fold it differently: `ImportStatement` keeps every node
for the registry; `mkBuildTargets` keeps a map from source to the tables it
contributes; `findPersistentDependencies` nests it for the deprecated
`getBuildPlan`.

### The fold

`Runtime.getBuildTargets(model, options?)` (`api/foundation/runtime.ts`) does
the async part — a digest per connection, the Runtime's givens — and hands the
materialized walk, the digests, and a `BuildIdOptions` to `mkBuildTargets`
(`api/foundation/build_targets.ts`), which is synchronous and testable without
a connection.

The fold merges sources onto tables. A persistent source's relation is
generated under the options and hashed; the source joins the target with that
key on its connection, or creates it. A route, or a source with no key, passes
its children's targets up to whoever referenced it, which is how an edge
survives a route. When a second source lands on an existing target, the
target's dependencies become the *intersection* of what the two recorded: the
sources have identical SQL and so identical real dependencies, and what
differs is the walk's join over-approximation, which a union would turn into a
cycle (`alias is base extend { join_one: mid }` where `mid` reads `base`). The
intersection is safe only because the walk's path list is complete. Targets
are then emitted in dependency order under their connection, and a cycle that
survives anyway is an error rather than a hang.

Each target closes over the options and the digests it was keyed with, so
`buildSQL(manifest)` cannot generate SQL under a different context from `sql`.
`readsGivens` is whether `givenUsageOfRelation` finds anything.

### Substitution

`persistedTableFor` (`model/sql_compiled.ts`) is the only lookup. It runs for a
`persistent` source when the compile has both a manifest and connection
digests, recomputes the key under `buildIdOptions(opts)` — the query's context
minus the manifest — and returns the table name on a hit, throws
`runtime-manifest-strict-miss` on a strict miss, and returns nothing otherwise
so the caller emits the source's own SQL. Its two callers are
`getStructSourceSQL` (`model/query_query.ts`), for the FROM clause and joins,
and `expandPersistableSource` (`model/sql_compiled.ts`), for `%{ }` segments.
`QueryQueryRaw` does not look up: a `conn.sql(...)` at the run site is unnamed
and so never persistent.

### Runtime

`Runtime._resolveBuildManifest` picks the manifest: an explicit one from the
constructor or setter, else a lazy, cached read of `config.manifestURL` (a read
failure is a soft miss; a parse failure is `{entries: {}, loadError}` so a
strict throw can say why), else none. `QueryMaterializer.loadPreparedResult`
then applies the per-query override, re-validates every table name, drops an
empty non-strict manifest, checks `##! experimental.persistence` (an
explicitly passed manifest throws without it; a config-supplied one is
ignored), and fetches a digest per connection the model's persist sources
name. That last step still goes through `getBuildPlan`, which is why compiling
a persistence query costs a plan walk.

## Connection digests

Each backend implements `getDigest()` itself; today they all hash the dialect
name plus the connection's identifying configuration:

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

Settings that change generated SQL — a DuckDB working directory, a setup SQL
statement — correctly invalidate the cache. So does pure connection plumbing:
the same warehouse reached from a different host, port, or user is a different
digest and so a different BuildID, and a manifest built in one environment does
not apply in another. Separating "which database, with what SQL semantics"
from "how it was dialed" is an open design question.

`makeDigest` (`model/utils.ts`) length-prefixes each part before hashing, so
`("ab","c")` and `("a","bc")` cannot collide, and treats `undefined` as
distinct from `""`.

## Deprecated: `Model.getBuildPlan()`

The entry point before `getBuildTargets`, kept until the builders have moved.
It reports sources keyed by `sourceID`, and a `sourceID` does not name a
table, so a builder on it has to compute BuildIDs, discover the sources that
share one, and order the build itself. Its roots are the sources nothing
depends on, which for a persisted source with an extension is the extension,
and `BuildGraph.nodes` is typed `BuildNode[][]` but always holds one entry.
`findPersistentDependencies` and `minimalBuildGraph` exist only for it, as do
`PersistSource.getSQL` and `makeBuildId`.

## Glossary

Where a name lives.

### Types

| Name | File | What |
|---|---|---|
| `BuildID` | `model/malloy_types.ts` | Manifest key: hash of connection digest and SQL |
| `BuildManifest` | `model/malloy_types.ts` | `BuildID` → table name, plus `strict` and `loadError` |
| `BuildIdOptions` | `model/sql_compiled.ts` | The context a BuildID's SQL is generated under: `virtualMap`, `resolvedGivens` |
| `BuildTarget` | `api/foundation/types.ts` | One table, every source that maps onto it, `buildSQL()`, `readsGivens` |
| `BuildTargetOptions` | `api/foundation/types.ts` | A build's givens and `virtualMap`, over the Runtime's |
| `BuildTargets` | `api/foundation/types.ts` | What `getBuildTargets` returns |
| `ConnectionBuild` | `api/foundation/types.ts` | One connection's targets, in dependency order |
| `UnbuildableSource` | `api/foundation/types.ts` | A persist source with no BuildID, and why |
| `PersistNode` | `model/persist_utils.ts` | One source the walk yields |
| `ResolvedNode` | `api/foundation/build_targets.ts` | A `PersistNode` with its `PersistSource` |
| `PersistableSourceDef` | `model/malloy_types.ts` | `SQLSourceDef \| QuerySourceDef` |
| `SourceID` | `model/malloy_types.ts` | Identity of a named source |
| `SourceRegistryValue` | `model/malloy_types.ts` | Registry entry, with the lazy `persist` flag |
| `BuildNode`, `BuildGraph`, `BuildPlan` | `api/foundation/types.ts`, `core.ts` | *deprecated* — the plan shapes |

### Classes

| Name | File | What |
|---|---|---|
| `Manifest` | `api/foundation/config.ts` | Load, touch, update, `activeEntries` |
| `PersistSource` | `api/foundation/core.ts` | A persist source: identity, `location`, annotations, `_compileSQL`; `getSQL`/`makeBuildId` *deprecated* |

### Functions

| Name | File | What |
|---|---|---|
| `Runtime.getBuildTargets` | `api/foundation/runtime.ts` | The builder entry point |
| `Runtime._givensFor` | `api/foundation/runtime.ts` | File → constructor → per-call merge, refusing a finalized name; queries and builds |
| `bindGivens` | `model/given_binding.ts` | Supplied values plus inline folds, as `resolvedGivens`; queries and builds |
| `givenUsageOfRelation` | `model/sql_compiled.ts` | The givens a relation reads |
| `mkBuildTargets` | `api/foundation/build_targets.ts` | Folds the walk into targets and `unbuildable` |
| `resolvePersistWalk` | `api/foundation/build_targets.ts` | Walks and resolves each node's source |
| `walkPersistentDependencies` | `model/persist_utils.ts` | The generator; the six paths live here |
| `Model._walkPersistSources` | `api/foundation/core.ts` | The walk over a whole model |
| `Model._persistSourceFor` | `api/foundation/core.ts` | `SourceID` → `PersistSource` |
| `checkPersistAnnotation` | `model/persist_utils.ts` | Parses `#@` and asks `has('persist')` |
| `isPersistent` | `model/persist_utils.ts` | The lazy flag used while walking |
| `mkSourceID`, `mkBuildID` | `model/source_def_utils.ts` | Identity constructors |
| `resolveSourceID`, `resolveSourceRef` | `model/source_def_utils.ts` | Registry lookup |
| `isPersistableSourceDef` | `model/malloy_types.ts` | The persistable test |
| `persistedTableFor` | `model/sql_compiled.ts` | The lookup: BuildID → table, or the strict throw |
| `buildIdOptions` | `model/sql_compiled.ts` | A query's context minus the manifest |
| `Model.getBuildPlan`, `findPersistentDependencies`, `minimalBuildGraph` | `api/foundation/core.ts`, `model/persist_utils.ts` | *deprecated* |

### Where persistence touches the translator

| Name | File | What |
|---|---|---|
| `DefineSource` | `lang/ast/statements/define-source.ts` | Stamps `sourceID`, resolves `persistent` |
| `DynamicSpace.structDef` | `lang/ast/field-space/dynamic-space.ts` | Clears both ids on a modification |
| `RefinedSource` | `lang/ast/source-elements/refined-source.ts` | Sets `extends` |
| `Document.setEntry` | `lang/ast/types/malloy-element.ts` | Local registry population |
| `Document.checkPersistSourceGivenSatisfiability` | `lang/ast/types/malloy-element.ts` | The import-time given check |
| `ImportStatement` | `lang/ast/statements/import-statement.ts` | Registry population across imports; records imported persist sources |

### Tests and samples

- `test/src/core/persist.spec.ts` — dependency paths, substitution, strict
  mode, cross-model imports, Runtime manifest, givens, data equivalence
- `packages/malloy/src/api/foundation/build-targets.spec.ts` — the merge, the
  ordering, givens, and build SQL, without a connection
- `packages/malloy/src/lang/test/givens.spec.ts` — the import-time check,
  under "imported persisted sources"
- `scripts/simple_builder/` — a teaching builder. Its spec runs in the
  `simple-builder` jest project (part of `test-duckdb` / `ci-duckdb`), so the
  file the docs cite as an example cannot drift out of true unnoticed
