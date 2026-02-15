/*
 * Copyright 2023 Google LLC
 * Copyright (c) Meta Platforms, Inc. and affiliates.
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
  | defineQuery
  | importStatement
  | runStatement
  | docAnnotations
  | ignoredObjectAnnotations
  | experimentalStatementForTesting
  ;

defineSourceStatement
  : tags SOURCE sourcePropertyList
  ;

defineQuery
  : topLevelQueryDefs                 # use_top_level_query_defs
  ;

topLevelAnonQueryDef
  : tags sqExpr
  ;

tags
  : ANNOTATION*
  ;

isDefine
  : beforeIs=tags IS afterIs=tags
  ;

runStatement
  : tags RUN topLevelAnonQueryDef
  ;

sqlString
  : SQL_BEGIN sqlInterpolation* SQL_END
  ;

sqlInterpolation
  : OPEN_CODE sqExpr CCURLY
  ;

importStatement
  : IMPORT importSelect? importURL
  ;

importSelect
  : OCURLY
    importItem (COMMA importItem)*
    CCURLY FROM
  ;

importItem
  : id (IS id)?
  ;

importURL
  : string
  ;

docAnnotations
  : DOC_ANNOTATION+
  ;

ignoredObjectAnnotations
  : ANNOTATION+
  ;

ignoredModelAnnotations
  : DOC_ANNOTATION+
  ;

topLevelQueryDefs
  : tags QUERY topLevelQueryDef (COMMA? topLevelQueryDef)* COMMA?
  ;

topLevelQueryDef
  : tags queryName isDefine sqExpr
  ;

refineOperator: PLUS ;

turtleName
  : id;

sqlSource
  : connectionId DOT SQL OPAREN (sqlString|shortString) CPAREN
  ;

exploreTable
  : connectionId DOT TABLE OPAREN tablePath CPAREN
  ;

connectionId
  : id;

queryProperties
  : OCURLY (queryStatement | SEMI)* CCURLY
  ;

queryName : id;

sourcePropertyList
  : sourceDefinition (COMMA? sourceDefinition)* COMMA?
  ;

sourceDefinition
  : tags sourceNameDef sourceParameters? isDefine sqExplore
  ;

sqExplore
  : sqExpr
  ;

sourceParameters
  : OPAREN CPAREN
  | OPAREN sourceParameter (COMMA sourceParameter)* CPAREN
  ;

legalParamType
  : malloyBasicType
  | FILTER LT malloyBasicType GT;

sourceParameter
  : parameterNameDef (DOUBLECOLON legalParamType)? (IS fieldExpr)?
  ;

parameterNameDef: id;
sourceNameDef: id;

exploreProperties
  : OCURLY (exploreStatement | SEMI)* CCURLY
  ;

exploreStatement
  : defDimensions                            # defExploreDimension_stub
  | defMeasures                              # defExploreMeasure_stub
  | joinStatement                            # defJoin_stub
  | whereStatement                           # defExploreWhere_stub
  | PRIMARY_KEY fieldName                    # defExplorePrimaryKey
  | tags accessLabel? RENAME renameList      # defExploreRename
  | (ACCEPT | EXCEPT) fieldNameList          # defExploreEditField
  | tags accessLabel? VIEW subQueryDefList   # defExploreQuery
  | timezoneStatement                        # defExploreTimezone
  | ANNOTATION+                              # defExploreAnnotation
  | ignoredModelAnnotations                  # defIgnoreModel_stub
  ;


accessLabel
  : PUBLIC_KW
  | PRIVATE_KW
  | INTERNAL_KW
  ;

accessModifierList
  : fieldNameList
  | STAR starQualified?
  ;

defMeasures
  : tags accessLabel? MEASURE defList
  ;

defDimensions
  : tags accessLabel? DIMENSION defList
  ;

renameList
  : renameEntry (COMMA? renameEntry)* COMMA?
  ;

renameEntry
  : tags fieldName isDefine fieldName
  ;

defList
  : fieldDef (COMMA? fieldDef)* COMMA?
  ;

fieldDef
  : tags fieldNameDef isDefine fieldExpr
  ;

fieldNameDef: id;
joinNameDef: id;

declareStatement
  : DECLARE accessLabel? defList
  ;

joinStatement
  : tags accessLabel? JOIN_ONE joinList                  # defJoinOne
  | tags accessLabel? JOIN_MANY joinList                 # defJoinMany
  | tags accessLabel? JOIN_CROSS joinList                # defJoinCross
  ;

queryExtend
  : EXTENDQ queryExtendStatementList
  ;

modEither
  : joinStatement
  | whereStatement
  | declareStatement
  ;

sourceArguments
  : OPAREN CPAREN
  | OPAREN sourceArgument (COMMA sourceArgument)* CPAREN
  ;

argumentId
  : id
  ;

sourceArgument
  : (argumentId IS)? fieldExpr
  ;

sqExpr
  : id sourceArguments?                                      # SQID
  | OPAREN sqExpr CPAREN                                     # SQParens
  | COMPOSE OPAREN (sqExpr (COMMA sqExpr)*)? CPAREN          # SQCompose
  | sqExpr PLUS segExpr                                      # SQRefinedQuery
  | sqExpr ARROW segExpr                                     # SQArrow
  | sqExpr (INCLUDE includeBlock)? EXTEND exploreProperties  # SQExtendedSource
  | sqExpr INCLUDE includeBlock                              # SQInclude
  | exploreTable                                             # SQTable
  | sqlSource                                                # SQSQL
  ;

includeBlock
  : OCURLY (includeItem | SEMI)* CCURLY
  ;

includeItem
  : tags accessLabelProp includeList
  | includeList
  | tags EXCEPT includeExceptList
  | orphanedAnnotation
  ;

orphanedAnnotation
  : ANNOTATION
  ;

accessLabelProp
  : PUBLIC
  | PRIVATE
  | INTERNAL
  ;

includeExceptList
  : includeExceptListItem (COMMA? includeExceptListItem)* COMMA?
  ;

includeExceptListItem
  : tags fieldPath
  | tags collectionWildCard
  ;

includeList
  : includeField (COMMA? includeField)* COMMA?
  ;

includeField
  : tags (as=fieldName isDefine)? name=fieldPath
  | tags name=fieldPath
  | tags collectionWildCard
  ;

segExpr
  : fieldPath                      # SegField
  | queryProperties                # SegOps
  | OPAREN vExpr CPAREN            # SegParen
  | lhs=segExpr PLUS rhs=segExpr   # SegRefine
  ;

vExpr
  : segExpr                        # VSeg
  | lhs=segExpr ARROW rhs=vExpr    # VArrow
  ;

queryExtendStatement
  : defDimensions
  | defMeasures
  | joinStatement
  ;

queryExtendStatementList
  : OCURLY (queryExtendStatement | SEMI)* CCURLY
  ;

joinList
  : joinDef (COMMA? joinDef)* COMMA?
  ;

isExplore
  : before_is=tags IS after_is=tags sqExpr
  ;

matrixOperation : (LEFT | RIGHT | FULL| INNER);

joinFrom
  : joinNameDef
  | joinNameDef sourceArguments
  | joinNameDef isExplore
  ;

joinDef
  : ANNOTATION* joinFrom matrixOperation? WITH fieldExpr        # joinWith
  | ANNOTATION* joinFrom (matrixOperation? ON joinExpression)?  # joinOn
  ;

joinExpression: fieldExpr;

filterStatement
  : whereStatement
  | havingStatement
  ;

fieldProperties
  : OCURLY (fieldPropertyStatement | SEMI)* CCURLY
  ;

aggregateOrdering
  : aggregateOrderBySpec (COMMA aggregateOrderBySpec)* COMMA?
  ;

aggregateOrderBySpec
  : fieldExpr ( ASC | DESC ) ?
  | ASC
  | DESC
  ;

aggregateOrderByStatement
  : ORDER_BY aggregateOrdering
  ;

fieldPropertyLimitStatement
  : limitStatement
  ;

fieldPropertyStatement
  : whereStatement
  | partitionByStatement
  | aggregateOrderByStatement
  | fieldPropertyLimitStatement
  | groupedByStatement
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
  : ANNOTATION* exploreQueryNameDef isDefine vExpr
  ;

drillStatement
  : DRILL drillClauseList
  ;

drillClauseList
  : fieldExpr (COMMA fieldExpr)* COMMA?
  ;

queryStatement
  : groupByStatement
  | declareStatement
  | queryJoinStatement
  | queryExtend
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
  | drillStatement
  | queryAnnotation
  | ignoredModelAnnotations
  ;

queryJoinStatement
  : joinStatement
  ;

groupByStatement
  : tags GROUP_BY queryFieldList
  ;

queryFieldList
  : queryFieldEntry (COMMA? queryFieldEntry)* COMMA?
  ;


queryFieldEntry
  : taggedRef
  | fieldDef
  ;

nestStatement
  : tags NEST nestedQueryList
  ;

nestedQueryList
  : nestEntry (COMMA? nestEntry)* COMMA?
  ;

nestEntry
  : tags (queryName isDefine)? vExpr   # nestDef
  ;

aggregateStatement
  : tags AGGREGATE queryFieldList
  ;

calculateStatement
  : tags CALCULATE queryFieldList
  ;

projectStatement
  : tags SELECT fieldCollection
  ;

partitionByStatement
  : PARTITION_BY id (COMMA id)* COMMA?
  ;

groupedByStatement
  : GROUPED_BY id (COMMA id)* COMMA?
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
  : TOP INTEGER_LITERAL
  ;

indexElement
  : fieldPath (DOT STAR)?
  | STAR
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
  : TIMEZONE string
  ;

queryAnnotation
  : ANNOTATION
  ;

sampleSpec
  : PERCENT_LITERAL
  | INTEGER_LITERAL
  | TRUE
  | FALSE;


aggregate: SUM | COUNT | AVG | MIN | MAX;
malloyType
  : malloyBasicType
  | malloyRecordType
  | malloyType OBRACK CBRACK
  ;

malloyBasicType
  : STRING | NUMBER | BOOLEAN | DATE | TIMESTAMP | TIMESTAMPTZ
  ;

malloyRecordType
  : OCURLY malloyRecordField (COMMA malloyRecordField)* COMMA? CCURLY
  ;

malloyRecordField
  : id DOUBLECOLON malloyType
  ;
compareOp: MATCH | NOT_MATCH | GT | LT | GTE | LTE | EQ | NE;

string
  : shortString
  | sqlString
  ;

shortString
  : (SQ_STRING | DQ_STRING)
  ;

rawString
  : RAW_SQ
  | RAW_DQ
  ;

numericLiteral
  : (NUMERIC_LITERAL | INTEGER_LITERAL)
  ;

literal
  : string                                      # exprString
  | rawString                                   # stub_rawString
  | numericLiteral                              # exprNumber
  | dateLiteral                                 # exprTime
  | NULL                                        # exprNULL
  | (TRUE | FALSE)                              # exprBool
  | HACKY_REGEX                                 # exprRegex
  | filterString                                # filterString_stub
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

tablePath: string;
tableURI: string;

id
  : IDENTIFIER
  | BQ_STRING
  ;


timeframe
  : SECOND | MINUTE | HOUR | DAY | WEEK | MONTH | QUARTER | YEAR
  ;

ungroup
  : ALL | EXCLUDE
  ;

malloyOrSQLType
  : malloyType
  | string
  ;

fieldExpr
  : fieldPath                                              # exprFieldPath
  | literal                                                # exprLiteral
  | OBRACK fieldExpr (COMMA fieldExpr)* COMMA? CBRACK      # exprArrayLiteral
  | OCURLY recordElement (COMMA recordElement)* CCURLY     # exprLiteralRecord
  | fieldExpr fieldProperties                              # exprFieldProps
  | fieldExpr timeframe                                    # exprDuration
  | fieldExpr DOT timeframe                                # exprTimeTrunc
  | fieldExpr DOUBLECOLON malloyOrSQLType                  # exprCast
  | fieldExpr TRIPLECOLON malloyOrSQLType                  # exprSafeCast
  | MINUS fieldExpr                                        # exprMinus
  | fieldExpr ( STAR | SLASH | PERCENT ) fieldExpr         # exprMulDiv
  | fieldExpr ( PLUS | MINUS ) fieldExpr                   # exprAddSub
  | fieldExpr TO fieldExpr                                 # exprRange
  | startAt=fieldExpr FOR duration=fieldExpr timeframe     # exprForRange
  | fieldExpr AMPER partialAllowedFieldExpr                # exprAndTree
  | fieldExpr BAR partialAllowedFieldExpr                  # exprOrTree
  | fieldExpr compareOp fieldExpr                          # exprCompare
  | fieldExpr NOT? LIKE fieldExpr                          # exprWarnLike
  | fieldExpr IS NOT? NULL                                 # exprNullCheck
  | fieldExpr NOT? IN OPAREN fieldExprList CPAREN          # exprWarnIn
  | fieldExpr QMARK partialAllowedFieldExpr                # exprApply
  | NOT fieldExpr                                          # exprNot
  | fieldExpr AND fieldExpr                                # exprLogicalAnd
  | fieldExpr OR fieldExpr                                 # exprLogicalOr
  | fieldExpr DOUBLE_QMARK fieldExpr                       # exprCoalesce
  | CAST OPAREN fieldExpr AS malloyOrSQLType CPAREN        # exprCast
  | (SOURCE_KW DOT)? aggregate
      OPAREN fieldExpr? CPAREN                             # exprPathlessAggregate
  | fieldPath DOT aggregate
      OPAREN fieldExpr? CPAREN                             # exprAggregate
  | OPAREN fieldExpr CPAREN                                # exprExpr
  | fieldPath DOT id
      OPAREN ( argumentList? ) CPAREN                      # exprAggFunc
  | ((id (EXCLAM malloyType?)?) | timeframe)
      OPAREN ( argumentList? ) CPAREN                      # exprFunc
  | pickStatement                                          # exprPick
  | caseStatement                                          # exprCase
  | ungroup OPAREN fieldExpr (COMMA fieldName)* CPAREN     # exprUngroup
  ;

partialCompare
  : compareOp fieldExpr
  ;

partialTest
  : partialCompare
  | IS NOT? NULL
  ;

partialAllowedFieldExpr
  : partialTest
  | OPAREN partialTest CPAREN
  | fieldExpr
  ;

fieldExprList
  : fieldExpr (COMMA fieldExpr)*
  ;

pickStatement
  : pick+ (ELSE pickElse=fieldExpr)?
  ;

pick
  : PICK (pickValue=fieldExpr)? WHEN pickWhen=partialAllowedFieldExpr
  ;

caseStatement
  : CASE (valueExpr=fieldExpr)? (caseWhen)+ (ELSE caseElse=fieldExpr)? END
  ;

caseWhen
  : WHEN condition=fieldExpr THEN result=fieldExpr
  ;

recordKey: id;
recordElement
  : fieldPath                   # recordRef
  | (recordKey IS)? fieldExpr   # recordExpr
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
  : (fieldPath DOT)? STAR starQualified?
  ;

starQualified
  : OCURLY (
      (EXCEPT fieldNameList)
    | COMMA
  )+ CCURLY
  ;

taggedRef
  : tags fieldPath refExpr?
  ;

refExpr
  : DOT timeframe
  | DOT aggregate OPAREN CPAREN
  ;

collectionMember
  : taggedRef
  | collectionWildCard
  | fieldDef
  ;

fieldPath
  : fieldName (DOT fieldName)*
  ;

joinName: id;
fieldName: id;

sqlExploreNameRef: id;
nameSQLBlock: id;
connectionName: string;

tripFilterString
  : SQ3_FILTER
  | BQ3_FILTER
  | DQ3_FILTER
  ;

tickFilterString
  : SQ_FILTER
  | BQ_FILTER
  | DQ_FILTER;

filterString
  : tripFilterString
  | tickFilterString;

// These are for debug launch configs. Without the EOF a parse can stop without
// parsing the entire input, if it is legal up to some token, for the debuger
// we want to make sure the entire expression parses.
debugExpr: fieldExpr EOF;
debugPartial: partialAllowedFieldExpr EOF;

experimentalStatementForTesting // this only exists to enable tests for the experimental compiler flag
  : SEMI SEMI OBRACK string CBRACK
  ;
