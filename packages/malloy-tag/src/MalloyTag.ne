#
# Copyright Contributors to the Malloy project
# SPDX-License-Identifier: MIT
#

@preprocessor typescript
@{%
import moo from 'moo';

// hack around lack of \{Alphabetic} ... vibe coded, mtoy TODO test
const ALPHA = 'a-zA-Z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u1E00-\\u1EFF_';
export const tag_lexer = moo.compile({
  WS: /[\t ]+/,
  NL: { match: /\n/, lineBreaks: true },
  SQ_STRING: /'(?:[^\\']|\\.)*'/,
  DQ_STRING: /"(?:[^\\"]|\\.)*"/,
  BQ_STRING: /`(?:[^\\`]|\\.)*`/,
  BARE_STRING: new RegExp(`[${ALPHA}][${ALPHA}0-9]*`),
  MINUS_DOTTY: '-...',
  DOTTY: '...',
  EQ: '=',
  PR_BEG: '{',
  PR_END: '}',
  AR_BEG: '[',
  AR_END: ']',
  COMMA: ',',
  FLOAT: /-?(?:\d+\.\d*|\d*\.\d+)(?:[Ee][+-]?\d+)?/,
  NUMBERE: /-?\d+(?:[Ee][+-]?\d+)?/,
  DOT: '.',
  MINUS: '-',
});

const actual_next = tag_lexer.next;
tag_lexer.next = (next => () => {
  for (;;) {
    const token = next.call(tag_lexer);
    if (token && (token.type === 'WS' || token.type === 'NL')) {
      continue;
    }
    return token;
  }
})(actual_next);

import * as ast from "../new-tag-ast"
%}

@lexer tag_lexer

tagLine -> tagSpec:* {% ast.createTagLine %}

# Defines the different forms a tag specification can take
tagSpec ->
      propName %EQ eqValue properties:?  {% ast.createTagSpec_EqValue %}
    | propName %EQ %DOTTY:? properties   {% ast.createTagSpec_EqDotty %}
    | propName properties                {% ast.createTagSpec_PropOnly %}
    | %MINUS:? propName                  {% ast.createTagSpec_MinusProp %}
    | %MINUS_DOTTY                       {% ast.createTagSpec_MinusDotty %}

# String literals can be single-quoted, double-quoted, or bare
string ->
      %SQ_STRING      {% ast.createStringLiteral %}
    | %DQ_STRING      {% ast.createStringLiteral %}
    | %BARE_STRING    {% ast.createStringLiteral %}

# Identifiers can be back-ticked or bare strings
identifier ->
      %BQ_STRING      {% ast.createIdentifier %}
    | %BARE_STRING    {% ast.createIdentifier %}

# A property name can be a single identifier or a dot-separated path
propName -> identifier (%DOT identifier):* {% ast.createPropName %}

number ->
    %FLOAT     {% ast.createNumberLiteral %}
  | %NUMBERE   {% ast.createNumberLiteral %}

# The value on the right side of an equals sign
eqValue ->
      string        {% ast.processEqValue %}
    | number        {% ast.processEqValue %}
    | arrayValue    {% ast.processEqValue %}

# An element within an array
arrayElement ->
      string properties:?  {% ast.createArrayElement_String %}
    | number               {% ast.createArrayElement_Node %}
    | arrayValue           {% ast.createArrayElement_Node %}
    | properties           {% ast.createArrayElement_Node %}


# A comma-separated list of array elements
elementList -> arrayElement (%COMMA arrayElement):* %COMMA:?  {% ast.createElementList %}

# An array, which contains a list of elements
arrayValue -> %AR_BEG elementList:? %AR_END                  {% ast.createArrayValue %}

# A properties block, which contains more tag specifications
properties -> %PR_BEG %DOTTY:? tagSpec:* %PR_END              {% ast.createProperties %}