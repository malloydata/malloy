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
 *   2. Walk the parse tree from `Formatter.format(node)`. Specific rule classes
 *      have explicit handlers (see `format()`); everything else recurses to
 *      children, eventually reaching terminal-node tokens that emit through
 *      `emitVisibleToken` (the leaf).
 *   3. The leaf walker handles per-token spacing/indentation/comments. It is
 *      v1's behaviour and is also the fallback when parsing fails.
 *
 * File layout
 * -----------
 *   - ./out             — Out buffer (indent, newlines, single-space coalescing).
 *   - ./tokens          — LINE_BUDGET, INDENT_STR; classification sets
 *                         (SECTION_TOKENS, BINARY_OPS, CALL_HUG_AFTER, etc.);
 *                         findMatching, endLineOf.
 *   - ./rules           — SECTION_STATEMENT_RULES + STATEMENT_KIND_BY_CTX.
 *                         A maintainer adding a new section keyword lands here.
 *   - ./error-listener  — CollectingErrorListener.
 *   - ./types           — PrettifyError, PrettifyResult.
 *   - ./index (this)    — Formatter class + prettify() entry point.
 *
 * Where rules live
 * ----------------
 *   - emitVisibleToken          — RULE: PER-TOKEN. Spacing, structural
 *     punctuation, comment placement.
 *   - formatSectionList         — RULE: SECTION-LIST. inline vs. wrapped,
 *     bare-flow, `is`-on-own-line, annotation-forces-own-line.
 *   - formatPickStatement       — RULE: PICK. Inline / wrapped / column-align.
 *   - formatCaseStatement       — RULE: CASE. Same idea as pick, aligning THEN.
 *   - formatBinaryChain         — RULE: BINARY CHAIN. Leading-operator
 *     continuation lines for `and`/`or`/`??`/`+`/`-`.
 *   - formatFieldProperties     — RULE: POSTFIX `{…}` (filter shortcut).
 *     Inline-if-fits, else block.
 *   - formatBlockBody           — RULE: BLOCK BODY. Adjacent-statement blank
 *     lines preserved between different kinds, dropped between same kinds.
 *   - emitVisibleToken / renderItemInline duplication — see comment in
 *     `renderItemInline`. If you change a per-token spacing rule in one,
 *     update the other.
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
 *
 * Adding a new section-statement
 * ------------------------------
 *   Add a row to SECTION_STATEMENT_RULES (./rules) with the rule's context
 *   class, the keyword token type(s), the list-context accessor, and the
 *   item-kind tag. Add a corresponding entry to listItems(). That's it.
 *
 *   Note: section keywords NOT in the table fall through to the leaf walker
 *   (which produces correct-but-plain output). Add a row only when the default
 *   isn't good enough — flow-fill, alignment, or annotation handling.
 */

import {
  CharStreams,
  CommonTokenStream,
  Token,
  ParserRuleContext,
} from 'antlr4ts';
import type {ParseTree} from 'antlr4ts/tree';
import {TerminalNode} from 'antlr4ts/tree';
import {MalloyLexer} from '../lib/Malloy/MalloyLexer';
import * as parser from '../lib/Malloy/MalloyParser';
import {MalloyParser} from '../lib/Malloy/MalloyParser';

import {Out} from './out';
import {
  L,
  LINE_BUDGET,
  INDENT_STR,
  SECTION_TOKENS,
  TOP_LEVEL_STARTERS,
  CALL_HUG_AFTER,
  BINARY_OPS,
  endLineOf,
  findMatching,
} from './tokens';
import type {ItemKind} from './rules';
import {SECTION_STATEMENT_RULES, STATEMENT_KIND_BY_CTX} from './rules';
import {CollectingErrorListener} from './error-listener';
import type {PrettifyResult} from './types';

export type {PrettifyError, PrettifyResult} from './types';

// ---------- Formatter ----------

class Formatter {
  o = new Out();

  // -- Per-token state (updated by `note(t, idx)` after every token emit) --
  // Index of the last token (visible or implicitly skipped) we've accounted
  // for. flushHiddenBefore won't re-emit anything at or before this index.
  lastEmittedIdx = -1;
  // Type of the last visible token emitted. Drives spacing decisions
  // (e.g. CALL_HUG_AFTER membership for `(`).
  lastEmittedType: number | null = null;
  // 1-based line in the SOURCE where the last emitted token ended. Used to
  // distinguish trailing-comments (same line) from leading-comments
  // (different line).
  prevTokenEndLine = 0;
  // After end-of-top-level-statement, the next statement-starter gets a
  // blank line. Consumed once, then reset.
  needBlank = false;

  // -- Paren-pair state --
  parenDepth = 0;
  // For each open paren-pair: did we choose to break args/content across
  // lines? Stack matches parenDepth.
  parenBreaks: boolean[] = [];

  constructor(
    readonly src: string,
    readonly tokens: Token[]
  ) {}

  // ============================================================
  // RULE: PER-TOKEN — `emitVisibleToken`
  // The leaf of the walker. Produces v1's per-token formatting.
  // ============================================================

  // Update per-token state after emitting a token (or a token-like span).
  private note(tokenType: number, idx: number, endTok: Token): void {
    this.lastEmittedType = tokenType;
    this.prevTokenEndLine = endLineOf(endTok);
    this.lastEmittedIdx = idx;
  }

  // Emit any hidden-channel tokens (comments) sitting between lastEmittedIdx
  // and idx-1, advancing lastEmittedIdx so they are not re-emitted by a later
  // call. Visible tokens in the same range (e.g. commas the section-list rule
  // chose to drop) are skipped.
  private flushHiddenBefore(idx: number): void {
    if (idx <= this.lastEmittedIdx + 1) return;
    for (let j = this.lastEmittedIdx + 1; j < idx; j++) {
      const t = this.tokens[j];
      if (t.channel === Token.HIDDEN_CHANNEL) {
        this.emitHiddenToken(t);
      }
    }
    this.lastEmittedIdx = idx - 1;
  }

  // Hidden-channel tokens (comments). Trailing comments (same line as previous
  // token) attach with a space; leading comments (own line) start a fresh line.
  private emitHiddenToken(t: Token): void {
    const text = t.text ?? '';
    const sameLine =
      this.prevTokenEndLine !== 0 && t.line === this.prevTokenEndLine;
    if (t.type === L.COMMENT_TO_EOL) {
      if (sameLine) {
        this.o.space();
        this.o.text(text.replace(/\s+$/, ''));
        this.o.nl();
      } else {
        if (this.o.indent === 0) this.startStatementLine();
        else this.o.nl();
        this.o.text(text.replace(/\s+$/, ''));
        this.o.nl();
      }
    } else if (t.type === L.BLOCK_COMMENT) {
      if (sameLine) {
        this.o.space();
        this.o.text(text);
        this.o.space();
      } else {
        if (this.o.indent === 0) this.startStatementLine();
        else this.o.nl();
        this.o.text(text);
        this.o.nl();
      }
    }
    this.prevTokenEndLine = endLineOf(t);
  }

  // Either consume `needBlank` (emit blank line) or just newline.
  private startStatementLine(): void {
    if (this.needBlank) {
      this.o.blank();
      this.needBlank = false;
    } else {
      this.o.nl();
    }
  }

  // Should `(` or `[` hug the previous token (no leading space)?
  private hugsCallParen(): boolean {
    return (
      this.lastEmittedType !== null && CALL_HUG_AFTER.has(this.lastEmittedType)
    );
  }

  // Approximate length of the inline form of tokens [fromIdx, toIdx]: sum of
  // visible token text + 1 char between adjacent tokens. Used for budget
  // checks (paren wrap, pickStatement wrap, etc.). It's an overestimate for
  // dotted-paths and similar (`a.b` is 3 chars, our estimate is 5) but the
  // direction is conservative — we wrap a touch sooner than strictly needed.
  private approxInlineSpan(fromIdx: number, toIdx: number): number {
    let len = 0;
    let prev = -1;
    for (let i = fromIdx; i <= toIdx; i++) {
      const t = this.tokens[i];
      if (t.channel === Token.HIDDEN_CHANNEL) continue;
      if (t.type === Token.EOF) continue;
      if (prev >= 0) len += 1;
      len += (t.text ?? '').length;
      prev = i;
    }
    return len;
  }

  // Are there any hidden-channel tokens (comments) in [fromIdx, toIdx]? Used
  // to gate inline-form candidates: any path that goes through
  // `renderItemInline` strips comments, so candidates with comments must
  // fall back to wrapped/broken form where the leaf walker preserves them.
  private hasCommentsInRange(fromIdx: number, toIdx: number): boolean {
    for (let i = fromIdx; i <= toIdx; i++) {
      if (this.tokens[i].channel === Token.HIDDEN_CHANNEL) return true;
    }
    return false;
  }

  // Does the paren-pair at [openIdx, closeIdx] have any COMMA at its own
  // depth? (Used to distinguish "function call with multiple args" from
  // "single-arg call" / "empty parens".)
  private hasCommaAtDepth1(openIdx: number, closeIdx: number): boolean {
    let depth = 0;
    for (let i = openIdx + 1; i < closeIdx; i++) {
      const t = this.tokens[i];
      if (t.channel === Token.HIDDEN_CHANNEL) continue;
      if (t.type === L.OPAREN || t.type === L.OBRACK || t.type === L.OCURLY)
        depth++;
      else if (
        t.type === L.CPAREN ||
        t.type === L.CBRACK ||
        t.type === L.CCURLY
      )
        depth--;
      else if (t.type === L.COMMA && depth === 0) return true;
    }
    return false;
  }

  // The big switch. Each branch ends with `note(...)`.
  emitVisibleToken(t: Token, idx: number): void {
    if (idx <= this.lastEmittedIdx) return; // already emitted (e.g. SQL block range)
    this.flushHiddenBefore(idx);
    const text = t.text ?? '';

    // ---- Verbatim regions: SQL strings and block annotations ----
    // We don't own a SQL formatter. Annotation indentation is significant.
    if (t.type === L.SQL_BEGIN) {
      const endIdx = findMatching(this.tokens, idx, L.SQL_BEGIN, L.SQL_END);
      const stop = this.tokens[endIdx].stopIndex;
      this.o.space();
      this.o.text(this.src.substring(t.startIndex, stop + 1));
      this.note(L.SQL_END, endIdx, this.tokens[endIdx]);
      return;
    }
    if (
      t.type === L.BLOCK_ANNOTATION_BEGIN ||
      t.type === L.DOC_BLOCK_ANNOTATION_BEGIN
    ) {
      const endIdx = findMatching(
        this.tokens,
        idx,
        t.type,
        L.BLOCK_ANNOTATION_END
      );
      const stop = this.tokens[endIdx].stopIndex;
      if (this.o.indent === 0) this.startStatementLine();
      else this.o.nl();
      this.o.text(this.src.substring(t.startIndex, stop + 1));
      this.o.nl();
      this.note(L.BLOCK_ANNOTATION_END, endIdx, this.tokens[endIdx]);
      return;
    }

    // ---- Single-line annotations on their own line ----
    if (t.type === L.ANNOTATION || t.type === L.DOC_ANNOTATION) {
      if (this.o.indent === 0) this.startStatementLine();
      else this.o.nl();
      this.o.text(text.replace(/\s+$/, ''));
      this.o.nl();
      this.note(t.type, idx, t);
      return;
    }

    // ---- Curly braces: indent in/out around block bodies ----
    if (t.type === L.OCURLY) {
      this.o.space();
      this.o.text('{');
      this.o.indent++;
      this.o.nl();
      this.note(t.type, idx, t);
      return;
    }
    if (t.type === L.CCURLY) {
      this.o.indent = Math.max(0, this.o.indent - 1);
      this.o.nl();
      this.o.text('}');
      if (this.o.indent === 0) this.needBlank = true;
      this.note(t.type, idx, t);
      return;
    }

    // ---- Statement separators ----
    // `;` in wrapped form is dropped — newlines do the job. (Inline `;`
    // appears via renderItemInline, not here.)
    if (t.type === L.SEMI) {
      this.o.trimTrailingSpace();
      this.o.nl();
      if (this.o.indent === 0) this.needBlank = true;
      this.note(t.type, idx, t);
      return;
    }

    // ---- Commas ----
    // At top level (parenDepth==0) → newline. Inside parens that the wrap
    // logic flagged as multi-line → newline. Otherwise inline (just space).
    if (t.type === L.COMMA) {
      this.o.trimTrailingSpace();
      this.o.text(',');
      const innerBreaks =
        this.parenBreaks.length > 0 &&
        this.parenBreaks[this.parenBreaks.length - 1];
      if (this.parenDepth === 0 || innerBreaks) this.o.nl();
      this.note(t.type, idx, t);
      return;
    }

    // ---- Open paren / bracket: decide call-hug vs grouping, decide wrap ----
    if (t.type === L.OPAREN || t.type === L.OBRACK) {
      const isCall = this.hugsCallParen();
      if (!isCall) this.o.space();
      this.o.text(text);

      // Decide whether the contents will exceed the line budget when laid out
      // inline. Break only if there's somewhere useful to break:
      //   - call/subscript parens: must have ≥ 2 args (commas at this depth);
      //   - grouping parens: any overflow — content's own rules will wrap.
      const closeType = t.type === L.OPAREN ? L.CPAREN : L.CBRACK;
      const matchIdx = findMatching(this.tokens, idx, t.type, closeType);
      const inlineLen = this.approxInlineSpan(idx, matchIdx);
      const wouldOverflow = this.o.lineLengthSoFar() + inlineLen > LINE_BUDGET;
      const hasArgCommas = this.hasCommaAtDepth1(idx, matchIdx);
      const willBreak = wouldOverflow && (hasArgCommas || !isCall);
      this.parenBreaks.push(willBreak);
      this.parenDepth++;
      if (willBreak) {
        this.o.indent++;
        this.o.nl();
      }
      this.note(t.type, idx, t);
      return;
    }
    if (t.type === L.CPAREN || t.type === L.CBRACK) {
      const wasBreak = this.parenBreaks.pop() ?? false;
      if (wasBreak) {
        this.o.indent = Math.max(0, this.o.indent - 1);
        this.o.nl();
      } else {
        this.o.trimTrailingSpace();
      }
      this.o.text(text);
      this.parenDepth = Math.max(0, this.parenDepth - 1);
      this.note(t.type, idx, t);
      return;
    }

    // ---- Glued punctuation ----
    if (t.type === L.DOT) {
      this.o.trimTrailingSpace();
      this.o.text('.');
      this.note(t.type, idx, t);
      return;
    }
    if (t.type === L.COLON || t.type === L.TRIPLECOLON) {
      this.o.trimTrailingSpace();
      this.o.text(text);
      this.note(t.type, idx, t);
      return;
    }

    // ---- Section keyword fallback (no explicit handler took it) ----
    // Inside a brace block, force a fresh line. Keeps v1-style readable
    // output even for sections we don't yet handle.
    if (SECTION_TOKENS.has(t.type) && this.o.indent > 0) {
      this.o.nl();
      this.o.text(text.replace(/\s+/g, ''));
      this.note(t.type, idx, t);
      return;
    }

    // ---- Top-level statement starter ----
    if (
      TOP_LEVEL_STARTERS.has(t.type) &&
      this.o.indent === 0 &&
      this.parenDepth === 0
    ) {
      this.startStatementLine();
      this.o.text(text.replace(/\s+/g, ''));
      this.note(t.type, idx, t);
      return;
    }

    // ---- Binary operator: spaces both sides ----
    if (BINARY_OPS.has(t.type)) {
      this.o.space();
      this.o.text(text);
      this.o.space();
      this.note(t.type, idx, t);
      return;
    }

    // ---- Default: identifier, literal, keyword. Single space, then text. ----
    this.o.space();
    this.o.text(text);
    this.note(t.type, idx, t);
  }

  // Emit the source text covering tokens [fromIdx, toIdx] verbatim — used for
  // ranges we deliberately don't reformat (currently unused; kept as a tool).
  emitVerbatim(fromIdx: number, toIdx: number): void {
    if (fromIdx <= this.lastEmittedIdx) return;
    this.flushHiddenBefore(fromIdx);
    const startTok = this.tokens[fromIdx];
    const stopTok = this.tokens[toIdx];
    this.o.space();
    this.o.text(this.src.substring(startTok.startIndex, stopTok.stopIndex + 1));
    this.note(stopTok.type, toIdx, stopTok);
  }

  // Render `ctx` to an isolated string by running the parse-tree walker
  // against a fresh Out. Used by the wrapped section-list bare-flow path so
  // that comments INSIDE an item are preserved (the old `renderItemInline`
  // helper was a flat token-only renderer that dropped hidden tokens).
  // Outer state (parenDepth, paren-break stack, lastEmittedIdx, etc.) is
  // saved and restored. lastEmittedIdx is advanced past the item on return
  // so the outer flow doesn't try to re-emit its tokens.
  private formatToString(ctx: ParserRuleContext): string {
    const savedOut = this.o;
    const savedLastIdx = this.lastEmittedIdx;
    const savedLastType = this.lastEmittedType;
    const savedNeedBlank = this.needBlank;
    const savedDepth = this.parenDepth;
    const savedBreaks = this.parenBreaks;

    this.o = new Out();
    this.lastEmittedIdx = ctx._start.tokenIndex - 1;
    this.lastEmittedType = null;
    this.prevTokenEndLine = 0;
    this.needBlank = false;
    this.parenDepth = 0;
    this.parenBreaks = [];

    this.format(ctx);
    const result = this.o.buf.replace(/\n+$/, '');

    this.o = savedOut;
    this.lastEmittedType = savedLastType;
    this.prevTokenEndLine = endLineOf(ctx._stop!);
    this.needBlank = savedNeedBlank;
    this.parenDepth = savedDepth;
    this.parenBreaks = savedBreaks;
    // Advance lastEmittedIdx past the item we just rendered so callers don't
    // re-emit it (and so flushHiddenBefore for between-item comments works).
    this.lastEmittedIdx = Math.max(savedLastIdx, ctx._stop!.tokenIndex);
    return result;
  }

  // Emit each visible token in [fromIdx, toIdx] via the leaf walker.
  formatTokenRange(fromIdx: number, toIdx: number): void {
    for (let i = fromIdx; i <= toIdx; i++) {
      const t = this.tokens[i];
      if (t.channel !== Token.HIDDEN_CHANNEL && t.type !== Token.EOF) {
        this.emitVisibleToken(t, i);
      }
    }
  }

  // ============================================================
  // Tree dispatch
  // ============================================================

  format(node: ParseTree): void {
    if (node instanceof TerminalNode) {
      const tok = node.symbol;
      if (tok.type !== Token.EOF) this.emitVisibleToken(tok, tok.tokenIndex);
      return;
    }
    if (!(node instanceof ParserRuleContext)) return;

    // RULE: TOP-LEVEL BODY — one blank line between adjacent statements.
    if (node instanceof parser.MalloyDocumentContext) {
      return this.formatTopLevel(node);
    }

    // RULE: POSTFIX `{…}` — filter shortcut etc.
    if (node instanceof parser.FieldPropertiesContext) {
      return this.formatFieldProperties(node);
    }

    // RULE: BLOCK BODY — walk children, blank-lines between different kinds.
    if (
      node instanceof parser.ExplorePropertiesContext ||
      node instanceof parser.QueryPropertiesContext ||
      node instanceof parser.QueryExtendStatementListContext
    ) {
      return this.formatBlockBody(node);
    }

    // RULE: SECTION-STATEMENT — table-driven dispatch.
    for (const rule of SECTION_STATEMENT_RULES) {
      if (node instanceof rule.ctxClass) {
        const keywordTok = this.findKeyword(node, rule.keywordTypes);
        const list = rule.list(node);
        return this.formatSectionStatement(
          node,
          keywordTok,
          list,
          rule.itemKind
        );
      }
    }

    // RULE: PICK / CASE / BINARY CHAIN.
    if (node instanceof parser.PickStatementContext)
      return this.formatPickStatement(node);
    if (node instanceof parser.PickContext) return this.formatPick(node);
    if (node instanceof parser.CaseStatementContext)
      return this.formatCaseStatement(node);
    if (
      node instanceof parser.ExprLogicalAndContext ||
      node instanceof parser.ExprLogicalOrContext ||
      node instanceof parser.ExprCoalesceContext ||
      node instanceof parser.ExprAddSubContext
    ) {
      return this.formatBinaryChain(node);
    }

    // Default: recurse on children left-to-right.
    for (let i = 0; i < node.childCount; i++) this.format(node.getChild(i));
  }

  // ============================================================
  // RULE: BLOCK BODY — formatBlockBody
  //
  // A `{ … }` body containing statements (extend body, view body, etc.).
  // Walks children; between adjacent statements, preserves a single
  // user-supplied blank line *only if the kinds differ*. Same-kind adjacent
  // statements never get a blank.
  // ============================================================

  private statementKind(ctx: ParserRuleContext): string {
    for (const r of STATEMENT_KIND_BY_CTX) {
      if (ctx instanceof r.ctxClass) return r.kind;
    }
    return ctx.constructor.name;
  }

  // Top-level statements (children of MalloyDocument). Force a blank line
  // before each statement after the first, regardless of source spacing —
  // top-level statements should breathe.
  private formatTopLevel(ctx: ParserRuleContext): void {
    let emittedFirst = false;
    for (let i = 0; i < ctx.childCount; i++) {
      const c = ctx.getChild(i);
      if (c instanceof TerminalNode) {
        const tok = c.symbol;
        if (tok.type !== Token.EOF) this.emitVisibleToken(tok, tok.tokenIndex);
        continue;
      }
      if (c instanceof ParserRuleContext) {
        if (emittedFirst) this.needBlank = true;
        this.format(c);
        emittedFirst = true;
      }
    }
  }

  private formatBlockBody(ctx: ParserRuleContext): void {
    let lastChild: ParserRuleContext | null = null;
    let lastChildEndLine = 0;
    for (let i = 0; i < ctx.childCount; i++) {
      const c = ctx.getChild(i);
      if (c instanceof TerminalNode) {
        // OCURLY / CCURLY / SEMI — let the leaf walker handle them.
        const tok = c.symbol;
        if (tok.type !== Token.EOF) this.emitVisibleToken(tok, tok.tokenIndex);
        continue;
      }
      if (c instanceof ParserRuleContext) {
        if (lastChild !== null) {
          const userHadBlank = c._start.line - lastChildEndLine > 1;
          const sameKind =
            this.statementKind(lastChild) === this.statementKind(c);
          if (userHadBlank && !sameKind) this.o.blank();
        }
        this.format(c);
        lastChild = c;
        lastChildEndLine = endLineOf(c._stop!);
      }
    }
  }

  // ============================================================
  // RULE: SECTION-STATEMENT — formatSectionStatement / formatSectionList
  //
  // A `keyword: items` block. The statement context wraps:
  //   <tags?> <ACCESS_LABEL?> <KEYWORD> <listCtx>
  // We walk children: tags + access-label go through the normal dispatcher
  // (so annotations are preserved); the KEYWORD is emitted manually; the
  // list context dispatches to formatSectionList.
  //
  // formatSectionList rule (locked in with the user):
  //   - All bare items + total fits ≤ LINE_BUDGET → inline `kw: a, b, c`.
  //   - Single item that fits (even if it has `is`) → inline.
  //   - Otherwise → wrapped: keyword on its own line; items at +1 indent;
  //       bare items flow-fill ≤ LINE_BUDGET, comma-separated intra-line,
  //       no trailing commas; `is` items each on own line; annotated
  //       items each on own line, annotation on the line above.
  // ============================================================

  private formatSectionStatement(
    stmt: ParserRuleContext,
    keywordTok: Token | undefined,
    listCtx: ParserRuleContext | undefined,
    itemKind: ItemKind
  ): void {
    if (!keywordTok || !listCtx) {
      this.formatTokenRange(stmt._start.tokenIndex, stmt._stop!.tokenIndex);
      return;
    }
    for (let i = 0; i < stmt.childCount; i++) {
      const c = stmt.getChild(i);
      if (c instanceof TerminalNode && c.symbol === keywordTok) {
        this.flushHiddenBefore(keywordTok.tokenIndex);
        if (this.o.indent > 0) this.o.nl();
        else this.startStatementLine();
        this.o.text((keywordTok.text ?? '').replace(/\s+/g, ''));
        this.note(keywordTok.type, keywordTok.tokenIndex, keywordTok);
        continue;
      }
      if (c === listCtx) {
        const items = this.listItems(listCtx, itemKind);
        if (items.length > 0) this.formatSectionList(items);
        continue;
      }
      this.format(c);
    }
  }

  private findKeyword(
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

  private listItems(
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

  private classifyItem(ctx: ParserRuleContext): {
    ctx: ParserRuleContext;
    hasIs: boolean;
    hasAnnotation: boolean;
  } {
    let hasIs = false;
    let hasAnnotation = false;
    for (let i = ctx._start.tokenIndex; i <= ctx._stop!.tokenIndex; i++) {
      const t = this.tokens[i];
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

  private formatSectionList(items: ParserRuleContext[]): void {
    const itemInfos = items.map(it => this.classifyItem(it));
    const noAnnotations = itemInfos.every(info => !info.hasAnnotation);
    const allBare = itemInfos.every(info => !info.hasIs && !info.hasAnnotation);
    const firstItem = items[0];
    const lastItem = items[items.length - 1];

    // Inline candidate: no annotations, no hidden-channel comments anywhere
    // in the items' span (renderItemInline drops them), AND either all bare
    // or exactly one item.
    const itemsHaveComments = this.hasCommentsInRange(
      firstItem._start.tokenIndex,
      lastItem._stop!.tokenIndex
    );
    const inlineEligible =
      noAnnotations && !itemsHaveComments && (allBare || items.length === 1);

    if (inlineEligible) {
      const renderedItems = itemInfos.map(info =>
        this.renderItemInline(info.ctx)
      );
      const inlineBody = renderedItems.join(', ');
      const candidateLen =
        this.o.lineLengthSoFar() + 1 /* space */ + inlineBody.length;
      if (candidateLen <= LINE_BUDGET) {
        this.o.text(' ');
        this.o.text(inlineBody);
        this.note(L.IDENTIFIER, lastItem._stop!.tokenIndex, lastItem._stop!);
        return;
      }
    }

    // Wrapped form. Two paths:
    //   - No comments anywhere: original flow-fill — bare items pack into
    //     lines at LINE_BUDGET, `is`/annotated items each get their own line.
    //   - Comments anywhere in the items' span: every item emits on its own
    //     line via format(), which goes through emitVisibleToken /
    //     flushHiddenBefore and handles trailing-vs-leading attachment for
    //     hidden-channel tokens correctly. Flow-fill density is sacrificed
    //     for comment correctness.
    this.o.indent++;
    this.o.nl();

    if (itemsHaveComments) {
      this.lastEmittedIdx = firstItem._start.tokenIndex - 1;
      for (let k = 0; k < itemInfos.length; k++) {
        const info = itemInfos[k];
        // flushHiddenBefore handles between-item comments and advances
        // lastEmittedIdx so they aren't re-emitted by format(item)'s own
        // first emit.
        this.flushHiddenBefore(info.ctx._start.tokenIndex);
        this.o.nl();
        this.format(info.ctx);
      }
      // Tail comments after the last item.
      this.flushHiddenBefore(lastItem._stop!.tokenIndex + 1);
      this.o.indent--;
      this.note(L.IDENTIFIER, lastItem._stop!.tokenIndex, lastItem._stop!);
      return;
    }

    // No-comments fast path: flow-fill packing as before.
    let curBare = '';
    const flushBare = (): void => {
      if (curBare.length > 0) {
        this.o.text(curBare);
        this.o.nl();
        curBare = '';
      }
    };
    for (const info of itemInfos) {
      if (info.hasIs || info.hasAnnotation) {
        flushBare();
        this.flushHiddenBefore(info.ctx._start.tokenIndex);
        this.format(info.ctx);
        this.o.nl();
      } else {
        const itemText = this.renderItemInline(info.ctx);
        const indentChars = this.o.indent * INDENT_STR.length;
        const sepLen = curBare.length > 0 ? 2 : 0; // ", "
        const projected =
          indentChars + curBare.length + sepLen + itemText.length;
        if (curBare.length > 0 && projected > LINE_BUDGET) {
          flushBare();
          curBare = itemText;
        } else {
          curBare = curBare.length > 0 ? curBare + ', ' + itemText : itemText;
        }
      }
    }
    flushBare();
    this.o.indent--;
    this.note(L.IDENTIFIER, lastItem._stop!.tokenIndex, lastItem._stop!);
  }

  // ============================================================
  // RULE: POSTFIX `{…}` — formatFieldProperties
  //
  // `expr { kw: ... }` — filter shortcut and friends. Inline if it fits;
  // otherwise emit as a block with each inner statement on its own line.
  // Inner statements are rendered atomically via renderItemInline (no
  // recursive section-list rewriting): they're part of the expression.
  // ============================================================

  private formatFieldProperties(ctx: parser.FieldPropertiesContext): void {
    const startIdx = ctx._start.tokenIndex;
    const stopIdx = ctx._stop!.tokenIndex;
    const hasComments = this.hasCommentsInRange(startIdx, stopIdx);

    if (!hasComments) {
      const inline = this.renderItemInline(ctx);
      if (this.o.lineLengthSoFar() + 1 + inline.length <= LINE_BUDGET) {
        this.o.space();
        this.o.text(inline);
        this.note(L.CCURLY, stopIdx, ctx._stop!);
        return;
      }
    }
    // Wrapped form. Each inner statement runs through the leaf walker
    // (formatTokenRange) so comments inside it are preserved naturally.
    this.o.space();
    this.o.text('{');
    this.o.indent++;
    // Advance past the OCURLY ourselves so flushHiddenBefore for the first
    // inner statement doesn't try to re-emit it.
    this.lastEmittedIdx = startIdx;
    for (let i = 0; i < ctx.childCount; i++) {
      const c = ctx.getChild(i);
      if (c instanceof TerminalNode) continue; // skip OCURLY / CCURLY / SEMI
      this.o.nl();
      const child = c as ParserRuleContext;
      this.formatTokenRange(child._start.tokenIndex, child._stop!.tokenIndex);
    }
    this.o.indent--;
    this.o.nl();
    this.o.text('}');
    this.note(L.CCURLY, stopIdx, ctx._stop!);
  }

  // ============================================================
  // RULE: PICK — formatPickStatement / formatPickAligned / formatPick
  //
  // pickStatement: pick+ (ELSE pickElse=fieldExpr)?
  //
  // Inline if the whole thing fits. Otherwise:
  //   - each pick on its own line at +1 indent
  //   - column-align WHEN across picks (pad shorter values)
  //   - else aligns with `pick` (no value padding for else)
  //   - if a single pick still doesn't fit when aligned, break that pick at
  //     WHEN onto two lines.
  // ============================================================

  private formatPickStatement(ctx: parser.PickStatementContext): void {
    const startIdx = ctx._start.tokenIndex;
    const stopIdx = ctx._stop!.tokenIndex;
    const inlineLen = this.approxInlineSpan(startIdx, stopIdx);
    const hasComments = this.hasCommentsInRange(startIdx, stopIdx);
    if (
      !hasComments &&
      this.o.lineLengthSoFar() + 1 + inlineLen <= LINE_BUDGET
    ) {
      for (let i = 0; i < ctx.childCount; i++) this.format(ctx.getChild(i));
      return;
    }

    const picks = ctx.pick();
    const elseTok = ctx.ELSE();
    const elseExpr = ctx.fieldExpr();
    const valueStrs = picks.map(p =>
      p._pickValue ? this.renderItemInline(p._pickValue) : ''
    );
    const maxValueLen = valueStrs.reduce((m, s) => Math.max(m, s.length), 0);

    // formatPickAligned emits a pre-rendered string and skips
    // flushHiddenBefore, so any comments between picks would be lost.
    // Walk the gaps explicitly and emit hidden-channel comments on their own
    // line.
    let prevEndIdx = ctx._start.tokenIndex - 1;
    const flushBetween = (target: number): void => {
      for (let j = prevEndIdx + 1; j < target; j++) {
        const t = this.tokens[j];
        if (t.channel !== Token.HIDDEN_CHANNEL) continue;
        this.o.nl();
        this.o.text((t.text ?? '').replace(/\s+$/, ''));
      }
    };

    this.o.indent++;
    for (let i = 0; i < picks.length; i++) {
      flushBetween(picks[i]._start.tokenIndex);
      this.o.nl();
      this.formatPickAligned(picks[i], maxValueLen);
      prevEndIdx = picks[i]._stop!.tokenIndex;
    }
    if (elseTok && elseExpr) {
      flushBetween(elseTok.symbol.tokenIndex);
      this.o.nl();
      this.format(elseTok);
      this.format(elseExpr);
      prevEndIdx = elseExpr._stop!.tokenIndex;
    }
    flushBetween(stopIdx + 1);
    this.o.indent--;
  }

  private formatPickAligned(
    pick: parser.PickContext,
    maxValueLen: number
  ): void {
    const valueStr = pick._pickValue
      ? this.renderItemInline(pick._pickValue)
      : '';
    const condStr = this.renderItemInline(pick._pickWhen);
    const padding = ' '.repeat(maxValueLen - valueStr.length);
    const aligned = valueStr
      ? `pick ${valueStr}${padding} when ${condStr}`
      : `pick${padding ? ' ' + padding : ''} when ${condStr}`;

    // Aligned form drops comments (renderItemInline skips them). If this
    // pick has internal comments, fall through to the broken-at-WHEN form
    // which uses format() and preserves them.
    const hasComments = this.hasCommentsInRange(
      pick._start.tokenIndex,
      pick._stop!.tokenIndex
    );

    if (
      !hasComments &&
      this.o.lineLengthSoFar() + aligned.length <= LINE_BUDGET
    ) {
      // Aligned form: emit as a single pre-rendered string so the spacing
      // between value and `when` is exact regardless of padding width.
      this.o.text(aligned);
      this.note(L.IDENTIFIER, pick._stop!.tokenIndex, pick._stop!);
      return;
    }
    // Doesn't fit even aligned — break at WHEN, no padding.
    this.format(pick.PICK());
    if (pick._pickValue) this.format(pick._pickValue);
    this.o.nl();
    this.format(pick.WHEN());
    this.format(pick._pickWhen);
  }

  // pick: PICK pickValue? WHEN pickWhen
  // Inline if fits; otherwise break at WHEN. (Used when this pick is dispatched
  // outside of a pickStatement context, which is rare but possible.)
  private formatPick(ctx: parser.PickContext): void {
    const inlineLen = this.approxInlineSpan(
      ctx._start.tokenIndex,
      ctx._stop!.tokenIndex
    );
    if (this.o.lineLengthSoFar() + 1 + inlineLen <= LINE_BUDGET) {
      for (let i = 0; i < ctx.childCount; i++) this.format(ctx.getChild(i));
      return;
    }
    for (let i = 0; i < ctx.childCount; i++) {
      const c = ctx.getChild(i);
      if (c instanceof TerminalNode && c.symbol.type === L.WHEN) this.o.nl();
      this.format(c);
    }
  }

  // ============================================================
  // RULE: CASE — formatCaseStatement / formatCaseWhen
  //
  // caseStatement: CASE valueExpr? (caseWhen)+ (ELSE caseElse)? END
  //
  // Inline if it fits. Otherwise:
  //   case [valueExpr]
  //     when COND_A   then RESULT_A
  //     when LONGCOND then RESULT_B
  //     else FALLBACK
  //   end
  // THEN keyword column-aligns across whens (pad shorter conditions).
  // ELSE/END live at the case's own indent. If an aligned when still
  // overflows, break it at THEN onto two lines.
  // ============================================================

  private formatCaseStatement(ctx: parser.CaseStatementContext): void {
    const startIdx = ctx._start.tokenIndex;
    const stopIdx = ctx._stop!.tokenIndex;
    const inlineLen = this.approxInlineSpan(startIdx, stopIdx);
    const hasComments = this.hasCommentsInRange(startIdx, stopIdx);
    if (
      !hasComments &&
      this.o.lineLengthSoFar() + 1 + inlineLen <= LINE_BUDGET
    ) {
      for (let i = 0; i < ctx.childCount; i++) this.format(ctx.getChild(i));
      return;
    }

    const whens = ctx.caseWhen();
    const condStrs = whens.map(w => this.renderItemInline(w._condition));
    const maxCondLen = condStrs.reduce((m, s) => Math.max(m, s.length), 0);

    this.o.indent++;
    for (let i = 0; i < ctx.childCount; i++) {
      const c = ctx.getChild(i);
      if (c instanceof parser.CaseWhenContext) {
        this.o.nl();
        this.formatCaseWhen(c, maxCondLen);
        continue;
      }
      if (c instanceof TerminalNode && c.symbol.type === L.ELSE) {
        this.o.nl();
        this.format(c);
        // emit the else expression on the same line
        i++;
        if (i < ctx.childCount) this.format(ctx.getChild(i));
        continue;
      }
      if (c instanceof TerminalNode && c.symbol.type === L.END) {
        this.o.indent--;
        this.o.nl();
        this.format(c);
        this.o.indent++;
        continue;
      }
      // CASE keyword and optional valueExpr stay on the head line.
      this.format(c);
    }
    this.o.indent--;
  }

  private formatCaseWhen(
    ctx: parser.CaseWhenContext,
    maxCondLen: number
  ): void {
    const condStr = this.renderItemInline(ctx._condition);
    const resultStr = this.renderItemInline(ctx._result);
    const padding = ' '.repeat(maxCondLen - condStr.length);
    const aligned = `when ${condStr}${padding} then ${resultStr}`;
    const hasComments = this.hasCommentsInRange(
      ctx._start.tokenIndex,
      ctx._stop!.tokenIndex
    );

    if (
      !hasComments &&
      this.o.lineLengthSoFar() + aligned.length <= LINE_BUDGET
    ) {
      this.o.text(aligned);
      this.note(L.IDENTIFIER, ctx._stop!.tokenIndex, ctx._stop!);
      return;
    }
    // Doesn't fit aligned — break at THEN.
    this.format(ctx.WHEN());
    this.format(ctx._condition);
    this.o.nl();
    this.format(ctx.THEN());
    this.format(ctx._result);
  }

  // ============================================================
  // RULE: BINARY CHAIN — formatBinaryChain
  //
  // Handles `and`/`or`/`??`/`+`/`-` chains. The grammar is left-recursive,
  // so a chain `a + b + c` parses as `((a + b) + c)`. Only the OUTERMOST
  // chain context emits; inner same-class contexts fall through to default
  // recursion so the outer can collect all operands.
  //
  // Inline if it fits. Otherwise: first operand inline; each subsequent
  // operator+operand on its own line at +1 indent (leading-operator style).
  //
  // We deliberately do NOT break at comparison operators — see header.
  // ============================================================

  private formatBinaryChain(ctx: ParserRuleContext): void {
    const ChainCtor = ctx.constructor as Function;
    if (ctx.parent instanceof ChainCtor) {
      // Inner chain — let the outer one emit.
      for (let i = 0; i < ctx.childCount; i++) this.format(ctx.getChild(i));
      return;
    }

    const operands: ParseTree[] = [];
    const operators: TerminalNode[] = [];
    const collect = (n: ParseTree): void => {
      if (n instanceof ChainCtor) {
        const r = n as ParserRuleContext;
        collect(r.getChild(0));
        operators.push(r.getChild(1) as TerminalNode);
        operands.push(r.getChild(2));
      } else {
        operands.push(n);
      }
    };
    collect(ctx);

    const inlineLen = this.approxInlineSpan(
      ctx._start.tokenIndex,
      ctx._stop!.tokenIndex
    );
    if (this.o.lineLengthSoFar() + 1 + inlineLen <= LINE_BUDGET) {
      for (let i = 0; i < ctx.childCount; i++) this.format(ctx.getChild(i));
      return;
    }

    this.format(operands[0]);
    this.o.indent++;
    for (let i = 0; i < operators.length; i++) {
      this.o.nl();
      this.format(operators[i]);
      this.format(operands[i + 1]);
    }
    this.o.indent--;
  }

  // ============================================================
  // renderItemInline — flat-string mirror of emitVisibleToken
  //
  // Returns the inline (single-line) form of a parse-rule's token range.
  // Used by:
  //   - section-list inline measurement and bare-item flow-fill
  //   - postfix `{…}` inline form
  //   - pick / case alignment (rendering values and conditions to strings)
  //
  // !!! MAINTAINER NOTE !!!
  // This is a parallel implementation of the per-token spacing rules in
  // emitVisibleToken. They have to agree on inter-token spacing for inline
  // measurements to predict actual emission. If you change a per-token rule
  // in one (e.g. add a token type that hugs `(`), update the other.
  //
  // Differences by design:
  //   - This produces a flat string (no newlines, no indentation).
  //   - SEMI emits `; ` (compact-inline form), not a newline.
  //   - COMMA always emits `, ` (intra-line form).
  //   - Space-coalescing skip-list omits `\n` (we never emit one) but is
  //     otherwise the same as Out.space.
  // ============================================================

  private renderItemInline(ctx: ParserRuleContext): string {
    let buf = '';
    let lastType: number | null = null;
    const space = (): void => {
      if (buf.length === 0) return;
      const last = buf[buf.length - 1];
      if (last === ' ' || last === '(' || last === '[' || last === '.') return;
      buf += ' ';
    };
    const trim = (): void => {
      buf = buf.replace(/ +$/, '');
    };
    // Mirror emitVisibleToken's hug rule: only hug after a known-callable
    // token type. After IS/AS/EXTEND/binary-ops/etc. the `(` is grouping.
    const hugs = (): boolean =>
      lastType !== null && CALL_HUG_AFTER.has(lastType);

    for (let i = ctx._start.tokenIndex; i <= ctx._stop!.tokenIndex; i++) {
      const t = this.tokens[i];
      if (t.channel === Token.HIDDEN_CHANNEL) continue;
      const text = t.text ?? '';

      if (t.type === L.SQL_BEGIN) {
        const endIdx = findMatching(this.tokens, i, L.SQL_BEGIN, L.SQL_END);
        const stop = this.tokens[endIdx].stopIndex;
        space();
        buf += this.src.substring(t.startIndex, stop + 1);
        i = endIdx;
        lastType = L.SQL_END;
        continue;
      }
      if (t.type === L.OCURLY) {
        space();
        buf += '{';
        lastType = t.type;
        continue;
      }
      if (t.type === L.CCURLY) {
        // `{}` empty: no inner space. `{ x }`: both inner spaces.
        if (buf.length > 0 && !buf.endsWith('{') && !buf.endsWith(' '))
          buf += ' ';
        else trim();
        buf += '}';
        lastType = t.type;
        continue;
      }
      if (t.type === L.OPAREN || t.type === L.OBRACK) {
        if (!hugs()) space();
        buf += text;
        lastType = t.type;
        continue;
      }
      if (t.type === L.CPAREN || t.type === L.CBRACK) {
        trim();
        buf += text;
        lastType = t.type;
        continue;
      }
      if (t.type === L.DOT) {
        trim();
        buf += '.';
        lastType = t.type;
        continue;
      }
      if (t.type === L.COMMA) {
        trim();
        buf += ', ';
        lastType = t.type;
        continue;
      }
      if (t.type === L.SEMI) {
        trim();
        buf += '; ';
        lastType = t.type;
        continue;
      }
      if (t.type === L.COLON || t.type === L.TRIPLECOLON) {
        trim();
        buf += text;
        lastType = t.type;
        continue;
      }
      if (BINARY_OPS.has(t.type)) {
        space();
        buf += text;
        buf += ' ';
        lastType = t.type;
        continue;
      }
      // Default: identifier / literal / keyword.
      space();
      buf += text;
      lastType = t.type;
    }
    return buf;
  }
}

// ---------- Entry point ----------

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
  const inputStream = CharStreams.fromString(src);
  const lexer = new MalloyLexer(inputStream);
  const lexerErrors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrors);
  const tokenStream = new CommonTokenStream(lexer);
  tokenStream.fill();
  const tokens = tokenStream.getTokens();

  let root: parser.MalloyDocumentContext | null = null;
  const parserErrors = new CollectingErrorListener();
  try {
    const malloyParser = new MalloyParser(tokenStream);
    malloyParser.removeErrorListeners();
    malloyParser.addErrorListener(parserErrors);
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
        f.emitVisibleToken(t, i);
      }
    }
  }

  return {
    result: f.o.toString(),
    errors: [...lexerErrors.errors, ...parserErrors.errors],
  };
}
