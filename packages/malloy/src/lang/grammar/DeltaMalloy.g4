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

grammar DeltaMalloy;

malloyDocument
  : propStatement* EOF
  ;

propStatement
  : id COLON propertyValue
  ;

propertyValue
  : scalarValue
  | OBRACK (scalarValue COMMA?)* CBRACK
  ;

scalarValue
  : orderBySpec
  | STAR
  | topSpec
  | fieldExpr
  | id IS scalarValue
  | joinSpec
  | scalarValue ARROW scalarValue
  | scalarValue refinement
  | refinement
  | TABLE STRING_LITERAL
  | OPAREN scalarValue CPAREN
  ;

refinement
  : OCURLY propStatement* CCURLY
  ;

joinSpec
  : id IS scalarValue ON id
  | id ON id
  ;

orderBySpec
  : (INTEGER_LITERAL|id) ( ASC | DESC )
  ;

topSpec
  : INTEGER_LITERAL BY id
  | INTEGER_LITERAL BY fieldExpr
  ;

aggregate: SUM | COUNT | AVG | MIN | MAX;
malloyType: STRING | NUMBER | BOOLEAN | DATE | TIMESTAMP;
compareOp: MATCH | NOT_MATCH | GT | LT | GTE | LTE | EQ | NE;

literal
  : STRING_LITERAL                              # exprString
  | (NUMERIC_LITERAL | INTEGER_LITERAL)         # exprNumber
  | dateLiteral                                 # exprTime
  | NULL                                        # exprNULL
  | (TRUE | FALSE)                              # exprBool
  | HACKY_REGEX                                 # exprRegex
  | NOW                                         # exprNow
  ;

dateLiteral
  : LITERAL_TIMESTAMP      # literalTimestamp
  | LITERAL_DAY            # literalDay
  | LITERAL_WEEK           # literalWeek
  | LITERAL_MONTH          # literalMonth
  | LITERAL_QUARTER        # literalQuarter
  | LITERAL_YEAR           # literalYear
  ;

id
  : IDENTIFIER
  | OBJECT_NAME_LITERAL
  ;

timeframe
  : SECOND | MINUTE | HOUR | DAY | WEEK | MONTH | QUARTER | YEAR
  ;

fieldExpr
  : fieldPath                                              # exprFieldPath
  | fieldExpr refinement                                   # exprRefine
  | literal                                                # exprLiteral
  | MINUS fieldExpr                                        # exprMinus
  | fieldExpr timeframe                                    # exprDuration
  | fieldExpr DOT timeframe                                # exprTimeTrunc
  | fieldExpr DOUBLECOLON malloyType                       # exprSafeCast
  | fieldExpr ( STAR | SLASH ) fieldExpr                   # exprMulDiv
  | fieldExpr ( PLUS | MINUS ) fieldExpr                   # exprAddSub
  | fieldExpr TO fieldExpr                                 # exprRange
  | startAt=fieldExpr FOR duration=fieldExpr timeframe     # exprForRange
  | fieldExpr (AMPER | BAR) partialAllowedFieldExpr        # exprLogicalTree
  | fieldExpr compareOp fieldExpr                          # exprCompare
  | fieldExpr COLON partialAllowedFieldExpr                # exprApply
  | NOT fieldExpr                                          # exprNot
  | fieldExpr (AND | OR) fieldExpr                         # exprLogical
  | CAST OPAREN fieldExpr AS malloyType CPAREN             # exprCast
  | COUNT OPAREN DISTINCT fieldExpr CPAREN                 # exprCountDisinct
  | (fieldPath DOT)?
      aggregate
      OPAREN (fieldExpr | STAR)? CPAREN                    # exprAggregate
  | OPAREN partialAllowedFieldExpr CPAREN                  # exprExpr
  | (id | timeframe) OPAREN ( fieldExprList? ) CPAREN      # exprFunc
  | CASE caseSpec END                                      # exprCase
  | pickStatement                                          # exprPick
  ;

partialAllowedFieldExpr
  : compareOp fieldExpr                                    # exprPartialCompare
  | fieldExpr                                              # exprNotPartial
  ;

caseSpec
  : (WHEN fieldExpr THEN fieldExpr)+ (ELSE fieldExpr)?
  ;

pickStatement
  : pick+ (ELSE pickElse=fieldExpr)?
  ;

pick
  : PICK (pickValue=fieldExpr)? WHEN pickWhen=partialAllowedFieldExpr
  ;

fieldExprList
  : fieldExpr (COMMA fieldExpr)* COMMA?
  ;

// Syntactically same as a field name, but semantically, might be a parameter
fieldPath
  : id ( DOT id )*
  ;

AND: A N D ;
AS: A S ;
ASC: A S C ;
AVG: A V G ;
BOOLEAN: B O O L E A N;
BY: B Y ;
CASE: C A S E ;
CAST: C A S T ;
CONDITION: C O N D I T I O N ;
COUNT: C O U N T ;
CROSS: C R O S S ;
DATE: D A T E;
DAY: D A Y S?;
DESC: D E S C ;
DISTINCT: D I S T I N C T ;
ELSE: E L S E ;
END: E N D ;
FALSE: F A L S E;
FOR: F O R;
FROM: F R O M ;
HAS: H A S ;
HOUR: H O U R S?;
IS: I S ;
MAX: M A X;
MIN: M I N;
MINUTE: M I N U T E S?;
MONTH: M O N T H S?;
NOT: N O T ;
NOW: N O W;
NULL: N U L L ;
NUMBER: N U M B E R;
ON: O N ;
OR: O R ;
PICK: P I C K ;
QMARK: '?';
QUARTER: Q U A R T E R S?;
SECOND: S E C O N D S?;
STRING: S T R I N G;
SUM: S U M ;
TABLE: T A B L E;
THEN: T H E N ;
TIMESTAMP: T I M E S T A M P;
TO: T O;
TRUE: T R U E ;
WEEK: W E E K S?;
WHEN: W H E N ;
YEAR: Y E A R S?;

STRING_ESCAPE
  : '\\' '\''
  | '\\' '\\'
  | '\\' .;
HACKY_REGEX: ('/' | [rR]) '\'' (STRING_ESCAPE | ~('\\' | '\''))* '\'';
STRING_LITERAL: '\'' (STRING_ESCAPE | ~('\\' | '\''))* '\'';

fragment SPACE_CHAR: [ \u000B\t\r\n];

AMPER: '&';
ARROW: '->';
OPAREN: '(' ;
CPAREN: ')' ;
OBRACK: '[' ;
CBRACK: ']' ;
OCURLY: '{' ;
CCURLY: '}' ;
DOUBLECOLON: '::';
COLON: ':' ;
COMMA: ',';
DOT: '.' ;
LT: '<' ;
GT: '>' ;
EQ: '=' ;
NE: '!=' ;
LTE: '<=' ;
GTE: '>=' ;
PLUS: '+' ;
MINUS: '-' ;
STAR: '*' ;
STARSTAR: '**';
SLASH: '/' ;
BAR: '|' ;
SEMI: ';' ;
NOT_MATCH: '!~' ;
MATCH: '~' ;

fragment F_YEAR: DIGIT DIGIT DIGIT DIGIT;
fragment F_DD: DIGIT DIGIT;
fragment LX: '-' 'X' (ID_CHAR | DIGIT)+;
LITERAL_TIMESTAMP
  : '@' F_YEAR '-' F_DD '-' F_DD
    ' ' F_DD ':' F_DD ( ':' F_DD )? LX?
  ;
LITERAL_DAY:     '@' F_YEAR '-' F_DD '-' F_DD LX?;
LITERAL_QUARTER: '@' F_YEAR '-' 'Q' ('1'|'2'|'3'|'4') LX?;
LITERAL_MONTH:   '@' F_YEAR '-' F_DD LX?;
LITERAL_WEEK:    '@' W K F_YEAR '-' F_DD '-' F_DD LX?;
LITERAL_YEAR:    '@' F_YEAR LX?;

IDENTIFIER: ID_CHAR ( ID_CHAR | DIGIT )*;

INTEGER_LITERAL: DIGIT+ ;

NUMERIC_LITERAL
  : DIGIT+ ( DOT DIGIT* ) ?
  | DOT DIGIT+ (E [-+]? DIGIT+)?
  ;

OBJECT_NAME_LITERAL: '`' ID_CHAR ( ID_CHAR | DIGIT )* '`';

fragment ID_CHAR: [\p{Alphabetic}_] ;
fragment DIGIT: [0-9];
fragment A: [aA] ; fragment B: [bB] ; fragment C: [cC] ; fragment D: [dD] ;
fragment E: [eE] ; fragment F: [fF] ; fragment G: [gG] ; fragment H: [hH] ;
fragment I: [iI] ; fragment J: [jJ] ; fragment K: [kK] ; fragment L: [lL] ;
fragment M: [mM] ; fragment N: [nN] ; fragment O: [oO] ; fragment P: [pP] ;
fragment Q: [qQ] ; fragment R: [rR] ; fragment S: [sS] ; fragment T: [tT] ;
fragment U: [uU] ; fragment V: [vV] ; fragment W: [wW] ; fragment X: [xX] ;
fragment Y: [yY] ; fragment Z: [zZ] ;

BLOCK_COMMENT: '/*' .*? '*/' -> channel(HIDDEN);
DOUBLE_DASH_COMMENT: '--' ~[\r\n]* (('\r'? '\n') | EOF) -> channel(HIDDEN) ;
WHITE_SPACE: SPACE_CHAR -> skip ;

// Matching any of these is a parse error
UNWATED_CHARS_TRAILING_NUMBERS: DIGIT+ ID_CHAR+ (ID_CHAR | DIGIT)*;
UNEXPECTED_CHAR: .;
