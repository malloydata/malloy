/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * RULE: SECTION-STATEMENT — formatSectionStatement / formatSectionList
 *
 * A `keyword: items` block. The statement context wraps:
 *   <tags?> <ACCESS_LABEL?> <KEYWORD> <listCtx>
 * We walk children: tags + access-label go through the normal dispatcher
 * (so annotations are preserved); the KEYWORD is emitted manually; the
 * list context dispatches to formatSectionList.
 *
 * formatSectionList rule (locked in with the user):
 *   - All bare items + total fits ≤ LINE_BUDGET → inline `kw: a, b, c`.
 *   - Single item that fits (even if it has `is`) → inline.
 *   - Otherwise → wrapped: keyword on its own line; items at +1 indent;
 *       bare items flow-fill ≤ LINE_BUDGET, comma-separated intra-line,
 *       no trailing commas; `is` items each on own line; annotated items
 *       each on own line, annotation on the line above.
 */

import {ParserRuleContext, Token} from 'antlr4ts';
import type {ParseTree} from 'antlr4ts/tree';
import {TerminalNode} from 'antlr4ts/tree';
import * as parser from '../lib/Malloy/MalloyParser';
import type {Formatter} from './formatter';
import type {ItemKind, SectionRule} from './rules';
import {INDENT_STR, L, LINE_BUDGET, endLineOf} from './tokens';
import {
  flushHiddenBefore,
  formatTokenRange,
  hasCommentsInRange,
  note,
  startStatementLine,
} from './leaf';
import {renderItemInline} from './inline-renderer';

export function formatSectionStatement(
  f: Formatter,
  stmt: ParserRuleContext,
  rule: SectionRule
): void {
  const keywordTok = findKeyword(stmt, rule.keywordTypes);
  const listCtx = rule.list(stmt);
  if (!keywordTok || !listCtx) {
    formatTokenRange(f, stmt._start.tokenIndex, stmt._stop!.tokenIndex);
    return;
  }
  for (let i = 0; i < stmt.childCount; i++) {
    const c = stmt.getChild(i);
    if (c instanceof TerminalNode && c.symbol === keywordTok) {
      flushHiddenBefore(f, keywordTok.tokenIndex);
      if (f.o.indent > 0) f.o.nl();
      else startStatementLine(f);
      f.o.text((keywordTok.text ?? '').replace(/\s+/g, ''));
      note(f, keywordTok.type, keywordTok.tokenIndex, keywordTok);
      continue;
    }
    if (c === listCtx) {
      const items = listItems(listCtx, rule.itemKind);
      if (items.length > 0) formatSectionList(f, items);
      continue;
    }
    f.format(c);
  }
}

function findKeyword(
  node: ParserRuleContext,
  types: number[]
): Token | undefined {
  for (let i = 0; i < node.childCount; i++) {
    const c = node.getChild(i);
    if (c instanceof TerminalNode && types.includes(c.symbol.type))
      return c.symbol;
  }
  return undefined;
}

function listItems(
  listCtx: ParserRuleContext,
  itemKind: ItemKind
): ParserRuleContext[] {
  const matches = (c: ParseTree): boolean => {
    if (!(c instanceof ParserRuleContext)) return false;
    switch (itemKind) {
      case 'fieldEntry':
        return c instanceof parser.QueryFieldEntryContext;
      case 'nestEntry':
        return c instanceof parser.NestEntryContext;
      case 'fieldDef':
        return c instanceof parser.FieldDefContext;
      case 'fieldName':
        return c instanceof parser.FieldNameContext;
      case 'collectionMember':
        return c instanceof parser.CollectionMemberContext;
      case 'orderBySpec':
        return c instanceof parser.OrderBySpecContext;
      case 'fieldExpr':
        return c instanceof parser.FieldExprContext;
    }
  };
  const out: ParserRuleContext[] = [];
  for (let i = 0; i < listCtx.childCount; i++) {
    const c = listCtx.getChild(i);
    if (matches(c)) out.push(c as ParserRuleContext);
  }
  return out;
}

function classifyItem(
  f: Formatter,
  ctx: ParserRuleContext
): {ctx: ParserRuleContext; hasIs: boolean; hasAnnotation: boolean} {
  let hasIs = false;
  let hasAnnotation = false;
  for (let i = ctx._start.tokenIndex; i <= ctx._stop!.tokenIndex; i++) {
    const t = f.tokens[i];
    if (t.type === L.IS) hasIs = true;
    if (
      t.type === L.ANNOTATION ||
      t.type === L.DOC_ANNOTATION ||
      t.type === L.BLOCK_ANNOTATION_BEGIN ||
      t.type === L.DOC_BLOCK_ANNOTATION_BEGIN
    )
      hasAnnotation = true;
  }
  return {ctx, hasIs, hasAnnotation};
}

function formatSectionList(f: Formatter, items: ParserRuleContext[]): void {
  const itemInfos = items.map(it => classifyItem(f, it));
  const noAnnotations = itemInfos.every(info => !info.hasAnnotation);
  const allBare = itemInfos.every(info => !info.hasIs && !info.hasAnnotation);
  const firstItem = items[0];
  const lastItem = items[items.length - 1];

  // Inline candidate: no annotations, no hidden-channel comments anywhere in
  // the items' span (renderItemInline drops them), AND either all bare or
  // exactly one item.
  const itemsHaveComments = hasCommentsInRange(
    f,
    firstItem._start.tokenIndex,
    lastItem._stop!.tokenIndex
  );
  const inlineEligible =
    noAnnotations && !itemsHaveComments && (allBare || items.length === 1);

  if (inlineEligible) {
    const renderedItems = itemInfos.map(info => renderItemInline(f, info.ctx));
    const inlineBody = renderedItems.join(', ');
    const candidateLen =
      f.o.lineLengthSoFar() + 1 /* space */ + inlineBody.length;
    if (candidateLen <= LINE_BUDGET) {
      f.o.text(' ');
      f.o.text(inlineBody);
      note(
        f,
        lastItem._stop!.type,
        lastItem._stop!.tokenIndex,
        lastItem._stop!
      );
      return;
    }
  }

  // Wrapped form. Two paths:
  //   - No comments anywhere: original flow-fill — bare items pack into lines
  //     at LINE_BUDGET, `is`/annotated items each get their own line.
  //   - Comments anywhere in the items' span: every item emits on its own
  //     line via f.format(), which goes through emitVisibleToken /
  //     flushHiddenBefore and handles trailing-vs-leading attachment for
  //     hidden-channel tokens correctly. Flow-fill density is sacrificed for
  //     comment correctness.
  f.o.indent++;
  f.o.nl();

  if (itemsHaveComments) {
    f.lastEmittedIdx = firstItem._start.tokenIndex - 1;
    for (let k = 0; k < itemInfos.length; k++) {
      const info = itemInfos[k];
      // flushHiddenBefore handles between-item comments and advances
      // lastEmittedIdx so they aren't re-emitted by f.format(item)'s own first
      // emit.
      flushHiddenBefore(f, info.ctx._start.tokenIndex);
      f.o.nl();
      f.format(info.ctx);
    }
    flushSameLineTail(f, lastItem._stop!);
    f.o.indent--;
    // Update lastEmittedType for leading-action decisions, but DO NOT reset
    // lastEmittedIdx — flushSameLineTail may have advanced it past tail
    // comments, and rolling it back would let the parent re-emit them.
    f.lastEmittedType = lastItem._stop!.type;
    return;
  }

  // No-comments fast path: flow-fill packing as before.
  let curBare = '';
  const flushBare = (): void => {
    if (curBare.length > 0) {
      f.o.text(curBare);
      f.o.nl();
      curBare = '';
    }
  };
  for (const info of itemInfos) {
    if (info.hasIs || info.hasAnnotation) {
      flushBare();
      flushHiddenBefore(f, info.ctx._start.tokenIndex);
      f.format(info.ctx);
      f.o.nl();
    } else {
      const itemText = renderItemInline(f, info.ctx);
      const indentChars = f.o.indent * INDENT_STR.length;
      const sepLen = curBare.length > 0 ? 2 : 0; // ", "
      const projected = indentChars + curBare.length + sepLen + itemText.length;
      if (curBare.length > 0 && projected > LINE_BUDGET) {
        flushBare();
        curBare = itemText;
      } else {
        curBare = curBare.length > 0 ? curBare + ', ' + itemText : itemText;
      }
    }
  }
  flushBare();
  flushSameLineTail(f, lastItem._stop!);
  f.o.indent--;
  // See comment in the with-comments branch: keep the advanced
  // lastEmittedIdx so tail comments aren't re-emitted by the parent.
  f.lastEmittedType = lastItem._stop!.type;
}

// After the last item of a wrapped section list, flush any trailing comments
// on the SAME source line as the last item — those are tail comments belong-
// ing to the last item and should emit at the section's inner indent.
// Different-line comments are leading comments for the next statement; leave
// them for the parent context to emit at the outer indent.
function flushSameLineTail(f: Formatter, lastTok: Token): void {
  const lastEndLine = endLineOf(lastTok);
  let j = lastTok.tokenIndex + 1;
  while (j < f.tokens.length) {
    const t = f.tokens[j];
    if (t.channel !== Token.HIDDEN_CHANNEL) break;
    if (t.line !== lastEndLine) break;
    j++;
  }
  if (j > lastTok.tokenIndex + 1) {
    // The wrapping loop emitted a per-item newline after the last item, but
    // a same-line tail comment should attach to that item's line — not float
    // on a fresh one. Drop the trailing newline so emitHiddenToken's
    // same-line branch reattaches the comment correctly (and adds a trailing
    // newline back for EOL comments). Without this, the comment lands on a
    // new line, and a re-parse sees it as a different-line comment, breaking
    // idempotence.
    f.o.buf = f.o.buf.replace(/\n+$/, '');
    flushHiddenBefore(f, j);
  }
}
