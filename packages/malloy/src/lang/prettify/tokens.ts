/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * Token classification, layout config, and small token utilities used by the
 * prettifier's leaf walker and rule formatters.
 */

import type {Token} from 'antlr4ts';
import {MalloyLexer} from '../lib/Malloy/MalloyLexer';

export const L = MalloyLexer;

// ---------- Global formatting config ----------

export const LINE_BUDGET = 100;
export const INDENT_STR = '  '; // two spaces per indent level

// ---------- Token classification ----------

// Section keywords that introduce a `keyword: items` block (or a single value
// for some). Used by the leaf walker as a fallback newline rule when no
// explicit section-statement handler caught us.
export const SECTION_TOKENS = new Set<number>([
  L.ACCEPT,
  L.AGGREGATE,
  L.CALCULATE,
  L.CALCULATION,
  L.CONNECTION,
  L.DECLARE,
  L.DIMENSION,
  L.DRILL,
  L.EXCEPT,
  L.EXTENDQ,
  L.GROUP_BY,
  L.GROUPED_BY,
  L.HAVING,
  L.INDEX,
  L.INTERNAL,
  L.JOIN_CROSS,
  L.JOIN_ONE,
  L.JOIN_MANY,
  L.LIMIT,
  L.MEASURE,
  L.NEST,
  L.ORDER_BY,
  L.PARTITION_BY,
  L.PRIMARY_KEY,
  L.PRIVATE,
  L.PROJECT,
  L.PUBLIC,
  L.QUERY,
  L.RENAME,
  L.RUN,
  L.SAMPLE,
  L.SELECT,
  L.SOURCE,
  L.TYPE,
  L.TOP,
  L.WHERE,
  L.VIEW,
  L.TIMEZONE,
]);

// Top-level statement starters. At column 0 each gets a blank line before it
// when introducing a new statement (subject to the same-kind-no-blank rule).
export const TOP_LEVEL_STARTERS = new Set<number>([
  L.SOURCE,
  L.QUERY,
  L.RUN,
  L.IMPORT,
  L.GIVEN,
  L.TYPE,
]);

// Token types after which an immediately following `(` or `[` is a call /
// subscript and should hug (no leading space). Anything else (binary ops,
// IS/AS/EXTEND/ON/WHEN/PICK/etc.) gets a space — the `(` is grouping.
export const CALL_HUG_AFTER = new Set<number>([
  L.IDENTIFIER,
  L.CPAREN,
  L.CBRACK,
  // Aggregate / built-in callable keywords commonly used as function names.
  L.COUNT,
  L.SUM,
  L.AVG,
  L.MIN,
  L.MAX,
  L.TABLE,
  L.SQL,
  L.COMPOSE,
  L.CAST,
  L.NOW,
  L.LAST,
  // Ungrouped / level-modifier function-style calls.
  L.ALL,
  L.EXCLUDE,
  // Timeframe truncation keywords used as functions: year(x), month(x), …
  L.YEAR,
  L.QUARTER,
  L.MONTH,
  L.WEEK,
  L.DAY,
  L.HOUR,
  L.MINUTE,
  L.SECOND,
  // Type-cast keyword names: timestamp(x), date(x), number(x), string(x), …
  L.TIMESTAMP,
  L.TIMESTAMPTZ,
  L.DATE,
  L.NUMBER,
  L.STRING,
  L.BOOLEAN,
  L.JSON,
]);

// Binary operators that get spaces on both sides at the leaf level.
// (Chain wrapping for and/or/??/+/- happens at parse-tree level — see
// formatBinaryChain.)
export const BINARY_OPS = new Set<number>([
  L.PLUS,
  L.MINUS,
  L.STAR,
  L.SLASH,
  L.PERCENT,
  L.STARSTAR,
  L.EQ,
  L.NE,
  L.LT,
  L.GT,
  L.LTE,
  L.GTE,
  L.AND,
  L.OR,
  L.MATCH,
  L.NOT_MATCH,
  L.ARROW,
  L.FAT_ARROW,
  L.BAR,
  L.AMPER,
]);

// ---------- Inter-token spacing ----------

// What separator should appear before a token of `nextType` given the last
// emitted token's type? Single source of truth for inter-token spacing —
// consulted by both the leaf walker (./leaf) and the inline renderer
// (./inline-renderer) so they agree on what space (or lack of it) goes
// between any two adjacent tokens.
//
//   'glue'  — strip trailing space, then emit (for `.`, `,`, `;`, `:`, `::`,
//              `)`, `]`).
//   'hug'   — emit nothing before (for `(` and `[` immediately after a known
//              callable token in CALL_HUG_AFTER).
//   'space' — coalescing single space; the buffer's own space() may further
//              suppress it when the last char already provides separation.
//
// To add a new token type that should hug or glue, edit this function — both
// walkers pick up the change automatically.
export type LeadingAction = 'glue' | 'hug' | 'space';

export function leadingAction(
  prevType: number | null,
  nextType: number
): LeadingAction {
  if (
    nextType === L.DOT ||
    nextType === L.COMMA ||
    nextType === L.SEMI ||
    nextType === L.COLON ||
    nextType === L.TRIPLECOLON ||
    nextType === L.EXCLAM ||
    nextType === L.CPAREN ||
    nextType === L.CBRACK
  ) {
    return 'glue';
  }
  // After the `!` cast operator (`epoch_ms!timestamp(x)`), the next token
  // glues to it like the `.` operator does.
  if (prevType === L.EXCLAM) return 'glue';
  if (
    (nextType === L.OPAREN || nextType === L.OBRACK) &&
    prevType !== null &&
    CALL_HUG_AFTER.has(prevType)
  ) {
    return 'hug';
  }
  return 'space';
}

// ---------- Token utilities ----------

export function endLineOf(t: Token): number {
  const text = t.text ?? '';
  const newlines = (text.match(/\n/g) ?? []).length;
  return t.line + newlines;
}

// Find the index of the closing token that matches the opener at startIdx.
// Counts nested begin/end pairs of the same types.
//
// Precondition: must not be called inside an SQL string region — depth
// tracking only knows about the begin/end token types passed in, not about
// embedded SQL. In practice we never call this inside an SQL block (we skip
// past them).
export function findMatching(
  tokens: Token[],
  startIdx: number,
  beginType: number,
  endType: number
): number {
  let depth = 1;
  for (let j = startIdx + 1; j < tokens.length; j++) {
    if (tokens[j].type === beginType) depth++;
    else if (tokens[j].type === endType) {
      depth--;
      if (depth === 0) return j;
    }
  }
  return tokens.length - 1;
}
