/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

{{
const {temporalNot, joinTemporal, timeLiteral, mkUnits} = require('../clause_utils');
}}

temporalFilter
  = head:temporalUnary tail:(_ conjunction _ temporalUnary)*
    {
      return tail.reduce((left, [, cop, , right]) => joinTemporal(left, cop, right), head);
    }

temporalUnary
  = NOT __ clause:clause { return temporalNot(clause, true); }
  / clause:clause { return clause; }

clause
  = NULL { return {operator: 'null'}; }
  / "(" _ expr:temporalFilter _ ")" { return {operator: "()", expr}; }
  / BEFORE __ m:moment { return {operator: 'before', before: m}; }
  / STARTING __ m:moment { return {operator: 'before', before: m, not: true}; }
  / AFTER __ m:moment { return {operator: 'after', after: m}; }
  / THROUGH __ m:moment { return {operator: 'after', after: m, not: true}; }
  / ln:lastOrNext __ d:duration { return {operator: ln, ...d}; }
  / m:moment __ TO __ m2:moment { return {operator: 'to', fromMoment: m, toMoment: m2}; }
  / m:moment __ FOR __ d:duration { return {...d, operator: 'for', begin: m}; }
  / m:moment { return {operator: 'in', in: m}; }
  / d:duration { return {operator: 'in_last', ...d}; }

lastOrNext
  = LAST { return 'last'; }
  / NEXT { return 'next'; }

duration = n:integer __ u:unit { return {units: u, n}; }

integer = n:$[0-9]+ { return n; }

unit
  = u:$("second"i / "minute"i / "hour"i / "day"i / "week"i / "month"i / "quarter"i / "year"i) "s"i? !idChar
    { return mkUnits(u); }

moment
  = NOW { return {moment: 'now'}; }
  / TODAY { return {moment: 'today'}; }
  / YESTERDAY { return {moment: 'yesterday'}; }
  / TOMORROW { return {moment: 'tomorrow'}; }
  / d:duration __ AGO { return {moment: 'ago', ...d}; }
  / d:duration __ FROM __ NOW { return {moment: 'from_now', ...d}; }
  / NEXT __ dn:weekday { return {moment: dn.toLowerCase(), which: 'next'}; }
  / LAST __ dn:weekday { return {moment: dn.toLowerCase(), which: 'last'}; }
  / lnt:lastNextThis __ u:unit { return {moment: lnt, units: u}; }
  / dn:weekday { return {moment: dn.toLowerCase(), which: 'last'}; }
  / tl:timeLiteral { return tl; }

lastNextThis
  = THIS { return 'this'; }
  / NEXT { return 'next'; }
  / LAST { return 'last'; }

timeLiteral
  = l:$([0-9][0-9][0-9][0-9] "-" [0-9][0-9] "-" [0-9][0-9] [ Tt] [0-9][0-9] ":" [0-9][0-9] ":" [0-9][0-9] ([.,] [0-9]*)?) { return timeLiteral(l); }
  / l:$([0-9][0-9][0-9][0-9] "-" [0-9][0-9] "-" [0-9][0-9] "-" [Ww] [Kk]) { return timeLiteral(l, 'week'); }
  / l:$([0-9][0-9][0-9][0-9] "-" [Qq] [1234]) { return timeLiteral(l, 'quarter'); }
  / l:$([0-9][0-9][0-9][0-9] "-" [0-9][0-9] "-" [0-9][0-9] [ Tt] [0-9][0-9] ":" [0-9][0-9]) { return timeLiteral(l, 'minute'); }
  / l:$([0-9][0-9][0-9][0-9] "-" [0-9][0-9] "-" [0-9][0-9] [ Tt] [0-9][0-9]) { return timeLiteral(l, 'hour'); }
  / l:$([0-9][0-9][0-9][0-9] "-" [0-9][0-9] "-" [0-9][0-9]) { return timeLiteral(l, 'day'); }
  / l:$([0-9][0-9][0-9][0-9] "-" [0-9][0-9]) { return timeLiteral(l, 'month'); }
  / l:$([0-9][0-9][0-9][0-9]) { return timeLiteral(l, 'year'); }

weekday
  = w:$(MONDAY / TUESDAY / WEDNESDAY / THURSDAY / FRIDAY / SATURDAY / SUNDAY) { return w; }

conjunction
  = OR { return "or"; }
  / AND { return "and"; }

// Keywords - case insensitive, must not be followed by more id chars
NOT = "not"i !idChar
NULL = "null"i !idChar
TO = "to"i !idChar
NOW = "now"i !idChar
LAST = "last"i !idChar
THIS = "this"i !idChar
NEXT = "next"i !idChar
AGO = "ago"i !idChar
FROM = "from"i !idChar
BEFORE = "before"i !idChar
AFTER = "after"i !idChar
THROUGH = "through"i !idChar
STARTING = "starting"i !idChar
FOR = "for"i !idChar
TODAY = "today"i !idChar
YESTERDAY = "yesterday"i !idChar
TOMORROW = "tomorrow"i !idChar
AND = "and"i !idChar
OR = "or"i !idChar

MONDAY = "monday"i !idChar
TUESDAY = "tuesday"i !idChar
WEDNESDAY = "wednesday"i !idChar
THURSDAY = "thursday"i !idChar
FRIDAY = "friday"i !idChar
SATURDAY = "saturday"i !idChar
SUNDAY = "sunday"i !idChar

idChar = [a-zA-Z]

_ "optional whitespace" = [ \t]*
__ "whitespace" = [ \t]+
