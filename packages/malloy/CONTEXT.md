# Malloy Core Package

The `malloy` package is the heart of the Malloy language implementation. It contains the compiler, translator, and runtime system that powers Malloy's semantic modeling and query capabilities.

## Package Structure

```
packages/malloy/
├── src/
│   ├── lang/              # Translator: Parse tree → AST → IR (see src/lang/CONTEXT.md)
│   ├── model/             # Compiler: IR → SQL (see src/model/CONTEXT.md)
│   ├── dialect/           # Database-specific SQL generation
│   ├── api/               # API layers (see src/api/CONTEXT.md)
│   │   └── foundation/    # Public API classes (see MALLOY_API.md)
│   └── connection/        # Database connection abstractions
```

## Two-Phase Architecture

The Malloy compilation process is split into two distinct phases:

### Phase 1: Translation (src/lang/)
The translator takes Malloy source code and transforms it into an Intermediate Representation (IR).

**Process:**
1. ANTLR parser generates parse tree from source code
2. Parse tree is transformed into Abstract Syntax Tree (AST)
3. AST is analyzed and transformed into IR

**Key characteristics:**
- IR is a **serializable data format** (plain objects, not class instances)
- IR fully describes the semantic model independent of SQL
- IR can be cached, transmitted, and reused across compilations

For detailed information about the translator, see [src/lang/CONTEXT.md](src/lang/CONTEXT.md).

### Phase 2: Compilation (src/model/)
The compiler takes IR and generates SQL queries for specific database dialects.

**Process:**
1. IR is read and analyzed
2. Query operations are transformed into SQL expressions
3. Dialect-specific SQL is generated
4. Metadata is generated for result processing

**Key characteristics:**
- Produces SQL that can be executed on target database
- Includes metadata to interpret and render results
- Dialect-agnostic until final SQL generation step

For detailed information about the compiler, see [src/model/CONTEXT.md](src/model/CONTEXT.md).

## Subsystem Context

For deeper details on specific subsystems:
- [MALLOY_API.md](MALLOY_API.md) - Public API classes (Model, PreparedQuery, Runtime, Materializers)
- [src/lang/CONTEXT.md](src/lang/CONTEXT.md) - Translator architecture (grammar, AST, IR generation)
- [src/model/CONTEXT.md](src/model/CONTEXT.md) - Compiler architecture (SQL generation, expression compilation)
