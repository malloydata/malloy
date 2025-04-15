#
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.
#

@preprocessor typescript
@{%
import moo from 'moo';
import {temporalNot, joinTemporal, timeLiteral, mkUnits} from '../clause_utils';

const kwList = moo.keywords(
  {
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
      'TOMORROW': 'tomorrow',
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
    }
);

const temporal_lexer = moo.compile({
  WS: /[ \t]+/,
  id: {
    match: /[a-zA-Z]+/,
    type: kw => kwList(kw.toLowerCase()),
  },
  oparen: '(',
  cparen: ')',
  comma: ',',
  literal: /\d\d\d\d-\d\d-\d\d[ Tt]\d\d:\d\d(?::\d\d(?:[.,]\d*)?)/,
  lit_week: /\d\d\d\d-\d\d-\d\d-[Ww][Kk]/,
  lit_quarter: /\d\d\d\d-[qQ][1234]/,
  lit_min: /\d\d\d\d-\d\d-\d\d[ Tt]\d\d:\d\d/,
  lit_hour: /\d\d\d\d-\d\d-\d\d[ Tt]\d\d/,
  lit_day: /\d\d\d\d-\d\d-\d\d/,
  lit_month: /\d\d\d\d-\d\d/,
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

duration -> number unit {% ([n, units]) => ({units, n}) %}

number ->
    %n {% ([numToken]) => numToken.text %}
  | %lityear {% ([yearToken]) => yearToken.text %}

unit ->
    (%SECOND | %MINUTE | %HOUR | %DAY | %WEEK | %MONTH | %QUARTER | %YEAR
    | %SECONDS | %MINUTES | %HOURS | %DAYS | %WEEKS | %MONTHS | %QUARTERS | %YEARS) {% ([unitToken]) => mkUnits(unitToken[0].text) %}

clause ->
    %NULL_KW {% () => ({operator: 'null' }) %}
  | parens {% (data) => data[0] %}
  | duration {% ([duration]) => ({operator: 'in_last', ...duration}) %}
  | %BEFORE moment {% ([_, moment]) => ({operator: 'before', before: moment }) %}
  | %AFTER moment {% ([_, moment]) => ({operator: 'after', after: moment }) %}
  | moment %TO moment {% ([fromMoment, _, toMoment]) => ({operator: 'to', fromMoment, toMoment}) %}
  | moment %FOR duration {% ([moment, _, duration]) => ({...duration, operator: 'for', begin: moment}) %}
  | (%LAST|%NEXT) duration {% ([op, duration]) => ({operator: op[0].text, ...duration}) %}
  | moment {% ([moment]) => ({operator: 'in', in: moment}) %}

lastNextThis ->
    %THIS {% ([token]) => token.text.toLowerCase() %}
  | %NEXT {% ([token]) => token.text.toLowerCase() %}
  | %LAST {% ([token]) => token.text.toLowerCase() %}

moment ->
    %NOW {% () => ({moment: 'now'}) %}
  | lastNextThis unit {% ([moment, units]) => ({moment, units}) %}
  | %TODAY {% () => ({moment: 'today'}) %}
  | %YESTERDAY {% () => ({moment: 'yesterday'}) %}
  | %TOMORROW {% () => ({moment: 'tomorrow'}) %}
  | duration %AGO {% ([duration, _]) => ({moment: 'ago', ...duration}) %}
  | duration %FROM %NOW {% ([duration, _]) => ({moment: 'from_now', ...duration}) %}
  | %NEXT weekday {% ([_, dn]) => ({moment: dn.toLowerCase(), which: 'next'}) %}
  | %LAST weekday {% ([_, dn]) => ({moment: dn.toLowerCase(), which: 'last'}) %}
  | weekday {% ([dn]) => ({moment: dn.toLowerCase(), which: 'last'}) %}
  | timeLiteral {% d => d[0] %}

timeLiteral ->
    %literal {% ([l]) => timeLiteral(l.text) %}
  | %lit_day {% ([l]) => timeLiteral(l.text, 'day') %}
  | %lit_min {% ([l]) => timeLiteral(l.text, 'minute') %}
  | %lit_hour {% ([l]) => timeLiteral(l.text, 'hour') %}
  | %lit_month {% ([l]) => timeLiteral(l.text, 'month') %}
  | %lit_quarter {% ([l]) => timeLiteral(l.text, 'quarter') %}
  | %lit_week {% ([l]) => timeLiteral(l.text, 'week') %}
  | %lit_year {% ([l]) => timeLiteral(l.text, 'year') %}

weekday -> (%MONDAY | %TUESDAY | %WEDNESDAY | %THURSDAY | %FRIDAY | %SATURDAY | %SUNDAY) {% ([dayToken]) => dayToken[0].text %}

parens -> %oparen temporalFilter %cparen {% ([_1, subFilter, _3]) => ({operator: "()", expr: subFilter}) %}

conjunction -> %OR | %AND
