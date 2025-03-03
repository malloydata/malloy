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
  comma: ',',
  semi: ';',
  open: '(',
  close: ')',
  or: '|',
  minus: '-',
  keyword: ['null', 'NULL', 'empty', 'EMPTY'],
  matchStr: /\s*(?:\\[^\n]|[^\n,;()|])+\s*/,
})

function maybeNot(data: any[]) {
  const [isMinus, op] = data;
  if (isMinus) {
    return {...op, not: true};
  }
  return op;
}

function matchOp(matchStr: string) {
  // Strip escaping needed to get past parser
  matchStr = matchStr.replace(/\\([,;|()])/g, '$1');
  // It's a LIKE if there are unescaped % or _, we are
  // passing this on to a domain where \ escaping is respected
  if (matchStr.match(/(^[%_])|[^\\][%_]/)) {
    return {op: '~', match: matchStr};
  }
  // Unescape everything else
  return {op: '=', match: matchStr.replace(/\\(.)/g, '$1')};
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
