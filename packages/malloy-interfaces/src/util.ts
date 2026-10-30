import {RESERVED_WORDS} from './reserved_words';

function shouldQuoteIdentifier(name: string) {
  const containsFunnyCharacters = !name.match(/^[A-Za-z_][A-Za-z_0-9]*$/);
  const isReserved = RESERVED_WORDS.includes(name.toLowerCase());
  return containsFunnyCharacters || isReserved;
}

export function maybeQuoteIdentifier(name: string): string {
  if (shouldQuoteIdentifier(name)) {
    return `\`${escapeQuoted(name, '`')}\``;
  }
  return name;
}

const NAMED_ESCAPES = new Map([
  ['\b', '\\b'],
  ['\f', '\\f'],
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
]);

/**
 * Escapes the body of a quoted string or backtick identifier, which share
 * one lexical rule: `\` escapes the next character, and control characters
 * may not appear raw. The result decodes back to exactly `str`.
 */
export function escapeQuoted(str: string, quote: string): string {
  let escaped = '';
  for (const c of str) {
    const named = NAMED_ESCAPES.get(c);
    if (c === '\\' || c === quote) {
      escaped += '\\' + c;
    } else if (named !== undefined) {
      escaped += named;
    } else if (c < ' ') {
      escaped += '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
    } else {
      escaped += c;
    }
  }
  return escaped;
}
