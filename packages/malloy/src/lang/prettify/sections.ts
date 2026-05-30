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
 *   - Single item that fits (even if it has `is`) → inline. Items containing
 *     a `{...}` body with more than one section statement are excluded —
 *     view bodies don't read on one line regardless of length.
 *   - Single is-item that doesn't fit inline → keep keyword and item on the
 *     same line (`nest: name is { …wrapped body… }`); the body's `{...}`
 *     wraps internally. Annotated items still take the keyword-on-own-line
 *     form so the annotation lands above its item.
 *   - Otherwise → wrapped: keyword on its own line; items at +1 indent;
 *       bare items flow-fill ≤ LINE_BUDGET, comma-separated intra-line,
 *       no trailing commas; `is` items each on own line; annotated items
 *       each on own line, annotation on the line above.
 *
 * After the last item, trailing comments that sit between the section and
 * the enclosing `}` are also emitted at the inner indent — they belong to
 * the section the user just wrote, not the parent block.
 */

import {ParserRuleContext, Token} from 'antlr4ts';
import type {ParseTree} from 'antlr4ts/tree';
import {TerminalNode} from 'antlr4ts/tree';
import * as parser from '../lib/Malloy/MalloyParser';
import type {Formatter} from './formatter';
import type {ItemKind, SectionRule} from './rules';
import {
  INDENT_STR,
  L,
  LINE_BUDGET,
  SECTION_TOKENS,
  endLineOf,
  findMatching,
} from './tokens';
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
    const isKeywordChild =
      (c instanceof TerminalNode && c.symbol === keywordTok) ||
      (c instanceof ParserRuleContext && childContainsToken(c, keywordTok));
    if (isKeywordChild) {
      flushHiddenBefore(f, keywordTok.tokenIndex);
      if (f.o.indent > 0) f.o.nl();
      else startStatementLine(f);
      f.o.text((keywordTok.text ?? '').replace(/\s+/g, ''));
      note(f, keywordTok.type, keywordTok.tokenIndex, keywordTok);
      continue;
    }
    if (c === listCtx) {
      const items = listItems(listCtx, rule.itemKind);
      if (items.length > 0) formatSectionList(f, items, rule.itemKind);
      continue;
    }
    f.format(c);
  }
}

function childContainsToken(node: ParserRuleContext, tok: Token): boolean {
  for (let i = 0; i < node.childCount; i++) {
    const c = node.getChild(i);
    if (c instanceof TerminalNode && c.symbol === tok) return true;
  }
  return false;
}

function findKeyword(
  node: ParserRuleContext,
  types: number[]
): Token | undefined {
  // Direct terminal children — fast path, the common case.
  for (let i = 0; i < node.childCount; i++) {
    const c = node.getChild(i);
    if (c instanceof TerminalNode && types.includes(c.symbol.type))
      return c.symbol;
  }
  // Fallback: descend one level. Some rules wrap the keyword in a small
  // nested rule (e.g. includeItem → accessLabelProp → INTERNAL).
  for (let i = 0; i < node.childCount; i++) {
    const c = node.getChild(i);
    if (c instanceof ParserRuleContext) {
      for (let j = 0; j < c.childCount; j++) {
        const g = c.getChild(j);
        if (g instanceof TerminalNode && types.includes(g.symbol.type))
          return g.symbol;
      }
    }
  }
  return undefined;
}

function listItems(
  listCtx: ParserRuleContext,
  itemKind: ItemKind
): ParserRuleContext[] {
  // Type predicate (`c is ParserRuleContext`) so callers don't need a cast.
  const matches = (c: ParseTree): c is ParserRuleContext => {
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
      case 'joinDef':
        return c instanceof parser.JoinDefContext;
      case 'includeField':
        return c instanceof parser.IncludeFieldContext;
      case 'indexElement':
        return c instanceof parser.IndexElementContext;
      case 'givenDef':
        return c instanceof parser.GivenDefContext;
    }
  };
  const out: ParserRuleContext[] = [];
  for (let i = 0; i < listCtx.childCount; i++) {
    const c = listCtx.getChild(i);
    if (matches(c)) out.push(c);
  }
  return out;
}

function classifyItem(
  f: Formatter,
  ctx: ParserRuleContext,
  itemKind: ItemKind
): {ctx: ParserRuleContext; hasIs: boolean; hasAnnotation: boolean} {
  // joinDef items always wrap onto their own line. They use `with` / `on`
  // instead of `is`, but they're structurally one-per-line like is-items.
  let hasIs = itemKind === 'joinDef';
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

function formatSectionList(
  f: Formatter,
  items: ParserRuleContext[],
  itemKind: ItemKind
): void {
  const itemInfos = items.map(it => classifyItem(f, it, itemKind));
  const noAnnotations = itemInfos.every(info => !info.hasAnnotation);
  const allBare = itemInfos.every(info => !info.hasIs && !info.hasAnnotation);
  const firstItem = items[0];
  const lastItem = items[items.length - 1];

  // Inline candidate: no annotations, no hidden-channel comments anywhere in
  // the items' span (renderItemInline drops them), AND either all bare or
  // exactly one item. Items containing a `{...}` body with multiple inner
  // statements are also excluded — collapsing a view body onto one line is
  // hostile to read regardless of length.
  const itemsHaveComments = hasCommentsInRange(
    f,
    firstItem._start.tokenIndex,
    lastItem._stop!.tokenIndex
  );
  const itemsHaveMultiStatementBody = itemInfos.some(info =>
    hasMultiStatementCurlyBody(f, info.ctx)
  );
  const inlineEligible =
    noAnnotations &&
    !itemsHaveComments &&
    !itemsHaveMultiStatementBody &&
    (allBare || items.length === 1);

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

  // Single is-item that doesn't fit inline: keep the keyword on the same
  // line as the item (`nest: name is { …wrapped body… }`) instead of
  // breaking before the name. The body's `{...}` will wrap on its own.
  // Annotated items still need the keyword-on-own-line form so the
  // annotation can land between them.
  if (
    items.length === 1 &&
    itemInfos[0].hasIs &&
    !itemInfos[0].hasAnnotation &&
    !itemsHaveComments
  ) {
    f.o.text(' ');
    f.format(itemInfos[0].ctx);
    f.lastEmittedType = lastItem._stop!.type;
    return;
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

// Does any `{...}` block inside this item contain more than one section
// keyword (group_by:, aggregate:, where:, …) at its top level? Used to gate
// the section-list inline form: a view body with multiple statements never
// reads well on a single line, even when it fits. Single-statement bodies
// like `{ where: x = 1 }` may still inline.
function hasMultiStatementCurlyBody(
  f: Formatter,
  ctx: ParserRuleContext
): boolean {
  const fromIdx = ctx._start.tokenIndex;
  const toIdx = ctx._stop!.tokenIndex;
  for (let i = fromIdx; i <= toIdx; i++) {
    if (f.tokens[i].type !== L.OCURLY) continue;
    const close = findMatching(f.tokens, i, L.OCURLY, L.CCURLY);
    let count = 0;
    let depth = 0;
    for (let j = i + 1; j < close; j++) {
      const t = f.tokens[j];
      if (t.type === L.OCURLY || t.type === L.OPAREN || t.type === L.OBRACK) {
        depth++;
      } else if (
        t.type === L.CCURLY ||
        t.type === L.CPAREN ||
        t.type === L.CBRACK
      ) {
        depth--;
      } else if (depth === 0 && SECTION_TOKENS.has(t.type)) {
        count++;
        if (count > 1) return true;
      }
    }
    i = close;
  }
  return false;
}

// After the last item of a wrapped section list, flush trailing comments
// belonging to the section. There are two cases:
//
//   1. Same-line tail: a comment on the SAME source line as the last item.
//      Always belongs to the last item; emit at the section's inner indent.
//
//   2. Different-line trailing comments that sit between the last item and
//      the closing `}` of the enclosing block (no other statement follows).
//      These visually belong to the section the user just wrote, not the
//      block. Emit them at the inner indent so they stay associated with
//      the section. If a real statement follows the comments, leave them
//      for the parent — they're leading comments for that statement.
function flushSameLineTail(f: Formatter, lastTok: Token): void {
  const lastEndLine = endLineOf(lastTok);
  let j = lastTok.tokenIndex + 1;
  // Phase 1: same-line tail comments.
  while (j < f.tokens.length) {
    const t = f.tokens[j];
    if (t.channel !== Token.HIDDEN_CHANNEL) break;
    if (t.line !== lastEndLine) break;
    j++;
  }
  if (j > lastTok.tokenIndex + 1) {
    // Same-line comments: drop the wrapping loop's per-item newline so
    // emitHiddenToken's same-line branch reattaches the comment correctly
    // (and adds a trailing newline back for EOL comments). Otherwise a
    // re-parse sees a different-line comment, breaking idempotence.
    f.o.trimTrailingNewlines();
    flushHiddenBefore(f, j);
  }
  // Phase 2: own-line comments before the next visible token. If the next
  // visible token is a closing `}`, the comments visually belong to this
  // section — emit them at the inner indent. Otherwise leave them for the
  // parent (they're leading comments for whatever follows).
  let k = j;
  let trailingHidden = 0;
  while (k < f.tokens.length) {
    const t = f.tokens[k];
    if (t.channel !== Token.HIDDEN_CHANNEL) break;
    trailingHidden++;
    k++;
  }
  if (trailingHidden > 0 && k < f.tokens.length) {
    const next = f.tokens[k];
    if (next.type === L.CCURLY) {
      flushHiddenBefore(f, k);
    }
  }
}
