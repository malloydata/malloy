#
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.
#

@preprocessor typescript
@{%
import moo from 'moo';
import {maybeNot, mkRange, joinNumbers} from '../clause_utils';

const fnumber_lexer = moo.compile({
  WS: /[ \t]+/,
  id: {
    match: /[a-zA-Z]+/,
    type: moo.keywords({
      'AND': 'and',
      'OR': 'or',
      'NOT': 'not',
      'NULL_KW': 'null',
      'TO': 'to',
    }),
  },
  oparen: /\(/,
  cparen: /\)/,
  obrack: /\[/,
  cbrack: /\]/,
  comma: /,/,
  op: /=|!=|<=|>=|<|>/,
  float: /-?(?:\d+)?\.\d+(?:[Ee][+-]?\d+)?/,
  numberE: /-?\d+[Ee][+-]?\d+/,
  integer: /-?\d+/,
});

const actual_next = fnumber_lexer.next;
fnumber_lexer.next = (next => () => {
  for (;;) {
    const token = next.call(fnumber_lexer);
    if (token === undefined || token.type !== 'WS') {
      return token;
    }
  }
})(actual_next);

function conjoin(x: Object, y:  Object, z: Object) {
  return null;
}
%}

@lexer fnumber_lexer

numberFilter ->
    numberFilter conjunction numberUnary {% ([left, cop, right]) => joinNumbers(left, cop[0].text, right) %}
  | numberUnary {% (data) => data[0] %}

numberUnary ->
  %NOT:? clause {% (data) => maybeNot(data) %}

clause ->
    %NULL_KW {% () => ({operator: 'null' }) %}
  | N {% (d) => ({operator: '=', values: [d[0]]}) %}
  | %op N {% ([op, n]) => ({operator: op.text, values: [n]}) %}
  | parens {% (data) => data[0] %}
  | openInterval N %TO N closeInterval {% ([l, b, _to, e, r]) => mkRange(l[0].text,b,e,r[0].text) %}

parens -> %oparen  numberFilter %cparen {% ([_1, subFilter, _3]) => ({operator: "()", expr: subFilter}) %}

closeInterval -> %cbrack | %cparen
openInterval -> %obrack | %oparen

N -> (%float | %numberE | %integer) {% (nMatch) => nMatch[0][0].text %}

conjunction -> %OR | %AND | %comma
