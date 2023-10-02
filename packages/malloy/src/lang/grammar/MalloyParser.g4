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
  | runStatement
  | docAnnotations
  | ignoredObjectAnnotations
  ;

defineSourceStatement
  : tags SOURCE sourcePropertyList
  ;

defineQuery
  : topLevelQueryDefs                 # use_top_level_query_defs
  | tags QUERY topLevelAnonQueryDef   # anonymousQuery
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

defineSQLStatement
  : SQLC nameSQLBlock isDefine sqlBlock
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
  : OPEN_CODE sqExpr (CCURLY | CLOSE_CODE)
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

queryRefinement
  : (REFINE | refineOperator)? queryProperties
  ;

sourceExtension
  : (EXTEND | refineOperator)? exploreProperties
  ;

sqlSource
  : connectionId DOT SQL OPAREN (sqlString|shortString) CPAREN
  ;

pipelineFromName
  : firstSegment pipeElement*
  ;

firstSegment
  : ARROW? queryProperties
  | exploreQueryName queryRefinement?
  ;

pipeElement
  : ARROW queryProperties
  ;

exploreTable
  : TABLE OPAREN tableURI CPAREN                     # tableFunction
  | connectionId DOT TABLE OPAREN tablePath CPAREN   # tableMethod
  ;

connectionId
  : id;

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
  : tags sourceNameDef isDefine sqExplore
  ;

sqExplore
  : sqExpr
  ;

sourceNameDef: id;
sourceID: id;

exploreProperties
  : OCURLY (exploreStatement | SEMI)* CCURLY
  | filterShortcut
  ;

exploreStatement
  : defDimensions                         # defExploreDimension_stub
  | defMeasures                           # defExploreMeasure_stub
  | declareStatement                      # defDeclare_stub
  | joinStatement                         # defJoin_stub
  | whereStatement                        # defExploreWhere_stub
  | PRIMARY_KEY fieldName                 # defExplorePrimaryKey
  | RENAME renameList                     # defExploreRename
  | (ACCEPT | EXCEPT) fieldNameList       # defExploreEditField
  | tags (QUERY | VIEW) subQueryDefList   # defExploreQuery
  | timezoneStatement                     # defExploreTimezone
  | ANNOTATION+                           # defExploreAnnotation
  | ignoredModelAnnotations               # defIgnoreModel_stub
  ;

defMeasures
  : tags MEASURE defList
  ;

defDimensions
  : tags DIMENSION defList
  ;

renameList
  : exploreRenameDef (COMMA? exploreRenameDef)* COMMA?
  ;

exploreRenameDef
  : fieldName isDefine fieldName
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
  : DECLARE defList
  ;

joinStatement
  : tags JOIN_ONE joinList                  # defJoinOne
  | tags JOIN_MANY joinList                 # defJoinMany
  | tags JOIN_CROSS joinList                # defJoinCross
  ;

queryExtend
  : EXTENDQ queryExtendStatementList
  ;

// this is a little turd to allow m0 and 4.0 to run at once
ambiguousModification
  : filterShortcut
  | OCURLY (modEither | SEMI)* CCURLY
  ;

modEither
  : joinStatement
  | whereStatement
  | declareStatement
  ;

sqExpr
  : ARROW? id                                 # SQID
  | sqExpr ARROW leadSeg (PLUS qSeg)*         # SQArrow
  | sqExpr PLUS? ambiguousModification        # SQAmbiguous
  | sqExpr sourceExtension                    # SQExtendedSource
  | sqExpr queryRefinement                    # SQRefinedQuery
  | FROM OPAREN sqExpr CPAREN                 # SQFrom
  | exploreTable                              # SQTable
  | FROM_SQL OPAREN sqlExploreNameRef CPAREN  # SQLegacySQLBlock
  | sqlSource                                 # SQSQL
  ;

leadSeg
  : id queryRefinement?
  | queryProperties
  ;

qSeg
  : id
  | queryProperties
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

joinDef
  : ANNOTATION* joinNameDef isExplore? WITH fieldExpr        # joinWith
  | ANNOTATION* joinNameDef isExplore? (ON joinExpression)?  # joinOn
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
  : ANNOTATION* exploreQueryNameDef isDefine pipelineFromName
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
  : tags queryName queryRefinement?   # nestExisting
  | tags queryName isDefine pipelineFromName            # nestDef
  ;

aggregateStatement
  : tags AGGREGATE queryFieldList
  ;

calculateStatement
  : tags CALCULATE queryFieldList
  ;

projectStatement
  : tags (SELECT | PROJECT) fieldCollection
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
malloyType: STRING | NUMBER | BOOLEAN | DATE | TIMESTAMP;
compareOp: MATCH | NOT_MATCH | GT | LT | GTE | LTE | EQ | NE;

string
  : shortString
  | sqlString
  ;

shortString
  : (SQ_STRING | DQ_STRING)
  ;

numericLiteral
  : (NUMERIC_LITERAL | INTEGER_LITERAL)
  ;

literal
  : string                                      # exprString
  | numericLiteral                              # exprNumber
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
  | fieldExpr OCURLY filteredBy CCURLY                     # exprFilter
  | literal                                                # exprLiteral
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
  | fieldExpr QMARK partialAllowedFieldExpr                # exprApply
  | NOT fieldExpr                                          # exprNot
  | fieldExpr AND fieldExpr                                # exprLogicalAnd
  | fieldExpr OR fieldExpr                                 # exprLogicalOr
  | fieldExpr DOUBLE_QMARK fieldExpr                       # exprCoalesce
  | CAST OPAREN fieldExpr AS malloyOrSQLType CPAREN        # exprCast
  | COUNT OPAREN DISTINCT fieldExpr CPAREN                 # exprCountDisinct
  | (SOURCE_KW DOT)? aggregate
      OPAREN (fieldExpr | STAR)? CPAREN                    # exprPathlessAggregate
  | fieldPath DOT aggregate
      OPAREN fieldExpr? CPAREN                             # exprAggregate
  | OPAREN partialAllowedFieldExpr CPAREN                  # exprExpr
  | fieldPath DOT id
      OPAREN ( argumentList? ) CPAREN                      # exprAggFunc
  | ((id (EXCLAM malloyType?)?) | timeframe)
      OPAREN ( argumentList? ) CPAREN                      # exprFunc
  | pickStatement                                          # exprPick
  | ungroup OPAREN fieldExpr (COMMA fieldName)* CPAREN     # exprUngroup
  ;

partialAllowedFieldExpr
  : OPAREN compareOp? fieldExpr CPAREN
  | compareOp? fieldExpr
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

justExpr: fieldExpr EOF;

sqlExploreNameRef: id;
nameSQLBlock: id;
connectionName: string;
