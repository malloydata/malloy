# Dialect: Database-Specific SQL Generation

This directory contains dialect implementations — the layer that translates Malloy's database-independent IR into SQL specific to each supported database engine.

## Directory Structure

```
dialect/
├── functions/
│   ├── malloy_standard_functions.ts  # Cross-database standard library definitions
│   └── util.ts                       # Blueprint types, expansion utilities, def() helper
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

## Function Call Pipeline

When Malloy source code contains a function call like `greatest(a, b)` or `string_agg(x, ',' order_by: y)`, it flows through:

```
Malloy Source          → Parser/AST      → Overload Resolution  → Expression Compiler  → SQL
greatest(a, b)           ExprFunc           FunctionCallNode        expandFunctionCall()    GREATEST(a, b)
```

### Step 1: Parsing (`lang/ast/expressions/expr-func.ts`)

The parser creates an `ExprFunc` AST node storing the function name, arguments, and any modifiers (order_by, limit, distinct). It does **not** resolve which SQL to generate — that happens at translation time.

### Step 2: Overload Resolution (`expr-func.ts:getPropsExpression()`)

The translator looks up the function by name (case-insensitive) in two namespaces:

1. **GlobalNameSpace** — standard library functions available in all dialects
2. **DialectNameSpace** — functions specific to the current dialect

It then calls `findOverload()` to match arguments against overload signatures, checking:
- Argument count and types (including generic type inference)
- Expression type compatibility (scalar, aggregate, analytic)
- Eval space constraints (literal, constant, input, output)

The result is a `FunctionCallNode` in the IR, which carries the matched `FunctionOverloadDef` — including per-dialect expression templates.

### Step 3: SQL Generation (`model/expression_compiler.ts`)

`generateFunctionCallExpression()` takes the `FunctionCallNode` and:
1. Compiles each argument expression to SQL
2. Calls `expandFunctionCall()` to substitute arguments into the dialect's expression template
3. Handles aggregate modifiers (ORDER BY, LIMIT, DISTINCT, symmetric aggregates)
4. Handles analytic functions (OVER clause with PARTITION BY, ORDER BY, window bounds)

`expandFunctionCall()` walks the template expression tree, replacing:
- `function_parameter` nodes with compiled argument SQL
- `spread` nodes with comma-separated variadic arguments
- `aggregate_order_by` nodes with the ORDER BY clause (or empty string)
- `aggregate_limit` nodes with the LIMIT clause (or empty string)

## Three Collections of Functions

Each dialect provides functions through three collections, each with a distinct role:

### 1. Malloy Standard Library (`functions/malloy_standard_functions.ts`)

Cross-database functions that form Malloy's portable function library. Every dialect must support these. The standard library defines both the **signature** (name, parameter types, return type) and a **default implementation** (SQL template).

Examples: `abs`, `concat`, `greatest`, `substr`, `round`, `starts_with`, `stddev`, `row_number`

The `Standard` type at the top of the file is the authoritative list of standard functions. Each is defined as a `DefinitionBlueprint` (single overload) or has named overloads (e.g., `ltrim` has `whitespace` and `characters` variants).

Exported via `getMalloyStandardFunctions()`, which expands all blueprints into `DialectFunctionOverloadDef[]`.

### 2. Standard Library Overrides (`{dialect}/function_overrides.ts`)

Dialect-specific **re-implementations** of standard library functions. These replace only the `impl` (SQL template) while keeping the signature from the standard library. Use these when a dialect's SQL syntax differs from the default.

Example from Trino:
```typescript
export const TRINO_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  byte_length: {sql: '(LENGTH(CAST(${value} AS VARBINARY)))'},
  is_inf: {sql: 'COALESCE(IS_INFINITE(${value}), false)'},
  trunc: {
    to_integer: {sql: 'CASE WHEN ${value} < 0 THEN CEIL(...) ELSE FLOOR(...) END'},
    to_precision: {sql: '...'},
  },
};
```

For overloaded functions, you can override individual overloads by name (`to_integer`, `to_precision`). For single-overload functions, provide a single `ImplementationBlueprint`.

Exported via `expandOverrideMap(overrides)`, which merges overrides with the standard library base definitions.

### 3. Dialect-Specific Functions (`{dialect}/dialect_functions.ts`)

Functions unique to a dialect (or shared among a family, like Trino/Presto). These define both signature and implementation from scratch. They appear only when querying that dialect.

Examples: Trino's `array_agg`, `max_by`, `regexp_like`, `tdigest_agg`

Exported via `expandBlueprintMap(blueprints)`.

### How They Combine

In `global-name-space.ts:getDialectFunctions()`:

1. Standard library blueprints are expanded into base overload definitions
2. Each dialect's overrides are applied — matching overloads by parameter signature, replacing the expression template
3. The result is a `FunctionDef` per function, where each `FunctionOverloadDef` has a `dialect` map containing per-dialect expression templates
4. Dialect-specific functions are loaded separately into `DialectNameSpace` and searched after the global namespace

## Defining Functions: The Blueprint System

Functions are defined as "blueprints" — declarative data structures that get expanded into the compiler's internal `DialectFunctionOverloadDef` type. This is done at startup, not at query time.

### Blueprint Types

- **`DefinitionBlueprint`** — A single function overload: signature + implementation
- **`OverloadedDefinitionBlueprint`** — Multiple named overloads: `{overload_name: DefinitionBlueprint, ...}`
- **`ImplementationBlueprint`** — Just the implementation (for overrides): `{sql: ...}`, `{function: ...}`, or `{expr: ...}`

### Anatomy of a DefinitionBlueprint

```typescript
const example: DefinitionBlueprint = {
  // Generic type parameters (optional)
  generic: {'T': ['string', 'number', 'date', 'timestamp']},

  // Parameter definitions (order matters for positional matching)
  takes: {
    'value': {dimension: T},        // scalar expression of generic type T
    'separator': {literal: 'string'}, // must be a literal string
    'items': {variadic: 'number'},   // variadic (accepts 1+ number args)
  },

  // Return type
  returns: {measure: 'string'},     // aggregate returning string

  // SQL template
  impl: {sql: 'ARRAY_JOIN(ARRAY_AGG(${value} ${order_by:}), ${separator})'},

  // Aggregate options (optional)
  supportsOrderBy: true,
  supportsLimit: true,
  isSymmetric: true,  // safe with symmetric aggregate optimization
};
```

### Parameter Type Modifiers

Wrapping a type changes what expression types and eval spaces are accepted:

| Blueprint syntax | Meaning |
|---|---|
| `'string'` | Any string expression (scalar, aggregate, etc.) |
| `{dimension: 'string'}` | Scalar string expression only |
| `{measure: 'number'}` | Aggregate number expression only |
| `{literal: 'string'}` | Must be a compile-time literal |
| `{constant: 'number'}` | Must be a constant expression |
| `{calculation: 'number'}` | Analytic (window) expression |
| `{variadic: 'string'}` | One or more string arguments |
| `['string', 'number']` | Accepts either string or number |
| `{generic: 'T'}` | Generic type T (resolved at call site) |
| `{array: 'number'}` | Array of numbers |
| `{record: {x: 'number', y: 'string'}}` | Record type |
| `{sql_native: 'hyperloglog'}` | SQL-native type with specific raw type |

### Implementation Styles

Three ways to specify the SQL output:

**`{function: 'NAME'}`** — Simple function call. Arguments are placed in order inside parentheses:
```typescript
impl: {function: 'ABS'}     // → ABS(value)
impl: {function: 'GREATEST'} // → GREATEST(a, b, c, ...)
```

**`{sql: '...'}`** — SQL template string with interpolation:
```typescript
impl: {sql: 'COALESCE(IS_INF(${value}), false)'}
impl: {sql: 'ARRAY_AGG(${x} ${order_by:})'}
impl: {sql: 'CONCAT(${...values})'}  // spread variadic
```

Template variables:
- `${paramName}` — substitutes compiled SQL for that parameter
- `${...paramName}` — spreads variadic parameter (comma-separated)
- `${order_by:}` — replaced with `ORDER BY ...` clause or empty string
- `${limit:}` — replaced with `LIMIT N` clause or empty string

**`{expr: sql\`...\`}`** — Expression tree built with tagged template literal. Used for complex cases where arguments need wrapping:
```typescript
impl: {expr: sql`CONCAT(${spread(arg('values'), 'CAST(', 'AS VARCHAR)')})`}
```
Here each spread element gets wrapped in `CAST(... AS VARCHAR)`.

### The `def()` Shorthand

For simple functions where the SQL is just `FUNC_NAME(arg1, arg2, ...)`, the `def()` helper eliminates boilerplate:

```typescript
// Instead of:
const bitwise_and: DefinitionBlueprint = {
  takes: {'val1': 'number', 'val2': 'number'},
  returns: 'number',
  impl: {function: 'BITWISE_AND'},
};
export const FUNCTIONS = { bitwise_and };

// Write:
export const FUNCTIONS = {
  ...def('bitwise_and', {'val1': 'number', 'val2': 'number'}, 'number'),
};
```

`def(name, takes, returns, options?)`:
- Sets `impl` to `{function: name.toUpperCase()}` by default
- Auto-discovers generic type references and defaults them to `['any']`
- Spreads into a `{[name]: DefinitionBlueprint}` — use `...def(...)` to merge into a map
- Pass `options` to override `impl`, `isSymmetric`, `generic`, etc.

### The `T` Convention

For readability with generic types, define a shorthand:
```typescript
const T: TypeDescBlueprint = {generic: 'T'};

// Then use it naturally:
...def('array_sort', {'x': {array: T}}, {array: T})
...def('element_at', {'x': {array: T}, 'ordinal': 'number'}, T)
```

This is purely a readability convention — `T` is just `{generic: 'T'}`.

### Preferred Style for New Dialects

When creating a new dialect, prefer `def()` and the `T` convention for simple functions. Use full `DefinitionBlueprint` objects only when you need:
- SQL templates (`{sql: ...}`)
- Multiple overloads (`OverloadedDefinitionBlueprint`)
- Window function options (`needsWindowOrderBy`, `between`)
- Order by or limit support in aggregates

## Adding a New Dialect

See [adding-a-new-database.md](../doc/adding-a-new-database.md) for a complete step-by-step guide covering both the Dialect and Connection sides, test data setup, and CI configuration.

### Escape-function contract

Every dialect must declare three fields that drive identifier and string-literal escaping:

- `identifierQuoteChar` — the character used to quote identifiers, typically `"` or `` ` ``.
- `identifierEscapeStyle` — `EscapeStyle.Doubled` (ANSI: doubling the quote char escapes it; every current dialect except BigQuery) or `EscapeStyle.Backslash` (BigQuery: quoted identifiers use string-literal escape sequences).
- `stringLiteralStyle` — `EscapeStyle.Doubled` for ANSI `''` escaping (Postgres-family) or `EscapeStyle.Backslash` for `\'` escaping (BigQuery, Snowflake, MySQL, Databricks).

`EscapeStyle` is exported from `dialect.ts`; importing it gives the literal-type narrowing for free, so dialect files do not need `as const`.

The base class provides safe implementations of `sqlQuoteIdentifier`, `sqlLiteralString`, and `sqlLiteralRegexp` driven by these flags. Dialects normally do not override them. If a subclass forgets to set a flag, the base method throws at first use with a message naming the dialect and the missing flag — `escape.spec.ts` exercises this fail-fast path on every registered dialect, so a forgotten flag fails CI rather than producing wrong SQL silently.

The contract is verified by `packages/malloy/src/dialect/escape.spec.ts`, which iterates `getDialects()` and asserts that an adversarial input corpus round-trips through each escape function. A new dialect is covered automatically the moment it is registered in `dialect_map.ts`; you do not need to edit the spec file.

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

All three are exposed as `Dialect` properties already: `identifierQuoteChar`, `identifierEscapeStyle`, and `tablePathBareIdentRegex`. The base `sqlValidateTableName` reads them and calls `parseDottedTablePath` from `dialect/table-path.ts`. A new well-behaved dialect just declares its bare-segment regex (and uses the existing escape/quote properties) and inherits the rest:

```ts
// e.g. postgres/postgres.ts
override tablePathBareIdentRegex = /^[A-Za-z_][A-Za-z0-9_$]*/;
// No sqlValidateTableName override needed.
```

The per-dialect regexes were derived empirically by probing the live engines.

**One dialect overrides the method outright: DuckDB.** Its grammar isn't a pure dotted-segment shape — it accepts file-path-shaped inputs (`arrests-latest.parquet`, `s3://…`, globs) and explicit single-quoted literals (`'foo.csv'`) in addition to identifier paths. See `duckdb/table-path-parser.ts`. **Do not look at DuckDB as a reference for a normal SQL dialect** — its grammar is intentionally richer than what ANSI SQL allows.

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
