/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

{{
const {numNot, mkRange, joinNumbers, mkValues} = require('../clause_utils');
}}

numberFilter
  = head:numberUnary tail:(_ conjunction _ numberUnary)*
    {
      return tail.reduce((left, [, cop, , right]) => joinNumbers(left, cop, right), head);
    }

numberUnary
  = not:NOT _ clause:clause { return numNot(clause, not); }
  / clause:clause { return clause; }

clause
  = NULL { return {operator: 'null'}; }
  / "(" _ expr:numberFilter _ ")" { return {operator: "()", expr}; }
  / open:openInterval _ b:N _ TO _ e:N _ close:closeInterval { return mkRange(open, b, e, close); }
  / "!=" _ n:N nList:(_ "," _ N)* { return {operator: '!=', ...mkValues(n, nList.map(x => x[3]))}; }
  / "=" _ n:N nList:(_ "," _ N)* { return {operator: '=', ...mkValues(n, nList.map(x => x[3]))}; }
  / op:$("<=" / ">=" / "<" / ">") _ n:N { return {operator: op, values: [n]}; }
  / n:N nList:(_ "," _ N)* { return {operator: '=', ...mkValues(n, nList.map(x => x[3]))}; }

openInterval = "[" { return "["; } / "(" { return "("; }
closeInterval = "]" { return "]"; } / ")" { return ")"; }

N = n:$("-"? ([0-9]+ "."? [0-9]* / [0-9]* "." [0-9]+) ([Ee] [+-]? [0-9]+)?) { return n; }

conjunction
  = OR { return "or"; }
  / AND { return "and"; }

NOT = "not"i !idChar { return "not"; }
NULL = "null"i !idChar
AND = "and"i !idChar
OR = "or"i !idChar
TO = "to"i !idChar

idChar = [a-zA-Z]

_ "whitespace" = [ \t]*
