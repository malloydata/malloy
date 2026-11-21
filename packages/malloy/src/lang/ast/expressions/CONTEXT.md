# Expression AST Nodes

Expression-shaped AST nodes all extend `ExpressionDef` (`../types/expression-def.ts`).
The two integration points are:

- **`computeExpression(fs: FieldSpace): ValueOrRange`** — evaluate this node. This is what a node implements. Callers never invoke it directly; they call `getExpression`, `getUnsettled` or `getValueOrRange`, which are sealed on `ExpressionDef` and memoize.
- **`apply(fs, op, left, byApplyOperator): Unsettled`** — called when this node appears as the *right* operand of a binary operator; allows the node to override how the comparison is assembled (see below).

## What a node evaluates to

An `ExprValue` (`../types/expr-value.ts`) is one flat object holding two things:

- **a type**: `type` and the fields of its type definition (`numberType`, `fields`,
  `elementTypeDef`, …), plus `expressionType` (scalar, aggregate, …), `evalSpace`
  (literal, constant, input, output) and the usage summaries (`refSummary`,
  `ungroupings`, `requiresGroupBy`);
- **a value**: `value`, the IR `Expr`.

When a value goes into the IR, `value` is the definition and the type is the field's type.

Some fields of the type describe one particular value rather than its type.
`timeframe` on a temporal type is the value's granularity: `@2020` and `ats.month`
each stand for a whole unit of time, which is what `?` tests against, what `+ 1`
offsets by and what a result column renders by. A value computed from others does
not simply inherit it:

- a truncation sets it;
- a choice (pick, `??`, case) keeps a granularity every non-null alternative
  shares, and has none when they differ;
- a function call has none, even when its arguments share one, because what it
  does to a unit of time is not known; truncating its result gives it one;
- a field keeps the granularity of its definition.

### Morphic values

A date literal is a date, and beside a timestamp it is that date read in the query
timezone. Such a value is a `MorphicValue` (`../types/morphic-value.ts`):
`{type: 'morphic', forms: ExprValue[]}`, one value computed in two or more forms, the
first form the default. `Unsettled` is `ExprValue | MorphicValue`.

A morphic value has no `value`, and `'morphic'` is not a type in `malloy_types`, so a
morphic value cannot be stored in an `ExprValue`, a field, or the IR. To **settle** one
is to choose a form.

### Ranges

`?` tests a span of time. A value with a granularity is a span one unit wide, which
`?` rebuilds from the type. A span whose width varies by row cannot ride on the type,
so it is a value of its own: a `RangeValue`, `{type: 'range', start, end}`, from
`start` up to but not including `end`, each of which may be morphic. A date literal
is one, with its next value as the end.

A range goes through a choice, pick (both forms), `??` and case, and stops at
anything with a type of its own: a function call, a cast, a field, a given. A choice
in which some alternative is a span is a range from the choice of starts to the
choice of ends, so each alternative keeps its own width. A null alternative is a null
span. A single value beside a span is a span of no width, its end its start;
`withMoments` marks such a range, and `?` tests it as
`x >= start and (x < end or x = start)`.

To anything that does not ask, a range is its `start`. A range has no `value`, and
`'range'` is not a type in `malloy_types`, so it never reaches a field or the IR: a
choice of different widths stored as a dimension is a plain date or timestamp, and
`?` against the field is an equality. `ValueOrRange` is `Unsettled | RangeValue`.

Two things read a range. `?` tests it (`apply-test.ts`), alone or as one item of a
`|` list. `+` and `-` with no unit refuse a range whose value has no granularity,
since its alternatives differ and there is no unit to step by.

### Which accessor returns what

- `getExpression(fs, as?)` returns an `ExprValue`: the value settled to the form of type
  `as`, else the default. Almost every caller uses this and never sees a morphic value
  or a range.
- `getUnsettled(fs)` returns an `Unsettled`: the value, possibly morphic, a range read
  as its start. A caller that can use another form asks for it.
- `getValueOrRange(fs)` returns what the node computed, possibly a range. Only a node
  that makes a range (a choice), passes one on (an applied pick, through
  `Pick.applyValueOrRange`) or reads one (`applyTest` and `delta`, through `rangeOf`)
  asks for it.

A caller of `getUnsettled` settles the value itself, usually through one of these:

| the caller | how it settles |
|---|---|
| compares two values | `settlePair` / `settleAgainst`: each side takes the form matching the other |
| chooses among values (pick, case, `??`) | `choice`: each alternative is settled to the type they share |
| computes a new value in each form (a function returning its argument's type) | `inEachForm`: computes once per form |
| has a declared type (source argument) | `getExpression(fs, declaredType)`; a given or parameter default, `constantValue(declaredType)` |
| calls a function | `findOverload` settles each argument to the parameter it matches |

The rules for the type of a choice are in `commonType`. A few refusals sit with the
node: `??` refuses a null right side, and a pick refuses a filter expression.

## ExprValue is shared — treat it as immutable

`getValueOrRange` remembers the last value it computed, keyed on the field space and
that space's `generation()`. Asking a node twice returns **the same object**, and that
object is also what gets stored into the IR. So a value you receive is not yours to
modify: retyping or appending to one reaches every other holder, including field
definitions already handed out.

Derive instead, with `computedExprValue({dataType, value, from: [operand]})`. Pass a
type definition as `dataType`, never another `ExprValue`: that copies what belongs to
the other value onto one it does not describe. `typeDefOf` gives a value's type and
granularity and nothing else. Spreading an operand (`{...operand, value}`) is
right only when the result is the same value in a new shape.

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
| `ExprAlternationTree` (`5 \| 6 \| 7`) | a tree of values/partials | when `applyOp` is `=`/`!=` and the tree is all plain values, emits an `in` IR node; otherwise recurses, applying each branch to `expr`, and under `?` reads each branch as it would be read alone after `?` |

Both classes also:
- Return `undefined` from `requestExpression` (so the `?` apply operator does not try to
  use them as standalone values)
- Return an error from `getExpression` (since they are not valid stand-alone values)

### How `?` (apply) uses this

`Apply` extends `ExprCompare` with `op = '='`. It reads its right side through
`applyTest` (`apply-test.ts`), which ends, for anything that is not a span, in:

```ts
// simplified
return right.apply(fs, '=', left, true);
```

So `x ? > 5` → `PartialCompare(>, 5).apply(fs, '=', x)` → `x > 5`.
And `x ? 5 | 6 | 7` → `ExprAlternationTree.apply(fs, '=', x)` → `x IN (5, 6, 7)`.

One thing only `?` does, which is why it lives in `applyTest` and not in `apply`:
a right side which stands for a span of time is tested as that span. `x ? ad.month`
tests the month, and `x ? (pick @2020 when c else @2021-03)` tests the year or the
month the pick selects. `=` against the same pick is a single equality.

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

Before either form, `applyTest` asks its right side for a value
(`requestExpression`), and one which stands for a span is tested as that span.
So a pick in the value form whose value is a span, as the right side of `?` or
as one item of a `|` list under `?`, is a range test and does not reach
`Pick.apply`.

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
