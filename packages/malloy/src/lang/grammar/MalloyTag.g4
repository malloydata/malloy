/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
grammar MalloyTag;

// mtoy TODO error recovery?
tagLine: tagSpec* EOF;

tagSpec
  : propName EQ eqValue properties?    # tagEq
  | propName EQ DOTTY? properties      # tagReplaceProperties
  | propName properties                # tagUpdateProperties
  | MINUS? propName                    # tagDef
  ;

string
  : SQ_STRING
  | NUMERIC_LITERAL
  | DQ_STRING
  | BARE_STRING;

propName: string (DOT string)*;

eqValue
  : string
  | arrayValue
  | reference
  ;

arrayElement
  : string properties?
  | properties
  | arrayValue
  | reference
  ;

reference: RF_BEG propName RF_END;

arrayValue: AR_BEG arrayElement (COMMA arrayElement)* COMMA? AR_END;
properties: PR_BEG (DOTTY | (tagSpec*)) PR_END;

DOTTY: '...';
DOT: '.';
MINUS: '-';
EQ: '=';
RF_BEG: '$(';
RF_END: ')';
PR_BEG: '{';
PR_END: '}';
AR_BEG: '[';
COMMA: ',';
AR_END: ']';

fragment ID_CHAR: [\p{Alphabetic}_] ;
fragment DIGIT: [0-9];
fragment HEX: [0-9a-fA-F];
fragment UNICODE: '\\u' HEX HEX HEX HEX;
fragment SAFE_NON_QUOTE: ~ ['"`\\\u0000-\u001F];
fragment ESCAPED: '\\' .;
SQ_STRING: '\'' (UNICODE | ESCAPED | SAFE_NON_QUOTE | ["`])* '\'';
DQ_STRING: '"' (UNICODE | ESCAPED | SAFE_NON_QUOTE | ['`])* '"';
fragment INTEGER_LITERAL: MINUS? DIGIT+;
fragment EXPONENT: [Ee] [+-]? DIGIT+;
NUMERIC_LITERAL
  : INTEGER_LITERAL? DOT DIGIT+ EXPONENT?
  | INTEGER_LITERAL EXPONENT?
  ;

BARE_STRING: (DIGIT | ID_CHAR)+;

// mtoy todo understand why the ? needs to be here
COMMENT: '#' .*? EOF -> skip;
WHITE_SPACE:  [ \u000B\t\r\n]+ -> skip;

UNEXPECTED_CHAR: .;
