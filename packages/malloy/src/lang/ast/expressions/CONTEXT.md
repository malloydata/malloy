# Expression AST Nodes

Expression-shaped AST nodes all extend `ExpressionDef` (`../types/expression-def.ts`).
The integration points are:

- **`computeExpression(fs: FieldSpace): ExprValue`** — evaluate this node and return an IR value + type. This is what a node implements. Callers never invoke it directly.
- **`computeForms(fs: FieldSpace): Forms`** — implemented as well by the few nodes whose value has more than one form (below); `getForms` calls it, and their `computeExpression` only reads the plain value out of it. The default wraps `computeExpression`.
- **`getExpression(fs)`** and **`getForms(fs)`** — what callers use. Both are sealed on `ExpressionDef`; `getForms` memoizes, and `getExpression` is the plain value read out of it.
- **`apply(fs, op, left, byApplyOperator): ExprValue`** — called when this node appears as the *right* operand of a binary operator; allows the node to override how the comparison is assembled (see below).

## ExprValue is shared — treat it as immutable

`getForms` remembers the last forms it computed, keyed on the field space and
that space's `generation()`. Asking a node twice returns **the same object**, and the
plain value in it is also what gets stored into the IR. So a value you receive is not yours to
modify: retyping or appending to one reaches every other holder, including field
definitions already handed out.

Derive instead — `{...operand, type: 'boolean'}`, or `computedExprValue({…, from: [operand]})`.
An `ExprValue` holds only its own value, never another form of it (those
live only in `Forms`), so copying one cannot carry another form along. What
a copy does carry is the type. A granularity is part of the type, so
copying an operand keeps its granularity, and with it the range of its unit;
a node whose value is not its operand's value must drop the unit.

The memo is why `+`/`-` chains compile in linear rather than exponential time:
`delta()` evaluates both operands and then hands the *nodes* to `numeric()`, which
evaluates them again, so without it each `+` doubled the work beneath it.

## A value has forms

A value can be read more than one way, along two independent lines:

- **Date or timestamp.** A time literal written to the day or coarser
  (`@2020`, `@2020-03-04`) is a date, and beside a timestamp it is that date
  read in the query timezone.
- **Moment or range.** Anything with a granularity is the moment its unit
  starts, and also the range of that one unit, which includes its start and
  excludes its end.

`Forms` (`../types/forms.ts`) holds them: a list of **readings**, one per type
the value can be read as, the default first. A reading is a **moment**, an
ordinary `ExprValue`, and, when the value is also a range, the **end** of that
range. A range always starts at the moment, so only the end is held.

| value | readings |
|---|---|
| a plain value | one reading, no range |
| a value with a granularity: a truncation, a field defined with one, `min`/`max` of one, a selector's result | one reading, ending one unit later (the default `computeForms`) |
| `@2020` | a date reading and a timestamp reading, each with a constant end |
| a choice: `pick`, `??`, `case` | a reading for each type every alternative can be read as, and a range when some alternative has one |
| a function call | a reading for each type a date-literal argument can be read as which matches an overload; a range only from a selector's granularity |

A form which is not the plain value cannot reach a field or the IR: nothing
in `malloy_types` can hold `Forms`, and ordinary code asks for
`getExpression` and sees one type and one expression. A cast, a given and a
parameter have no granularity, so they have no range. Neither does a function
call, unless its definition marks it a **selector**, a function whose result
is always one of the values bound to the generic it returns (`lag`,
`coalesce`, `greatest`): its result keeps the granularity those arguments
share, by the rule a choice uses, and so the range of that unit. A selector
never has a range of different widths; `??` is the way to write that.

### Who takes which form

Date or timestamp is chosen by what the value is used with: the other side of
a comparison (`readingPair`), an element of `in` against the tested value
(`readingFor`), a declared type (`valueAs`), the parameters of a function
overload. With nothing to choose by, it is the default.

Moment or range is chosen by the consumer:

| consumer | a time literal | anything else with a range |
|---|---|---|
| `?` | the range | the range |
| `=` `!=` `<` `<=` `>` `>=` | the range when the literal is on the right (written by the literal's own `apply`); the moment when it is on the left | the moment |
| anything else that needs a value | the moment | the moment |

`+ n` and `- n` with no unit step by the granularity. A value with a range and
no granularity is a choice among different units, and offsetting one is an
error which says to write the unit.

### A choice

`choose` (`../types/forms.ts`) builds every choice. The alternatives are
brought to the readings they all have (a null or an error takes the others'
type), each reading's moment is the choice among the alternatives' moments,
and the choice keeps a granularity only when every alternative which is not
null shares it, a date with none counting as a day. When some alternative has a range, each reading's end is the
choice among the alternatives' ends, with the same conditions, so each
alternative keeps its own width. A plain alternative is a range of no width,
its end its start, and the range records that it has one
(`noWidthAlternative`); a null alternative is a null range and never matches.

`?` against a range tests `x >= start and x < end`, or with a range of no
width among the alternatives, `x >= start and (x < end or x = start)`. Both
are comparisons of values with the `CASE` of the starts and the `CASE` of the
ends, never a condition chosen by a `CASE`, so they are legal on a dialect
with no boolean values.

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

A range (`a to b`, `a for n unit`) is the same: it is not a value, and is
never one of a value's forms.

### How `?` (apply) uses this

`x ? r` does one of two things (`applyTestForms`, `apply-test.ts`):

- If `r` has a value (`requestExpression`) and that value has a range, `x`
  is tested against the range, in the reading paired with `x`.
- Otherwise `x` is applied to `r` (`r.applyForms`, which by default is
  `r.apply(fs, '=', x, true)`): a partial, an alternation, a range, a pick
  with no value, and a value with no range, which is equality. A pick with
  a value is tested against that value. A list and a pick override
  `applyForms`; see below.

A time literal writes its own test with constant ends, so `applyTest` hands
it straight to its `apply`.

So `x ? > 5` → `PartialCompare(>, 5).apply(fs, '=', x)` → `x > 5`,
`x ? 5 | 6 | 7` → `x IN (5, 6, 7)`, and `x ? t.month` tests the month.

The right side of `?`, `|`, `&` and `when` are the **partial positions**: the
places a partial may be written. Each item of a `|` or `&` list written
directly after `?` goes through `applyTest` too (`ExprAlternationTree.applyForms`),
so it is read as it would be read alone after `?`: `x ? t.month | t.year` is
two range tests. A list of plain values is still one `IN`, and a value with a
range is never one of its values. A list inside a pick's `when` is reached
through `apply` instead, so each item is applied: `x ? pick 1 when t.month |
t.year else 2` compares `x` with the start of each unit.

### `?` and a written operator reach the right side the same way

Both reach `right.apply`, `?` through `right.applyForms`, passing `'='` as
its operator. What tells them
apart is the fourth argument of `apply`, `byApplyOperator`: it is true only
when `?` hands its right side the `=` to apply. Every other caller leaves it
false, which is right both for an operator written in the source and for a
node applying an operator of its own, as a range does with `>=` and `<` and a
`PartialCompare` does with the operator it holds. A node which hands the
application it was given on to nodes it holds — an alternation tree to its
choices, a pick to its `when`s — passes the argument on.

An alternation tree uses it to decide whether a pick among its choices is a
value to list in an `IN` or a choice to apply. (The tree's `or-choices-only`
warning is a separate matter: `ExprEquality` asks for it, through
`applyEquality`, when the tree is its right side.)

### Pick after `?`

A pick has a value (`Pick.requestExpression`) when it has an `else`, a result
in every arm, and a condition in every `when`. A pick handed a left side
(`Pick.applyForms`), after `?` or as the `when` of an applied pick, is tested
when it has a value: `x` against the value it chooses, in its range when it
has one and otherwise for equality (`valueTest`), so
`x ? pick 7 when c else 8` is `x = CASE WHEN c THEN 7 ELSE 8 END`. Nothing
is read from the arms: a boolean `when` is always a condition, never a value
to match `x` with.

Any other pick is applied: `x` is applied to each `when` with `when.apply`,
so `x ? pick 1 when t.month else 2` compares `x` with the start of the month,
and the result is the first arm which matches. That result is a choice
like any other, with every form its arms share, and the `?` node hands those
forms on: `ats > (astr ? pick @2020 when 'a' else @2021)` compares
timestamps.

A written operator always takes the value: `x = pick …` compares `x` with the
value the pick chooses, and a pick with no value after a written operator
reports why, in words which name `?`.

What is applied must test the value: each choice of an alternation tree and
each `when` of an applied pick has to come back boolean, and one which does
not (an applied pick of numbers, say) is the error
`applied-is-not-a-test`.

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
