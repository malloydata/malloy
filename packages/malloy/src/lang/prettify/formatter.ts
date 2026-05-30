/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * Formatter: per-format-call state container plus the parse-tree dispatcher.
 *
 * State (Out buffer, last-emitted token tracking, paren-depth stack) is
 * mutable and read/written directly by the per-rule free functions in sibling
 * modules. The dispatcher is the only method on the class — it routes each
 * parse-tree node to the appropriate per-rule formatter, falling back to
 * left-to-right child recursion.
 *
 * The class itself is not exported beyond ./index, so its fields being
 * "package-public" is hygiene only — no external API leakage.
 */

import {ParserRuleContext, Token} from 'antlr4ts';
import type {ParseTree} from 'antlr4ts/tree';
import {TerminalNode} from 'antlr4ts/tree';
import * as parser from '../lib/Malloy/MalloyParser';

import {Out} from './out';
import {SECTION_STATEMENT_RULES} from './rules';
import {emitVisibleToken} from './leaf';
import {formatBlockBody, formatTopLevel} from './block-body';
import {formatSectionStatement} from './sections';
import {formatFieldProperties} from './field-properties';
import {
  formatCaseStatement,
  formatPick,
  formatPickStatement,
} from './pick-case';
import {formatBinaryChain} from './binary-chain';
import {formatImportSelect} from './import-select';
import {formatFilterTypeOrFallback} from './filter-type';

export class Formatter {
  o = new Out();

  // -- Per-token state (updated by `note(f, ...)` after every token emit) --
  // Index of the last token (visible or implicitly skipped) we've accounted
  // for. flushHiddenBefore won't re-emit anything at or before this index.
  lastEmittedIdx = -1;
  // Type of the last visible token emitted. Drives spacing decisions
  // (e.g. CALL_HUG_AFTER membership for `(`).
  lastEmittedType: number | null = null;
  // 1-based line in the SOURCE where the last emitted token ended. Used to
  // distinguish trailing-comments (same line) from leading-comments (different
  // line).
  prevTokenEndLine = 0;
  // After end-of-top-level-statement, the next statement-starter gets a blank
  // line. Consumed once, then reset.
  needBlank = false;

  // -- Paren-pair state --
  parenDepth = 0;
  // For each open paren-pair: did we choose to break args/content across
  // lines? Stack matches parenDepth.
  parenBreaks: boolean[] = [];

  // Set when format() is invoked at the top level (a MalloyDocument). Guards
  // against accidental reuse of a Formatter instance — the Out buffer
  // accumulates and would emit garbage on a second call. Construct a fresh
  // Formatter per top-level call.
  private rootFormatted = false;

  constructor(
    readonly src: string,
    readonly tokens: Token[]
  ) {}

  format(node: ParseTree): void {
    if (node instanceof TerminalNode) {
      const tok = node.symbol;
      if (tok.type !== Token.EOF) emitVisibleToken(this, tok, tok.tokenIndex);
      return;
    }
    if (!(node instanceof ParserRuleContext)) return;

    // RULE: TOP-LEVEL BODY — one blank line between adjacent statements.
    if (node instanceof parser.MalloyDocumentContext) {
      if (this.rootFormatted) {
        throw new Error(
          'Formatter is single-use; construct a new instance per top-level format call'
        );
      }
      this.rootFormatted = true;
      return formatTopLevel(this, node);
    }

    // RULE: POSTFIX `{…}` — filter shortcut etc.
    if (node instanceof parser.FieldPropertiesContext) {
      return formatFieldProperties(this, node);
    }

    // RULE: BLOCK BODY — walk children, blank-lines between different kinds.
    if (
      node instanceof parser.ExplorePropertiesContext ||
      node instanceof parser.QueryPropertiesContext ||
      node instanceof parser.QueryExtendStatementListContext
    ) {
      return formatBlockBody(this, node);
    }

    // RULE: SECTION-STATEMENT — table-driven dispatch.
    for (const rule of SECTION_STATEMENT_RULES) {
      if (node instanceof rule.ctxClass) {
        return formatSectionStatement(this, node, rule);
      }
    }

    // RULE: IMPORT SELECT — `import {a, b} from 'x'` stays compact.
    if (node instanceof parser.ImportSelectContext) {
      return formatImportSelect(this, node);
    }

    // RULE: FILTER TYPE — `filter<T>` rendered glued, not as `filter < T >`.
    if (
      node instanceof parser.GivenTypeContext ||
      node instanceof parser.LegalParamTypeContext
    ) {
      return formatFilterTypeOrFallback(this, node);
    }

    // RULE: PICK / CASE / BINARY CHAIN.
    if (node instanceof parser.PickStatementContext)
      return formatPickStatement(this, node);
    if (node instanceof parser.PickContext) return formatPick(this, node);
    if (node instanceof parser.CaseStatementContext)
      return formatCaseStatement(this, node);
    if (
      node instanceof parser.ExprLogicalAndContext ||
      node instanceof parser.ExprLogicalOrContext ||
      node instanceof parser.ExprCoalesceContext ||
      node instanceof parser.ExprAddSubContext
    ) {
      return formatBinaryChain(this, node);
    }

    // Default: recurse on children left-to-right.
    for (let i = 0; i < node.childCount; i++) this.format(node.getChild(i));
  }
}
