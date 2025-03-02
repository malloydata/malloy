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
  // console.log("MATCH CLAUSE ", JSON.stringify(data, null, 2));
  return data[0];
}
%}

@lexer fstring_lexer

stringFilter ->
    %minus sfBinary {% ([_, expr]) => ({...expr, not: true}) %}
  | sfBinary {% (data) => matchClause(data) %}

sfBinary ->
    sfBinary conjunction clause {% ([left, cop, right]) => ({op: cop[0].text, left, right}) %}
  | clause {% (data) => matchClause(data) %}
clause ->
    %keyword {% ([kw])=> ({op: kw.text.toLowerCase() }) %}
  | %matchStr {% ([withStr]) => ({op: "=~", match: withStr.text}) %}
  | %open stringFilter %close {% ([_1, subFilter, _3]) => ({op: "()", expr: subFilter}) %}

conjunction -> %comma | %semi | %or
