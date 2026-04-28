/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * RULE: POSTFIX `{…}` — formatFieldProperties
 *
 * `expr { kw: ... }` — filter shortcut and friends. Inline if it fits;
 * otherwise emit as a block with each inner statement on its own line. Inner
 * statements are rendered atomically via formatTokenRange (no recursive
 * section-list rewriting): they're part of the expression.
 */

import type {ParserRuleContext} from 'antlr4ts';
import {TerminalNode} from 'antlr4ts/tree';
import type * as parser from '../lib/Malloy/MalloyParser';
import type {Formatter} from './formatter';
import {L, LINE_BUDGET} from './tokens';
import {
  flushHiddenBefore,
  formatTokenRange,
  hasCommentsInRange,
  note,
} from './leaf';
import {renderItemInline} from './inline-renderer';

export function formatFieldProperties(
  f: Formatter,
  ctx: parser.FieldPropertiesContext
): void {
  const startIdx = ctx._start.tokenIndex;
  const stopIdx = ctx._stop!.tokenIndex;
  const hasComments = hasCommentsInRange(f, startIdx, stopIdx);

  if (!hasComments) {
    const inline = renderItemInline(f, ctx);
    if (f.o.lineLengthSoFar() + 1 + inline.length <= LINE_BUDGET) {
      f.o.space();
      f.o.text(inline);
      note(f, L.CCURLY, stopIdx, ctx._stop!);
      return;
    }
  }
  // Wrapped form. Each inner statement runs through the leaf walker
  // (formatTokenRange) so comments inside it are preserved naturally.
  f.o.space();
  f.o.text('{');
  f.o.indent++;
  // Advance past the OCURLY ourselves so flushHiddenBefore for the first inner
  // statement doesn't try to re-emit it.
  f.lastEmittedIdx = startIdx;
  for (let i = 0; i < ctx.childCount; i++) {
    const c = ctx.getChild(i);
    if (c instanceof TerminalNode) continue; // skip OCURLY / CCURLY / SEMI
    f.o.nl();
    const child = c as ParserRuleContext;
    formatTokenRange(f, child._start.tokenIndex, child._stop!.tokenIndex);
  }
  // Flush any tail hidden tokens between the last inner statement and the
  // closing `}` so trailing comments emit at the inner indent rather than
  // disappearing.
  flushHiddenBefore(f, stopIdx);
  f.o.indent--;
  f.o.nl();
  f.o.text('}');
  note(f, L.CCURLY, stopIdx, ctx._stop!);
}
