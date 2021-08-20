# Apply (:) Operator

The apply operator takes one expression and applies it to another.
The primary us of apply is to "apply" a value to a partial comparison,
but there are a number of other powerful gestures which use this operator.

For an expression matching the pattern `x : expression`, the following table outlines the various meanings.

Expression Type | Expression | Meaning in apply
---- | ---- | ----
partial comparison |`x:  > 10 & < 100` | `x > 10 and x < 100`
alternate choices | `x: 'A' \| 'B'` | `x = 'A' or x = 'B'`
range match | `x: 1 to 10` | `x >= 1 and x < 10`
equality | `x: 47` | `x = 47`
match | `x: /'ab'` | `x ~ /'ab'` _(this only works when applying a regular expression to a string)_

In addition it is very common to use [Time Ranges](time-ranges.md)
with the apply operator, which operate similar to the numeric range
example above.

