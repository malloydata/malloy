/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Parser, Vocabulary} from 'antlr4ts';
import {Token} from 'antlr4ts';
import {MalloyParser} from '../lib/Malloy/MalloyParser';
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

// When a bare-word reserved token appears where a name (IDENTIFIER) was legal,
// the user meant it as a field name; return a "quote it" message. undefined
// otherwise, so the caller keeps its normal message.
export function reservedNameMessage(
  offending: Token | undefined,
  expected: number[],
  recognizer: Parser
): string | undefined {
  const text = offending?.text;
  if (!text || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) return undefined;
  const symbolic = recognizer.vocabulary.getSymbolicName(offending!.type);
  if (symbolic === undefined || KEYWORD_DISPLAY_NAMES[symbolic] === undefined) {
    return undefined;
  }
  if (!expected.includes(MalloyParser.IDENTIFIER)) return undefined;
  // A reserved word followed by '(' is a function call (count()), not a name.
  // offending is the current token here, so LA(2) is the next on-channel token;
  // LA fetches it lazily rather than pre-filling the stream.
  if (recognizer.inputStream.LA(2) === MalloyParser.OPAREN) {
    return undefined;
  }
  return `'${text}' is a reserved word, so to use it as a name you must quote it: \`${text}\``;
}
