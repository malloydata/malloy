// Generated from MalloyParser.g4 by ANTLR 4.9.0-SNAPSHOT


import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";

import { NameMemberContext } from "./MalloyParser";
import { WildMemberContext } from "./MalloyParser";
import { NewMemberContext } from "./MalloyParser";
import { NamedQueries_stubContext } from "./MalloyParser";
import { AnonymousQueryContext } from "./MalloyParser";
import { NamedSourceContext } from "./MalloyParser";
import { TableSourceContext } from "./MalloyParser";
import { QuerySourceContext } from "./MalloyParser";
import { SQLSourceNameContext } from "./MalloyParser";
import { LiteralTimestampContext } from "./MalloyParser";
import { LiteralDayContext } from "./MalloyParser";
import { LiteralWeekContext } from "./MalloyParser";
import { LiteralMonthContext } from "./MalloyParser";
import { LiteralQuarterContext } from "./MalloyParser";
import { LiteralYearContext } from "./MalloyParser";
import { ExprStringContext } from "./MalloyParser";
import { ExprNumberContext } from "./MalloyParser";
import { ExprTimeContext } from "./MalloyParser";
import { ExprNULLContext } from "./MalloyParser";
import { ExprBoolContext } from "./MalloyParser";
import { ExprRegexContext } from "./MalloyParser";
import { ExprNowContext } from "./MalloyParser";
import { QueryFieldRefContext } from "./MalloyParser";
import { QueryFieldDefContext } from "./MalloyParser";
import { NestExistingContext } from "./MalloyParser";
import { NestDefContext } from "./MalloyParser";
import { ExprFieldPathContext } from "./MalloyParser";
import { ExprFilterContext } from "./MalloyParser";
import { ExprLiteralContext } from "./MalloyParser";
import { ExprMinusContext } from "./MalloyParser";
import { ExprDurationContext } from "./MalloyParser";
import { ExprTimeTruncContext } from "./MalloyParser";
import { ExprSafeCastContext } from "./MalloyParser";
import { ExprMulDivContext } from "./MalloyParser";
import { ExprAddSubContext } from "./MalloyParser";
import { ExprRangeContext } from "./MalloyParser";
import { ExprForRangeContext } from "./MalloyParser";
import { ExprLogicalTreeContext } from "./MalloyParser";
import { ExprCompareContext } from "./MalloyParser";
import { ExprApplyContext } from "./MalloyParser";
import { ExprNotContext } from "./MalloyParser";
import { ExprLogicalContext } from "./MalloyParser";
import { ExprCastContext } from "./MalloyParser";
import { ExprCountDisinctContext } from "./MalloyParser";
import { ExprAggregateContext } from "./MalloyParser";
import { ExprExprContext } from "./MalloyParser";
import { ExprFuncContext } from "./MalloyParser";
import { ExprPickContext } from "./MalloyParser";
import { ExprUngroupContext } from "./MalloyParser";
import { ExploreArrowQueryContext } from "./MalloyParser";
import { ArrowQueryContext } from "./MalloyParser";
import { DefJoinOneContext } from "./MalloyParser";
import { DefJoinManyContext } from "./MalloyParser";
import { DefJoinCrossContext } from "./MalloyParser";
import { DefExploreDimensionContext } from "./MalloyParser";
import { DefExploreMeasureContext } from "./MalloyParser";
import { DefDeclare_stubContext } from "./MalloyParser";
import { DefJoin_stubContext } from "./MalloyParser";
import { DefExploreWhereContext } from "./MalloyParser";
import { DefExplorePrimaryKeyContext } from "./MalloyParser";
import { DefExploreRenameContext } from "./MalloyParser";
import { DefExploreEditFieldContext } from "./MalloyParser";
import { DefExploreQueryContext } from "./MalloyParser";
import { FilterByShortcutContext } from "./MalloyParser";
import { FilterByWhereContext } from "./MalloyParser";
import { JoinWithContext } from "./MalloyParser";
import { JoinOnContext } from "./MalloyParser";
import { MalloyDocumentContext } from "./MalloyParser";
import { MalloyStatementContext } from "./MalloyParser";
import { DefineExploreStatementContext } from "./MalloyParser";
import { ExploreKeywordContext } from "./MalloyParser";
import { DefineQueryContext } from "./MalloyParser";
import { TopLevelAnonQueryDefContext } from "./MalloyParser";
import { DefineSQLStatementContext } from "./MalloyParser";
import { SqlBlockContext } from "./MalloyParser";
import { BlockSQLDefContext } from "./MalloyParser";
import { SqlStringContext } from "./MalloyParser";
import { SqlInterpolationContext } from "./MalloyParser";
import { ImportStatementContext } from "./MalloyParser";
import { ImportURLContext } from "./MalloyParser";
import { TopLevelQueryDefsContext } from "./MalloyParser";
import { TopLevelQueryDefContext } from "./MalloyParser";
import { RefineOperatorContext } from "./MalloyParser";
import { QueryContext } from "./MalloyParser";
import { PipelineFromNameContext } from "./MalloyParser";
import { FirstSegmentContext } from "./MalloyParser";
import { PipeElementContext } from "./MalloyParser";
import { ExploreTableContext } from "./MalloyParser";
import { QueryPropertiesContext } from "./MalloyParser";
import { FilterShortcutContext } from "./MalloyParser";
import { ExploreQueryNameContext } from "./MalloyParser";
import { QueryNameContext } from "./MalloyParser";
import { ExploreDefinitionListContext } from "./MalloyParser";
import { ExploreDefinitionContext } from "./MalloyParser";
import { ExploreContext } from "./MalloyParser";
import { ExploreSourceContext } from "./MalloyParser";
import { ExploreNameDefContext } from "./MalloyParser";
import { ExploreNameContext } from "./MalloyParser";
import { ExplorePropertiesContext } from "./MalloyParser";
import { ExploreStatementContext } from "./MalloyParser";
import { RenameListContext } from "./MalloyParser";
import { ExploreRenameDefContext } from "./MalloyParser";
import { DimensionDefListContext } from "./MalloyParser";
import { MeasureDefListContext } from "./MalloyParser";
import { FieldDefContext } from "./MalloyParser";
import { FieldNameDefContext } from "./MalloyParser";
import { JoinNameDefContext } from "./MalloyParser";
import { MeasureDefContext } from "./MalloyParser";
import { DeclareStatementContext } from "./MalloyParser";
import { JoinStatementContext } from "./MalloyParser";
import { JoinListContext } from "./MalloyParser";
import { JoinDefContext } from "./MalloyParser";
import { JoinExpressionContext } from "./MalloyParser";
import { FilterStatementContext } from "./MalloyParser";
import { FilteredByContext } from "./MalloyParser";
import { FilterClauseListContext } from "./MalloyParser";
import { WhereStatementContext } from "./MalloyParser";
import { HavingStatementContext } from "./MalloyParser";
import { SubQueryDefListContext } from "./MalloyParser";
import { ExploreQueryNameDefContext } from "./MalloyParser";
import { ExploreQueryDefContext } from "./MalloyParser";
import { QueryStatementContext } from "./MalloyParser";
import { GroupByStatementContext } from "./MalloyParser";
import { QueryFieldListContext } from "./MalloyParser";
import { DimensionDefContext } from "./MalloyParser";
import { QueryFieldEntryContext } from "./MalloyParser";
import { NestStatementContext } from "./MalloyParser";
import { NestedQueryListContext } from "./MalloyParser";
import { NestEntryContext } from "./MalloyParser";
import { AggregateStatementContext } from "./MalloyParser";
import { ProjectStatementContext } from "./MalloyParser";
import { OrderByStatementContext } from "./MalloyParser";
import { OrderingContext } from "./MalloyParser";
import { OrderBySpecContext } from "./MalloyParser";
import { LimitStatementContext } from "./MalloyParser";
import { BySpecContext } from "./MalloyParser";
import { TopStatementContext } from "./MalloyParser";
import { IndexElementContext } from "./MalloyParser";
import { IndexFieldsContext } from "./MalloyParser";
import { IndexStatementContext } from "./MalloyParser";
import { SampleStatementContext } from "./MalloyParser";
import { SampleSpecContext } from "./MalloyParser";
import { AggregateContext } from "./MalloyParser";
import { MalloyTypeContext } from "./MalloyParser";
import { CompareOpContext } from "./MalloyParser";
import { LiteralContext } from "./MalloyParser";
import { DateLiteralContext } from "./MalloyParser";
import { TableNameContext } from "./MalloyParser";
import { IdContext } from "./MalloyParser";
import { TimeframeContext } from "./MalloyParser";
import { UngroupContext } from "./MalloyParser";
import { FieldExprContext } from "./MalloyParser";
import { PartialAllowedFieldExprContext } from "./MalloyParser";
import { PickStatementContext } from "./MalloyParser";
import { PickContext } from "./MalloyParser";
import { ArgumentListContext } from "./MalloyParser";
import { FieldNameListContext } from "./MalloyParser";
import { FieldCollectionContext } from "./MalloyParser";
import { CollectionMemberContext } from "./MalloyParser";
import { FieldPathContext } from "./MalloyParser";
import { JoinNameContext } from "./MalloyParser";
import { FieldNameContext } from "./MalloyParser";
import { JustExprContext } from "./MalloyParser";
import { JsonContext } from "./MalloyParser";
import { JsonValueContext } from "./MalloyParser";
import { JsonObjectContext } from "./MalloyParser";
import { JsonPropertyContext } from "./MalloyParser";
import { JsonArrayContext } from "./MalloyParser";
import { SqlExploreNameRefContext } from "./MalloyParser";
import { NameSQLBlockContext } from "./MalloyParser";
import { ConnectionNameContext } from "./MalloyParser";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `MalloyParser`.
 */
export interface MalloyParserListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by the `nameMember`
	 * labeled alternative in `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 */
	enterNameMember?: (ctx: NameMemberContext) => void;
	/**
	 * Exit a parse tree produced by the `nameMember`
	 * labeled alternative in `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 */
	exitNameMember?: (ctx: NameMemberContext) => void;

	/**
	 * Enter a parse tree produced by the `wildMember`
	 * labeled alternative in `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 */
	enterWildMember?: (ctx: WildMemberContext) => void;
	/**
	 * Exit a parse tree produced by the `wildMember`
	 * labeled alternative in `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 */
	exitWildMember?: (ctx: WildMemberContext) => void;

	/**
	 * Enter a parse tree produced by the `newMember`
	 * labeled alternative in `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 */
	enterNewMember?: (ctx: NewMemberContext) => void;
	/**
	 * Exit a parse tree produced by the `newMember`
	 * labeled alternative in `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 */
	exitNewMember?: (ctx: NewMemberContext) => void;

	/**
	 * Enter a parse tree produced by the `namedQueries_stub`
	 * labeled alternative in `MalloyParser.defineQuery`.
	 * @param ctx the parse tree
	 */
	enterNamedQueries_stub?: (ctx: NamedQueries_stubContext) => void;
	/**
	 * Exit a parse tree produced by the `namedQueries_stub`
	 * labeled alternative in `MalloyParser.defineQuery`.
	 * @param ctx the parse tree
	 */
	exitNamedQueries_stub?: (ctx: NamedQueries_stubContext) => void;

	/**
	 * Enter a parse tree produced by the `anonymousQuery`
	 * labeled alternative in `MalloyParser.defineQuery`.
	 * @param ctx the parse tree
	 */
	enterAnonymousQuery?: (ctx: AnonymousQueryContext) => void;
	/**
	 * Exit a parse tree produced by the `anonymousQuery`
	 * labeled alternative in `MalloyParser.defineQuery`.
	 * @param ctx the parse tree
	 */
	exitAnonymousQuery?: (ctx: AnonymousQueryContext) => void;

	/**
	 * Enter a parse tree produced by the `NamedSource`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 */
	enterNamedSource?: (ctx: NamedSourceContext) => void;
	/**
	 * Exit a parse tree produced by the `NamedSource`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 */
	exitNamedSource?: (ctx: NamedSourceContext) => void;

	/**
	 * Enter a parse tree produced by the `TableSource`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 */
	enterTableSource?: (ctx: TableSourceContext) => void;
	/**
	 * Exit a parse tree produced by the `TableSource`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 */
	exitTableSource?: (ctx: TableSourceContext) => void;

	/**
	 * Enter a parse tree produced by the `QuerySource`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 */
	enterQuerySource?: (ctx: QuerySourceContext) => void;
	/**
	 * Exit a parse tree produced by the `QuerySource`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 */
	exitQuerySource?: (ctx: QuerySourceContext) => void;

	/**
	 * Enter a parse tree produced by the `SQLSourceName`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 */
	enterSQLSourceName?: (ctx: SQLSourceNameContext) => void;
	/**
	 * Exit a parse tree produced by the `SQLSourceName`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 */
	exitSQLSourceName?: (ctx: SQLSourceNameContext) => void;

	/**
	 * Enter a parse tree produced by the `literalTimestamp`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	enterLiteralTimestamp?: (ctx: LiteralTimestampContext) => void;
	/**
	 * Exit a parse tree produced by the `literalTimestamp`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	exitLiteralTimestamp?: (ctx: LiteralTimestampContext) => void;

	/**
	 * Enter a parse tree produced by the `literalDay`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	enterLiteralDay?: (ctx: LiteralDayContext) => void;
	/**
	 * Exit a parse tree produced by the `literalDay`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	exitLiteralDay?: (ctx: LiteralDayContext) => void;

	/**
	 * Enter a parse tree produced by the `literalWeek`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	enterLiteralWeek?: (ctx: LiteralWeekContext) => void;
	/**
	 * Exit a parse tree produced by the `literalWeek`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	exitLiteralWeek?: (ctx: LiteralWeekContext) => void;

	/**
	 * Enter a parse tree produced by the `literalMonth`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	enterLiteralMonth?: (ctx: LiteralMonthContext) => void;
	/**
	 * Exit a parse tree produced by the `literalMonth`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	exitLiteralMonth?: (ctx: LiteralMonthContext) => void;

	/**
	 * Enter a parse tree produced by the `literalQuarter`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	enterLiteralQuarter?: (ctx: LiteralQuarterContext) => void;
	/**
	 * Exit a parse tree produced by the `literalQuarter`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	exitLiteralQuarter?: (ctx: LiteralQuarterContext) => void;

	/**
	 * Enter a parse tree produced by the `literalYear`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	enterLiteralYear?: (ctx: LiteralYearContext) => void;
	/**
	 * Exit a parse tree produced by the `literalYear`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	exitLiteralYear?: (ctx: LiteralYearContext) => void;

	/**
	 * Enter a parse tree produced by the `exprString`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	enterExprString?: (ctx: ExprStringContext) => void;
	/**
	 * Exit a parse tree produced by the `exprString`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	exitExprString?: (ctx: ExprStringContext) => void;

	/**
	 * Enter a parse tree produced by the `exprNumber`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	enterExprNumber?: (ctx: ExprNumberContext) => void;
	/**
	 * Exit a parse tree produced by the `exprNumber`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	exitExprNumber?: (ctx: ExprNumberContext) => void;

	/**
	 * Enter a parse tree produced by the `exprTime`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	enterExprTime?: (ctx: ExprTimeContext) => void;
	/**
	 * Exit a parse tree produced by the `exprTime`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	exitExprTime?: (ctx: ExprTimeContext) => void;

	/**
	 * Enter a parse tree produced by the `exprNULL`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	enterExprNULL?: (ctx: ExprNULLContext) => void;
	/**
	 * Exit a parse tree produced by the `exprNULL`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	exitExprNULL?: (ctx: ExprNULLContext) => void;

	/**
	 * Enter a parse tree produced by the `exprBool`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	enterExprBool?: (ctx: ExprBoolContext) => void;
	/**
	 * Exit a parse tree produced by the `exprBool`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	exitExprBool?: (ctx: ExprBoolContext) => void;

	/**
	 * Enter a parse tree produced by the `exprRegex`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	enterExprRegex?: (ctx: ExprRegexContext) => void;
	/**
	 * Exit a parse tree produced by the `exprRegex`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	exitExprRegex?: (ctx: ExprRegexContext) => void;

	/**
	 * Enter a parse tree produced by the `exprNow`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	enterExprNow?: (ctx: ExprNowContext) => void;
	/**
	 * Exit a parse tree produced by the `exprNow`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	exitExprNow?: (ctx: ExprNowContext) => void;

	/**
	 * Enter a parse tree produced by the `queryFieldRef`
	 * labeled alternative in `MalloyParser.queryFieldEntry`.
	 * @param ctx the parse tree
	 */
	enterQueryFieldRef?: (ctx: QueryFieldRefContext) => void;
	/**
	 * Exit a parse tree produced by the `queryFieldRef`
	 * labeled alternative in `MalloyParser.queryFieldEntry`.
	 * @param ctx the parse tree
	 */
	exitQueryFieldRef?: (ctx: QueryFieldRefContext) => void;

	/**
	 * Enter a parse tree produced by the `queryFieldDef`
	 * labeled alternative in `MalloyParser.queryFieldEntry`.
	 * @param ctx the parse tree
	 */
	enterQueryFieldDef?: (ctx: QueryFieldDefContext) => void;
	/**
	 * Exit a parse tree produced by the `queryFieldDef`
	 * labeled alternative in `MalloyParser.queryFieldEntry`.
	 * @param ctx the parse tree
	 */
	exitQueryFieldDef?: (ctx: QueryFieldDefContext) => void;

	/**
	 * Enter a parse tree produced by the `nestExisting`
	 * labeled alternative in `MalloyParser.nestEntry`.
	 * @param ctx the parse tree
	 */
	enterNestExisting?: (ctx: NestExistingContext) => void;
	/**
	 * Exit a parse tree produced by the `nestExisting`
	 * labeled alternative in `MalloyParser.nestEntry`.
	 * @param ctx the parse tree
	 */
	exitNestExisting?: (ctx: NestExistingContext) => void;

	/**
	 * Enter a parse tree produced by the `nestDef`
	 * labeled alternative in `MalloyParser.nestEntry`.
	 * @param ctx the parse tree
	 */
	enterNestDef?: (ctx: NestDefContext) => void;
	/**
	 * Exit a parse tree produced by the `nestDef`
	 * labeled alternative in `MalloyParser.nestEntry`.
	 * @param ctx the parse tree
	 */
	exitNestDef?: (ctx: NestDefContext) => void;

	/**
	 * Enter a parse tree produced by the `exprFieldPath`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprFieldPath?: (ctx: ExprFieldPathContext) => void;
	/**
	 * Exit a parse tree produced by the `exprFieldPath`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprFieldPath?: (ctx: ExprFieldPathContext) => void;

	/**
	 * Enter a parse tree produced by the `exprFilter`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprFilter?: (ctx: ExprFilterContext) => void;
	/**
	 * Exit a parse tree produced by the `exprFilter`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprFilter?: (ctx: ExprFilterContext) => void;

	/**
	 * Enter a parse tree produced by the `exprLiteral`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprLiteral?: (ctx: ExprLiteralContext) => void;
	/**
	 * Exit a parse tree produced by the `exprLiteral`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprLiteral?: (ctx: ExprLiteralContext) => void;

	/**
	 * Enter a parse tree produced by the `exprMinus`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprMinus?: (ctx: ExprMinusContext) => void;
	/**
	 * Exit a parse tree produced by the `exprMinus`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprMinus?: (ctx: ExprMinusContext) => void;

	/**
	 * Enter a parse tree produced by the `exprDuration`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprDuration?: (ctx: ExprDurationContext) => void;
	/**
	 * Exit a parse tree produced by the `exprDuration`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprDuration?: (ctx: ExprDurationContext) => void;

	/**
	 * Enter a parse tree produced by the `exprTimeTrunc`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprTimeTrunc?: (ctx: ExprTimeTruncContext) => void;
	/**
	 * Exit a parse tree produced by the `exprTimeTrunc`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprTimeTrunc?: (ctx: ExprTimeTruncContext) => void;

	/**
	 * Enter a parse tree produced by the `exprSafeCast`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprSafeCast?: (ctx: ExprSafeCastContext) => void;
	/**
	 * Exit a parse tree produced by the `exprSafeCast`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprSafeCast?: (ctx: ExprSafeCastContext) => void;

	/**
	 * Enter a parse tree produced by the `exprMulDiv`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprMulDiv?: (ctx: ExprMulDivContext) => void;
	/**
	 * Exit a parse tree produced by the `exprMulDiv`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprMulDiv?: (ctx: ExprMulDivContext) => void;

	/**
	 * Enter a parse tree produced by the `exprAddSub`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprAddSub?: (ctx: ExprAddSubContext) => void;
	/**
	 * Exit a parse tree produced by the `exprAddSub`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprAddSub?: (ctx: ExprAddSubContext) => void;

	/**
	 * Enter a parse tree produced by the `exprRange`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprRange?: (ctx: ExprRangeContext) => void;
	/**
	 * Exit a parse tree produced by the `exprRange`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprRange?: (ctx: ExprRangeContext) => void;

	/**
	 * Enter a parse tree produced by the `exprForRange`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprForRange?: (ctx: ExprForRangeContext) => void;
	/**
	 * Exit a parse tree produced by the `exprForRange`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprForRange?: (ctx: ExprForRangeContext) => void;

	/**
	 * Enter a parse tree produced by the `exprLogicalTree`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprLogicalTree?: (ctx: ExprLogicalTreeContext) => void;
	/**
	 * Exit a parse tree produced by the `exprLogicalTree`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprLogicalTree?: (ctx: ExprLogicalTreeContext) => void;

	/**
	 * Enter a parse tree produced by the `exprCompare`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprCompare?: (ctx: ExprCompareContext) => void;
	/**
	 * Exit a parse tree produced by the `exprCompare`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprCompare?: (ctx: ExprCompareContext) => void;

	/**
	 * Enter a parse tree produced by the `exprApply`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprApply?: (ctx: ExprApplyContext) => void;
	/**
	 * Exit a parse tree produced by the `exprApply`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprApply?: (ctx: ExprApplyContext) => void;

	/**
	 * Enter a parse tree produced by the `exprNot`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprNot?: (ctx: ExprNotContext) => void;
	/**
	 * Exit a parse tree produced by the `exprNot`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprNot?: (ctx: ExprNotContext) => void;

	/**
	 * Enter a parse tree produced by the `exprLogical`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprLogical?: (ctx: ExprLogicalContext) => void;
	/**
	 * Exit a parse tree produced by the `exprLogical`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprLogical?: (ctx: ExprLogicalContext) => void;

	/**
	 * Enter a parse tree produced by the `exprCast`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprCast?: (ctx: ExprCastContext) => void;
	/**
	 * Exit a parse tree produced by the `exprCast`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprCast?: (ctx: ExprCastContext) => void;

	/**
	 * Enter a parse tree produced by the `exprCountDisinct`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprCountDisinct?: (ctx: ExprCountDisinctContext) => void;
	/**
	 * Exit a parse tree produced by the `exprCountDisinct`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprCountDisinct?: (ctx: ExprCountDisinctContext) => void;

	/**
	 * Enter a parse tree produced by the `exprAggregate`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprAggregate?: (ctx: ExprAggregateContext) => void;
	/**
	 * Exit a parse tree produced by the `exprAggregate`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprAggregate?: (ctx: ExprAggregateContext) => void;

	/**
	 * Enter a parse tree produced by the `exprExpr`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprExpr?: (ctx: ExprExprContext) => void;
	/**
	 * Exit a parse tree produced by the `exprExpr`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprExpr?: (ctx: ExprExprContext) => void;

	/**
	 * Enter a parse tree produced by the `exprFunc`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprFunc?: (ctx: ExprFuncContext) => void;
	/**
	 * Exit a parse tree produced by the `exprFunc`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprFunc?: (ctx: ExprFuncContext) => void;

	/**
	 * Enter a parse tree produced by the `exprPick`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprPick?: (ctx: ExprPickContext) => void;
	/**
	 * Exit a parse tree produced by the `exprPick`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprPick?: (ctx: ExprPickContext) => void;

	/**
	 * Enter a parse tree produced by the `exprUngroup`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterExprUngroup?: (ctx: ExprUngroupContext) => void;
	/**
	 * Exit a parse tree produced by the `exprUngroup`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitExprUngroup?: (ctx: ExprUngroupContext) => void;

	/**
	 * Enter a parse tree produced by the `exploreArrowQuery`
	 * labeled alternative in `MalloyParser.query`.
	 * @param ctx the parse tree
	 */
	enterExploreArrowQuery?: (ctx: ExploreArrowQueryContext) => void;
	/**
	 * Exit a parse tree produced by the `exploreArrowQuery`
	 * labeled alternative in `MalloyParser.query`.
	 * @param ctx the parse tree
	 */
	exitExploreArrowQuery?: (ctx: ExploreArrowQueryContext) => void;

	/**
	 * Enter a parse tree produced by the `arrowQuery`
	 * labeled alternative in `MalloyParser.query`.
	 * @param ctx the parse tree
	 */
	enterArrowQuery?: (ctx: ArrowQueryContext) => void;
	/**
	 * Exit a parse tree produced by the `arrowQuery`
	 * labeled alternative in `MalloyParser.query`.
	 * @param ctx the parse tree
	 */
	exitArrowQuery?: (ctx: ArrowQueryContext) => void;

	/**
	 * Enter a parse tree produced by the `defJoinOne`
	 * labeled alternative in `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 */
	enterDefJoinOne?: (ctx: DefJoinOneContext) => void;
	/**
	 * Exit a parse tree produced by the `defJoinOne`
	 * labeled alternative in `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 */
	exitDefJoinOne?: (ctx: DefJoinOneContext) => void;

	/**
	 * Enter a parse tree produced by the `defJoinMany`
	 * labeled alternative in `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 */
	enterDefJoinMany?: (ctx: DefJoinManyContext) => void;
	/**
	 * Exit a parse tree produced by the `defJoinMany`
	 * labeled alternative in `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 */
	exitDefJoinMany?: (ctx: DefJoinManyContext) => void;

	/**
	 * Enter a parse tree produced by the `defJoinCross`
	 * labeled alternative in `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 */
	enterDefJoinCross?: (ctx: DefJoinCrossContext) => void;
	/**
	 * Exit a parse tree produced by the `defJoinCross`
	 * labeled alternative in `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 */
	exitDefJoinCross?: (ctx: DefJoinCrossContext) => void;

	/**
	 * Enter a parse tree produced by the `defExploreDimension`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	enterDefExploreDimension?: (ctx: DefExploreDimensionContext) => void;
	/**
	 * Exit a parse tree produced by the `defExploreDimension`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	exitDefExploreDimension?: (ctx: DefExploreDimensionContext) => void;

	/**
	 * Enter a parse tree produced by the `defExploreMeasure`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	enterDefExploreMeasure?: (ctx: DefExploreMeasureContext) => void;
	/**
	 * Exit a parse tree produced by the `defExploreMeasure`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	exitDefExploreMeasure?: (ctx: DefExploreMeasureContext) => void;

	/**
	 * Enter a parse tree produced by the `defDeclare_stub`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	enterDefDeclare_stub?: (ctx: DefDeclare_stubContext) => void;
	/**
	 * Exit a parse tree produced by the `defDeclare_stub`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	exitDefDeclare_stub?: (ctx: DefDeclare_stubContext) => void;

	/**
	 * Enter a parse tree produced by the `defJoin_stub`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	enterDefJoin_stub?: (ctx: DefJoin_stubContext) => void;
	/**
	 * Exit a parse tree produced by the `defJoin_stub`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	exitDefJoin_stub?: (ctx: DefJoin_stubContext) => void;

	/**
	 * Enter a parse tree produced by the `defExploreWhere`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	enterDefExploreWhere?: (ctx: DefExploreWhereContext) => void;
	/**
	 * Exit a parse tree produced by the `defExploreWhere`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	exitDefExploreWhere?: (ctx: DefExploreWhereContext) => void;

	/**
	 * Enter a parse tree produced by the `defExplorePrimaryKey`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	enterDefExplorePrimaryKey?: (ctx: DefExplorePrimaryKeyContext) => void;
	/**
	 * Exit a parse tree produced by the `defExplorePrimaryKey`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	exitDefExplorePrimaryKey?: (ctx: DefExplorePrimaryKeyContext) => void;

	/**
	 * Enter a parse tree produced by the `defExploreRename`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	enterDefExploreRename?: (ctx: DefExploreRenameContext) => void;
	/**
	 * Exit a parse tree produced by the `defExploreRename`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	exitDefExploreRename?: (ctx: DefExploreRenameContext) => void;

	/**
	 * Enter a parse tree produced by the `defExploreEditField`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	enterDefExploreEditField?: (ctx: DefExploreEditFieldContext) => void;
	/**
	 * Exit a parse tree produced by the `defExploreEditField`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	exitDefExploreEditField?: (ctx: DefExploreEditFieldContext) => void;

	/**
	 * Enter a parse tree produced by the `defExploreQuery`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	enterDefExploreQuery?: (ctx: DefExploreQueryContext) => void;
	/**
	 * Exit a parse tree produced by the `defExploreQuery`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	exitDefExploreQuery?: (ctx: DefExploreQueryContext) => void;

	/**
	 * Enter a parse tree produced by the `filterByShortcut`
	 * labeled alternative in `MalloyParser.filteredBy`.
	 * @param ctx the parse tree
	 */
	enterFilterByShortcut?: (ctx: FilterByShortcutContext) => void;
	/**
	 * Exit a parse tree produced by the `filterByShortcut`
	 * labeled alternative in `MalloyParser.filteredBy`.
	 * @param ctx the parse tree
	 */
	exitFilterByShortcut?: (ctx: FilterByShortcutContext) => void;

	/**
	 * Enter a parse tree produced by the `filterByWhere`
	 * labeled alternative in `MalloyParser.filteredBy`.
	 * @param ctx the parse tree
	 */
	enterFilterByWhere?: (ctx: FilterByWhereContext) => void;
	/**
	 * Exit a parse tree produced by the `filterByWhere`
	 * labeled alternative in `MalloyParser.filteredBy`.
	 * @param ctx the parse tree
	 */
	exitFilterByWhere?: (ctx: FilterByWhereContext) => void;

	/**
	 * Enter a parse tree produced by the `joinWith`
	 * labeled alternative in `MalloyParser.joinDef`.
	 * @param ctx the parse tree
	 */
	enterJoinWith?: (ctx: JoinWithContext) => void;
	/**
	 * Exit a parse tree produced by the `joinWith`
	 * labeled alternative in `MalloyParser.joinDef`.
	 * @param ctx the parse tree
	 */
	exitJoinWith?: (ctx: JoinWithContext) => void;

	/**
	 * Enter a parse tree produced by the `joinOn`
	 * labeled alternative in `MalloyParser.joinDef`.
	 * @param ctx the parse tree
	 */
	enterJoinOn?: (ctx: JoinOnContext) => void;
	/**
	 * Exit a parse tree produced by the `joinOn`
	 * labeled alternative in `MalloyParser.joinDef`.
	 * @param ctx the parse tree
	 */
	exitJoinOn?: (ctx: JoinOnContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.malloyDocument`.
	 * @param ctx the parse tree
	 */
	enterMalloyDocument?: (ctx: MalloyDocumentContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.malloyDocument`.
	 * @param ctx the parse tree
	 */
	exitMalloyDocument?: (ctx: MalloyDocumentContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.malloyStatement`.
	 * @param ctx the parse tree
	 */
	enterMalloyStatement?: (ctx: MalloyStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.malloyStatement`.
	 * @param ctx the parse tree
	 */
	exitMalloyStatement?: (ctx: MalloyStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.defineExploreStatement`.
	 * @param ctx the parse tree
	 */
	enterDefineExploreStatement?: (ctx: DefineExploreStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.defineExploreStatement`.
	 * @param ctx the parse tree
	 */
	exitDefineExploreStatement?: (ctx: DefineExploreStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreKeyword`.
	 * @param ctx the parse tree
	 */
	enterExploreKeyword?: (ctx: ExploreKeywordContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreKeyword`.
	 * @param ctx the parse tree
	 */
	exitExploreKeyword?: (ctx: ExploreKeywordContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.defineQuery`.
	 * @param ctx the parse tree
	 */
	enterDefineQuery?: (ctx: DefineQueryContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.defineQuery`.
	 * @param ctx the parse tree
	 */
	exitDefineQuery?: (ctx: DefineQueryContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.topLevelAnonQueryDef`.
	 * @param ctx the parse tree
	 */
	enterTopLevelAnonQueryDef?: (ctx: TopLevelAnonQueryDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.topLevelAnonQueryDef`.
	 * @param ctx the parse tree
	 */
	exitTopLevelAnonQueryDef?: (ctx: TopLevelAnonQueryDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.defineSQLStatement`.
	 * @param ctx the parse tree
	 */
	enterDefineSQLStatement?: (ctx: DefineSQLStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.defineSQLStatement`.
	 * @param ctx the parse tree
	 */
	exitDefineSQLStatement?: (ctx: DefineSQLStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.sqlBlock`.
	 * @param ctx the parse tree
	 */
	enterSqlBlock?: (ctx: SqlBlockContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.sqlBlock`.
	 * @param ctx the parse tree
	 */
	exitSqlBlock?: (ctx: SqlBlockContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.blockSQLDef`.
	 * @param ctx the parse tree
	 */
	enterBlockSQLDef?: (ctx: BlockSQLDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.blockSQLDef`.
	 * @param ctx the parse tree
	 */
	exitBlockSQLDef?: (ctx: BlockSQLDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.sqlString`.
	 * @param ctx the parse tree
	 */
	enterSqlString?: (ctx: SqlStringContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.sqlString`.
	 * @param ctx the parse tree
	 */
	exitSqlString?: (ctx: SqlStringContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.sqlInterpolation`.
	 * @param ctx the parse tree
	 */
	enterSqlInterpolation?: (ctx: SqlInterpolationContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.sqlInterpolation`.
	 * @param ctx the parse tree
	 */
	exitSqlInterpolation?: (ctx: SqlInterpolationContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.importStatement`.
	 * @param ctx the parse tree
	 */
	enterImportStatement?: (ctx: ImportStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.importStatement`.
	 * @param ctx the parse tree
	 */
	exitImportStatement?: (ctx: ImportStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.importURL`.
	 * @param ctx the parse tree
	 */
	enterImportURL?: (ctx: ImportURLContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.importURL`.
	 * @param ctx the parse tree
	 */
	exitImportURL?: (ctx: ImportURLContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.topLevelQueryDefs`.
	 * @param ctx the parse tree
	 */
	enterTopLevelQueryDefs?: (ctx: TopLevelQueryDefsContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.topLevelQueryDefs`.
	 * @param ctx the parse tree
	 */
	exitTopLevelQueryDefs?: (ctx: TopLevelQueryDefsContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.topLevelQueryDef`.
	 * @param ctx the parse tree
	 */
	enterTopLevelQueryDef?: (ctx: TopLevelQueryDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.topLevelQueryDef`.
	 * @param ctx the parse tree
	 */
	exitTopLevelQueryDef?: (ctx: TopLevelQueryDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.refineOperator`.
	 * @param ctx the parse tree
	 */
	enterRefineOperator?: (ctx: RefineOperatorContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.refineOperator`.
	 * @param ctx the parse tree
	 */
	exitRefineOperator?: (ctx: RefineOperatorContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.query`.
	 * @param ctx the parse tree
	 */
	enterQuery?: (ctx: QueryContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.query`.
	 * @param ctx the parse tree
	 */
	exitQuery?: (ctx: QueryContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.pipelineFromName`.
	 * @param ctx the parse tree
	 */
	enterPipelineFromName?: (ctx: PipelineFromNameContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.pipelineFromName`.
	 * @param ctx the parse tree
	 */
	exitPipelineFromName?: (ctx: PipelineFromNameContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.firstSegment`.
	 * @param ctx the parse tree
	 */
	enterFirstSegment?: (ctx: FirstSegmentContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.firstSegment`.
	 * @param ctx the parse tree
	 */
	exitFirstSegment?: (ctx: FirstSegmentContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.pipeElement`.
	 * @param ctx the parse tree
	 */
	enterPipeElement?: (ctx: PipeElementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.pipeElement`.
	 * @param ctx the parse tree
	 */
	exitPipeElement?: (ctx: PipeElementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreTable`.
	 * @param ctx the parse tree
	 */
	enterExploreTable?: (ctx: ExploreTableContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreTable`.
	 * @param ctx the parse tree
	 */
	exitExploreTable?: (ctx: ExploreTableContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.queryProperties`.
	 * @param ctx the parse tree
	 */
	enterQueryProperties?: (ctx: QueryPropertiesContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.queryProperties`.
	 * @param ctx the parse tree
	 */
	exitQueryProperties?: (ctx: QueryPropertiesContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.filterShortcut`.
	 * @param ctx the parse tree
	 */
	enterFilterShortcut?: (ctx: FilterShortcutContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.filterShortcut`.
	 * @param ctx the parse tree
	 */
	exitFilterShortcut?: (ctx: FilterShortcutContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreQueryName`.
	 * @param ctx the parse tree
	 */
	enterExploreQueryName?: (ctx: ExploreQueryNameContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreQueryName`.
	 * @param ctx the parse tree
	 */
	exitExploreQueryName?: (ctx: ExploreQueryNameContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.queryName`.
	 * @param ctx the parse tree
	 */
	enterQueryName?: (ctx: QueryNameContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.queryName`.
	 * @param ctx the parse tree
	 */
	exitQueryName?: (ctx: QueryNameContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreDefinitionList`.
	 * @param ctx the parse tree
	 */
	enterExploreDefinitionList?: (ctx: ExploreDefinitionListContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreDefinitionList`.
	 * @param ctx the parse tree
	 */
	exitExploreDefinitionList?: (ctx: ExploreDefinitionListContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreDefinition`.
	 * @param ctx the parse tree
	 */
	enterExploreDefinition?: (ctx: ExploreDefinitionContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreDefinition`.
	 * @param ctx the parse tree
	 */
	exitExploreDefinition?: (ctx: ExploreDefinitionContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.explore`.
	 * @param ctx the parse tree
	 */
	enterExplore?: (ctx: ExploreContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.explore`.
	 * @param ctx the parse tree
	 */
	exitExplore?: (ctx: ExploreContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 */
	enterExploreSource?: (ctx: ExploreSourceContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 */
	exitExploreSource?: (ctx: ExploreSourceContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreNameDef`.
	 * @param ctx the parse tree
	 */
	enterExploreNameDef?: (ctx: ExploreNameDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreNameDef`.
	 * @param ctx the parse tree
	 */
	exitExploreNameDef?: (ctx: ExploreNameDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreName`.
	 * @param ctx the parse tree
	 */
	enterExploreName?: (ctx: ExploreNameContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreName`.
	 * @param ctx the parse tree
	 */
	exitExploreName?: (ctx: ExploreNameContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreProperties`.
	 * @param ctx the parse tree
	 */
	enterExploreProperties?: (ctx: ExplorePropertiesContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreProperties`.
	 * @param ctx the parse tree
	 */
	exitExploreProperties?: (ctx: ExplorePropertiesContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	enterExploreStatement?: (ctx: ExploreStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 */
	exitExploreStatement?: (ctx: ExploreStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.renameList`.
	 * @param ctx the parse tree
	 */
	enterRenameList?: (ctx: RenameListContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.renameList`.
	 * @param ctx the parse tree
	 */
	exitRenameList?: (ctx: RenameListContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreRenameDef`.
	 * @param ctx the parse tree
	 */
	enterExploreRenameDef?: (ctx: ExploreRenameDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreRenameDef`.
	 * @param ctx the parse tree
	 */
	exitExploreRenameDef?: (ctx: ExploreRenameDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.dimensionDefList`.
	 * @param ctx the parse tree
	 */
	enterDimensionDefList?: (ctx: DimensionDefListContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.dimensionDefList`.
	 * @param ctx the parse tree
	 */
	exitDimensionDefList?: (ctx: DimensionDefListContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.measureDefList`.
	 * @param ctx the parse tree
	 */
	enterMeasureDefList?: (ctx: MeasureDefListContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.measureDefList`.
	 * @param ctx the parse tree
	 */
	exitMeasureDefList?: (ctx: MeasureDefListContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.fieldDef`.
	 * @param ctx the parse tree
	 */
	enterFieldDef?: (ctx: FieldDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.fieldDef`.
	 * @param ctx the parse tree
	 */
	exitFieldDef?: (ctx: FieldDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.fieldNameDef`.
	 * @param ctx the parse tree
	 */
	enterFieldNameDef?: (ctx: FieldNameDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.fieldNameDef`.
	 * @param ctx the parse tree
	 */
	exitFieldNameDef?: (ctx: FieldNameDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.joinNameDef`.
	 * @param ctx the parse tree
	 */
	enterJoinNameDef?: (ctx: JoinNameDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.joinNameDef`.
	 * @param ctx the parse tree
	 */
	exitJoinNameDef?: (ctx: JoinNameDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.measureDef`.
	 * @param ctx the parse tree
	 */
	enterMeasureDef?: (ctx: MeasureDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.measureDef`.
	 * @param ctx the parse tree
	 */
	exitMeasureDef?: (ctx: MeasureDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.declareStatement`.
	 * @param ctx the parse tree
	 */
	enterDeclareStatement?: (ctx: DeclareStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.declareStatement`.
	 * @param ctx the parse tree
	 */
	exitDeclareStatement?: (ctx: DeclareStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 */
	enterJoinStatement?: (ctx: JoinStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 */
	exitJoinStatement?: (ctx: JoinStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.joinList`.
	 * @param ctx the parse tree
	 */
	enterJoinList?: (ctx: JoinListContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.joinList`.
	 * @param ctx the parse tree
	 */
	exitJoinList?: (ctx: JoinListContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.joinDef`.
	 * @param ctx the parse tree
	 */
	enterJoinDef?: (ctx: JoinDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.joinDef`.
	 * @param ctx the parse tree
	 */
	exitJoinDef?: (ctx: JoinDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.joinExpression`.
	 * @param ctx the parse tree
	 */
	enterJoinExpression?: (ctx: JoinExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.joinExpression`.
	 * @param ctx the parse tree
	 */
	exitJoinExpression?: (ctx: JoinExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.filterStatement`.
	 * @param ctx the parse tree
	 */
	enterFilterStatement?: (ctx: FilterStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.filterStatement`.
	 * @param ctx the parse tree
	 */
	exitFilterStatement?: (ctx: FilterStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.filteredBy`.
	 * @param ctx the parse tree
	 */
	enterFilteredBy?: (ctx: FilteredByContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.filteredBy`.
	 * @param ctx the parse tree
	 */
	exitFilteredBy?: (ctx: FilteredByContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.filterClauseList`.
	 * @param ctx the parse tree
	 */
	enterFilterClauseList?: (ctx: FilterClauseListContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.filterClauseList`.
	 * @param ctx the parse tree
	 */
	exitFilterClauseList?: (ctx: FilterClauseListContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.whereStatement`.
	 * @param ctx the parse tree
	 */
	enterWhereStatement?: (ctx: WhereStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.whereStatement`.
	 * @param ctx the parse tree
	 */
	exitWhereStatement?: (ctx: WhereStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.havingStatement`.
	 * @param ctx the parse tree
	 */
	enterHavingStatement?: (ctx: HavingStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.havingStatement`.
	 * @param ctx the parse tree
	 */
	exitHavingStatement?: (ctx: HavingStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.subQueryDefList`.
	 * @param ctx the parse tree
	 */
	enterSubQueryDefList?: (ctx: SubQueryDefListContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.subQueryDefList`.
	 * @param ctx the parse tree
	 */
	exitSubQueryDefList?: (ctx: SubQueryDefListContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreQueryNameDef`.
	 * @param ctx the parse tree
	 */
	enterExploreQueryNameDef?: (ctx: ExploreQueryNameDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreQueryNameDef`.
	 * @param ctx the parse tree
	 */
	exitExploreQueryNameDef?: (ctx: ExploreQueryNameDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.exploreQueryDef`.
	 * @param ctx the parse tree
	 */
	enterExploreQueryDef?: (ctx: ExploreQueryDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.exploreQueryDef`.
	 * @param ctx the parse tree
	 */
	exitExploreQueryDef?: (ctx: ExploreQueryDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.queryStatement`.
	 * @param ctx the parse tree
	 */
	enterQueryStatement?: (ctx: QueryStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.queryStatement`.
	 * @param ctx the parse tree
	 */
	exitQueryStatement?: (ctx: QueryStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.groupByStatement`.
	 * @param ctx the parse tree
	 */
	enterGroupByStatement?: (ctx: GroupByStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.groupByStatement`.
	 * @param ctx the parse tree
	 */
	exitGroupByStatement?: (ctx: GroupByStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.queryFieldList`.
	 * @param ctx the parse tree
	 */
	enterQueryFieldList?: (ctx: QueryFieldListContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.queryFieldList`.
	 * @param ctx the parse tree
	 */
	exitQueryFieldList?: (ctx: QueryFieldListContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.dimensionDef`.
	 * @param ctx the parse tree
	 */
	enterDimensionDef?: (ctx: DimensionDefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.dimensionDef`.
	 * @param ctx the parse tree
	 */
	exitDimensionDef?: (ctx: DimensionDefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.queryFieldEntry`.
	 * @param ctx the parse tree
	 */
	enterQueryFieldEntry?: (ctx: QueryFieldEntryContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.queryFieldEntry`.
	 * @param ctx the parse tree
	 */
	exitQueryFieldEntry?: (ctx: QueryFieldEntryContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.nestStatement`.
	 * @param ctx the parse tree
	 */
	enterNestStatement?: (ctx: NestStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.nestStatement`.
	 * @param ctx the parse tree
	 */
	exitNestStatement?: (ctx: NestStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.nestedQueryList`.
	 * @param ctx the parse tree
	 */
	enterNestedQueryList?: (ctx: NestedQueryListContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.nestedQueryList`.
	 * @param ctx the parse tree
	 */
	exitNestedQueryList?: (ctx: NestedQueryListContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.nestEntry`.
	 * @param ctx the parse tree
	 */
	enterNestEntry?: (ctx: NestEntryContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.nestEntry`.
	 * @param ctx the parse tree
	 */
	exitNestEntry?: (ctx: NestEntryContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.aggregateStatement`.
	 * @param ctx the parse tree
	 */
	enterAggregateStatement?: (ctx: AggregateStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.aggregateStatement`.
	 * @param ctx the parse tree
	 */
	exitAggregateStatement?: (ctx: AggregateStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.projectStatement`.
	 * @param ctx the parse tree
	 */
	enterProjectStatement?: (ctx: ProjectStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.projectStatement`.
	 * @param ctx the parse tree
	 */
	exitProjectStatement?: (ctx: ProjectStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.orderByStatement`.
	 * @param ctx the parse tree
	 */
	enterOrderByStatement?: (ctx: OrderByStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.orderByStatement`.
	 * @param ctx the parse tree
	 */
	exitOrderByStatement?: (ctx: OrderByStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.ordering`.
	 * @param ctx the parse tree
	 */
	enterOrdering?: (ctx: OrderingContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.ordering`.
	 * @param ctx the parse tree
	 */
	exitOrdering?: (ctx: OrderingContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.orderBySpec`.
	 * @param ctx the parse tree
	 */
	enterOrderBySpec?: (ctx: OrderBySpecContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.orderBySpec`.
	 * @param ctx the parse tree
	 */
	exitOrderBySpec?: (ctx: OrderBySpecContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.limitStatement`.
	 * @param ctx the parse tree
	 */
	enterLimitStatement?: (ctx: LimitStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.limitStatement`.
	 * @param ctx the parse tree
	 */
	exitLimitStatement?: (ctx: LimitStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.bySpec`.
	 * @param ctx the parse tree
	 */
	enterBySpec?: (ctx: BySpecContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.bySpec`.
	 * @param ctx the parse tree
	 */
	exitBySpec?: (ctx: BySpecContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.topStatement`.
	 * @param ctx the parse tree
	 */
	enterTopStatement?: (ctx: TopStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.topStatement`.
	 * @param ctx the parse tree
	 */
	exitTopStatement?: (ctx: TopStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.indexElement`.
	 * @param ctx the parse tree
	 */
	enterIndexElement?: (ctx: IndexElementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.indexElement`.
	 * @param ctx the parse tree
	 */
	exitIndexElement?: (ctx: IndexElementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.indexFields`.
	 * @param ctx the parse tree
	 */
	enterIndexFields?: (ctx: IndexFieldsContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.indexFields`.
	 * @param ctx the parse tree
	 */
	exitIndexFields?: (ctx: IndexFieldsContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.indexStatement`.
	 * @param ctx the parse tree
	 */
	enterIndexStatement?: (ctx: IndexStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.indexStatement`.
	 * @param ctx the parse tree
	 */
	exitIndexStatement?: (ctx: IndexStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.sampleStatement`.
	 * @param ctx the parse tree
	 */
	enterSampleStatement?: (ctx: SampleStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.sampleStatement`.
	 * @param ctx the parse tree
	 */
	exitSampleStatement?: (ctx: SampleStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.sampleSpec`.
	 * @param ctx the parse tree
	 */
	enterSampleSpec?: (ctx: SampleSpecContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.sampleSpec`.
	 * @param ctx the parse tree
	 */
	exitSampleSpec?: (ctx: SampleSpecContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.aggregate`.
	 * @param ctx the parse tree
	 */
	enterAggregate?: (ctx: AggregateContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.aggregate`.
	 * @param ctx the parse tree
	 */
	exitAggregate?: (ctx: AggregateContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.malloyType`.
	 * @param ctx the parse tree
	 */
	enterMalloyType?: (ctx: MalloyTypeContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.malloyType`.
	 * @param ctx the parse tree
	 */
	exitMalloyType?: (ctx: MalloyTypeContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.compareOp`.
	 * @param ctx the parse tree
	 */
	enterCompareOp?: (ctx: CompareOpContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.compareOp`.
	 * @param ctx the parse tree
	 */
	exitCompareOp?: (ctx: CompareOpContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	enterLiteral?: (ctx: LiteralContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.literal`.
	 * @param ctx the parse tree
	 */
	exitLiteral?: (ctx: LiteralContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	enterDateLiteral?: (ctx: DateLiteralContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 */
	exitDateLiteral?: (ctx: DateLiteralContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.tableName`.
	 * @param ctx the parse tree
	 */
	enterTableName?: (ctx: TableNameContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.tableName`.
	 * @param ctx the parse tree
	 */
	exitTableName?: (ctx: TableNameContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.id`.
	 * @param ctx the parse tree
	 */
	enterId?: (ctx: IdContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.id`.
	 * @param ctx the parse tree
	 */
	exitId?: (ctx: IdContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.timeframe`.
	 * @param ctx the parse tree
	 */
	enterTimeframe?: (ctx: TimeframeContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.timeframe`.
	 * @param ctx the parse tree
	 */
	exitTimeframe?: (ctx: TimeframeContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.ungroup`.
	 * @param ctx the parse tree
	 */
	enterUngroup?: (ctx: UngroupContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.ungroup`.
	 * @param ctx the parse tree
	 */
	exitUngroup?: (ctx: UngroupContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	enterFieldExpr?: (ctx: FieldExprContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 */
	exitFieldExpr?: (ctx: FieldExprContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.partialAllowedFieldExpr`.
	 * @param ctx the parse tree
	 */
	enterPartialAllowedFieldExpr?: (ctx: PartialAllowedFieldExprContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.partialAllowedFieldExpr`.
	 * @param ctx the parse tree
	 */
	exitPartialAllowedFieldExpr?: (ctx: PartialAllowedFieldExprContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.pickStatement`.
	 * @param ctx the parse tree
	 */
	enterPickStatement?: (ctx: PickStatementContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.pickStatement`.
	 * @param ctx the parse tree
	 */
	exitPickStatement?: (ctx: PickStatementContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.pick`.
	 * @param ctx the parse tree
	 */
	enterPick?: (ctx: PickContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.pick`.
	 * @param ctx the parse tree
	 */
	exitPick?: (ctx: PickContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.argumentList`.
	 * @param ctx the parse tree
	 */
	enterArgumentList?: (ctx: ArgumentListContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.argumentList`.
	 * @param ctx the parse tree
	 */
	exitArgumentList?: (ctx: ArgumentListContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.fieldNameList`.
	 * @param ctx the parse tree
	 */
	enterFieldNameList?: (ctx: FieldNameListContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.fieldNameList`.
	 * @param ctx the parse tree
	 */
	exitFieldNameList?: (ctx: FieldNameListContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.fieldCollection`.
	 * @param ctx the parse tree
	 */
	enterFieldCollection?: (ctx: FieldCollectionContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.fieldCollection`.
	 * @param ctx the parse tree
	 */
	exitFieldCollection?: (ctx: FieldCollectionContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 */
	enterCollectionMember?: (ctx: CollectionMemberContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 */
	exitCollectionMember?: (ctx: CollectionMemberContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.fieldPath`.
	 * @param ctx the parse tree
	 */
	enterFieldPath?: (ctx: FieldPathContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.fieldPath`.
	 * @param ctx the parse tree
	 */
	exitFieldPath?: (ctx: FieldPathContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.joinName`.
	 * @param ctx the parse tree
	 */
	enterJoinName?: (ctx: JoinNameContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.joinName`.
	 * @param ctx the parse tree
	 */
	exitJoinName?: (ctx: JoinNameContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.fieldName`.
	 * @param ctx the parse tree
	 */
	enterFieldName?: (ctx: FieldNameContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.fieldName`.
	 * @param ctx the parse tree
	 */
	exitFieldName?: (ctx: FieldNameContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.justExpr`.
	 * @param ctx the parse tree
	 */
	enterJustExpr?: (ctx: JustExprContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.justExpr`.
	 * @param ctx the parse tree
	 */
	exitJustExpr?: (ctx: JustExprContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.json`.
	 * @param ctx the parse tree
	 */
	enterJson?: (ctx: JsonContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.json`.
	 * @param ctx the parse tree
	 */
	exitJson?: (ctx: JsonContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.jsonValue`.
	 * @param ctx the parse tree
	 */
	enterJsonValue?: (ctx: JsonValueContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.jsonValue`.
	 * @param ctx the parse tree
	 */
	exitJsonValue?: (ctx: JsonValueContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.jsonObject`.
	 * @param ctx the parse tree
	 */
	enterJsonObject?: (ctx: JsonObjectContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.jsonObject`.
	 * @param ctx the parse tree
	 */
	exitJsonObject?: (ctx: JsonObjectContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.jsonProperty`.
	 * @param ctx the parse tree
	 */
	enterJsonProperty?: (ctx: JsonPropertyContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.jsonProperty`.
	 * @param ctx the parse tree
	 */
	exitJsonProperty?: (ctx: JsonPropertyContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.jsonArray`.
	 * @param ctx the parse tree
	 */
	enterJsonArray?: (ctx: JsonArrayContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.jsonArray`.
	 * @param ctx the parse tree
	 */
	exitJsonArray?: (ctx: JsonArrayContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.sqlExploreNameRef`.
	 * @param ctx the parse tree
	 */
	enterSqlExploreNameRef?: (ctx: SqlExploreNameRefContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.sqlExploreNameRef`.
	 * @param ctx the parse tree
	 */
	exitSqlExploreNameRef?: (ctx: SqlExploreNameRefContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.nameSQLBlock`.
	 * @param ctx the parse tree
	 */
	enterNameSQLBlock?: (ctx: NameSQLBlockContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.nameSQLBlock`.
	 * @param ctx the parse tree
	 */
	exitNameSQLBlock?: (ctx: NameSQLBlockContext) => void;

	/**
	 * Enter a parse tree produced by `MalloyParser.connectionName`.
	 * @param ctx the parse tree
	 */
	enterConnectionName?: (ctx: ConnectionNameContext) => void;
	/**
	 * Exit a parse tree produced by `MalloyParser.connectionName`.
	 * @param ctx the parse tree
	 */
	exitConnectionName?: (ctx: ConnectionNameContext) => void;
}

