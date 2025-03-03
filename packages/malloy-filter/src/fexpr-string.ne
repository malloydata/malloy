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

function matchClause(data: any[]) {
  return data[0];
}

function mkStringFilter(data: any[]) {
  const [isMinus, op] = data;
  if (isMinus) {
    return {...op, not: true};
  }
  return op;
}

%}

@lexer fstring_lexer

stringFilter ->
    %minus:? sfBinary {% (data) => mkStringFilter(data) %}

sfBinary ->
    sfBinary conjunction clause {% ([left, cop, right]) => ({op: cop[0].text, left, right}) %}
  | clause {% (data) => matchClause(data) %}

parens -> %open stringFilter %close {% ([_1, subFilter, _3]) => ({op: "()", expr: subFilter}) %}

clause ->
    %keyword {% ([kw])=> ({op: kw.text.toLowerCase() }) %}
  | %matchStr {% ([withStr]) => ({op: "=~", match: withStr.text}) %}
  | parens {% (data) => matchClause(data) %}

conjunction -> %comma | %semi | %or
