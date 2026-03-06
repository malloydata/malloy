/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

{{
const {conjoin, maybeNot, matchOp} = require('../clause_utils');
}}

stringFilter
  = _ head:sfUnary tail:(_ conjunction _ sfUnary)*
    {
      return tail.reduce((left, [, cop, , right]) => conjoin(left, cop, right), head);
    }

sfUnary
  = "-" _ clause:clause { return maybeNot([true, clause]); }
  / clause:clause { return clause; }

clause
  = "(" _ expr:stringFilter _ ")" { return {operator: "()", expr}; }
  / str:matchStr { return matchOp(str); }

matchStr "match string"
  = s:$(("\\" . / [^\n,;()|])+) { return s; }

conjunction
  = "," { return ","; }
  / ";" { return ";"; }
  / "|" { return "|"; }

_ "whitespace" = [ \t]*
