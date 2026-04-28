/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * RULE: BLOCK BODY
 *
 * A `{ … }` body containing statements (extend body, view body, etc.). Walks
 * children; between adjacent statements:
 *   - `view:` definitions always get a blank line before them (and after
 *     the previous one), regardless of whether the source had a blank or
 *     what kind preceded — view definitions read as their own sections.
 *   - For other kinds: preserve a single user-supplied blank line only if
 *     the kinds differ. Same-kind adjacent statements (consecutive
 *     dimensions, measures, etc.) never get a blank.
 *
 * Also: top-level body — forces a blank line before each statement after the
 * first, regardless of source spacing (top-level statements should breathe).
 */

import {ParserRuleContext, Token} from 'antlr4ts';
import {TerminalNode} from 'antlr4ts/tree';
import type {Formatter} from './formatter';
import {STATEMENT_KIND_BY_CTX} from './rules';
import {endLineOf} from './tokens';
import {emitVisibleToken} from './leaf';

function statementKind(ctx: ParserRuleContext): string {
  for (const r of STATEMENT_KIND_BY_CTX) {
    if (ctx instanceof r.ctxClass) return r.kind;
  }
  return ctx.constructor.name;
}

export function formatTopLevel(f: Formatter, ctx: ParserRuleContext): void {
  let emittedFirst = false;
  for (let i = 0; i < ctx.childCount; i++) {
    const c = ctx.getChild(i);
    if (c instanceof TerminalNode) {
      const tok = c.symbol;
      if (tok.type !== Token.EOF) emitVisibleToken(f, tok, tok.tokenIndex);
      continue;
    }
    if (c instanceof ParserRuleContext) {
      if (emittedFirst) f.needBlank = true;
      f.format(c);
      emittedFirst = true;
    }
  }
}

export function formatBlockBody(f: Formatter, ctx: ParserRuleContext): void {
  let lastChild: ParserRuleContext | null = null;
  let lastChildEndLine = 0;
  for (let i = 0; i < ctx.childCount; i++) {
    const c = ctx.getChild(i);
    if (c instanceof TerminalNode) {
      // OCURLY / CCURLY / SEMI — let the leaf walker handle them.
      const tok = c.symbol;
      if (tok.type !== Token.EOF) emitVisibleToken(f, tok, tok.tokenIndex);
      continue;
    }
    if (c instanceof ParserRuleContext) {
      if (lastChild !== null) {
        const userHadBlank = c._start.line - lastChildEndLine > 1;
        const lastKind = statementKind(lastChild);
        const curKind = statementKind(c);
        const sameKind = lastKind === curKind;
        // `view:` definitions always breathe — blank line above each one
        // (and after the previous one) regardless of the user's source
        // spacing or what kind preceded.
        if (curKind === 'view' || lastKind === 'view') {
          f.o.blank();
        } else if (userHadBlank && !sameKind) {
          f.o.blank();
        }
      }
      f.format(c);
      lastChild = c;
      lastChildEndLine = endLineOf(c._stop!);
    }
  }
}
