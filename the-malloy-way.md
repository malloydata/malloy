# The Malloy Way

A working set of guidelines — mostly extracted from review feedback rather than written from scratch — for writing code in this repo. Consult this when you're choosing between several reasonable options. When the rule and the situation disagree, the situation wins; come back here and update the rule.

This is not a style guide for whitespace and braces (the linter handles that). It is about decisions: where things live, what shape they take, how they're documented, what they say when something goes wrong.

---

## Comments

**Default to no comments. Only add one when the WHY is non-obvious.**

- Don't restate what well-named identifiers already say.
- Don't explain WHAT the code does. Don't reference current task / fix / callers.
- Don't write meta-notes about future PRs — that belongs in design docs.
- Don't repeat what an adjacent field's comment already says.

Good reasons to write a comment: a hidden constraint, a subtle invariant, a workaround for a specific bug, a deliberate departure from a TS or Malloy convention that will surprise the next reader.

If removing the comment wouldn't confuse a future reader, don't write it.

## Error messages

**Echo the source text the user wrote.**

- Use `pcx.text`, `basicCx.text`, the field name as written. Avoid resolved/canonicalized values unless the resolution is the point.
- Sparse "Expected an X" → richer "`${what}` is not Y; valid Y are A, B, C."

**Mark unreachable cases as compiler bugs.**

- If an error path can fire only when the grammar admits a case the AST builder doesn't handle, say so: "This is likely a compiler bug — the grammar admits cases the AST builder doesn't handle."
- That tells anyone reading the log later that user input isn't the issue.

## Names — `malloy-to-ast.ts`

**`visitX(pcx)` for parse-tree → AST node.**

Use this even when the method is called from one parent visitor only. The name signals "this is the parse-tree-to-AST mapping for rule `X`."

**`getX(pcx)` for transforms returning non-AST data, or shared helpers.**

Reserve `getX` for typedefs, primitives, lists of notes, and similar. The split lets a reader tell at a glance whether the return is an AST node or supporting data.

## Helper signatures

**Tightly-typed parameters over `ParserRuleContext`.**

If the only thing a helper does with a parameter is read one well-typed sub-rule, take that sub-rule's context type directly.

**Return the focused payload, not an inline structural object.**

`getFilterType(...)` returns `FilterExprType | undefined`, not `{type: 'filter expression'; filterType: FilterExprType} | undefined`. The caller composes the wider shape if it needs one.

**Don't accept an arg you can derive from another arg.**

If you have a `MalloyBasicTypeContext`, you don't also need its parent context for error location — point at the basic-type context.

## Type and file placement

**IR types live in `packages/malloy/src/model/malloy_types.ts`.**

Even types that are only constructed by AST code go here if they appear in IR. The AST consumes them.

**AST file layout.**

- Top-level statements: `packages/malloy/src/lang/ast/statements/define-X.ts` (e.g. `define-source.ts`, `define-given.ts`).
- Expression nodes: `packages/malloy/src/lang/ast/expressions/expr-X.ts` (e.g. `expr-id-reference.ts`, `expr-given.ts`).
- One concept per file. Small files are fine.

## Constructors

**Plain positional args. No `Init` interface for one optional field.**

`new Thing(name, type, optional?)` over `new Thing({name, type, optional})`. The `Init` shape is justified only when there are several optional fields a caller would otherwise have to thread `undefined` through.

If a parameter name collides with a JS reserved word (e.g. `default`), rename the parameter (`defaultExpr`) but keep the public field's name so callers reading `.default` see the natural noun.

## Grammar (`MalloyParser.g4`, `MalloyLexer.g4`)

**Stick to the canonical list pattern: `X (COMMA? X)* COMMA?`.**

Used in 13+ rules already (`sourcePropertyList`, `defList`, `joinList`, etc.). Don't diverge to a more compact form like `X (COMMA | X)*` even when it looks equivalent — it isn't (consecutive commas), and consistency wins.

**For new statements, do not allow annotations after `is`.**

`isDefine` (which permits before-is + after-is tags) was a mistake. Use plain `IS` for new statements, OR keep `isDefine` if you want to surface a *targeted* error message ("annotations are not allowed between `is` and the value") rather than a parse-level squiggle.

## Type system

**Prefer `undefined` over `null`.** New types that need an explicit "not present" should use `T | undefined`, not `T | null`. Existing code uses `null` in some places (Parameter.value); follow it locally but don't propagate.

**Make absence explicit at every read site when the absence carries meaning.**

When a missing default has a different runtime contract than a missing optional, declare `default: ConstantExpr | undefined` (non-optional) rather than `default?: ConstantExpr`. The caller can't forget to handle the no-default case.

**Compound types float alongside the tree, not on each node.**

When we add Foo nodes that participate in a typed expression tree, put `type` in a side-channel data structure (e.g. `givens: Record<GivenID, Given>` keyed by id), not on every reference node. The tree stays compact and immutable.

**No `as` casts.** Almost always a sign of not figuring out the types properly. Use type guards, generics, or proper narrowing.

**No inline imports.** All imports go at the top of the file.

## Scope discipline

**"Just that" means JUST that.** When the user asks for a focused change, do that change. Don't sneak adjacent cleanups in. They get reviewed separately or not at all.

**Defer changes that force every consumer to adapt.** Adding `GivenEntry` to `NamedModelObject` would force every site that narrows the union to handle it. Stage that change with the consumers, not with the type definition.

**Mark intentional omissions in the code.** A short comment like "intentionally NOT in this union yet — flipping it forces every consumer to adapt; that lands in Stage 2" prevents a future reader from "fixing" it by adding the missing arm.

## Documentation

**Substantive design content lives in `~/ctx/` or in repo `CONTEXT.md` files** — not in code comments and not in hidden memory.

**`CONTEXT.md` files describe the directory they live in.** Walk-up reading should give a future reader (human or LLM) enough context to act. Keep them current; an outdated CONTEXT.md is worse than none.

**Cross-reference, don't duplicate.** A file's CONTEXT.md should link to the design doc it implements, not retell it.

## Process

**Test through tasks, not narration.** Use the task list to plan and track multi-step work. Mark tasks completed as soon as they're done.

**Run lint and tests before claiming done.** The CI matrix is large; locally `npm run dev` + the relevant `npx jest` + `npm run lint` is the practical bar.

**On a new branch:** `git checkout -b name` (no upstream tracking). Set upstream only on push with `git push -u origin name`. Never amend. Never force push without explicit ask. Never include AI attribution in commits or PRs.
