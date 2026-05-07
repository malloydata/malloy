/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * renderItemInline — flat-string form of a parse-rule's token range.
 *
 * Used by:
 *   - section-list inline measurement and bare-item flow-fill
 *   - postfix `{…}` inline form
 *   - pick / case alignment (rendering values and conditions to strings)
 *
 * Inter-token spacing comes from `leadingAction` in ./tokens, the same
 * classifier the leaf walker (./leaf) consults. Both walkers therefore agree
 * on what spacing goes between any two adjacent tokens; inline measurement
 * predicts actual emission.
 *
 * Walker-specific divergence:
 *   - This produces a flat string (no newlines, no indentation).
 *   - SEMI emits `; ` (compact-inline form), not a newline.
 *   - COMMA emits `, ` (intra-line form), not a newline.
 *   - The space-coalescing skip-list omits `\n` (we never emit one) but is
 *     otherwise the same as Out.space.
 */

import type {ParserRuleContext} from 'antlr4ts';
import {Token} from 'antlr4ts';
import type {Formatter} from './formatter';
import {BINARY_OPS, L, findMatching, leadingAction} from './tokens';

export function renderItemInline(f: Formatter, ctx: ParserRuleContext): string {
  let buf = '';
  let lastType: number | null = null;
  // True between the LT and matching GT of a `filter<T>` window (LT
  // immediately follows FILTER). All four tokens render glued; mirrors
  // formatFilterTypeOrFallback in the leaf walker.
  let inFilterType = false;
  // Coalescing space: skip if buffer is empty or last char already provides
  // separation. Mirrors Out.space() (./out) minus the newline check, since
  // this renderer never emits a newline.
  const space = (): void => {
    if (buf.length === 0) return;
    const last = buf[buf.length - 1];
    if (last === ' ' || last === '(' || last === '[' || last === '.') return;
    buf += ' ';
  };
  const trim = (): void => {
    buf = buf.replace(/ +$/, '');
  };

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
    if (t.type === L.CCURLY) {
      // `{}` empty: no inner space. `{ x }`: both inner spaces.
      if (buf.length > 0 && !buf.endsWith('{') && !buf.endsWith(' '))
        buf += ' ';
      else trim();
      buf += '}';
      lastType = t.type;
      continue;
    }
    // Walker-specific divergence: COMMA and SEMI use compact-inline form
    // (`, ` and `; `). The leaf walker (./leaf) emits newlines for these in
    // wrapped contexts.
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
    // filter<T>: glue all four tokens.
    if (t.type === L.LT && lastType === L.FILTER) {
      trim();
      buf += '<';
      inFilterType = true;
      lastType = t.type;
      continue;
    }
    if (inFilterType) {
      trim();
      buf += text;
      if (t.type === L.GT) inFilterType = false;
      lastType = t.type;
      continue;
    }
    // Everything else: classifier-driven leading separator + text + (if a
    // binary op) trailing space. Same shape as the leaf walker's default.
    const action = leadingAction(lastType, t.type);
    if (action === 'glue') trim();
    else if (action === 'space') space();
    // 'hug' — emit nothing before
    buf += text;
    if (BINARY_OPS.has(t.type)) buf += ' ';
    lastType = t.type;
  }
  return buf;
}
