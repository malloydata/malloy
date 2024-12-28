# NULL fields are a problem
Because any field might be null, any expression might have NULL values. NULL in SQL is infecting,
so any expression which has a NULL in it returns a NULL value.

For booleans, especially for boolean dimensions, a very common pattern in Malloy, you end
up creating expressions which contain nonsense data because NOT null is null, or because
two values which are both NULL are NULL when compared which is false-y not equal.

## The Malloy Null Safe Truth Tables

### Boolean NOT

| Expression | x=null | x=true | x=false
| ---- | ---- | ----- | ---- |
| `not x` | `true` | `false` | `true` |

### Non null to nullable

| Expression | x=null |
| ---- | ---- |
| `x = 0` | `false` |
| `x != 0` | `true` |
| `x ~ 'a'` | `false` |
| `x !~ 'a'` | `true` |
| `x ~ r'a'` | `false` |
| `x !~ r'a'` | `true` |

### Compare two nullable

| Expression | x=null, y=null |
| ---- | ---- |
| `x = y` | `true` |
| `x != y` | `false` |
| `x ~ y` | `true` |
| `x !~ y` | `false` |

## Null Safe Functions

There needs to be a call about null safety on arguments to the standard functions and on the return.