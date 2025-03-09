#
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.
#

@preprocessor typescript
@{%
import moo from 'moo';
import {temporalNot, joinTemporal, timeLiteral} from '../clause_utils';

const temporal_lexer = moo.compile({
  WS: /[ \t]+/,
  id: {
    match: /[a-zA-Z]+/,
    type: moo.keywords({
      'AND': 'and',
      'OR': 'or',
      'NOT': 'not',
      'NULL_KW': 'null',
      'TO': 'to',
      'NOW': 'now',
      'LAST': 'last',
      'THIS': 'this',
      'NEXT': 'next',
      'AGO': 'ago',
      'FROM': 'from',
      'BEFORE': 'before',
      'AFTER': 'after',
      'FOR': 'for',
      'TODAY': 'today',
      'YESTERDAY': 'yesterday',
      'SECOND': 'second',
      'MINUTE': 'minute',
      'HOUR': 'hour',
      'DAY': 'day',
      'WEEK': 'week',
      'MONTH': 'month',
      'QUARTER': 'quarter',
      'YEAR': 'year',
      'SECONDS': 'seconds',
      'MINUTES': 'minutes',
      'HOURS': 'hours',
      'DAYS': 'days',
      'WEEKS': 'weeks',
      'MONTHS': 'months',
      'QUARTERS': 'quarters',
      'YEARS': 'years',
      'MONDAY': 'monday',
      'TUESDAY': 'tuesday',
      'WEDNESDAY': 'wednesday',
      'THURSDAY': 'thursday',
      'FRIDAY': 'friday',
      'SATURDAY': 'saturday',
      'SUNDAY': 'sunday',
    }),
  },
  oparen: /\(/,
  cparen: /\)/,
  comma: /,/,
  literal: /\d\d\d\d-\d\d-\d\d[ Tt]\d\d:\d\d(?::\d\d(?:[.,]\d*))/,
  lit_week: /\d\d\d\d-\d\d-\d\d-[Ww][Kk]/,
  lit_quarter: /\d\d\d\d-[qQ][1234]/,
  lit_hour: /\d\d\d\d-\d\d-\d\d[ Tt]\d\d/,
  lit_day: /\d\d\d\d-\d\d-\d\d/,
  lit_month: /\d\d\d\d-\d\d-\d\d/,
  lit_year: /\d\d\d\d/,
  n: /\d+/,
});

const actual_next = temporal_lexer.next;
temporal_lexer.next = (next => () => {
  for (;;) {
    const token = next.call(temporal_lexer);
    if (token === undefined || token.type !== 'WS') {
      return token;
    }
  }
})(actual_next);
%}

@lexer temporal_lexer

temporalFilter ->
    temporalFilter conjunction temporalUnary {% ([left, cop, right]) => joinTemporal(left, cop[0].text, right) %}
  | temporalUnary {% (data) => data[0] %}

temporalUnary ->
  %NOT:? clause {% ([notToken, op]) => temporalNot(op, notToken) %}

duration -> number unit

number ->
    %n {% ([numToken]) => numToken.text %}
  | %lityear {% ([yearToken]) => yearToken.text %}

unit ->
    %SECOND | %MINUTE | %HOUR | %DAY | %WEEK | %MONTH | %QUARTER | %YEAR
    | %SECONDS | %MINUTES | %HOURS | %DAYS | %WEEKS | %MONTHS | %QUARTERS | %YEARS

clause ->
    %NULL_KW {% () => ({operator: 'null' }) %}
  | parens {% (data) => data[0] %}
  | %BEFORE moment
  | %AFTER moment
  | moment %TO moment
  | moment %FOR duration
  | moment {% d => d[0] %}

moment ->
    %NOW
  | (%THIS | %NEXT | %LAST) (unit | duration)
  | %TODAY
  | %YESTERDAY
  | %TOMORROW
  | duration %AGO
  | duration %FROM %NOW
  | weekday
  | timeLiteral {% d => d[0] %}

timeLiteral ->
    %literal {% ([l]) => timeLiteral(l.text) %}
  | %lit_day {% ([l]) => timeLiteral(l.text, 'day') %}
  | %lit_hour {% ([l]) => timeLiteral(l.text, 'hour') %}
  | %lit_month {% ([l]) => timeLiteral(l.text, 'month') %}
  | %lit_quarter {% ([l]) => timeLiteral(l.text, 'quarter') %}
  | %lit_week {% ([l]) => timeLiteral(l.text, 'week') %}
  | %lit_year {% ([l]) => timeLiteral(l.text, 'year') %}

weekday -> %MONDAY | %TUESDAY | %WEDNESDAY | %THURSDAY | %FRIDAY | %SATURDAY | %SUNDAY

parens -> %oparen temporalFilter %cparen {% ([_1, subFilter, _3]) => ({operator: "()", expr: subFilter}) %}

conjunction -> %OR | %AND | %comma
