# Expression AST Nodes

Expression-shaped AST nodes all extend `ExpressionDef` (`../types/expression-def.ts`).
The two integration points are:

- **`getExpression(fs: FieldSpace): ExprValue`** — evaluate this node and return an IR value + type.
- **`apply(fs, op, left): ExprValue`** — called when this node appears as the *right* operand of a binary operator; allows the node to override how the comparison is assembled (see below).

## The apply / partial dance

`ExprCompare.getExpression` does not call `getExpression` on both sides and combine them.
Instead it does:

```ts
this.right.apply(fs, this.op, this.left)
```

The **right** operand controls how the expression is assembled. The default
`ExpressionDef.apply` just calls `applyBinary(fs, left, op, this)`, which evaluates both
sides and returns a normal binary node — so ordinary values work transparently without
knowing anything about `apply`.

Nodes that behave as **partials** override `apply` and substitute their own structure for
the operator/operands that come in. The critical invariant: **a partial node has no bound
LHS**. The LHS arrives through `apply`.

### Partial node catalog

| Class | Stores | `apply` behavior |
|---|---|---|
| `PartialCompare` (`> 5`) | `op` + `right` only | ignores the incoming `op`; does `this.right.apply(fs, this.op, expr)` |
| `ExprAlternationTree` (`5 \| 6 \| 7`) | a tree of values/partials | when `applyOp` is `=`/`!=` and the tree is all plain values, emits an `in` IR node; otherwise recurses, applying each branch to `expr` |

Both classes also:
- Return `undefined` from `requestExpression` (so the `?` apply operator does not try to
  use them as standalone values)
- Return an error from `getExpression` (since they are not valid stand-alone values)

### How `?` (apply) uses this

`Apply` extends `ExprCompare` with `op = '='`.  Its `getExpression` is:

```ts
// simplified
return this.right.apply(fs, '=', this.left);
```

So `x ? > 5` → `PartialCompare(>, 5).apply(fs, '=', x)` → `x > 5`.
And `x ? 5 | 6 | 7` → `ExprAlternationTree.apply(fs, '=', x)` → `x IN (5, 6, 7)`.

The same `apply` hook is used by `pick … when`, which also puts a
`partialAllowedFieldExpr` on its right.

## Why `in [...]` does not work as a partial

There are two independent blockers.

### 1. Grammar gap

`partialAllowedFieldExpr` (what may appear on the RHS of `?` or `when`) is:

```
partialAllowedFieldExpr : partialTest | '(' partialTest ')' | fieldExpr ;
partialTest             : partialCompare | IS NOT? NULL ;
partialCompare          : compareOp fieldExpr ;
```

`in [...]` and `in $given` always bind their LHS in the grammar
(`fieldExpr NOT? IN …`), so they can only appear in `partialAllowedFieldExpr` as a
complete expression with a bound LHS — not as a bare `partialTest`. The parser will not
produce the right tree for `x ? in [1, 2, 3]`.

### 2. No partial-in AST node

`ExprLegacyIn` and `ExprInGiven` both bake the LHS into the constructor as `this.expr`.
Neither overrides `apply`. When `apply` falls through to the base implementation it calls
`applyBinary(fs, left, op, this)`, which calls `this.getExpression(fs)` — which uses
`this.expr`, the original bound LHS, completely ignoring the `left` that arrived through
`apply`.

To support partial `in` you would need a node class (`ExprPartialIn` /
`ExprPartialInGiven`) that:
- Stores only `notIn` + the choices (no `expr`)
- Returns `undefined` from `requestExpression`
- Returns a `partial-as-value` error from `getExpression`
- Overrides `apply(fs, _op, left)` to evaluate `left` and the choices and emit the `in`
  IR node directly

Both fixes (grammar + AST node) are required together.
