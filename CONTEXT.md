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
   - Takes IR and generates SQL queries
   - Produces SQL + metadata needed to feed query results back into Malloy or render them
     with Malloy semantics.

**Vocabulary.** These two words are precise here: to *translate* is to turn Malloy source into IR, and to *compile* is to turn IR into SQL. SQL is the compiler's output and nothing in this repository compiles SQL, so "compile the SQL" is never the right phrase. Each area's `CONTEXT.md` defines the further terms that are precise in that area.

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
- `#` (object) or `##` (model) marks the beginning of an annotation
- Single-line annotations run to end-of-line: `# tag`, `## model_tag`
- Block annotations span multiple lines between `#|`/`|#` (object) or `##|`/`|##` (model); the body is dedented to its common leading-whitespace prefix
- Annotations apply to the construct declared below them; block-level annotations on a multi-item construct (e.g. `dimension: { ... }`) apply to every item

**Prefix and route.** Everything from the marker (`#`/`##`/`#|`/`##|`) up to the first whitespace is the annotation's **prefix**; it resolves to a **route** — a namespace key like `''` (the renderer's default), `!` (compiler flags), `@` (persistence), `dbmeta` (metadata a connection read with the table schema), `docs`, `myApp`. Routes claimed by an app (`#(myApp) ...`) are how applications stake a namespace and decline MOTLY in favor of their own payload language. The grammar is formalized in [packages/malloy/src/lang/annotation-prefix.ts](packages/malloy/src/lang/annotation-prefix.ts); MOTLY itself is in [packages/malloy-tag/CONTEXT.md](packages/malloy-tag/CONTEXT.md).

Read annotations on any tagged entity through its `annotations` view (`entity.annotations.parseAsTag(route)` for MOTLY; `entity.annotations.forRoute(route)` for raw text + source offsets when bringing your own parser).

## Data Model and Type System

### Malloy Data Types
In the Malloy language, the data types are: string, boolean, number, timestamp, timestamptz, date, json, "sql native", array and record.

Malloy reads the schema of any table referenced and creates a StructDef with the `fields[]` array filled out with the Malloy type for each column in the database mapped to a Malloy type. Types not supported by Malloy will be "sql native" which allows limited operation in the Malloy language.

### Type System Hierarchy

The type system distinguishes between:
- **`BasicAtomicType`** — Simple types whose TypeDef is fully described by just the type name: `string | number | boolean | date | timestamp | timestamptz | json | sql native | error`. The corresponding guard function is `isBasicAtomicType()`.
- **`AtomicTypeDef`** — Union of `BasicAtomicTypeDef | BasicArrayTypeDef | RecordTypeDef | RepeatedRecordTypeDef`. This is the general type for any atomic value including compound types.
- **Expression-only types** — Types like `null`, `error`, `duration`, `filter expression` that arise during expression evaluation but never appear as column types in a table schema.

In the Malloy language, compound types can be written using the syntax `type[]` for arrays, `{name :: type, ...}` for records, and these nest arbitrarily: `{x :: number, y :: string[]}[]`.

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
- `malloy-db-duckdb/` - DuckDB adapter (includes WASM support, and `/host` for a host that is itself a DuckDB database)
- `malloy-db-postgres/` - PostgreSQL adapter
- `malloy-db-mysql/` - MySQL adapter
- `malloy-db-sqlserver/` - SQL Server adapter
- `malloy-db-snowflake/` - Snowflake adapter ([packages/malloy-db-snowflake/CONTEXT.md](packages/malloy-db-snowflake/CONTEXT.md))
- `malloy-db-trino/` - Trino/Presto adapter
- `malloy-db-publisher/` - Publishing/caching layer

#### Native-dependency pins (do not loosen casually)

`@databricks/sql` (`1.15.0`) is pinned to its last pre-native release, not a `^` range. Why isn't visible here: downstream clients (the VS Code extension, `malloy-cli`) bundle with esbuild, which can't bundle native `.node` binaries. Newer releases ship one, so an unpinned range floats it in and breaks those builds — caught only in their CI (their `check-native` guard). `snowflake-sdk` (`3.4.1`) is exact for a different reason: its minors change runtime behavior every embedding app inherits, and it is loaded on first use (see [`packages/malloy-db-snowflake/CONTEXT.md`](packages/malloy-db-snowflake/CONTEXT.md)). Full pin ledger, methodology, and revisit triggers: [`docs/dependency-management/CONTEXT.md`](docs/dependency-management/CONTEXT.md).

### Supporting Libraries
- `malloy-interfaces/` - TypeScript interfaces and Thrift-generated types
- `malloy-render/` - Data visualization and rendering (see [packages/malloy-render/CONTEXT.md](packages/malloy-render/CONTEXT.md))
- `malloy-syntax-highlight/` - Language syntax highlighting (see [packages/malloy-syntax-highlight/CONTEXT.md](packages/malloy-syntax-highlight/CONTEXT.md))
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
npm run dev                    # Fast build: codegen + tsc (for iterating)
npm run build                  # Full build: codegen + tsc + flow types + render
npm run clean                  # Clean build artifacts from all packages
```

### Capturing output from long commands

Builds, tests, and lints in this repo are slow. The wrong instinct is to re-run a command with different flags or verbosity to dig into a failure. The right instinct is to **capture the full output once and grep the saved log**.

Pattern for any long-running command (build, dev, jest, lint, dbtest, ci-core, precheck) — plain redirection, no `&&` / `||` / `;` chaining:

```
CMD > /tmp/CMD.log 2>&1
```

Chaining (`&& echo OK || (tail …; exit 1)`) trips Claude Code's auto-approval and forces an interactive permission prompt even for commands that would otherwise sail through. Keep the call site to a single command with redirection only; the Bash tool already reports CMD's exit status. On failure, make a separate call to inspect the log:

```
tail -50 /tmp/CMD.log
grep -nE 'error|FAIL' /tmp/CMD.log
```

If one pass through the log doesn't answer the question, grep it differently — **do not re-invoke CMD**. The log is the artifact you work with; re-running is the cost to avoid.

Examples for the common commands:
```
npm run build > /tmp/build.log 2>&1
npm run dev   > /tmp/dev.log   2>&1
npx jest <path> -t <pattern> > /tmp/jest.log 2>&1
```

### Trust the exit code

The Bash tool reports CMD's exit status directly. That is the signal.

- **Exit 0 → done. Do not read the log.** No `tail`, no `grep`, no peek-just-in-case. The log exists only as a debugger for the failure case; on success it is noise, and reading it conditions you to invent problems in clean output.
- **Exit non-zero → read the log.** Start with `tail -50 /tmp/CMD.log`. If that doesn't surface the cause, `grep -nE 'error|FAIL' /tmp/CMD.log` or `Read` the file directly. Still do not re-run CMD.

The log is not a report or a summary of what the command did. It is a debugger you open only when something broke. Treat exit-0 as a guarantee that whatever the log contains is irrelevant for the work in front of you.

### Dev vs Build

- **`npm run dev`** — Runs codegen (ANTLR, peggy) then `tsc --build` for each package. This is the fast command you run repeatedly while debugging. It skips the vite render build since tests don't need it.
- **`npm run build`** — Everything in `dev`, plus the vite render bundle. Run this when you need fully built packages (e.g. for `npm link`).

### When to rebuild

If you're editing code and running tests **in the same package**, you don't need to rebuild — just run `npx jest` directly on the test file. Changes to `.ts` files are picked up by ts-jest.

If you make changes **in a different package** than the test (or you're running tests from `test/` and change any package), run `npm run dev` at the repo root first. It's fast — codegen is content-hash cached and tsc is incremental.

If you edit a codegen input (`.g4` grammar, `.peggy`, `.pegjs`), run `npm run dev` from the affected package's directory. Don't invoke `scripts/femto-build.js` directly — going through the package's npm script gets the working directory and digest paths right.

### Codegen and femto-build

Some packages have codegen steps that generate source files from grammars or configs:
- **`packages/malloy`** — ANTLR4 parser from `.g4` grammar files
- **`packages/malloy-filter`** — Peggy parsers from `.peggy` grammar files
- **`packages/malloy-malloy-sql`** — Peggy parsers from `.pegjs` grammar files
- **`packages/malloy-render`** — Vite bundle from TypeScript/Solid sources, gated by a `tsc` type-check (`tsconfig.type-check.json`) that runs first so type errors fail the build; vite's own dts pass only prints them

These use `scripts/femto-build.js`, a tiny content-hash-based build caching tool. Each package with codegen has a `femto-config.motly` with named targets specifying input globs and commands. femto-build hashes the inputs and skips the commands if nothing changed. Targets can depend on other targets via `deps`. This survives git operations (unlike Make's timestamp-based approach).

To add codegen to a new package: create a `femto-config.motly` in the package directory:
```motly
targetName: {
  inputs = ["src/grammar/*.g4"]
  commands = ["mkdir -p out", "tool -o out src/grammar/File.g4"]
}

dependent-target: {
  deps = [targetName]
  inputs = ["src/other/*.g4"]
  commands = ["tool -o out src/other/File.g4"]
}
```
Then add to `package.json`: `"codegen": "node ../../scripts/femto-build.js targetName"`

`node ../../scripts/femto-build.js --help` is the reference for the config format; the example above omits `outputs`, the field that forces a rebuild when a generated file has gone missing. The hash covers input files, config text, and dep digests — but not the versions of the tools the commands run, so bumping antlr4ts or peggy needs a `npm run clean` to take effect.


### Testing

**IMPORTANT**: Malloy has a large test suite which cannot run end-to-end on a development machine. A CI run is needed to fully verify a change.

A **database** is an entry in `test/src/malloy-config.json` and `test/src/databases.ts`: `duckdb`, `duckdb_wasm`, `motherduck`, `bigquery`, `postgres`, `mysql`, `snowflake`, `trino`, `presto`, `databricks`, `sqlserver`, `mssql_via_duckdb`. The **stand-in** is `duckdb`, read-only on `test/data/duckdb/duckdb_test.db`; plain specs run on it. **Core** is the CI job that runs every plain spec.

#### Kinds of test

1. **Run once.** `*.spec.ts` with no `db-` part, anywhere except a connection package or the renderer. It runs in core. Inside `packages/` it uses neither the `test/src` harness nor another package's connection. Outside `packages/` it may open an in-process database (today, DuckDB).
2. **Run on every database.** `test/src/**/*.db-all.spec.ts`, once for each database. A database that isn't fully supported has its CI run narrowed by `dbAllPassing` and `dbAllSkip`.
3. **Run on named databases.** `test/src/**/*.db-NAME.spec.ts`, where NAME is a database or a set from `databaseSets` (`sources/sql.db-presto_trino.spec.ts`).
4. **Connection tests.** Everything in `packages/malloy-db-X/`, run for each database whose `databases.ts` entry names that package in `connectionTests`. A connection package no entry names (`malloy-db-publisher`) holds plain specs, which run in core.
5. **Renderer tests.** `packages/malloy-render` and `test/src/render`. They run in core, and they don't yet follow these rules.

In `test/src` the directory is the subject: `joins/`, `time/`, `sources/`, and so on (the list is in [test/CONTEXT.md](test/CONTEXT.md)). If DuckDB is what a test is testing, the file is `.db-duckdb` or `.db-duckdb_all` (which also runs on `duckdb_wasm`); if DuckDB is only a tool the test uses, the file is plain. A sub-feature is a file in its feature's directory: `sources/sql.spec.ts`, `sources/sql.db-all.spec.ts`.

Every file ends in `.spec.ts`. In `test/src`, words in file and directory names are separated by `_`; `-` appears only in the `db-` marker, and in `malloy-config.json`, the name every Malloy config file has. A `db-` part that names no database or set fails the run, so a typo can't leave a file that never runs.

In `packages/**/*.spec.ts`, importing from `test/src` or from another package's `@malloydata/db-*` is a lint error.

#### Running tests

```
npx jest <FILE_OR_DIRECTORY> -t <TEST_PATTERN>
```

Run it from the repo root. A plain spec runs on the stand-in. A database file runs on `MALLOY_DATABASE`, which names one database; with it unset, the file fails with a message saying how to set it. A database file given explicitly that the selected database doesn't run gets a message saying which database does. The VS Code runner behaves the same way.

```
MALLOY_DATABASE=postgres npx jest test/src/joins/joins.db-all.spec.ts -t <pattern>
```

The broader runs:

| Command | Runs |
|---|---|
| `npm run precheck` | `npm run typecheck`, then `MALLOY_DATABASE=duckdb npm test`. The "did I break anything" check. |
| `npm test` | Core, plus everything selected for `MALLOY_DATABASE`, ignoring `dbAllPassing`/`dbAllSkip`. `MALLOY_DATABASE=sqlserver npm test` is the inventory of what SQL Server can't do yet. |
| `npm run dbtest NAME` | Exactly what NAME's CI job runs: its connection tests, its `db-NAME` and set files, and its `db-all` files, narrowed. `mssql_via_duckdb` and `motherduck` have no CI job; for them it is a local run only. |
| `npm run ci-core` | The core CI job. |

Long runs go through the capture-output pattern above. On exit 0, move on; on non-zero, `tail` or `grep` the log.

#### The database files

**`test/src/malloy-config.json`** holds the bare minimum needed to make each connection, in the [Malloy config format](https://docs.malloydata.dev/documentation/setup/config). A setting is written as `{"env": "..."}` only where the connection doesn't read it from the environment itself. `{"test": "NAME"}` is a test-only reference, resolved by `test/src/test_database.ts`.

**`test/src/databases.ts`** is data only, read by `jest.config.ts`. Each entry names its dialect, whether its connection streams (`canStream`), and its `connectionTests` glob; the first query checks the dialect and `canStream` against the real connection. A set in `databaseSets` names databases by what they are, never by what they can do; capabilities go in `test.when`. `dbAllPassing`, if present, limits `dbtest` to the `db-all` files it matches; `dbAllSkip` leaves out the files it matches. A glob that matches no files fails the run.

#### A test file

```ts
import {testDatabase} from '../test_database';

afterAll(() => testDatabase.shutdown());

const model = wrapTestModel(testDatabase, `
  query: isabellaN is db.table('malloytest.state_facts') -> { ... }`);

test.when(testDatabase.dialect.supportsNesting)('one-stage nest is in the order it asked for', async () => { ... });
```

`testDatabase` is this run's database: the stand-in in a plain spec, `MALLOY_DATABASE` in a database file. Its connection is named `db`. `coreDatabase()` is for a run-once test that depends on DuckDB itself. No file loops over databases, and test names carry no database name. [test/CONTEXT.md](test/CONTEXT.md) has the details.

### Code Quality
```bash
npm run lint-fix              # Lint every package and fix what ESLint can; this is the command to run
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

**Do not copy the header from a neighboring file.** Most existing files were created when the project used a longer Google MIT header; the short SPDX form above is what every *new* file must use. The neighboring-file pattern is the most common way to end up with the wrong header by accident. Always use the exact block above for new files, regardless of what the rest of the directory looks like.

This same header is also recorded in the root [`LICENSE`](LICENSE) file, in its "SOURCE FILE HEADER" section.

## Subsystem Context

For deeper context on specific subsystems, see:
- [packages/malloy/CONTEXT.md](packages/malloy/CONTEXT.md) - Core language package (translator and compiler)
- [packages/malloy/src/api/CONTEXT.md](packages/malloy/src/api/CONTEXT.md) - API layers (Foundation, Stateless, Sessioned, Async)
- [packages/malloy/src/api/foundation/CONTEXT.md](packages/malloy/src/api/foundation/CONTEXT.md) - Config pipeline internals (three states, section compilers, overlay resolution, failure modes)
- [packages/malloy/src/doc/configuration.md](packages/malloy/src/doc/configuration.md) - User-facing configuration guide (`malloy-config.json`, overlays, discovery, embedding)
- [packages/malloy/src/connection/CONTEXT.md](packages/malloy/src/connection/CONTEXT.md) - Connection registry, config format, backend properties
- [packages/malloy-tag/CONTEXT.md](packages/malloy-tag/CONTEXT.md) - Tag language for annotation parsing
- [packages/malloy-render/CONTEXT.md](packages/malloy-render/CONTEXT.md) - Data visualization and rendering
- [test/CONTEXT.md](test/CONTEXT.md) - Test organization and infrastructure
- [.github/workflows/CONTEXT.md](.github/workflows/CONTEXT.md) - CI and release: what CI runs, the external-PR security model, and npm publishing (OIDC trusted publishing)
- [docs/dependency-management/](docs/dependency-management/CONTEXT.md) - Dependency management: the pin ledger (`CONTEXT.md` — how we use Dependabot, every version we deliberately pin/hold, why, what it costs, when to revisit) plus agent-agnostic runbooks for the monthly and security passes

## Maintaining the CONTEXT Tree

This repository uses the [CONTEXT.md convention](https://github.com/the-michael-toy/llm-context-md) for LLM-friendly documentation.

The idea is that for any file of interest, an LLM can walk up the directory tree reading CONTEXT.md files to gather layered context - from specific to general - without loading all context files at once.

**Verification command:** "Read the CONTEXT tree and verify it is up to date"
