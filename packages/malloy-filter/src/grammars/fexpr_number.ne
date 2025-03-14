#
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.
#

@preprocessor typescript
@{%
import moo from 'moo';
import {numNot, mkRange, joinNumbers, mkValues} from '../clause_utils';

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
  oparen: '(',
  cparen: ')',
  obrack: '[',
  cbrack: ']',
  comma: ',',
  op: /<=|>=|<|>/,
  ne: '!=',
  eq: '=',
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
%}

@lexer fnumber_lexer

numberFilter ->
    numberFilter conjunction numberUnary {% ([left, cop, right]) => joinNumbers(left, cop[0].text, right) %}
  | numberUnary {% (data) => data[0] %}

numberUnary ->
  %NOT:? clause {% ([notToken, clause]) => numNot(clause, notToken) %}

clause ->
    %NULL_KW {% () => ({operator: 'null' }) %}
  | N numberList:* {% ([n, nList]) => ({operator: '=', ...mkValues(n, nList)}) %}
  | %eq N numberList:* {% ([_, n, nList]) => ({operator: '=', ...mkValues(n, nList)}) %}
  | %ne N numberList:* {% ([_, n, nList]) => ({operator: '!=', ...mkValues(n, nList)}) %}
  | %op N {% ([op, n]) => ({operator: op.text, values: [n]}) %}
  | %oparen numberFilter %cparen {% ([_1, subFilter, _3]) => ({operator: "()", expr: subFilter}) %}
  | openInterval N %TO N closeInterval {% ([l, b, _to, e, r]) => mkRange(l[0].text,b,e,r[0].text) %}

numberList -> %comma N {% ([_, n]) => n %}

closeInterval -> %cbrack | %cparen
openInterval -> %obrack | %oparen

N -> (%float | %numberE | %integer) {% ([nMatch]) => nMatch[0].text %}

conjunction -> %OR | %AND