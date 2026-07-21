# Dialect: Database-Specific SQL Generation

This directory contains dialect implementations — the layer that translates Malloy's database-independent IR into SQL specific to each supported database engine.

## Directory Structure

```
dialect/
├── functions/
│   ├── malloy_standard_functions.ts  # Cross-database standard library definitions
│   ├── util.ts                       # Blueprint types, expansion utilities, def() helper
│   └── CONTEXT.md                    # How to write function templates
├── bigquery/
│   ├── bigquery.ts                   # BigQuery Dialect class
│   ├── function_overrides.ts         # BigQuery overrides for standard functions
│   └── dialect_functions.ts          # BigQuery-only functions
├── duckdb/                           # (same structure per dialect)
├── postgres/
├── snowflake/
├── trino/
├── mysql/
├── databricks/
├── dialect.ts                        # Abstract Dialect base class
└── dialect_map.ts                    # Dialect registry
```

## Functions

Each dialect provides functions through three collections: the cross-database **standard library** (`functions/malloy_standard_functions.ts`), a dialect's **overrides** of standard implementations (`{dialect}/function_overrides.ts`), and its **own functions** (`{dialect}/dialect_functions.ts`). All are declared as blueprints and expanded at startup.

- To **write** a function or dialect SQL for one: [`functions/CONTEXT.md`](./functions/CONTEXT.md).
- To understand how a call is **resolved and emitted** at runtime: [`../doc/functions.md`](../doc/functions.md).

## Adding a New Dialect

See [adding-a-new-database.md](../doc/adding-a-new-database.md) for a complete step-by-step guide covering both the Dialect and Connection sides, test data setup, and CI configuration.

### Escape-function contract

Every dialect must declare three fields that drive identifier and string-literal escaping:

- `identifierQuoteChar` — the character used to quote identifiers, typically `"` or `` ` ``.
- `identifierEscapeStyle` — `EscapeStyle.Doubled` (ANSI: doubling the quote char escapes it; every current dialect except BigQuery) or `EscapeStyle.Backslash` (BigQuery: quoted identifiers use string-literal escape sequences).
- `stringLiteralStyle` — `EscapeStyle.Doubled` for ANSI `''` escaping (Postgres-family) or `EscapeStyle.Backslash` for `\'` escaping (BigQuery, Snowflake, MySQL, Databricks).

`EscapeStyle` is exported from `dialect.ts`; importing it gives the literal-type narrowing for free, so dialect files do not need `as const`.

The base class provides safe implementations of `sqlQuoteIdentifier`, `sqlLiteralString`, and `sqlLiteralRegexp` driven by these flags. If a subclass forgets to set a flag, the base method throws at first use with a message naming the dialect and the missing flag, so a forgotten flag fails CI rather than producing wrong SQL silently.

For `EscapeStyle.Backslash` (BigQuery, Snowflake, MySQL, Databricks), both the literal and identifier paths share `escapeBackslashStyle`, which escapes the backslash, the closing delimiter, and the control characters `\n` / `\r` / `\t`. A raw newline terminates a backslash-style token early in BigQuery ("Unclosed string literal"); the other backslash dialects tolerate it but decode the named escapes to the same bytes, so escaping uniformly keeps values byte-exact. The escape set is deliberately those three control characters — `\0` and the Unicode line/paragraph separators are passed through, since there is no evidence they break these lexers.

A raw newline is also the one value plain `EscapeStyle.Doubled` (`''`) quoting cannot carry safely: the literal is valid SQL, but the SQL indenter (`indent()` in `model/utils.ts`) injects whitespace after every newline, corrupting a multi-line literal. So `PostgresBase.sqlLiteralString` encodes a newline-bearing literal as a Postgres/DuckDB `E'…'` escape string, and `TrinoDialect` overrides that with a Trino/Presto `U&'…'` Unicode-escape literal. These are the only overrides of the base literal methods.

The contract is verified at two levels. `packages/malloy/src/dialect/escape.spec.ts` (connection-free) asserts, for every registered dialect, the byte-exact encoding, fail-fast on a missing flag, field-name injection containment, and the table-path grammar. `test/src/databases/all/escape-e2e.spec.ts` round-trips an adversarial corpus through the real engines — the only honest decode check. A new dialect is covered automatically once registered in `dialect_map.ts`; extend the e2e corpus when you add a character class the escapers must handle.

### Table-path validation contract

User-supplied table-path strings (from `connection.table('…')` and the virtual table map) are validated against each dialect's table-path grammar at translation time, not at SQL emission time. The mechanism is one method:

```ts
sqlValidateTableName(input: string):
  | {ok: true; canonical: string}
  | {ok: false; error: string};
```

On success, `canonical` is the SQL fragment that gets pasted directly into `FROM` clauses and stored in `StructDef.tablePath`. There is no separate "quote this table path" step — the validator's canonical form is the SQL form. We never rewrite, auto-quote, or fold the user's input.

**Scope.** `sqlValidateTableName` accepts *names of tables* and the file-path shapes that DuckDB's replacement scans treat as tables. It deliberately rejects table-valued function calls (`read_parquet(...)`, `range(10)`), `LATERAL`, aliases, subqueries, and other things that are valid in a `FROM` clause but compose tables rather than name them. Users who want those use a SQL block (`connection.sql("""SELECT * FROM …""")`).

**Default implementation handles every well-behaved dialect.** Six of the seven dialects we ship (Postgres, MySQL, Snowflake, Trino, Databricks, BigQuery) all use the same dotted-segment grammar:

```
TablePath = Segment ( '.' Segment )* EOF
Segment   = BareIdent | QuotedIdent
```

What varies between them is purely lexical:
- the **quote character** for `QuotedIdent` (`"` for the ANSI-style dialects, `` ` `` for MySQL, Databricks, BigQuery),
- the **escape style** inside the quoted body (doubled-quote `""` for most, backslash `\X` for BigQuery),
- the **bare-segment character set** (Postgres allows `$`, MySQL allows digit-start, BigQuery allows dashes, Trino is strict ANSI, …).

All three are exposed as `Dialect` properties already: `identifierQuoteChar`, `identifierEscapeStyle`, and `tablePathBareIdentRegex`. The base `sqlValidateTableName` reads them and calls `validateDottedTablePath` from `dialect/table-path.ts`. A new well-behaved dialect just declares its bare-segment regex (and uses the existing escape/quote properties) and inherits the rest:

```ts
// e.g. postgres/postgres.ts
override tablePathBareIdentRegex = /^[A-Za-z_][A-Za-z0-9_$]*/;
// No sqlValidateTableName override needed.
```

The per-dialect regexes were derived empirically by probing the live engines.

**One dialect overrides the method outright: DuckDB.** Its grammar isn't a pure dotted-segment shape — it accepts file-path-shaped inputs (`arrests-latest.parquet`, `s3://…`, globs) and explicit single-quoted literals (`'foo.csv'`) in addition to identifier paths. See `duckdb/table-path-parser.ts`. **Do not look at DuckDB as a reference for a normal SQL dialect** — its grammar is intentionally richer than what ANSI SQL allows.

**Defense in depth: `;` and `--` are forbidden in any decoded segment.** Even when a segment is legally quoted, the parser rejects it if the decoded value contains `;` or `--`. Real table names don't contain those, and the rule shuts down a class of injection scenarios in callers that splice the canonical form into other string contexts.

When the validator rejects an input:
- `ImportsAndTablesStep` silently skips the reference (no schemaZone register, no schema-fetch needs-request).
- The AST step (`TableMethodSource.getSourceDef`) re-validates and logs the error at the AST element's source location — the user sees a squiggle on the `connection.table(...)` expression.

Tests:
- `packages/malloy/src/dialect/escape.spec.ts` — per-dialect unit tests with corpora reflecting the live engines' actual behavior.
- `packages/malloy/src/lang/test/table-path-validation.spec.ts` — end-to-end translator-error tests with source-range assertions.
- `test/src/databases/duckdb-all/duckdb.spec.ts` — DuckDB-specific shapes (file paths, globs).

## Key Source Files

| File | Purpose |
|---|---|
| `functions/malloy_standard_functions.ts` | Standard library: signatures + default implementations |
| `functions/util.ts` | Blueprint types, expansion logic, `def()`, `arg()`, `spread()`, `sql()` helpers |
| `{dialect}/function_overrides.ts` | Dialect's overrides for standard library |
| `{dialect}/dialect_functions.ts` | Dialect-unique function definitions |
| `dialect.ts` | Abstract Dialect base class |
| `dialect_map.ts` | Dialect registry |
| `../lang/ast/expressions/expr-func.ts` | Parser-side: function call AST, overload resolution |
| `../lang/ast/types/global-name-space.ts` | Assembles standard functions + overrides across all dialects |
| `../lang/ast/types/dialect-name-space.ts` | Loads dialect-specific functions |
| `../model/expression_compiler.ts` | SQL generation: template expansion, aggregate/analytic handling |
