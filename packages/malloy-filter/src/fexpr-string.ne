#
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.
#

@preprocessor typescript
@{%
import moo from 'moo';

const fstring_lexer = moo.compile({
  WS: /[ \t]+/,
  comma: ',',
  semi: ';',
  or: '|',
  open: '(',
  close: ')',
  minus: '-',
  keyword: ['null', 'NULL', 'empty', 'EMPTY'],
  matchStr: /(?:\\[^\n]|[^\n,;()|])+/,
})

const actual_next = fstring_lexer.next;
fstring_lexer.next = (next => () => {
  for (;;) {
    const token = next.call(fstring_lexer);
    if (token == undefined || token.type !== 'WS') {
      return token;
    }
  }
})(actual_next);

function maybeNot(data: any[]) {
  const [isMinus, op] = data;
  if (isMinus) {
    return {...op, not: true};
  }
  return op;
}

function hasLikeChar(str: string) {
  return str.match(/(^[%_])|[^\\][%_]/) !== null;
}

function unescape(str: string) {
  return str.replace(/\\(.)/g, '$1');
}

function matchOp(matchStr: string) {
  // Strip escaping needed to get past parser
  let match = matchStr.trimLeft().replace(/\\([,;|()])/g, '$1');
  const trailingSpaces = match.match(/[^\\\s](\s+)($)/);
  if (trailingSpaces) {
    // remove trailing spaces
    const extraSpaces = trailingSpaces[1];
    match = match.slice(0, match.length - extraSpaces.length);
  }
  // It's a LIKE if there are unescaped % or _, we are
  // passing this on to a domain where \ escaping is respected
  if (hasLikeChar(match)) {
    const ends = match[0] === '%';
    const last = match.length - 1;
    const starts = match[last] === '%' && match[last-1] !== '\\';
    if (starts && ends) {
      const mid = match.slice(1,-1);
      if (!hasLikeChar(mid) && mid.length > 0) {
        return {op: 'contains', match: unescape(mid)};
      }
    } else if (starts) {
      const tail = match.slice(0, -1);
      if (!hasLikeChar(tail)) {
        return {op: 'starts', match: unescape(tail)};
      }
    } else if (ends) {
      const head = match.slice(1);
      if (!hasLikeChar(head)) {
        return {op: 'ends', match: unescape(head)};
      }
    }
    return {op: '~', match};
  }
  // Unescape everything else
  return {op: '=', match: unescape(match)};
}

%}

@lexer fstring_lexer

stringFilter ->
    stringFilter conjunction sfUnary {% ([left, cop, right]) => ({op: cop[0].text, left, right}) %}
  | sfUnary {% (data) => data[0] %}

sfUnary ->
  %minus:? clause {% (data) => maybeNot(data) %}

parens -> %open stringFilter %close {% ([_1, subFilter, _3]) => ({op: "()", expr: subFilter}) %}

clause ->
    %keyword {% ([kw])=> ({op: kw.text.toLowerCase() }) %}
  | %matchStr {% ([withStr]) => matchOp(withStr.text) %}
  | parens {% (data) => data[0] %}

conjunction -> %comma | %semi | %or
