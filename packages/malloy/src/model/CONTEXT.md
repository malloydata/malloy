# Malloy Compiler

Malloy compilation has two phases: the **translator** ([`../lang/CONTEXT.md`](../lang/CONTEXT.md) — `src/lang/`, source → IR) and the **compiler** (this document — `src/model/`, IR → SQL). They live in sibling directories and communicate only through the IR.

This document covers the compiler: it takes the Intermediate Representation (IR) produced by the translator and generates executable SQL for specific database dialects.

## Intermediate Representation (IR)

The compiler consumes **Intermediate Representation (IR)** produced by the translator. IR is defined in `malloy_types.ts` in this directory.

**IR is plain data structures** (not class instances) that are fully serializable. This allows IR to be:
- Cached between compilations
- Transmitted over network
- Persisted to disk
- Reused without re-parsing
- Processed by different compiler versions

### Key IR Types

**Model and Source Definitions:**
- **`ModelDef`** - Complete model definition containing all sources and queries
- **`SourceDef`** - A data source (table or derived table) with its schema and extended fields
- **`StructDef`** - Schema definition for any structured data (records, arrays, tables, query results)

**The `name` / `as` invariant (`AliasedName`):**

Every `StructDef`, `SourceDef`, and `FieldDef` is an `AliasedName` with two name slots:

- **`name`** — the intrinsic name, fixed when the def is created. It is **write-once**: nothing rebinds a def by reassigning `name`. For some def kinds `name` carries identity that must survive every rebinding — e.g. `VirtualSourceDef.name` *is* the `virtual('…')` argument, the key into the `virtualMap`.
- **`as`** — the local binding name. Every rename, `X is …`, join, or `rename:` sets `as`, never `name`.

The name a thing goes by in a given context is therefore **`activeName(x)` = `x.as ?? x.name`** (the one helper for this, defined next to the `AliasedName` interface in `malloy_types.ts`). Always call `activeName` at use sites — never hand-roll `x.as ?? x.name`, which is easy to get wrong (`x.as ?? x.name === n` parses as `x.as ?? (x.name === n)`). You cannot tell from a use site whether this particular def is one whose `name` is load-bearing identity, so you always preserve `name` and always read through `activeName`.

**Corollary for writers:** to rebind a def, set `as`. Never assign `name` and never `delete x.as` to "reset" a name — doing so destroys any identity payload `name` carried. (This was the cause of the joined-virtual-source bug: the join wrote the join name into `name` and deleted `as`, erasing the `virtualMap` key.)

**Type Definitions:**
- **`BasicAtomicType`** - String union of simple type names (`string | number | boolean | date | timestamp | timestamptz | json | sql native | error`). Guard: `isBasicAtomicType()`.
- **`BasicAtomicTypeDef`** - TypeDef union for basic types (each variant may carry metadata, e.g. `NumberTypeDef` has optional `numberType`)
- **`AtomicTypeDef`** - `BasicAtomicTypeDef | BasicArrayTypeDef | RecordTypeDef | RepeatedRecordTypeDef`
- **`MalloyTypecastExpr`** - IR node for type casts. `dstType` is `AtomicTypeDef` (supports compound types), `srcType` is `BasicAtomicTypeDef` (only used for temporal pattern matching)
- Helper functions: `mkFieldDef(AtomicTypeDef, name)` creates a `FieldDef`, `mkArrayTypeDef(AtomicTypeDef)` wraps a type in an array

**Query Structures:**
- **`Query`** - A complete query with source and pipeline of operations
- **Pipeline** - Array of query operations (group, filter, project, aggregate, etc.)
- Each pipeline stage transforms the source for the next stage

**Field Definitions:**
- **`FieldDef`** - Base type for all field definitions
- Subtypes include:
  - Dimensions (scalar calculations)
  - Measures (aggregations)
  - Joins (references to other sources)
  - Calculations (window functions)

**Expressions:**
- **`Expr`** - Tree of expression nodes representing computations
- Includes:
  - Arithmetic operations (`+`, `-`, `*`, `/`)
  - Logical operations (`AND`, `OR`, `NOT`)
  - Comparisons (`=`, `<`, `>`, `LIKE`)
  - Aggregate expressions (`SUM`, `COUNT`, `AVG`)
  - Function calls
  - Field references and path expressions
- Forms a complete expression tree that can be compiled to SQL

### Annotations in the IR

Object (`#`) annotations attach to any IR entity via an
`annotations?: AnnotationsDef` field:

```ts
// One bundle type for both `#` object annotations and `##` model annotations.
// Object annotations carry NO model provenance — `##` is model-level, resolved
// by folding `ModelDef.modelAnnotations` keyed by ModelID (see below).
interface AnnotationsDef {
  inherits?: AnnotationsDef; // parent's annotations when this entity is derived
  blockNotes?: Note[];       // notes inherited from a containing block of definitions
  notes?: Note[];            // notes attached directly to this entity
}
// A model's own `##` is just an AnnotationsDef (`ModelAnnotationEntry.ownNotes`);
// there is no separate model-annotation type.
interface Note {
  text: string;
  at: DocumentLocation;
  indentStripped?: number;   // characters dedented per body line (multi-line annotations)
}
```

`text` is the annotation **as stored**: the marker and prefix are kept
verbatim, line endings are LF-normalized, and for multi-line annotations
the body is dedented (`indentStripped` records how many leading characters
were removed per non-blank body line). Routes are derived at retrieval by
`parsePrefix` (`../lang/annotation-prefix.ts`); the Note stores no route.
**Read through the `Annotations` view (`../api/foundation/annotation.ts`)** —
it flattens `inherits` and filters by route. Walking the three buckets
yourself is a smell.

`indentStripped` is what lets payload-parser error columns map back to
source: for a body line, `source_col = indentStripped + parser_col`. The
`Annotations` view's `mapMalloyError` and the `forRoute(route)` door (which
returns `RoutedNote` instances carrying offsets) both surface this —
consumers parsing non-MOTLY content can compute their own source columns
the same way.

`inherits` is populated when an entity *derives* from another (most
prominently `source: child is parent extend { ... }` in
`lang/ast/statements/define-source.ts`, but also model-extends-model in
`malloy-element.ts:initModelDef`, queries in `define-query.ts`, and several
field-space sites). Grep for `inherits:` in `lang/ast/` for the full list.

**One Note, many paths.** `MalloyToAST.getAnnotation` builds each source-level
annotation exactly once; the same `Note` object then appears on every entity
that earns it — directly via `notes`/`blockNotes`, transitively via
`inherits`. Construction-time diagnostics (e.g. the prefix `malformed-route`
/ `reserved-route` warnings) fire once per source annotation, not once per
reachable copy.

### Model-level annotations resolve across files

`##` is **model-level**: a model has exactly one set of model annotations, and
every object resolved in it reports that same set. `ModelDef.modelAnnotations`
maps each involved model's `ModelID` (this model plus everything in its
import/extend closure) to a `ModelAnnotationEntry`:

```ts
interface ModelAnnotationEntry {
  ownNotes: AnnotationsDef;      // that model's own `##`
  inheritsFrom: ModelID[];       // DIRECT import/extend edges, extend-base as import₀
}
```

`inheritsFrom` is the lineage **DAG** (direct edges only, not the resolved
order); extend-base is an implicit `import₀` sitting first.
`getModelAnnotations(model, modelID?)` (`model/annotation_utils.ts`) walks
`inheritsFrom` from `modelID` (default `model.modelID`) post-order,
dedup-keep-first, compiling that model's annotations ordered imports-first /
local-last — returned as an `AnnotationsDef` whose `inherits` chain *is* that
order, so the `Annotations` view / `notesInOrder` read it with no new code.
`getModelAnnotations(model)` is the one set every object reports; the renderer
consumes the **run-head's** as `result.model_annotations`. `##` is the same for
every object, so resolution takes no object (last-wins / merge is MOTLY's job,
not the annotation layer's).

Both `import` and the extend-base init funnel through
`Document.contributeModelAnnotations` (`malloy-element.ts`) — they differ only
in namespace/export copying, never in the annotation fold.

### Compiler-flag (`##!`) propagation

Unlike themes, **`##!` compiler flags do not cross `import`.** A flag governs how
*its own file* is parsed/compiled; it is not data the model carries downstream.
(Notebook extend is a *continuation*, not an import, so it's outside this rule —
flags flow along the extend chain as the same authoring session continues.)
Deferring the inverse — an importable flag preamble (`import "all_experiments"`) —
is forward-safe: flags are additive, so a file written today keeps compiling if
imports ever start carrying flags.

Most `##!` flags are consumed **at translation time** (the `inExperiment` gates
in `lang/`). The Foundation API also reads `##! experimental.persistence` at
**runtime** — off the resolved model annotations (`Model.modelAnnotations`, the
fold, so it carries across extend) — to gate `getBuildPlan()` / manifest
substitution. There is deliberately no **SQL-gen-time** `##!` mechanism: the
former per-object `modelAnnotations` carrier and `modelCompilerFlags()` were
removed once their only consumer (`unsafe_complex_select_query`, a temporary BQ
escape hatch) proved unnecessary; the guard it bypassed is now a plain compiler
error.

## Compilation Pipeline

```
IR → QueryQuery → Expression Compiler → Dialect-Specific SQL + Metadata
```

## Core Components

### 1. QueryQuery (query_query.ts)

`QueryQuery` is the root of the compilation process.

**Responsibilities:**
- Takes IR query definition as input
- Orchestrates the overall compilation process
- Manages query pipeline transformations
- Coordinates with dialect-specific SQL generators
- Produces final SQL and execution metadata

**Process:**
1. Reads IR query structure
2. Processes pipeline operations in order
3. Generates appropriate SQL constructs (CTEs, subqueries, etc.)
4. Ensures proper scoping and aliasing
5. Produces executable SQL string

#### Nests, the `group_set` fan-out, and the column-name trap

A query and its nests compile to **one scan**, cross-joined against a `group_set`
integer table (`sqlGroupSetTable`) that replicates each base row once per grouping
grain. Each grain owns a `group_set` number (0 = top query, 1 = a nest, 2 = a deeper
nest); per group_set, scalars become `CASE WHEN group_set=N …` and nests an array-agg
`… FILTER (WHERE group_set=N)`. `computeGroups` (`field_instance.ts`) assigns the
numbers — a `reduce` nest recurses and gets its own group_set; a `project` nest rides
the enclosing group_set (it's grain-preserving, one element per in-scope row).

**The trap:** grouped stages emit columns named `name__groupSet` (`f1__0`, `m__0`) plus
a literal `group_set` column; only the final combine stage renames them to user names
(`"f1__0" as "f1"`). So a follow-on stage must reference the names the prior stage
**actually emitted** (suffixed), not the final names — getting this wrong was #2899. To
keep it straight, a stage's SELECT is built as one `StageOutputColumn[]` (`{sql, name,
isDimension}`); the SELECT list, the `GROUP BY` positions, the pipelined carry-forward
list, and the group_set remap list are **all derived from that one array**, so a
column's downstream name can't drift from what the stage emitted.

**Multi-stage nests — "compile the first stage, then stop."** For a nest pipeline of
length > 1, `generateTurtlePipelineSQL` compiles `pipeline[0]` to its array-agg, then
unnests that array and compiles the rest as a fresh recursive `QueryQuery`. Stitching
the remainder back is a dialect fork: `supportUnnestArrayAgg` dialects (duckdb) inline a
correlated subquery; others (Trino) push it through `generatePipelinedStages`, which
emits a carry-forward CTE — `SELECT * replace (…)` when `supportsSelectReplace`, else an
explicit column list.

**Verifying nest codegen needs the right dialect.** These paths are gated by dialect
flags that `precheck` (duckdb) does not exercise: the explicit carry-forward list is
reached **only** by Trino (`supportsSelectReplace=false`), the group_set remap **only**
by Databricks (`hasLateralColumnAliasInSelect`), and the lateral-join-bag `GROUP BY` by
BigQuery/standardsql and Databricks (`cantPartitionWindowFunctionsOnExpressions`). A
green duckdb precheck says nothing about them — run `ci-trino`/`ci-databricks`/
`ci-bigquery` (or a single-dialect connection).

### 2. Expression Compiler (expression_compiler.ts)

Compiles IR expression trees into SQL expressions.

**Responsibilities:**
- Traverses IR expression trees (`Expr` nodes)
- Generates SQL for arithmetic, logical, and aggregate expressions
- Handles function calls and special SQL constructs
- Manages type coercion and casting
- Ensures proper operator precedence and parenthesization

**Expression types handled:**
- Arithmetic operations (`+`, `-`, `*`, `/`, etc.)
- Logical operations (`AND`, `OR`, `NOT`, etc.)
- Comparisons (`=`, `<`, `>`, `LIKE`, etc.)
- Aggregates (`SUM`, `COUNT`, `AVG`, etc.)
- Window functions
- Function calls
- Field references and path expressions

### 3. Dialect System

The compiler supports multiple SQL dialects through a plugin architecture.

**Dialect-specific concerns:**
- SQL syntax variations
- Function name differences
- Type casting syntax
- Date/time handling
- String operations
- Aggregation functions
- Window function support

**Supported dialects:**
- BigQuery
- DuckDB
- PostgreSQL
- MySQL
- Snowflake
- Trino/Presto

Each dialect has its own implementation in `packages/malloy/src/dialect/`.

## Compilation Output

The compiler produces two key outputs:

### 1. SQL String
Executable SQL that can be run on the target database.

**Characteristics:**
- Dialect-specific syntax
- Properly aliased and scoped
- Optimized where possible
- Includes necessary CTEs and subqueries

### 2. Metadata
Information needed to process query results.

**Includes:**
- Field names and types
- Rendering hints
- Data structure information
- Annotations and tags
- Required for proper result interpretation and visualization

## SafeRecord Pattern

IR types use `Record<string, V>` (aliased as `SafeRecord<V>`) as string-keyed maps in several places — notably `ModelDef.contents`, `SourceDef.parameters`, `SourceDef.arguments`, and `CompiledQuery.connectionDigests`.

**The problem:** Direct bracket access (`record[key]`) is **unsafe** because `Object.prototype` property names like `"constructor"`, `"toString"`, `"valueOf"` return inherited functions instead of `undefined`. A user naming a source `constructor` would collide with the prototype.

**The solution:** Three utilities in `malloy_types.ts`:

- **`SafeRecord<V>`** — Type alias for `Record<string, V>`. Documents that the record requires safe access patterns.
- **`safeRecordGet(record, key)`** — Returns `record[key]` only if it's an own property; otherwise `undefined`. All read sites must use this (or a `Map`-based lookup) instead of raw bracket access.
- **`mkSafeRecord<V>()`** — Creates a null-prototype object (`Object.create(null)`) typed as `SafeRecord<V>`. All initialization sites that create empty SafeRecords should use this so that even raw bracket reads won't hit prototype properties.

## File Organization

```
src/model/
├── malloy_types.ts               # IR type definitions, SafeRecord utilities
├── query_query.ts                # Root compilation orchestrator (QueryQuery)
├── query_node.ts                 # Query node types used during compilation
├── query_model.ts                # QueryModel interface (entry point from API)
├── query_model_impl.ts           # QueryModel implementation
├── query_model_contract.ts       # Contract types for QueryModel
├── expression_compiler.ts        # Expression tree → SQL expressions
├── constant_expression_compiler.ts # Constant expression evaluation
├── filter_compilers.ts           # Filter compilation
├── stage_writer.ts               # SQL stage/CTE writing
├── sql_block.ts                  # SQL block handling
├── sql_compiled.ts               # Compiled SQL output types
├── field_instance.ts             # Field instances during compilation
├── join_instance.ts              # Join instances during compilation
├── persist_utils.ts              # Persistence/build-plan utilities
├── source_def_utils.ts           # SourceDef manipulation utilities
├── utils.ts                      # General compilation utilities (mkModelDef, etc.)
├── index.ts                      # Barrel exports
└── test/                         # Compiler tests
```

## Important Notes

- The compiler is **read-only** with respect to IR - it never modifies IR structures
- Compilation is **stateless** - same IR always produces same SQL (for a given dialect)
- The compiler must handle all valid IR produced by the translator
- SQL generation is deterministic to support caching and testing
- Metadata generation is as important as SQL generation for proper result handling
