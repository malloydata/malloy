# Malloy Compiler

The compiler is the second phase of the Malloy compilation process. It takes the Intermediate Representation (IR) produced by the translator and generates executable SQL for specific database dialects.

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

## File Organization

```
src/model/
├── query_query.ts           # Root compilation orchestrator
├── expression_compiler.ts   # Expression tree → SQL expressions
├── malloy_types.ts          # IR type definitions (consumed by compiler)
└── [other compilation utilities]
```

## Important Notes

- The compiler is **read-only** with respect to IR - it never modifies IR structures
- Compilation is **stateless** - same IR always produces same SQL (for a given dialect)
- The compiler must handle all valid IR produced by the translator
- SQL generation is deterministic to support caching and testing
- Metadata generation is as important as SQL generation for proper result handling
