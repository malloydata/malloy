# Writing Function Templates

This is the authoring guide for Malloy's function library — signatures and the per-dialect SQL they compile to. For how a call is resolved and emitted at runtime, see [`../../doc/functions.md`](../../doc/functions.md).

Functions are declared as **blueprints**: plain data expanded at startup into the compiler's `DialectFunctionOverloadDef`. The blueprint types, expansion functions, and the `arg()` / `spread()` / `sql()` / `def()` helpers all live in [`util.ts`](./util.ts) — read it for the exact types; this file covers the shape and the conventions.

## Three collections

A dialect contributes functions through three collections, each with a distinct role:

1. **Standard library** — [`malloy_standard_functions.ts`](./malloy_standard_functions.ts). The portable functions every dialect must support (`abs`, `concat`, `round`, `stddev`, `row_number`, …). Each defines a signature *and* a default SQL implementation. The `Standard` type at the top is the authoritative list; `getMalloyStandardFunctions()` expands it.
2. **Overrides** — `{dialect}/function_overrides.ts`. A dialect re-implementing a standard function's `impl` while keeping its signature, for when the dialect's SQL differs from the default.
3. **Dialect-specific** — `{dialect}/dialect_functions.ts`. Functions unique to a dialect (or a family like Trino/Presto), signature and implementation from scratch. Visible only when querying that dialect.

## A blueprint

```ts
const example: DefinitionBlueprint = {
  takes: {value: 'number', separator: {literal: 'string'}},
  returns: 'string',
  impl: {sql: 'SOME_FUNC(${value}, ${separator})'},
};
```

- **`takes`** — an *ordered* map of parameter name → type. Order is the positional signature.
- **`returns`** — the return type.
- **`impl`** — how it compiles to SQL (below).
- Aggregate-only options (`supportsOrderBy`, `supportsLimit`, `isSymmetric`) and analytic options exist too; see `util.ts`.

A parameter or return type is a Malloy type (`'string'`, `'number'`, …) or `'any'`, optionally wrapped to constrain it: `{literal: T}`, `{constant: T}`, `{dimension: T}`, `{measure: T}`, `{calculation: T}` set the expression space; `{variadic: T}`, `{array: T}`, `{record: {…}}`, `{generic: 'T'}`, `{sql_native: '…'}` set the shape. On a parameter the space is the *maximum* accepted; on a return it's the *minimum* produced. `['string', 'number']` accepts either.

## Implementation styles

- **`{function: 'NAME'}`** → `NAME(arg1, arg2, …)`. For plain wrappers.
- **`{sql: '…'}`** → a template string. `${param}` interpolates a parameter's SQL, `${...param}` spreads a variadic (comma-separated), `${order_by:}` / `${limit:}` expand to the aggregate clauses (or empty).
- **`{expr: sql\`…\`}`** → an expression tree, for when arguments need per-element wrapping. Built with the `sql`, `arg`, and `spread` helpers, e.g. `sql\`CONCAT(${spread(arg('values'), 'CAST(', ' AS VARCHAR)')})\``.

## Overloads

A function with multiple signatures is an `OverloadedDefinitionBlueprint` — a map of overload-name → blueprint. Overrides target one overload by that name:

```ts
const trunc: OverloadedDefinitionBlueprint = {
  to_integer: { … },
  to_precision: { … },
};
```

## `def()` and the `T` convention

For a wrapper whose SQL name equals its Malloy name, `def(name, takes, returns, options?)` removes the boilerplate — it sets `impl` to `{function: NAME}` and spreads into the map:

```ts
export const DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  ...def('bitwise_and', {val1: 'number', val2: 'number'}, 'number'),
};
```

For generics, `const T: TypeDescBlueprint = {generic: 'T'}` reads naturally: `...def('element_at', {x: {array: T}, ordinal: 'number'}, T)`. `def()` is still an experiment — simpler to write, arguably harder to scan for a definition than a full blueprint. Prefer full `DefinitionBlueprint` objects when you need `{sql}`/`{expr}`, multiple overloads, or aggregate/window options.

## Wiring into a dialect

The `Dialect` methods return the expanded collections:

```ts
getDialectFunctions()        { return expandBlueprintMap(DIALECT_FUNCTIONS); }
getDialectFunctionOverrides(){ return expandOverrideMap(DIALECT_OVERRIDES); }
```

`getMalloyStandardFunctions()` expands the base library; the global namespace's own `getDialectFunctions()` (`../../lang/ast/types/global-name-space.ts`) then merges each dialect's overrides onto it, matching by parameter signature and keeping the base SQL where a dialect supplies none. The override and standard maps are typed against `Standard`, so a renamed or misspelled function fails to compile rather than silently going unmatched.

## Adding a standard function

Add an entry to the `Standard` type in `malloy_standard_functions.ts` (`name: D` for one overload, `name: {overload1: D; …}` for several), then define it with `DefinitionFor<Standard['name']>`. The type link keeps every dialect's override in sync with the signature.
