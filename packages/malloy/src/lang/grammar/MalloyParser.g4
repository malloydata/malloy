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

parser grammar MalloyParser;
options { tokenVocab=MalloyLexer; }

malloyDocument: (malloyStatement | SEMI)* EOF;

malloyStatement
  : defineSourceStatement
  | defineSQLStatement
  | defineQuery
  | importStatement
  ;

defineSourceStatement
  : SOURCE sourcePropertyList
  ;

defineQuery
  : QUERY topLevelQueryDefs      # namedQueries_stub
  | QUERY topLevelAnonQueryDef   # anonymousQuery
  ;

topLevelAnonQueryDef
  : query
  ;

defineSQLStatement
  : SQL (nameSQLBlock IS)? sqlBlock
  ;

sqlBlock
  : OCURLY blockSQLDef+ CCURLY
  ;

blockSQLDef
  : CONNECTION connectionName
  | SELECT sqlString
  ;

sqlString
  : SQL_BEGIN sqlInterpolation* SQL_END
  ;

sqlInterpolation
  : OPEN_CODE query CLOSE_CODE
  ;

importStatement
  : IMPORT importURL
  ;

importURL
  : JSON_STRING
  ;

topLevelQueryDefs
  : topLevelQueryDef (COMMA? topLevelQueryDef)* COMMA?
  ;

topLevelQueryDef
  : queryName IS query
  ;

refineOperator: PLUS ;

query
  : explore ARROW pipelineFromName                  # exploreArrowQuery
  | ARROW queryName (refineOperator? queryProperties)? pipeElement*   # arrowQuery
  ;

pipelineFromName
  : firstSegment pipeElement*
  ;

firstSegment
  : queryProperties
  | exploreQueryName (refineOperator? queryProperties)?
  ;

pipeElement
  : ARROW queryProperties
  ;

exploreTable
  : TABLE OPAREN tableName CPAREN
  ;

queryProperties
  : filterShortcut
  | OCURLY (queryStatement | SEMI)* CCURLY
  ;

filterShortcut
  : OCURLY QMARK fieldExpr CCURLY
  ;

exploreQueryName : id;
queryName : id;

sourcePropertyList
  : sourceDefinition (COMMA? sourceDefinition)* COMMA?
  ;

sourceDefinition
  : sourceNameDef IS explore
  ;

explore
  : exploreSource (refineOperator? exploreProperties)?
  ;

exploreSource
  : sourceID                                      # NamedSource
  | exploreTable                                  # TableSource
  | FROM OPAREN query CPAREN                      # QuerySource
  | FROM_SQL OPAREN sqlExploreNameRef CPAREN      # SQLSourceName
  ;

sourceNameDef: id;
sourceID: id;

exploreProperties
  : OCURLY (exploreStatement | SEMI)* CCURLY
  | filterShortcut
  ;

exploreStatement
  : DIMENSION defList                  # defExploreDimension
  | MEASURE defList                    # defExploreMeasure
  | declareStatement                   # defDeclare_stub
  | joinStatement                      # defJoin_stub
  | whereStatement                     # defExploreWhere
  | PRIMARY_KEY fieldName              # defExplorePrimaryKey
  | RENAME renameList                  # defExploreRename
  | (ACCEPT | EXCEPT) fieldNameList    # defExploreEditField
  | QUERY subQueryDefList              # defExploreQuery
  | timezoneStatement                  # defExploreTimezone
  ;

renameList
  : exploreRenameDef (COMMA? exploreRenameDef)* COMMA?
  ;

exploreRenameDef
  : fieldName IS fieldName
  ;

defList
  : fieldDef (COMMA? fieldDef)* COMMA?
  ;

fieldDef
  : fieldNameDef IS fieldExpr
  ;

fieldNameDef: id;
joinNameDef: id;

declareStatement
  : DECLARE defList
  ;

joinStatement
  : JOIN_ONE joinList                  # defJoinOne
  | JOIN_MANY joinList                 # defJoinMany
  | JOIN_CROSS joinList                # defJoinCross
  ;

joinList
  : joinDef (COMMA? joinDef)* COMMA?
  ;

joinDef
  : joinNameDef (IS explore)? WITH fieldExpr        # joinWith
  | joinNameDef (IS explore)? (ON joinExpression)?  # joinOn
  ;

joinExpression: fieldExpr;

filterStatement
  : whereStatement
  | havingStatement
  ;

filteredBy
  : QMARK fieldExpr                   # filterByShortcut
  | whereStatement                    # filterByWhere
  ;

filterClauseList
  : fieldExpr (COMMA fieldExpr)* COMMA?
  ;

whereStatement
  : WHERE filterClauseList
  ;

havingStatement
  : HAVING filterClauseList
  ;

subQueryDefList
  : exploreQueryDef (COMMA? exploreQueryDef)* COMMA?
  ;

exploreQueryNameDef: id;

exploreQueryDef
  : exploreQueryNameDef IS pipelineFromName
  ;

queryStatement
  : groupByStatement
  | declareStatement
  | joinStatement
  | projectStatement
  | indexStatement
  | aggregateStatement
  | calculateStatement
  | topStatement
  | limitStatement
  | orderByStatement
  | whereStatement
  | havingStatement
  | nestStatement
  | sampleStatement
  | timezoneStatement
  ;

groupByStatement
  : GROUP_BY queryFieldList
  ;

queryFieldList
  : queryFieldEntry (COMMA? queryFieldEntry)* COMMA?
  ;


queryFieldEntry
  : fieldPath
  | fieldDef
  ;

nestStatement
  : NEST nestedQueryList
  ;

nestedQueryList
  : nestEntry (COMMA? nestEntry)* COMMA?
  ;

nestEntry
  : queryName (refineOperator? queryProperties)?      # nestExisting
  | queryName IS pipelineFromName   # nestDef
  ;

aggregateStatement
  : AGGREGATE queryFieldList
  ;

calculateStatement
  : CALCULATE queryFieldList
  ;

projectStatement
  : PROJECT fieldCollection
  ;

orderByStatement
  : ORDER_BY ordering
  ;

ordering
  : orderBySpec (COMMA? orderBySpec)* COMMA?
  ;

orderBySpec
  : (INTEGER_LITERAL | fieldName) ( ASC | DESC ) ?
  ;

limitStatement
  : LIMIT INTEGER_LITERAL
  ;

bySpec
  : BY fieldName
  | BY fieldExpr
  ;

topStatement
  : TOP INTEGER_LITERAL bySpec?
  ;

indexElement
  : fieldPath (DOT STAR)?
  | STAR
  | STARSTAR
  ;

indexFields
  : indexElement ( COMMA? indexElement )*
  ;

indexStatement
  : INDEX indexFields (BY fieldName)?
  ;

sampleStatement
  : SAMPLE sampleSpec
  ;

timezoneStatement
  : TIMEZONE STRING_LITERAL
  ;

sampleSpec
  : PERCENT_LITERAL
  | INTEGER_LITERAL
  | TRUE
  | FALSE;


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
  | LITERAL_HOUR           # literalHour
  | LITERAL_DAY            # literalDay
  | LITERAL_WEEK           # literalWeek
  | LITERAL_MONTH          # literalMonth
  | LITERAL_QUARTER        # literalQuarter
  | LITERAL_YEAR           # literalYear
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

ungroup
  : ALL | EXCLUDE
  ;

fieldExpr
  : fieldPath                                              # exprFieldPath
  | fieldExpr OCURLY filteredBy CCURLY                     # exprFilter
  | literal                                                # exprLiteral
  | fieldExpr timeframe                                    # exprDuration
  | fieldExpr DOT timeframe                                # exprTimeTrunc
  | fieldExpr DOUBLECOLON malloyType                       # exprSafeCast
  | MINUS fieldExpr                                        # exprMinus
  | fieldExpr ( STAR | SLASH | PERCENT ) fieldExpr         # exprMulDiv
  | fieldExpr ( PLUS | MINUS ) fieldExpr                   # exprAddSub
  | fieldExpr TO fieldExpr                                 # exprRange
  | startAt=fieldExpr FOR duration=fieldExpr timeframe     # exprForRange
  | fieldExpr AMPER partialAllowedFieldExpr                # exprAndTree
  | fieldExpr BAR partialAllowedFieldExpr                  # exprOrTree
  | fieldExpr compareOp fieldExpr                          # exprCompare
  | fieldExpr QMARK partialAllowedFieldExpr                # exprApply
  | NOT fieldExpr                                          # exprNot
  | fieldExpr AND fieldExpr                                # exprLogicalAnd
  | fieldExpr OR fieldExpr                                 # exprLogicalOr
  | fieldExpr DOUBLE_QMARK fieldExpr                       # exprCoalesce
  | CAST OPAREN fieldExpr AS malloyType CPAREN             # exprCast
  | COUNT OPAREN DISTINCT fieldExpr CPAREN                 # exprCountDisinct
  | (fieldPath DOT)?
      aggregate
      OPAREN (fieldExpr | STAR)? CPAREN                    # exprAggregate
  | OPAREN partialAllowedFieldExpr CPAREN                  # exprExpr
  | (fieldPath DOT)?
      id
      OPAREN ( argumentList? ) CPAREN                      # exprAggFunc
  | ((id (EXCLAM malloyType?)?) | timeframe)
    OPAREN ( argumentList? ) CPAREN                        # exprFunc
  | pickStatement                                          # exprPick
  | ungroup OPAREN fieldExpr (COMMA fieldName)* CPAREN     # exprUngroup
  ;

partialAllowedFieldExpr
  : compareOp? fieldExpr
  ;

pickStatement
  : pick+ (ELSE pickElse=fieldExpr)?
  ;

pick
  : PICK (pickValue=fieldExpr)? WHEN pickWhen=partialAllowedFieldExpr
  ;

argumentList
  : fieldExpr (COMMA fieldExpr)* COMMA?
  ;

fieldNameList
  : fieldName (COMMA? fieldName)*
  ;

fieldCollection
  : collectionMember (COMMA? collectionMember)* COMMA?
  ;

collectionWildCard
  : (fieldPath DOT)? (STAR|STARSTAR)
  ;

collectionMember
  : fieldPath
  | collectionWildCard
  | fieldDef
  ;

fieldPath
  : fieldName (DOT fieldName)*
  ;

joinName: id;
fieldName: id;

justExpr: fieldExpr EOF;

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

sqlExploreNameRef: id;
nameSQLBlock: id;
connectionName: JSON_STRING;
