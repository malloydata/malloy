/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Vocabulary} from 'antlr4ts';
import {Token} from 'antlr4ts';
import {KEYWORD_DISPLAY_NAMES} from '../lib/Malloy/keyword-display-names';

// Pattern tokens have neither a literal nor a keyword spelling to show, so they
// get hand-written prose instead of their SHOUTING symbolic name.
const CLASS_TOKEN_DISPLAY_NAMES: Record<string, string> = {
  IDENTIFIER: 'a name',
  BQ_STRING: 'a `quoted` name',
  SQ_STRING: 'a quoted string',
  DQ_STRING: 'a quoted string',
  NUMERIC_LITERAL: 'a number',
  INTEGER_LITERAL: 'a number',
  PERCENT_LITERAL: 'a percentage',
  GIVEN_REF: 'a $given reference',
};

// Past this many alternatives the expected-set is the parser's follow-set, not
// a hint, so describeExpected drops it.
const MAX_EXPECTED_NAMED = 3;

export function describeToken(type: number, vocabulary: Vocabulary): string {
  if (type === Token.EOF) return 'end of input';
  const symbolic = vocabulary.getSymbolicName(type);
  if (symbolic !== undefined) {
    const prose = CLASS_TOKEN_DISPLAY_NAMES[symbolic];
    if (prose !== undefined) return prose;
    const keyword = KEYWORD_DISPLAY_NAMES[symbolic];
    if (keyword !== undefined) return `'${keyword}'`;
  }
  // Punctuation already carries a quoted literal name, e.g. "'{'".
  const literal = vocabulary.getLiteralName(type);
  if (literal !== undefined) return literal;
  return symbolic ?? `<token ${type}>`;
}

function joinOr(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

export function describeExpected(
  types: number[],
  vocabulary: Vocabulary
): string | undefined {
  const displays: string[] = [];
  const seen = new Set<string>();
  for (const type of types) {
    if (type < Token.MIN_USER_TOKEN_TYPE && type !== Token.EOF) continue;
    const display = describeToken(type, vocabulary);
    if (!seen.has(display)) {
      seen.add(display);
      displays.push(display);
    }
  }
  if (displays.length === 0 || displays.length > MAX_EXPECTED_NAMED) {
    return undefined;
  }
  return joinOr(displays);
}
