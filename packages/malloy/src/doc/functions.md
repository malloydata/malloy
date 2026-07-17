# How Function Calls Work

A function call in Malloy source — `greatest(a, b)`, `string_agg(x, ',' order_by: y)`, `abs(-1)` — travels from parse tree to SQL through overload resolution and template expansion. This describes that path. To *author* a function or a dialect's SQL for one, see [`dialect/functions/CONTEXT.md`](../dialect/functions/CONTEXT.md).

## Where functions come from

Two namespaces are searched, dialect first:

- **`DialectNameSpace`** (`lang/ast/types/dialect-name-space.ts`) — functions the current dialect defines itself (`dialect.getDialectFunctions()`), e.g. Trino's `max_by`.
- **`GlobalNameSpace`** (`lang/ast/types/global-name-space.ts`) — the Malloy standard library. Assembled once by the module-level `getDialectFunctions()` in that file (not the `Dialect` method of the same name): each standard function's base blueprint is expanded, then every dialect's overrides are merged in, producing one `FunctionDef` whose overloads each carry a `dialect` map of SQL templates keyed by dialect name.

A `FunctionDef` (`model/malloy_types.ts`) is `{type: 'function', overloads: FunctionOverloadDef[]}`. Resolution picks one overload.

## Three call paths

`ExprFunc` (`lang/ast/expressions/expr-func.ts`) is the AST node for every `name(args)`. Which path it takes is decided in `getExpression` / `getPropsExpression`:

1. **Resolved call** — the name matches a `FunctionDef`. The normal path; overload resolution runs (below).
2. **Raw call, `name!(args)` or `name!type(args)`** — `isRaw`. No resolution: the arguments are compiled and emitted verbatim as `name(arg, …)`. Return type is the explicit `!type` if given, else inferred from the first argument (defaulting to `number`). This is the escape hatch for any SQL function Malloy doesn't model. An unknown plain name errors with exactly this suggestion: *"Unknown function 'x'. Use 'x!(...)' to call a SQL function directly."*
3. **`sql_*` literal call** — the built-ins `sql_number`, `sql_string`, `sql_date`, `sql_timestamp`, `sql_boolean` take a string literal of user-supplied SQL and emit it at the given type. Gated by the `sql_functions` experiment (see [`experimental.md`](./experimental.md)).

Paths 2 and 3 are the two raw-SQL escape hatches; both are rejected in restricted queries.

## Overload resolution

For a resolved call, `findOverload` (`expr-func.ts`) matches the argument expressions against each overload's parameters:

- argument count and type, including generic-type inference;
- **expression space** — every argument and return type constrains where the value may come from (`literal` ⊂ `constant` ⊂ `dimension`/scalar ⊂ `measure`/aggregate, plus `calculation`/analytic). A parameter's declared space is the *maximum* it accepts; a return's is the *minimum* it produces — e.g. `stddev` returns a measure, so it upgrades scalar arguments to aggregate. The translator enforces the containment.

For aggregate calls written `join.field.agg(…)`, the path field becomes an implicit leading argument before matching.

The match yields the concrete `FunctionOverloadDef`, which is stored on the IR node.

## The IR node is dialect-bound

Resolution produces a `FunctionCallNode` (`model/malloy_types.ts`) carrying the matched `overload: FunctionOverloadDef`. That overload's `.dialect` field is a map of *every* dialect's template — so the node ships all dialects' SQL, not just the target's. The IR is nonetheless **not dialect-agnostic**: *which* overload resolved (and whether it resolved at all) depended on the compile-time dialect's namespace and on argument types that come from dialect-specific schema. The same source against a different database can produce a different node.

## SQL generation

`generateFunctionCallExpression` (`model/expression_compiler.ts`) binds the node to the running dialect. It compiles each argument, then `expandFunctionCall` walks `overload.dialect[dialect].e`, substituting argument SQL, spread lists, and `order_by:` / `limit:` clauses, and wraps aggregate/analytic modifiers (DISTINCT, symmetric-aggregate handling, the `OVER (…)` clause).

If `overload.dialect[dialect]` is absent, the dialect cannot honor this function and generation throws — the failure surfaces at SQL-generation time, not resolution time.
