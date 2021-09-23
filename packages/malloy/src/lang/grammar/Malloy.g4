/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

grammar Malloy;

malloyDocument
  : malloyStatement* EOF
  ;

malloyStatement
  : defineStatement
  | importStatement
  | namelessQuery
  | SEMI
  ;

defineStatement
  : EXPORT? DEFINE? id (OPAREN has+ CPAREN)? IS defineValue
  ;

has
  : HAS id COLON malloyType            # requiredConditionParam
  | HAS id COLON malloyType OR hasCond # optionalConditionParam
  | HAS id malloyType                  # requiredValueParam
  | HAS id malloyType OR hasExpr       # optionalValueParam
  | HAS id hasExpr                     # constantParam
  ;

hasCond
  : partialAllowedFieldExpr
  ;

hasExpr
  : fieldExpr
  ;

defineValue
  : OPAREN explore CPAREN  # defFromExplore
  | JSON json              # defFromJson
  ;

 importStatement
  : IMPORT quotedURL
  ;

quotedURL
  : JSON_STRING
  ;

 namelessQuery
  : explore
  ;

explore
  : EXPLORE? exploreSource filterList?
      primaryKey? fieldListEdit? (FIELDS? fieldDefList)? joinList?
      (BAR pipeline)?
  ;

exploreSource
  : id (OPAREN isParam+ CPAREN)*   # namedSource
  | tableName                      # tableSource
  | OPAREN explore CPAREN          # anonymousSource
  ;

isParam
  : id IS isExpr
  ;

isExpr
  : partialAllowedFieldExpr
  ;

primaryKey
  : PRIMARY KEY id
  ;

fieldListEdit
  : ( ACCEPT | EXCEPT ) fieldNameCollection
  ;

joinList
  : JOINS join (COMMA join)* COMMA?
  ;

joinDef
  : id IS JOIN COLON? exploreSource? ON fieldName
  ;

join
  : id ON fieldName                     # joinOn
  | id IS exploreSource ON fieldName    # joinSource
  ;

pipeline
  : fieldName filterList? (BAR pipeStages)?
  | pipeStages
  ;

pipeStages
  : queryStage (BAR queryStage)*
  ;
orderLimit
  : orderBy? limit?
  ;

queryStage
  : REDUCE stageStmt* fieldDefList orderLimit                     # reduceStage
  | PROJECT stageStmt* fieldDefList orderLimit                    # projectStage
  | INDEX filterList? fieldNameCollection* (ON fieldName)? limit? # indexStage
  ;

bySpec
  : BY id         # byName
  | BY fieldExpr  # byExpression
  ;

topSpec
  : TOP INTEGER_LITERAL bySpec?
  ;

stageStmt
  : orderBy
  | limit
  | topSpec
  | filterList
  ;

topStmt
  : bySpec
  | orderBy
  | filterList
  ;

orderBy
  : ORDER BY orderBySpec (COMMA orderBySpec)* COMMA?
  ;

orderBySpec
  : (INTEGER_LITERAL|id) ( ASC | DESC ) ?
  ;

limit
  : LIMIT INTEGER_LITERAL
  ;

filterList
  : COLON OBRACK boolFilter CBRACK
  ;

boolFilter
  : filterElement ( COMMA filterElement )* COMMA?
  ;

// for the filter parse walker .. TODO not sure we need this
filterElement: fieldExpr ;

fieldDefList
  : fieldDef ( COMMA? fieldDef )* COMMA?
  ;

fieldDef
  : id RENAMES id                               # renameFieldDef
  | fieldNameCollection                         # fieldReflist
  | defineName fieldName filterList?            # nameOnlyDef
  | defineName fieldExpr                        # expressionFieldDef
  | defineName TURTLE? OPAREN pipeline CPAREN   # turtleFieldDef
  | joinDef                                     # joinFieldDef
  ;

defineName
  : DEFINE? id IS
  ;

fieldExpr
  : idReference                                            # exprIdReference
  | fieldExpr filterList                                   # exprFilter
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
  | (fieldName DOT)?
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

fieldNameCollection
  : collectionMember (COMMA collectionMember)* COMMA?
  ;

collectionMember
  : fieldName                         # nameMember
  | (fieldName DOT)? (STAR|STARSTAR)  # wildMember
  ;

fieldName
  : idReference
  ;

// Syntactically same as a field name, but semantically, might be a parameter
idReference
  : id ( DOT id )*
  ;

tableName
  : STRING_LITERAL;

id
  : IDENTIFIER
  | OBJECT_NAME_LITERAL
  ;

timeframe
  : SECOND | MINUTE | HOUR | DAY | WEEK | MONTH | QUARTER | YEAR
  ;

json
  : jsonValue
  ;

jsonValue
   : JSON_STRING
   | INTEGER_LITERAL
   | NUMERIC_LITERAL
   | jsonObject
   | jsonArray
   | TRUE
   | FALSE
   | NULL
   ;

jsonObject
   : OCURLY jsonProperty (COMMA jsonProperty)* CCURLY
   | OCURLY CCURLY
   ;

jsonProperty
   : JSON_STRING COLON jsonValue
   ;

jsonArray
   : OBRACK jsonValue (COMMA jsonValue)* CBRACK
   | OBRACK CBRACK
   ;

JSON_STRING: '"' (ESC | SAFECODEPOINT)* '"';

fragment ESC: '\\' (["\\/bfnrt] | UNICODE);
fragment UNICODE: 'u' HEX HEX HEX HEX;
fragment HEX: [0-9a-fA-F];
fragment SAFECODEPOINT: ~ ["\\\u0000-\u001F];

ACCEPT: A C C E P T ;
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
DEFINE: D E F I N E ;
DESC: D E S C ;
DISTINCT: D I S T I N C T ;
ELSE: E L S E ;
END: E N D ;
EXCEPT: E X C E P T ;
EXPLORE: E X P L O R E ;
EXPORT: E X P O R T ;
FALSE: F A L S E;
FIELDS: F I E L D S;
FOREIGN: F O R E I G N ;
FOR: F O R;
FROM: F R O M ;
HAS: H A S ;
HOUR: H O U R S?;
IMPORT: I M P O R T;
INDEX: I N D E X ;
IS: I S ;
JOIN: J O I N (E D)?;
JOINS: J O I N S;
JSON: J S O N;
KEY: K E Y ;
LAST: L A S T ;
LIMIT: L I M I T;
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
ORDER: O R D E R ;
PICK: P I C K ;
PIVOT: P I V O T ;
PRIMARY: P R I M A R Y ;
PROJECT: P R O J E C T ;
QUARTER: Q U A R T E R S?;
REDUCE: R E D U C E ;
RENAMES: R E N A M E S ;
SECOND: S E C O N D S?;
STRING: S T R I N G;
SUM: S U M ;
THEN: T H E N ;
THIS: T H I S;
TIMESTAMP: T I M E S T A M P;
TO: T O;
TOP: T O P;
TRUE: T R U E ;
TURTLE: T U R T L E;
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
