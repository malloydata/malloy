# Functions

The `malloy_standard_functions` file defines `MALLOY_STANDARD_FUNCTIONS`, which defines the signature and base implementation of all functions in the "Malloy standard." Any dialect may override the definition (but not the signature) of any function or specific overload of that function.

## Standard Definitions

To add a new Malloy standard function, first, add to the `type Standard` near the top of the file. For functions with one overload, add `my_function: D;`. For functions with multiple overloads, add `my_function: {my_overload1: D; my_overload2: D;}`. This helps the typechecker ensure that definitions and overrides of the new function are synchronized.

Next, define the function. A single overload definition looks like:

```ts
const abs: DefinitionFor<Standard['my_function']> = {
  takes: {'value': 'number'},
  returns: 'number',
  impl: {function: 'MY_FUNCTION'},
};
```

* `takes` is an _ordered_ object with keys as parameter names and values as descriptions of the parameter type.
  * the parameter type should be
    * a Malloy type: `'string'`, `'number'`, `'boolean'`, `'date'`, `'timestamp'`, `'json'`
    * `'any'`
    * `'regular expression'`
    * `{generic: 'T'}`, where `'T'` is the name of a defined generic for this overload (see below)
    * `{expr_type: x}`, where `expr_type` is `literal`, `constant`, `dimension`, `measure`, or `calculation`, and `x` is any of the above options. This specifies the maximum allowed expression type for the parameter.
* `returns` is the return type of the overload, and may have any of the same values as a parameter type listed above. The one difference is that when using `{expr_type: x}`, the expression type is the minimum expression type returned by the function: e.g. if you have `returns: {constant: 'number'}`, the function will return a constant as long as the arguments are all constant or literal, but will return a dimension if a dimension is passed in.
* `impl` is one of:
  * `{ function: 'NAME_OF_FUNCTION' }`, which will generate SQL like `NAME_OF_FUNCTION(arg1, arg2, ..., argN)`
  * `{ sql: "FUNC(${param})" }`, which will generate SQL like `FUNC(value_of_param)`
    * `${param}` is replaced with a parameter fragment, which is expanded by the compiler to be the SQL for the argument of that parameter
    * `${...param}` is expanded to a spread fragment, which is expanded to a comma-separated list of arguments for a variadic parameter
    * `${order_by:}` and `${limit:}` expand to `aggregate_order_by` and `aggregate_limit` fragments respectively
  * `{ expr: { node: "node_type", ... } }`, for cases where the `function` or `sql` options are insufficiently flexible; generates SQL for an arbitrary node, which may include parameter fragments, spread fragments (optionally with prefix and suffix), and order by or limit fragments.
* `generic` specifies that the overload is generic over some types; it should be an object `{'T': types}`, where `'T'` is the name of the generic, and `types` is an array of Malloy types: e.g. `generic: {'T', ['string', 'number', 'timestamp', 'date', 'json']},`. Note that currently we only allow one generic per overload, since that's all we need right now. Under the hood, this creates multiple overloads, one for each type in the generic. Eventually we may make the function system smarter and understand generics more deeply.
* `supportsOrderBy` is for aggregate functions (e.g. `string_agg`) which can accept an `{ order_by: value }`. `false` is the default value. `true` indicates that any column may be used in the `order_by`. A value of `'default_only'` means that only the more limited `{ order_by: asc }` syntax is allowed.
* `supportsLimit`: is for aggregate functions (e.g. `string_agg`) which can accept a `{ limit: 10 }`. Default `false`.
* `isSymmetric` is for aggregate functions to indicate whether they are symmetric. Default `false`.

A function with multiple overloads is defined like:

```TypeScript
const concat: DefinitionFor<Standard['concat']> = {
  'empty': {
    takes: {},
    ...
  },
  'variadic': {
    ...
    impl: {function: 'CONCAT'},
  },
};
```

## Standard Overrides

Each dialect may override the standard implementations (that is, the `impl` part only). To do so:

```TypeScript
import {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';

export const DIALECT_OVERRIDES: OverrideMap = {
  byte_length: {sql: ...},
  replace: {
    regular_expression: {
      sql: ...,
    },
  },
  ...
};
```

The `MalloyStandardFunctionImplementations` type will typecheck that the names of overridden functions and overrides are correct, so that they can be matched up to the Malloy standard versions.

The `Dialect` implementation then implements `getDialectFunctionOverrides`. You should use `expandOverrideMap` to synchronize the overrides with the signatures from the standard.

```ts
getDialectFunctionOverrides(): {
  [name: string]: DialectFunctionOverloadDef[];
} {
  return expandOverrideMap(DIALECT_OVERRIDES);
}
```

## Dialect Functions

Each dialect may also have its own set of functions. These are defined just like the Malloy standard functions, but can use the `DefinitionBlueprint` and `OverloadedDefinitionBlueprint` types, which don't require pre-specifying the function and overload names. Then collect these into a `DefinitionBlueprintMap`.

```ts
const my_function: DefinitionBlueprint = {
  takes: {'value': {dimension: 'any'}},
  returns: {measure: 'number'},
  impl: {function: 'MY_FUNC'},
};

const string_agg: OverloadedDefinitionBlueprint = {
  default_separator: {
    takes: {'value': {dimension: 'string'}},
    ...
  },
  with_separator: { ... },
};

export const DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  my_function,
  ...
};
```

### The `def()` experiment
There is also an experimental shortcut for simple wrapper definitions where the name of the function in SQL and in Malloy is the same, and the definition is not overloaded. Here's an example if using `def` to define the string length function ...

Instead of writing

```ts
const length: DefinitionBluePrint = {
  takes: {str: 'string'},
  returns: 'number',
  impl: {function: 'LENGTH'},
}
export const DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  my_function,
  length
}
```

The shortcut looks like this ...

```ts
export const DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  my_function,
  ...def('length', {str: 'string'}, 'number')
};
```

We are waiting on user feedback on this experiment. While these are simpler to write, they are not simpler to read for a human scanning the file for the definition of a function.

### Dialect Implementation
The `Dialect` implementation then implements `getDialectFunctions`. You should use `expandBlueprintMap` to expand the function blueprints into `DialectFunctionOverloadDef`s.

```ts
getDialectFunctions(): {
  [name: string]: DialectFunctionOverloadDef[]
} {
  return expandBlueprintMap(DUCKDB_DIALECT_FUNCTIONS);
}
```

## Note about Eval Space

In a future change, the whole concept of "eval space" should be removed. Therefore it is not represented in the Function Blueprint DSL. Instead, each parameter or return type may indicate that it should be a literal, constant, dimension, measure, or calculation (with no mention of "input" or "output" space). For parameter types, this is the _maximum allowed type_ that an argument may have. For return types, this is the _mimumim type returned_ by the function. For example, the return type of `stddev` is `{ measure: number }` because it will "upgrade" arguments from literal, constant, or dimension, to measure.

To make type-checking work, the function expression translator enforces:
- if the param is literal, that the arg expression is literal
- if the param is constant, that the arg is literal or constant
- if the return type is analytic, that the arg is literal, constant, or output
