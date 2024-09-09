# Functions

The `malloy_standard_functions` file defines `MALLOY_STANDARD_FUNCTIONS`, which defines the signature and base implementation of all functions in the "Malloy standard." Any dialect may override the definition (but not the signature) of any function or specific overload of that function.

## Note about Eval Space

In a future change, the whole concept of "eval space" should be removed. Therefore it is not represented in the Function Blueprint DSL. Instead, each parameter or return type may indicate that it should be a literal, constant, dimension, measure, or calculation (with no mention of "input" or "output" space). For parameter types, this is the _maximum allowed type_ that an argument may have. For return types, this is the _mimumim type returned_ by the function. For example, the return type of `stddev` is `{ measure: number }` because it will "upgrade" arguments from literal, constant, or dimension, to measure.

To make type-checking work, the function expression translator enforces:
- if the param is literal, that the arg expression is literal
- if the param is constant, that the arg is literal or constant
- if the return type is analytic, that the arg is literal, constant, or output

TODO update me!
