# Booleans on a dialect with no boolean value

On a dialect with `booleanType: 'none'`, such as SQL Server, there is no
boolean type in the database, so:

  * Asking the connection for the schema of a table or a SQL source never
    returns a field of type boolean.
  * A boolean is a condition, never a value. Where a program would use a
    boolean as a value, the translator reports an error at that expression;
    [Translator errors](#translator-errors) lists every case.

Boolean expressions can be saved as field expressions. However the things you can do with a boolean expression in code are limited. For example, in most dialects you can do something like this:

```
source: thing is ... extend {
   dimension: is_small is size < 10
}

run: thing -> { group_by: color, too_small is is_small }
```

On a dialect with no boolean value type, you must write something like this instead because you cannot select or group_by (or aggregate) a boolean expression:

```
run: thing -> { group_by: color, too_small is pick 'yes' when is_small else 'no' }
```

## `not`, `!=`, `!~`

Malloy's [null-safe negation](https://docs.malloydata.dev/documentation/language/null-handling)
is written as a condition:

| Malloy | SQL |
|---|---|
| `not c` | `(CASE WHEN c THEN 1 ELSE 0 END = 0)` |
| `a != b`, `a !~ b` | `(CASE WHEN NOT (c) THEN 1 ELSE 0 END = 0)`, where `c` is the positive comparison |

## Translator errors

Each of these uses a boolean as a value, and is an error only when the model
is compiled for a `'none'` dialect.

- A boolean field in a query's output: `select:`, `group_by:`, `aggregate:`,
  and any other place a field becomes a result column.
- `is null` and `is not null` with a boolean operand.
- Any comparison (`=`, `!=`, `<`, `<=`, `>`, `>=`) with a boolean operand
  (`is_small = 1`, `size > is_small`, `is_small ? > false`), written plainly,
  as a partial or in an alternation.
- `??` with a boolean operand.
- A `pick` or `case` whose result is a boolean.
- A boolean filter expression (`x ~ f'true'`).
- A boolean as a function argument.
- A cast to or from boolean (`x::boolean`, `is_small::string`).

Each error says what to write instead.

## `select: *`

A star expansion leaves out boolean fields, with a warning naming each one and
suggesting the `pick` form.

## Why this is enough

A boolean has two states. A condition is only ever tested, and a tested unknown
is false, so unknown and false cannot be told apart. Through `and`, `or`, and
Malloy's `not`, treating unknown as false gives the same result as SQL Server's
three-valued logic, at any depth. The only operations that could observe the
difference are `is null` and a boolean used as a value, which are errors. So
`pick 'yes' when is_small else 'no'` loses nothing.
