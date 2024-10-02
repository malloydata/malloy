# NULL fields are a problem
Because any field might be null, any expression might have NULL values.

SQL basically says that any expression involving null values results in null value.

For booleans, the creates a problem where "condition" and "not condition" cannot
be assumed to cover all possibilities (because they might both be NULL)


## Null Safe Not

As an experiment, the following negation operators are all protected against NULL
values.

It is an open question if this is a good idea or not, but this has been how Malloy
works for a while, so to err on the side of safety, I am simply writing down
what happens now and moving on

This transformation used to happen in the compiler, but at this writing,
it now happens it code generation time.

| Expression | Null Safe Version |
| ---- | ---- |
| `not x` | `coalesce(not x, true)` |
| `a != b` | `coalesce(a != b, true)` |
| `a !~ b` | `coalesce(a != b, true)` |

## Null Safe Functions

There needs to be a call about null safety on arguments to the standard functions and on the return.