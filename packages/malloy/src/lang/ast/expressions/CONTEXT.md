# Expression AST Nodes

Expression-shaped AST nodes all extend `ExpressionDef` (`../types/expression-def.ts`).
The two integration points are:

- **`computeExpression(fs: FieldSpace): ExprValue`** — evaluate this node and return an IR value + type. This is what a node implements. Callers never invoke it directly; they call `getExpression`, which is sealed on `ExpressionDef` and memoizes.
- **`apply(fs, op, left, byApplyOperator): ExprValue`** — called when this node appears as the *right* operand of a binary operator; allows the node to override how the comparison is assembled (see below).

## ExprValue is shared — treat it as immutable

`getExpression` remembers the last value it computed, keyed on the field space and
that space's `generation()`. Asking a node twice returns **the same object**, and that
object is also what gets stored into the IR. So a value you receive is not yours to
modify: retyping or appending to one reaches every other holder, including field
definitions already handed out.

Derive instead — `{...operand, type: 'boolean'}`, or `computedExprValue({…, from: [operand]})`.
Two call sites used to retype an operand in place; it was invisible while every
evaluation allocated a fresh object, and became a miscompile once they didn't.

The memo is why `+`/`-` chains compile in linear rather than exponential time:
`delta()` evaluates both operands and then hands the *nodes* to `numeric()`, which
evaluates them again, so without it each `+` doubled the work beneath it.

## The apply / partial dance

`ExprCompare.getExpression` does not call `getExpression` on both sides and combine them.
Instead it does:

```ts
this.right.apply(fs, this.op, this.left)
```

The **right** operand controls how the expression is assembled. The default
`ExpressionDef.apply` dispatches on the operator, evaluates both sides and returns a
normal binary node — so ordinary values work transparently without knowing anything
about `apply`.

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
return this.right.apply(fs, '=', this.left, true);
```

So `x ? > 5` → `PartialCompare(>, 5).apply(fs, '=', x)` → `x > 5`.
And `x ? 5 | 6 | 7` → `ExprAlternationTree.apply(fs, '=', x)` → `x IN (5, 6, 7)`.

The same `apply` hook is used by `pick … when`, which also puts a
`partialAllowedFieldExpr` on its right. The right side of `?`, `|`, `&` and
`when` are the **partial positions**: the places a partial may be written.

### `?` and a written operator reach the right side the same way

Both call `right.apply`, and `?` passes `'='` as its operator. What tells them
apart is the fourth argument of `apply`, `byApplyOperator`: `Apply` (the `?`
node) passes `true` when it hands its right side the `=`. Every other caller
leaves it false, which is right both for an operator written in the source
and for a node applying an operator of its own, as a range does with `>=` and
`<` and a `PartialCompare` does with the operator it holds. A node which
hands the application it was given on to nodes it holds — an alternation tree
to its choices, a pick to its `when`s — passes the argument on.

For a range, a granular literal and `null` the difference does not matter:
each means the same under `?` as under `=`. An alternation tree uses it to
decide whether a pick among its choices is a value to list in an `IN` or a
choice to apply. (The tree's `or-choices-only` warning is a separate matter:
`ExprEquality` asks for it, through `applyEquality`, when the tree is its
right side.) It matters most for `Pick`, which has two forms:

| reached by | form | `when` holds |
|---|---|---|
| `?` | the **applied form**, like a partial: the left side is applied to each `when` | a partial position |
| a written operator, or standing alone | the **value form**, like a case statement; the operator works on its value | a boolean expression |

So `Pick.apply` builds the applied form only when `byApplyOperator` is true.
Otherwise it falls through to the base `apply`, which asks the pick for its
value, and a pick not written in the value form reports why, in words which
name `?`.

What is applied must test the value: each choice of an alternation tree and
each `when` of an applied pick has to come back boolean, and one which does
not (an applied pick of numbers, say) is the error `applied-is-not-a-test`.

Before either form, `Apply` asks its right side for a value
(`requestExpression`), and a granular one is tested as a range. So a pick in
the value form with a granular value, when it is the whole right side of `?`,
is a range test and does not reach `Pick.apply`.

A range, a granular literal and an alternation tree answer only a comparison
operator. Handed any other operator they fall through to the base `apply`,
which asks for their value: an error for a range or an alternation, the
literal's own value for a granular literal.

### Parentheses make no node

`(expr)` in the source is the node for `expr`, at the location of `expr`, so
an expression means the same thing in parentheses as out of them. Grouping
reaches the SQL through the shape of the tree alone; how the compiler honors
that is in `model/CONTEXT.md`.

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
Neither overrides `apply`. The base implementation calls `this.getExpression(fs)` — which
uses `this.expr`, the original bound LHS, completely ignoring the `left` that arrived
through `apply`.

To support partial `in` you would need a node class (`ExprPartialIn` /
`ExprPartialInGiven`) that:
- Stores only `notIn` + the choices (no `expr`)
- Returns `undefined` from `requestExpression`
- Returns a `partial-as-value` error from `getExpression`
- Overrides `apply(fs, _op, left)` to evaluate `left` and the choices and emit the `in`
  IR node directly

Both fixes (grammar + AST node) are required together.
