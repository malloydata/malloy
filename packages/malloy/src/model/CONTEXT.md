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

Annotations attach to any IR entity with an `annotation?: Annotation` field:

```ts
interface Annotation {
  inherits?: Annotation;     // parent's annotation when this entity is derived
  blockNotes?: Note[];       // block-level notes shared across items in a block
  notes?: Note[];            // notes attached directly to this entity
}
interface Note {
  text: string;
  at: DocumentLocation;
  indentStripped?: number;   // characters dedented per body line (block notes)
}
```

`text` is the annotation **as stored**: the marker and prefix are kept
verbatim, line endings are LF-normalized, and for block annotations the body
is dedented (`indentStripped` records how many leading characters were
removed per non-blank body line). Routes are derived at retrieval by
`parsePrefix` (`../prefix.ts`); the Note stores no route. **Read through the
`Annotations` view (`../annotation.ts`)** — it flattens `inherits` and
filters by route. Walking the three buckets yourself is a smell.

`indentStripped` is what lets payload-parser error columns map back to
source: for a body line, `source_col = indentStripped + parser_col`. The
`Annotations` view's `mapMalloyError` and the BYO-door `forRoute(route)`
both surface this — consumers parsing non-MOTLY content can compute their
own source columns the same way.

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
