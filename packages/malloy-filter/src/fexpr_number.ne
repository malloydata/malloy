#
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.
#

@preprocessor typescript
@{%
import moo from 'moo';

const fnumber_lexer = moo.compile({
  WS: /[ \t]+/,
  id: {
    match: /[a-zA-Z]+/,
    type: moo.keywords({
      'AND': 'and',
      'OR': 'or',
      'NOT': 'not',
      'NULL_KW': 'null',
    }),
  },
  oparen: /\(/,
  cparen: /)/,
  obrack: /\[/,
  cbrack: /]/,
  op: /=|!=|<=|>=|<|>/,
  number: /-?(\d+)?\.\d+([Ee][+-]?\d+)?/,
  numberE: /-?\d+[Ee][+-]?\d+/,
});

const actual_next = fnumber_lexer.next;
fnumber_lexer.next = (next => () => {
  for (;;) {
    const token = next.call(fnumber_lexer);
    if (token == undefined || token.type !== 'WS') {
      return token;
    }
  }
})(actual_next);

%}

@lexer fnumber_lexer

numberFilter ->
    numberFilter conjunction numberUnary {% ([left, cop, right]) => conjoin(left, cop[0].text, right) %}
  | numberUnary {% (data) => data[0] %}

numberUnary ->
  %NOT:? clause {% (data) => maybeNot(data) %}

clause ->
    %NULL_KW {% () => ({operator: 'null' }) %}
  | N
  | %op N
  | %oparen N %TO N closeInterval
  | %obrack N %TO N closeInterval
  | parens {% (data) => data[0] %}

parens -> %open  numberFilter %close {% ([_1, subFilter, _3]) => ({operator: "()", expr: subFilter}) %}

closeInterval -> %cbrack | %cparen

N -> %number | %numberE

conjunction -> %OR | %AND
