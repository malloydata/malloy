## Malloy Project Overview

Malloy is a language for describing data relationships and transformations. It's both a semantic modeling language and a query language that uses existing SQL engines (BigQuery, Snowflake, PostgreSQL, MySQL, Trino, Presto, DuckDB) to execute queries. The project includes a VS Code extension for building Malloy data models and creating visualizations.

This is a **monorepo** managed with npm workspaces and Lerna, containing multiple interconnected packages that form the complete Malloy ecosystem.

## Architecture Overview

### Query Execution Pipeline

```
Malloy Source → Parser → AST → IR Generation → SQL Compilation → Database → Results → Renderer
```

### Two-Phase Compilation Architecture

The Malloy compiler is split into two distinct parts:

1. **Translator** (`packages/malloy/src/lang/`) - See [packages/malloy/CONTEXT.md](packages/malloy/CONTEXT.md)
   - Uses ANTLR-generated parser to create parse tree
   - Generates Abstract Syntax Tree (AST) from parse tree
   - Transforms AST into Intermediate Representation (IR)
   - IR is a serializable data format that fully describes the semantic model

2. **Compiler** (`packages/malloy/src/model/`) - See [packages/malloy/CONTEXT.md](packages/malloy/CONTEXT.md)
   - Takes IR and translates it to SQL queries
   - Produces SQL + metadata needed to feed query results back into Malloy or render them
     with Malloy semantics.

## Language Structures

### Sources and Queries

At its simplest, a **source** is anything you can hand to a SQL database and get a schema back - either a table name or a SELECT statement. The initial "fields" of a source are the columns in that schema.

However, Malloy lets you **extend** sources by adding other types of fields:
- **Joins**: Model the graph structure of data as a property of the source (not the query, unlike SQL)
- **Dimensions**: Treated like columns, but are expressions referencing other columns or dimensions
- **Measures**: Aggregate expressions like `sum(x + y)` computed from a set of rows
- **Calculations**: Like measures, but implemented with window functions

### Symmetric Aggregates

Malloy uses **symmetric aggregates** to handle joined data correctly. Aggregation paths like `line_items.amount.sum()` specify which grain to aggregate at. This lets you query normalized (joined) data as if it were denormalized and get correct results - Malloy avoids double-counting automatically.

### Nested Data Access

The Malloy language uses dotted path notation to access nested data. Nested data might be actually be part of a row through a record data type (or array, or array of records), or it might be in a separate table where the nesting is hidden by "normalizing" the nested portion of the data which is then joined onto the current table. Unlike SQL, the access path to nested data is identical no matter which way the nesting is stored in the database.

### Annotations and Tags

Objects in Malloy (sources, queries, joins, measures, dimensions, `group_by`, `aggregate`, etc.) can have metadata attached via **annotations**.

**Annotation syntax:**
- `#` marks the beginning of an annotation
- An annotation continues to end-of-line
- Annotations apply to objects declared below them
- In block declarations, block-level annotations apply to all items, and each item can have its own
- `##` marks **model-level annotations** that apply to the entire model

**Annotations are just text** - the design intentionally leaves room for multiple DSLs. Each application extracts its annotations via pattern matching and defines its own syntax. For details on the Malloy Tag Language used for parsing annotations, see [packages/malloy-tag/CONTEXT.md](packages/malloy-tag/CONTEXT.md).

## Data Model and Type System

### Malloy Data Types
In the Malloy language, the data types are: string, boolean, number, timestamp, timestamptz, date, "sql native", array and record.

Malloy reads the schema of any table referenced and creates a StructDef with the `fields[]` array filled out with the Malloy type for each column in the database mapped to a Malloy type. Types not supported by Malloy will be "sql native" which allows limited operation in the Malloy language.

### Field Types

- **Atomic Field**: Can be stored in a single database column (includes arrays and records)
- **Basic Field**: Atomic field with a single value (string, number, etc.)
- **Compound Field**: Records and arrays and arrays of records.
- **Joined Field**: References another SQL query or joined table (not in current table)

### Structure Definitions
- **StructDef**: Any namespace-containing object (records, arrays, table schemas, query schemas)
- **SourceDef**: A StructDef that can be used as query input (tables, queries, but not plain records/arrays)
- **FieldSpace**: Used by translator to construct and comprehend StructDefs

### Special Handling
- Arrays treated as records with one entry named "value" or "each" (SQL heritage)
- Nested queries produce arrays of records, accessed via un-nested joins
- Historical note: nested queries are called "turtles" in source code, that was once their user facing name.

### Malloy Query Structure
A Malloy query consists of two main components:
- **Source**: A SourceDef, has a schema defined by a field list
- **Pipeline**: Array of query operations (similar to SELECT statements with grouping/filtering)
- Query execution flows through the pipeline: source → first operation → second operation → etc.

Since query output is table-shaped, a query can also be source. This is how pipelining works: take a source, transform it with a query operation, use that output as input to the next operation.


## Multi-Database Support

The system uses a **Dialect** pattern where each database adapter implements database-specific SQL generation while sharing the same semantic model. Database connections are abstracted through a common `Connection` interface.

The actual SQL writing portion of a Dialect is implemented in packages/malloy/dialect

### Database Adapters

Each database has its own package with connection handling and dialect-specific optimizations:
- `malloy-db-bigquery/` - Google BigQuery adapter
- `malloy-db-duckdb/` - DuckDB adapter (includes WASM support)
- `malloy-db-postgres/` - PostgreSQL adapter
- `malloy-db-mysql/` - MySQL adapter
- `malloy-db-snowflake/` - Snowflake adapter
- `malloy-db-trino/` - Trino/Presto adapter
- `malloy-db-publisher/` - Publishing/caching layer

### Supporting Libraries
- `malloy-interfaces/` - TypeScript interfaces and Thrift-generated types
- `malloy-render/` - Data visualization and rendering (see [packages/malloy-render/CONTEXT.md](packages/malloy-render/CONTEXT.md))
- `malloy-syntax-highlight/` - Language syntax highlighting
- `malloy-filter/` - Query filtering utilities
- `malloy-tag/` - Tagged template literal support (see [packages/malloy-tag/CONTEXT.md](packages/malloy-tag/CONTEXT.md))
- `malloy-query-builder/` - Programmatic query building
- `malloy-malloy-sql/` - SQL integration utilities

## Package Dependencies

The packages form a dependency graph where:
- `malloy-interfaces` is the foundation (no dependencies)
- `malloy` depends on interfaces, filter, and tag packages
- Database adapters depend on the core `malloy` package
- `malloy-render` depends on core malloy packages for data processing
- The root manages all packages through npm workspaces

When making changes, build order matters: interfaces → core → database adapters → render components.

## Common Development Commands

### Setup and Building
```bash
npm install                    # Install dependencies for all packages
npm run build                  # Build all packages
npm run clean                  # Clean build artifacts from all packages
npm run watch                  # Watch for TypeScript changes across the repo
```

NOTES TOOL RUNNING NUM BUILD: build output is long and | head or | tail and a re-run is a bas choice,
instead do something like

```
npm run build 2>&1 >/tmp/build0.log && echo Build OK || (tail -50 /tmp/build0.log; exit 1)
```

When changing only `packages/malloy` and running tests outside of that directory (e.g., in `test/`), use the workspace flag for faster builds:
```bash
npm run build -w @malloydata/malloy
```

### Parser Generation

The Malloy grammar uses ANTLR4. When modifying grammar files in `packages/malloy/src/lang/grammar/`, run:
```bash
npm run build-parser  # In the malloy package directory
```

### Testing

**IMPORTANT**: Malloy has a large test suite which cannot run on a development machine. A CI run is needed to fully verify a change.

NOTES ON TOOLS RUNNING TESTS:

**DO NOT RUN** `npm run test` without restrictions - it requires active database connections for every database and will take a very long time and won't ever succeed.

**NEVER run** `npm run test -- filename` - this will take a very long time and won't ever succeed.

#### Running Individual Tests

The typical path when working on a fix is to run just the one test file containing the test, and a test pattern to identify the test. For example, to run the translator's source test:

```bash
npx jest packages/malloy/src/lang/test/source.spec.ts -t "TEST NAME PATTERN"
```

#### Database-Specific Tests

Some tests loop over all testable databases (for example, all tests in test/src/databases/all). For these it is important to restrict the databases under test to one available. Most developers use duckdb:

```bash
MALLOY_DATABASE=duckdb npx jest test/src/database/all/TEST.spec.ts -t "TEST NAME PATTERN"
```

#### Comprehensive Local Testing

The most comprehensive test you might run as a developer before letting CI build your code:

```bash
npm run test-duckdb  # Runs all tests, but only checks the duckdb dialect
```

Every developer will be able to run this and is a good sanity check.

#### Other Test Commands
```bash
npm run test-publisher        # Test with publisher database (all tests, publisher dialect only)
npm run ci-core              # CI: Core tests (malloy-core, malloy-render)
npm run ci-duckdb            # CI: DuckDB-specific tests
npm run ci-bigquery          # CI: BigQuery-specific tests
npm run ci-postgres          # CI: PostgreSQL-specific tests
```

For more details on test organization and infrastructure, see [test/CONTEXT.md](test/CONTEXT.md).

### Code Quality
```bash
npm run lint                  # Run ESLint on all packages
npm run lint-fix              # Fix ESLint issues automatically
```

### VS Code Integration

The VS Code extension is in a separate repository (`malloy-vscode-extension`), but this repo contains the language server and core functionality it depends on.

## Copyright

For new files, this is the current correct copyright text (here in C/Java/Javascript style):

```
/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */
```

## Commit and PR Guidelines

Do not include AI attribution (e.g., "Generated with Claude Code", "Co-Authored-By: Claude") in commits or pull requests.

## Subsystem Context

For deeper context on specific subsystems, see:
- [packages/malloy/CONTEXT.md](packages/malloy/CONTEXT.md) - Core language package (translator and compiler)
- [packages/malloy/src/api/CONTEXT.md](packages/malloy/src/api/CONTEXT.md) - API layers (Foundation, Stateless, Sessioned, Async)
- [packages/malloy-tag/CONTEXT.md](packages/malloy-tag/CONTEXT.md) - Tag language for annotation parsing
- [packages/malloy-render/CONTEXT.md](packages/malloy-render/CONTEXT.md) - Data visualization and rendering
- [test/CONTEXT.md](test/CONTEXT.md) - Test organization and infrastructure

## Maintaining the CONTEXT Tree

This repository uses the [CONTEXT.md convention](https://github.com/the-michael-toy/llm-context-md) for LLM-friendly documentation.

The idea is that for any file of interest, an LLM can walk up the directory tree reading CONTEXT.md files to gather layered context - from specific to general - without loading all context files at once.

**Verification command:** "Read the CONTEXT tree and verify it is up to date"
