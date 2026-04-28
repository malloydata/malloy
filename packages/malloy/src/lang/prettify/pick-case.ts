/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * RULE: PICK — formatPickStatement / formatPickAligned / formatPick
 *
 *   pickStatement: pick+ (ELSE pickElse=fieldExpr)?
 *
 * Inline if the whole thing fits. Otherwise:
 *   - each pick on its own line at +1 indent
 *   - column-align WHEN across picks (pad shorter values)
 *   - else aligns with `pick` (no value padding for else)
 *   - if a single pick still doesn't fit when aligned, break that pick at WHEN
 *     onto two lines.
 *
 * RULE: CASE — formatCaseStatement / formatCaseWhen
 *
 *   caseStatement: CASE valueExpr? (caseWhen)+ (ELSE caseElse)? END
 *
 * Inline if it fits. Otherwise:
 *   case [valueExpr]
 *     when COND_A   then RESULT_A
 *     when LONGCOND then RESULT_B
 *     else FALLBACK
 *   end
 * THEN keyword column-aligns across whens (pad shorter conditions). ELSE/END
 * live at the case's own indent. If an aligned when still overflows, break it
 * at THEN onto two lines.
 */

import {Token} from 'antlr4ts';
import {TerminalNode} from 'antlr4ts/tree';
import * as parser from '../lib/Malloy/MalloyParser';
import type {Formatter} from './formatter';
import {L, LINE_BUDGET} from './tokens';
import {approxInlineSpan, hasCommentsInRange, note} from './leaf';
import {renderItemInline} from './inline-renderer';

export function formatPickStatement(
  f: Formatter,
  ctx: parser.PickStatementContext
): void {
  const startIdx = ctx._start.tokenIndex;
  const stopIdx = ctx._stop!.tokenIndex;
  const inlineLen = approxInlineSpan(f, startIdx, stopIdx);
  const hasComments = hasCommentsInRange(f, startIdx, stopIdx);
  if (!hasComments && f.o.lineLengthSoFar() + 1 + inlineLen <= LINE_BUDGET) {
    for (let i = 0; i < ctx.childCount; i++) f.format(ctx.getChild(i));
    return;
  }

  const picks = ctx.pick();
  const elseTok = ctx.ELSE();
  const elseExpr = ctx.fieldExpr();
  const valueStrs = picks.map(p =>
    p._pickValue ? renderItemInline(f, p._pickValue) : ''
  );
  const maxValueLen = valueStrs.reduce((m, s) => Math.max(m, s.length), 0);

  // formatPickAligned emits a pre-rendered string and skips flushHiddenBefore,
  // so any comments between picks would be lost. Walk the gaps explicitly and
  // emit hidden-channel comments on their own line.
  let prevEndIdx = ctx._start.tokenIndex - 1;
  const flushBetween = (target: number): void => {
    for (let j = prevEndIdx + 1; j < target; j++) {
      const t = f.tokens[j];
      if (t.channel !== Token.HIDDEN_CHANNEL) continue;
      f.o.nl();
      f.o.text((t.text ?? '').replace(/\s+$/, ''));
    }
  };

  f.o.indent++;
  for (let i = 0; i < picks.length; i++) {
    flushBetween(picks[i]._start.tokenIndex);
    f.o.nl();
    formatPickAligned(f, picks[i], maxValueLen);
    prevEndIdx = picks[i]._stop!.tokenIndex;
  }
  if (elseTok && elseExpr) {
    flushBetween(elseTok.symbol.tokenIndex);
    f.o.nl();
    f.format(elseTok);
    f.format(elseExpr);
    prevEndIdx = elseExpr._stop!.tokenIndex;
  }
  flushBetween(stopIdx + 1);
  f.o.indent--;
}

function formatPickAligned(
  f: Formatter,
  pick: parser.PickContext,
  maxValueLen: number
): void {
  const valueStr = pick._pickValue ? renderItemInline(f, pick._pickValue) : '';
  const condStr = renderItemInline(f, pick._pickWhen);
  const padding = ' '.repeat(maxValueLen - valueStr.length);
  const aligned = valueStr
    ? `pick ${valueStr}${padding} when ${condStr}`
    : `pick${padding ? ' ' + padding : ''} when ${condStr}`;

  // Aligned form drops comments (renderItemInline skips them). If this pick
  // has internal comments, fall through to the broken-at-WHEN form which uses
  // f.format() and preserves them.
  const hasComments = hasCommentsInRange(
    f,
    pick._start.tokenIndex,
    pick._stop!.tokenIndex
  );

  if (!hasComments && f.o.lineLengthSoFar() + aligned.length <= LINE_BUDGET) {
    // Aligned form: emit as a single pre-rendered string so the spacing
    // between value and `when` is exact regardless of padding width.
    f.o.text(aligned);
    note(f, pick._stop!.type, pick._stop!.tokenIndex, pick._stop!);
    return;
  }
  // Doesn't fit even aligned — break at WHEN, no padding.
  f.format(pick.PICK());
  if (pick._pickValue) f.format(pick._pickValue);
  f.o.nl();
  f.format(pick.WHEN());
  f.format(pick._pickWhen);
}

// pick: PICK pickValue? WHEN pickWhen
// Inline if fits; otherwise break at WHEN. (Used when this pick is dispatched
// outside of a pickStatement context, which is rare but possible.)
export function formatPick(f: Formatter, ctx: parser.PickContext): void {
  const inlineLen = approxInlineSpan(
    f,
    ctx._start.tokenIndex,
    ctx._stop!.tokenIndex
  );
  if (f.o.lineLengthSoFar() + 1 + inlineLen <= LINE_BUDGET) {
    for (let i = 0; i < ctx.childCount; i++) f.format(ctx.getChild(i));
    return;
  }
  for (let i = 0; i < ctx.childCount; i++) {
    const c = ctx.getChild(i);
    if (c instanceof TerminalNode && c.symbol.type === L.WHEN) f.o.nl();
    f.format(c);
  }
}

export function formatCaseStatement(
  f: Formatter,
  ctx: parser.CaseStatementContext
): void {
  const startIdx = ctx._start.tokenIndex;
  const stopIdx = ctx._stop!.tokenIndex;
  const inlineLen = approxInlineSpan(f, startIdx, stopIdx);
  const hasComments = hasCommentsInRange(f, startIdx, stopIdx);
  if (!hasComments && f.o.lineLengthSoFar() + 1 + inlineLen <= LINE_BUDGET) {
    for (let i = 0; i < ctx.childCount; i++) f.format(ctx.getChild(i));
    return;
  }

  const whens = ctx.caseWhen();
  const condStrs = whens.map(w => renderItemInline(f, w._condition));
  const maxCondLen = condStrs.reduce((m, s) => Math.max(m, s.length), 0);

  f.o.indent++;
  for (let i = 0; i < ctx.childCount; i++) {
    const c = ctx.getChild(i);
    if (c instanceof parser.CaseWhenContext) {
      f.o.nl();
      formatCaseWhen(f, c, maxCondLen);
      continue;
    }
    if (c instanceof TerminalNode && c.symbol.type === L.ELSE) {
      f.o.nl();
      f.format(c);
      // emit the else expression on the same line
      i++;
      if (i < ctx.childCount) f.format(ctx.getChild(i));
      continue;
    }
    if (c instanceof TerminalNode && c.symbol.type === L.END) {
      f.o.indent--;
      f.o.nl();
      f.format(c);
      f.o.indent++;
      continue;
    }
    // CASE keyword and optional valueExpr stay on the head line.
    f.format(c);
  }
  f.o.indent--;
}

function formatCaseWhen(
  f: Formatter,
  ctx: parser.CaseWhenContext,
  maxCondLen: number
): void {
  const condStr = renderItemInline(f, ctx._condition);
  const resultStr = renderItemInline(f, ctx._result);
  const padding = ' '.repeat(maxCondLen - condStr.length);
  const aligned = `when ${condStr}${padding} then ${resultStr}`;
  const hasComments = hasCommentsInRange(
    f,
    ctx._start.tokenIndex,
    ctx._stop!.tokenIndex
  );

  if (!hasComments && f.o.lineLengthSoFar() + aligned.length <= LINE_BUDGET) {
    f.o.text(aligned);
    note(f, ctx._stop!.type, ctx._stop!.tokenIndex, ctx._stop!);
    return;
  }
  // Doesn't fit aligned — break at THEN.
  f.format(ctx.WHEN());
  f.format(ctx._condition);
  f.o.nl();
  f.format(ctx.THEN());
  f.format(ctx._result);
}
