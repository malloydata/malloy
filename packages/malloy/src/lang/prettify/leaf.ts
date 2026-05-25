/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * Leaf walker: per-token spacing, structural punctuation, comment placement,
 * and the small helpers the rule formatters use to look at adjacent tokens.
 *
 * Per-rule formatters call into here via:
 *   - emitVisibleToken         — the leaf
 *   - flushHiddenBefore        — emit pending comments before a target index
 *   - note                     — atomic per-token state update
 *   - startStatementLine       — newline (consuming `needBlank`) for stmt start
 *   - approxInlineSpan         — line-budget overestimate for a token range
 *   - hasCommentsInRange       — comment-presence check (gates inline form)
 *   - formatTokenRange         — emit a span via the leaf walker
 */

import {Token} from 'antlr4ts';
import type {Formatter} from './formatter';
import {
  BINARY_OPS,
  L,
  LINE_BUDGET,
  SECTION_TOKENS,
  TOP_LEVEL_STARTERS,
  endLineOf,
  findMatching,
  leadingAction,
} from './tokens';

// Update per-token state after emitting a token (or a token-like span).
export function note(
  f: Formatter,
  tokenType: number,
  idx: number,
  endTok: Token
): void {
  f.lastEmittedType = tokenType;
  f.prevTokenEndLine = endLineOf(endTok);
  f.lastEmittedIdx = idx;
}

// Emit any hidden-channel tokens (comments) sitting between f.lastEmittedIdx
// and idx-1, advancing f.lastEmittedIdx so they are not re-emitted by a later
// call. Visible tokens in the same range (e.g. commas the section-list rule
// chose to drop) are skipped.
export function flushHiddenBefore(f: Formatter, idx: number): void {
  if (idx <= f.lastEmittedIdx + 1) return;
  for (let j = f.lastEmittedIdx + 1; j < idx; j++) {
    const t = f.tokens[j];
    if (t.channel === Token.HIDDEN_CHANNEL) {
      emitHiddenToken(f, t);
    }
  }
  f.lastEmittedIdx = idx - 1;
}

// Hidden-channel tokens (comments). Trailing comments (same line as previous
// token) attach with a space; leading comments (own line) start a fresh line.
function emitHiddenToken(f: Formatter, t: Token): void {
  const text = t.text ?? '';
  const sameLine = f.prevTokenEndLine !== 0 && t.line === f.prevTokenEndLine;
  if (t.type === L.COMMENT_TO_EOL) {
    if (sameLine) {
      f.o.space();
      f.o.text(text.replace(/\s+$/, ''));
      f.o.nl();
    } else {
      if (f.o.indent === 0) startStatementLine(f);
      else f.o.nl();
      f.o.text(text.replace(/\s+$/, ''));
      f.o.nl();
    }
  } else if (t.type === L.BLOCK_COMMENT) {
    if (sameLine) {
      f.o.space();
      f.o.text(text);
      f.o.space();
    } else {
      if (f.o.indent === 0) startStatementLine(f);
      else f.o.nl();
      f.o.text(text);
      f.o.nl();
    }
  }
  f.prevTokenEndLine = endLineOf(t);
}

// Either consume `needBlank` (emit blank line) or just newline.
export function startStatementLine(f: Formatter): void {
  if (f.needBlank) {
    f.o.blank();
    f.needBlank = false;
  } else {
    f.o.nl();
  }
}

// Approximate length of the inline form of tokens [fromIdx, toIdx]: sum of
// visible token text + 1 char between adjacent tokens. Used for budget checks
// (paren wrap, pickStatement wrap, etc.). It's an overestimate for dotted-paths
// and similar (`a.b` is 3 chars, our estimate is 5) but the direction is
// conservative — we wrap a touch sooner than strictly needed.
export function approxInlineSpan(
  f: Formatter,
  fromIdx: number,
  toIdx: number
): number {
  let len = 0;
  let prev = -1;
  for (let i = fromIdx; i <= toIdx; i++) {
    const t = f.tokens[i];
    if (t.channel === Token.HIDDEN_CHANNEL) continue;
    if (t.type === Token.EOF) continue;
    if (prev >= 0) len += 1;
    len += (t.text ?? '').length;
    prev = i;
  }
  return len;
}

// Are there any hidden-channel tokens (comments) in [fromIdx, toIdx]? Used to
// gate inline-form candidates: any path that goes through `renderItemInline`
// strips comments, so candidates with comments must fall back to wrapped or
// broken form where the leaf walker preserves them.
export function hasCommentsInRange(
  f: Formatter,
  fromIdx: number,
  toIdx: number
): boolean {
  for (let i = fromIdx; i <= toIdx; i++) {
    if (f.tokens[i].channel === Token.HIDDEN_CHANNEL) return true;
  }
  return false;
}

// Index of the next non-hidden, non-EOF token strictly after `idx`, or -1.
function nextVisibleAfter(f: Formatter, idx: number): number {
  for (let j = idx + 1; j < f.tokens.length; j++) {
    const t = f.tokens[j];
    if (t.channel === Token.HIDDEN_CHANNEL) continue;
    if (t.type === Token.EOF) return -1;
    return j;
  }
  return -1;
}

// Does the paren-pair at [openIdx, closeIdx] have any COMMA at its own depth?
// (Used to distinguish "function call with multiple args" from "single-arg
// call" / "empty parens".)
function hasCommaAtDepth1(
  f: Formatter,
  openIdx: number,
  closeIdx: number
): boolean {
  let depth = 0;
  for (let i = openIdx + 1; i < closeIdx; i++) {
    const t = f.tokens[i];
    if (t.channel === Token.HIDDEN_CHANNEL) continue;
    if (t.type === L.OPAREN || t.type === L.OBRACK || t.type === L.OCURLY)
      depth++;
    else if (t.type === L.CPAREN || t.type === L.CBRACK || t.type === L.CCURLY)
      depth--;
    else if (t.type === L.COMMA && depth === 0) return true;
  }
  return false;
}

// The big switch. Each branch ends with `note(...)`.
export function emitVisibleToken(f: Formatter, t: Token, idx: number): void {
  if (idx <= f.lastEmittedIdx) return; // already emitted (e.g. SQL block range)
  flushHiddenBefore(f, idx);
  const text = t.text ?? '';

  // ---- Verbatim regions: SQL strings and multi-line annotations ----
  // We don't own a SQL formatter. AnnotationsDef indentation is significant.
  if (t.type === L.SQL_BEGIN) {
    const endIdx = findMatching(f.tokens, idx, L.SQL_BEGIN, L.SQL_END);
    const stop = f.tokens[endIdx].stopIndex;
    f.o.space();
    f.o.text(f.src.substring(t.startIndex, stop + 1));
    note(f, L.SQL_END, endIdx, f.tokens[endIdx]);
    return;
  }
  if (
    t.type === L.BLOCK_ANNOTATION_BEGIN ||
    t.type === L.DOC_BLOCK_ANNOTATION_BEGIN
  ) {
    const endIdx = findMatching(f.tokens, idx, t.type, L.BLOCK_ANNOTATION_END);
    const stop = f.tokens[endIdx].stopIndex;
    if (f.o.indent === 0) startStatementLine(f);
    else f.o.nl();
    f.o.text(f.src.substring(t.startIndex, stop + 1));
    f.o.nl();
    note(f, L.BLOCK_ANNOTATION_END, endIdx, f.tokens[endIdx]);
    return;
  }

  // ---- Single-line annotations on their own line ----
  if (t.type === L.ANNOTATION || t.type === L.DOC_ANNOTATION) {
    if (f.o.indent === 0) startStatementLine(f);
    else f.o.nl();
    f.o.text(text.replace(/\s+$/, ''));
    f.o.nl();
    note(f, t.type, idx, t);
    return;
  }

  // ---- Curly braces: indent in/out around block bodies ----
  if (t.type === L.OCURLY) {
    f.o.space();
    f.o.text('{');
    // Empty `{}`: peek the next visible token. If it's the matching close
    // AND nothing hidden sits between them (no comments to preserve), emit
    // inline so we get `extend {}` not `extend {\n}`. With a comment in the
    // gap (`extend { /* keep */ }`), fall through to the wrapping form so
    // the leaf walker's comment placement runs.
    const nextVisible = nextVisibleAfter(f, idx);
    if (
      nextVisible !== -1 &&
      f.tokens[nextVisible].type === L.CCURLY &&
      !hasCommentsInRange(f, idx + 1, nextVisible - 1)
    ) {
      f.o.text('}');
      if (f.o.indent === 0) f.needBlank = true;
      note(f, L.CCURLY, nextVisible, f.tokens[nextVisible]);
      return;
    }
    f.o.indent++;
    f.o.nl();
    note(f, t.type, idx, t);
    return;
  }
  if (t.type === L.CCURLY) {
    f.o.indent = Math.max(0, f.o.indent - 1);
    f.o.nl();
    f.o.text('}');
    if (f.o.indent === 0) f.needBlank = true;
    note(f, t.type, idx, t);
    return;
  }

  // ---- Statement separators ----
  // `;` in wrapped form is dropped — newlines do the job. (Inline `;` appears
  // via renderItemInline, not here.)
  if (t.type === L.SEMI) {
    f.o.trimTrailingSpace();
    f.o.nl();
    if (f.o.indent === 0) f.needBlank = true;
    note(f, t.type, idx, t);
    return;
  }

  // ---- Commas ----
  // At top level (parenDepth==0) → newline. Inside parens that the wrap logic
  // flagged as multi-line → newline. Otherwise inline (just space).
  if (t.type === L.COMMA) {
    f.o.trimTrailingSpace();
    f.o.text(',');
    const innerBreaks =
      f.parenBreaks.length > 0 && f.parenBreaks[f.parenBreaks.length - 1];
    if (f.parenDepth === 0 || innerBreaks) f.o.nl();
    note(f, t.type, idx, t);
    return;
  }

  // ---- Open paren / bracket: decide call-hug vs grouping, decide wrap ----
  if (t.type === L.OPAREN || t.type === L.OBRACK) {
    const action = leadingAction(f.lastEmittedType, t.type);
    if (action === 'space') f.o.space();
    f.o.text(text);

    // Decide whether the contents will exceed the line budget when laid out
    // inline. Break only if there's somewhere useful to break:
    //   - call/subscript parens (action='hug'): must have ≥ 2 args (commas at
    //     this depth);
    //   - grouping parens (action='space'): any overflow — content's own
    //     rules will wrap.
    const closeType = t.type === L.OPAREN ? L.CPAREN : L.CBRACK;
    const matchIdx = findMatching(f.tokens, idx, t.type, closeType);
    const inlineLen = approxInlineSpan(f, idx, matchIdx);
    const wouldOverflow = f.o.lineLengthSoFar() + inlineLen > LINE_BUDGET;
    const hasArgCommas = hasCommaAtDepth1(f, idx, matchIdx);
    const isCall = action === 'hug';
    const willBreak = wouldOverflow && (hasArgCommas || !isCall);
    f.parenBreaks.push(willBreak);
    f.parenDepth++;
    if (willBreak) {
      f.o.indent++;
      f.o.nl();
    }
    note(f, t.type, idx, t);
    return;
  }
  if (t.type === L.CPAREN || t.type === L.CBRACK) {
    const wasBreak = f.parenBreaks.pop() ?? false;
    if (wasBreak) {
      f.o.indent = Math.max(0, f.o.indent - 1);
      f.o.nl();
    } else {
      f.o.trimTrailingSpace();
    }
    f.o.text(text);
    f.parenDepth = Math.max(0, f.parenDepth - 1);
    note(f, t.type, idx, t);
    return;
  }

  // ---- Section keyword fallback (no explicit handler took it) ----
  // Inside a brace block, force a fresh line. Keeps v1-style readable output
  // even for sections we don't yet handle.
  if (SECTION_TOKENS.has(t.type) && f.o.indent > 0) {
    f.o.nl();
    f.o.text(text.replace(/\s+/g, ''));
    note(f, t.type, idx, t);
    return;
  }

  // ---- Top-level statement starter ----
  if (
    TOP_LEVEL_STARTERS.has(t.type) &&
    f.o.indent === 0 &&
    f.parenDepth === 0
  ) {
    startStatementLine(f);
    f.o.text(text.replace(/\s+/g, ''));
    note(f, t.type, idx, t);
    return;
  }

  // ---- Default: identifier / literal / keyword / DOT / COLON / TRIPLECOLON
  //      / binary op. Leading separator from the classifier; binary ops also
  //      get a trailing space.
  const action = leadingAction(f.lastEmittedType, t.type);
  if (action === 'glue') f.o.trimTrailingSpace();
  else if (action === 'space') f.o.space();
  // 'hug' — emit nothing before
  f.o.text(text);
  if (BINARY_OPS.has(t.type)) f.o.space();
  note(f, t.type, idx, t);
}

// Emit each visible token in [fromIdx, toIdx] via the leaf walker.
export function formatTokenRange(
  f: Formatter,
  fromIdx: number,
  toIdx: number
): void {
  for (let i = fromIdx; i <= toIdx; i++) {
    const t = f.tokens[i];
    if (t.channel !== Token.HIDDEN_CHANNEL && t.type !== Token.EOF) {
      emitVisibleToken(f, t, i);
    }
  }
}
