/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * renderItemInline — flat-string mirror of emitVisibleToken
 *
 * Returns the inline (single-line) form of a parse-rule's token range. Used by:
 *   - section-list inline measurement and bare-item flow-fill
 *   - postfix `{…}` inline form
 *   - pick / case alignment (rendering values and conditions to strings)
 *
 * !!! MAINTAINER NOTE !!!
 * This is a parallel implementation of the per-token spacing rules in
 * emitVisibleToken (./leaf). They have to agree on inter-token spacing for
 * inline measurements to predict actual emission. If you change a per-token
 * rule in one (e.g. add a token type that hugs `(`), update the other.
 *
 * Differences by design:
 *   - This produces a flat string (no newlines, no indentation).
 *   - SEMI emits `; ` (compact-inline form), not a newline.
 *   - COMMA always emits `, ` (intra-line form).
 *   - Space-coalescing skip-list omits `\n` (we never emit one) but is
 *     otherwise the same as Out.space.
 */

import type {ParserRuleContext} from 'antlr4ts';
import {Token} from 'antlr4ts';
import type {Formatter} from './formatter';
import {BINARY_OPS, CALL_HUG_AFTER, L, findMatching} from './tokens';

export function renderItemInline(f: Formatter, ctx: ParserRuleContext): string {
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
  // Mirror emitVisibleToken's hug rule: only hug after a known-callable token
  // type. After IS/AS/EXTEND/binary-ops/etc. the `(` is grouping.
  const hugs = (): boolean => lastType !== null && CALL_HUG_AFTER.has(lastType);

  for (let i = ctx._start.tokenIndex; i <= ctx._stop!.tokenIndex; i++) {
    const t = f.tokens[i];
    if (t.channel === Token.HIDDEN_CHANNEL) continue;
    const text = t.text ?? '';

    if (t.type === L.SQL_BEGIN) {
      const endIdx = findMatching(f.tokens, i, L.SQL_BEGIN, L.SQL_END);
      const stop = f.tokens[endIdx].stopIndex;
      space();
      buf += f.src.substring(t.startIndex, stop + 1);
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
