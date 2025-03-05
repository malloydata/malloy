#
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.
#

@preprocessor typescript
@{%
import moo from 'moo';
import {conjoin, maybeNot, matchOp} from '../string_clause_utils';

const fstring_lexer = moo.compile({
  WS: /[ \t]+/,
  comma: ',',
  semi: ';',
  or: '|',
  open: '(',
  close: ')',
  minus: '-',
  matchStr: /(?:\\[^\n]|[^\n,;()|])+/,
});

const actual_next = fstring_lexer.next;
fstring_lexer.next = (next => () => {
  for (;;) {
    const token = next.call(fstring_lexer);
    if (token == undefined || token.type !== 'WS') {
      return token;
    }
  }
})(actual_next);

%}

@lexer fstring_lexer

stringFilter ->
    stringFilter conjunction sfUnary {% ([left, cop, right]) => conjoin(left, cop[0].text, right) %}
  | sfUnary {% (data) => data[0] %}

sfUnary ->
  %minus:? clause {% (data) => maybeNot(data) %}

parens -> %open stringFilter %close {% ([_1, subFilter, _3]) => ({operator: "()", expr: subFilter}) %}

clause ->
    %matchStr {% ([withStr]) => matchOp(withStr.text) %}
  | parens {% (data) => data[0] %}

conjunction -> %comma | %semi | %or
