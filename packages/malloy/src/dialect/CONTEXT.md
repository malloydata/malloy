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

Each dialect needs:

1. **`{dialect}.ts`** — Dialect class extending the abstract `Dialect` base, implementing:
   - `getDialectFunctionOverrides()` → overrides for standard library functions
   - `getDialectFunctions()` → dialect-specific functions
   - Various SQL generation methods (see `dialect.ts` for the full interface)

2. **`function_overrides.ts`** — Export an `OverrideMap` for standard functions that need different SQL in your dialect

3. **`dialect_functions.ts`** — Export a `DefinitionBlueprintMap` for dialect-specific functions

4. Register the dialect in `dialect_map.ts`

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
