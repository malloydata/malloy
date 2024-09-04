| Expression | Null Safe Version |
| ---- | ---- |
| `not x` | `coalesce(not x, true)` |
| `a = b` | `coalesce(a = b, false)` |
| `a != b` | `coalesce(a != b, true)` |