/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * ============================================================================
 * Malloy pretty-printer (experimental, /internal export — no stability promise)
 * ============================================================================
 *
 * Architecture
 * ------------
 *   1. Lex + parse the input.
 *   2. Walk the parse tree from `Formatter.format(node)`. The dispatcher routes
 *      each rule context to a per-rule free function in a sibling module;
 *      everything unhandled recurses to children, eventually reaching terminal
 *      tokens that emit through `emitVisibleToken` (the leaf).
 *   3. The leaf walker handles per-token spacing/indentation/comments. It is
 *      v1's behaviour and is also the fallback when parsing fails.
 *
 * File layout
 * -----------
 *   - ./out                — Out buffer (indent, newlines, single-space coalescing).
 *   - ./tokens             — LINE_BUDGET, INDENT_STR; classification sets
 *                            (SECTION_TOKENS, BINARY_OPS, CALL_HUG_AFTER, etc.);
 *                            findMatching, endLineOf.
 *   - ./rules              — SECTION_STATEMENT_RULES + STATEMENT_KIND_BY_CTX.
 *                            A maintainer adding a new section keyword lands here.
 *   - ./error-listener     — CollectingErrorListener.
 *   - ./types              — PrettifyError, PrettifyResult.
 *   - ./formatter          — Formatter class (state + format() dispatcher).
 *   - ./leaf               — emitVisibleToken + per-token state mutators
 *                            (note, flushHiddenBefore, startStatementLine, …)
 *                            and the small read-only helpers used by rule
 *                            formatters (approxInlineSpan, hasCommentsInRange,
 *                            formatTokenRange).
 *   - ./inline-renderer    — renderItemInline (flat-string form for budget
 *                            measurement and column alignment).
 *   - ./block-body         — formatBlockBody, formatTopLevel.
 *   - ./sections           — formatSectionStatement / formatSectionList.
 *   - ./field-properties   — formatFieldProperties (postfix `{…}`).
 *   - ./pick-case          — formatPickStatement, formatCaseStatement.
 *   - ./binary-chain       — formatBinaryChain.
 *   - ./index (this)       — prettify() entry point + type re-exports.
 *
 * Decisions worth knowing
 * -----------------------
 *   - Comparison operators (`=`, `!=`, `<`, `>`, …) are kept glued to their
 *     operands. We only break chains at and/or/??/+/-. Justification: LHS/RHS
 *     of a comparison reads as one unit; breaking inside is more confusing
 *     than the line being long.
 *   - SQL strings (`"""…"""`, including `%{…}` malloy interpolations) and
 *     block annotations (`#" … "`) are emitted verbatim from source. We don't
 *     own a SQL formatter; annotation indentation is significant.
 *   - `;` is the compact-inline statement separator. Wrapped form drops it
 *     (newlines do the job); inline form keeps it.
 *   - `,` in section-list bare flow: intra-line yes, end-of-line never.
 *   - Single-arg function calls don't wrap (no point — nowhere useful to break).
 *   - `(` hugs only after a known-callable token (CALL_HUG_AFTER); after `is`,
 *     `as`, `extend`, `on`, `when`, etc. the `(` is grouping and gets a space.
 *     CALL_HUG_AFTER includes the keyword-named built-ins that are commonly
 *     used as functions: ALL, EXCLUDE, the timeframe truncation keywords
 *     (YEAR/MONTH/DAY/…), and the cast-target type names
 *     (TIMESTAMP/DATE/NUMBER/STRING/BOOLEAN/JSON).
 *   - `!` is the cast operator (`epoch_ms!timestamp(x)`); it glues to both
 *     sides like `.` does.
 *   - Empty `{}` collapses inline (`extend {}`, not `extend {\n}`).
 *   - `import {a, b, c} from 'x'` formats as a flat list when it fits on the
 *     line; otherwise one item per line at +1 indent.
 *   - `view:` definitions in a block body always have a blank line before
 *     each one (after the first), even when no blank was in the source. The
 *     same-kind-no-blank rule still applies to other statement kinds.
 *   - `{...}` bodies that contain more than one section statement never
 *     collapse onto a single line, even when they would fit. Reading two
 *     `group_by:` clauses jammed on one line is hostile.
 *   - Single is-item section lists keep the keyword and item on the same
 *     line (`nest: name is { … }`), so the body wraps naturally instead of
 *     forcing a `nest:\n  name is {` opener split.
 *   - join_one / join_many / join_cross multi-item lists always wrap one
 *     item per line — items use `with`/`on` instead of `is` but are
 *     structurally is-like.
 *   - Trailing comments between the last item of a section list and the
 *     enclosing `}` are emitted at the section's inner indent, so they
 *     stay associated with the section the user wrote them in.
 *
 * Adding a new section-statement
 * ------------------------------
 *   Add a row to SECTION_STATEMENT_RULES in ./rules with the rule's context
 *   class, the keyword token type(s), the list-context accessor, and the
 *   item-kind tag. Add a corresponding entry to listItems() in ./sections.
 *
 *   Note: section keywords NOT in the table fall through to the leaf walker
 *   (which produces correct-but-plain output). Add a row only when the default
 *   isn't good enough — flow-fill, alignment, or annotation handling.
 *
 * Inter-token spacing
 * -------------------
 *   The classifier `leadingAction(prev, next)` in ./tokens is the single
 *   source of truth for what separator (glue, hug, or coalescing space) goes
 *   between two adjacent tokens. Both walkers — emitVisibleToken in ./leaf
 *   and renderItemInline in ./inline-renderer — consult it, so a change to
 *   `leadingAction` (e.g. adding a token type that hugs `(`) takes effect in
 *   both paths automatically. Walker-specific concerns (newlines, indent,
 *   paren-wrap decisions, compact-inline `, ` / `; `) live in the walker.
 */

import {Token} from 'antlr4ts';
import type * as parser from '../lib/Malloy/MalloyParser';
import {makeMalloyParser} from '../run-malloy-parser';

import {CollectingErrorListener} from './error-listener';
import {Formatter} from './formatter';
import {emitVisibleToken} from './leaf';
import type {PrettifyResult} from './types';

export type {PrettifyError, PrettifyResult} from './types';

/**
 * Pretty-print a Malloy source string.
 *
 * **Experimental — this API may vanish or change at any time without notice.**
 * It is exposed only via `@malloydata/malloy/internal` and is not covered by
 * any compatibility commitment. Do not depend on it from anything you can't
 * fix in a single PR.
 *
 * Parses the input, walks the parse tree, and emits a reformatted string.
 *
 * `errors` surfaces parse errors only (lexer + parser). Semantic / compile
 * errors aren't checked here. If `errors.length > 0` you have a bigger problem
 * than formatting — output is best-effort and not guaranteed to round-trip.
 *
 * @experimental
 */
export function prettify(src: string): PrettifyResult {
  const lexerErrors = new CollectingErrorListener();
  const parserErrors = new CollectingErrorListener();
  const {tokenStream, parser: malloyParser} = makeMalloyParser(src, {
    lexerErrorListener: lexerErrors,
    parserErrorListener: parserErrors,
  });
  tokenStream.fill();
  const tokens = tokenStream.getTokens();

  let root: parser.MalloyDocumentContext | null = null;
  try {
    root = malloyParser.malloyDocument();
  } catch {
    root = null;
  }

  const f = new Formatter(src, tokens);
  if (root) {
    f.format(root);
  } else {
    // Parse failed. Fall back to leaf-only emission so we still produce
    // something reasonable.
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.channel !== Token.HIDDEN_CHANNEL && t.type !== Token.EOF) {
        emitVisibleToken(f, t, i);
      }
    }
  }

  return {
    result: f.o.toString(),
    errors: [...lexerErrors.errors, ...parserErrors.errors],
  };
}
