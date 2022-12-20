// Generated from MalloyParser.g4 by ANTLR 4.9.0-SNAPSHOT


import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";

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
 * This interface defines a complete generic visitor for a parse tree produced
 * by `MalloyParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export interface MalloyParserVisitor<Result> extends ParseTreeVisitor<Result> {
	/**
	 * Visit a parse tree produced by the `nameMember`
	 * labeled alternative in `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNameMember?: (ctx: NameMemberContext) => Result;

	/**
	 * Visit a parse tree produced by the `wildMember`
	 * labeled alternative in `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitWildMember?: (ctx: WildMemberContext) => Result;

	/**
	 * Visit a parse tree produced by the `newMember`
	 * labeled alternative in `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNewMember?: (ctx: NewMemberContext) => Result;

	/**
	 * Visit a parse tree produced by the `namedQueries_stub`
	 * labeled alternative in `MalloyParser.defineQuery`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNamedQueries_stub?: (ctx: NamedQueries_stubContext) => Result;

	/**
	 * Visit a parse tree produced by the `anonymousQuery`
	 * labeled alternative in `MalloyParser.defineQuery`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAnonymousQuery?: (ctx: AnonymousQueryContext) => Result;

	/**
	 * Visit a parse tree produced by the `NamedSource`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNamedSource?: (ctx: NamedSourceContext) => Result;

	/**
	 * Visit a parse tree produced by the `TableSource`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTableSource?: (ctx: TableSourceContext) => Result;

	/**
	 * Visit a parse tree produced by the `QuerySource`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitQuerySource?: (ctx: QuerySourceContext) => Result;

	/**
	 * Visit a parse tree produced by the `SQLSourceName`
	 * labeled alternative in `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSQLSourceName?: (ctx: SQLSourceNameContext) => Result;

	/**
	 * Visit a parse tree produced by the `literalTimestamp`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLiteralTimestamp?: (ctx: LiteralTimestampContext) => Result;

	/**
	 * Visit a parse tree produced by the `literalDay`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLiteralDay?: (ctx: LiteralDayContext) => Result;

	/**
	 * Visit a parse tree produced by the `literalWeek`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLiteralWeek?: (ctx: LiteralWeekContext) => Result;

	/**
	 * Visit a parse tree produced by the `literalMonth`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLiteralMonth?: (ctx: LiteralMonthContext) => Result;

	/**
	 * Visit a parse tree produced by the `literalQuarter`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLiteralQuarter?: (ctx: LiteralQuarterContext) => Result;

	/**
	 * Visit a parse tree produced by the `literalYear`
	 * labeled alternative in `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLiteralYear?: (ctx: LiteralYearContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprString`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprString?: (ctx: ExprStringContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprNumber`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprNumber?: (ctx: ExprNumberContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprTime`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprTime?: (ctx: ExprTimeContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprNULL`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprNULL?: (ctx: ExprNULLContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprBool`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprBool?: (ctx: ExprBoolContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprRegex`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprRegex?: (ctx: ExprRegexContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprNow`
	 * labeled alternative in `MalloyParser.literal`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprNow?: (ctx: ExprNowContext) => Result;

	/**
	 * Visit a parse tree produced by the `queryFieldRef`
	 * labeled alternative in `MalloyParser.queryFieldEntry`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitQueryFieldRef?: (ctx: QueryFieldRefContext) => Result;

	/**
	 * Visit a parse tree produced by the `queryFieldDef`
	 * labeled alternative in `MalloyParser.queryFieldEntry`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitQueryFieldDef?: (ctx: QueryFieldDefContext) => Result;

	/**
	 * Visit a parse tree produced by the `nestExisting`
	 * labeled alternative in `MalloyParser.nestEntry`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNestExisting?: (ctx: NestExistingContext) => Result;

	/**
	 * Visit a parse tree produced by the `nestDef`
	 * labeled alternative in `MalloyParser.nestEntry`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNestDef?: (ctx: NestDefContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprFieldPath`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprFieldPath?: (ctx: ExprFieldPathContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprFilter`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprFilter?: (ctx: ExprFilterContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprLiteral`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprLiteral?: (ctx: ExprLiteralContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprMinus`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprMinus?: (ctx: ExprMinusContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprDuration`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprDuration?: (ctx: ExprDurationContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprTimeTrunc`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprTimeTrunc?: (ctx: ExprTimeTruncContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprSafeCast`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprSafeCast?: (ctx: ExprSafeCastContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprMulDiv`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprMulDiv?: (ctx: ExprMulDivContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprAddSub`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprAddSub?: (ctx: ExprAddSubContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprRange`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprRange?: (ctx: ExprRangeContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprForRange`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprForRange?: (ctx: ExprForRangeContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprLogicalTree`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprLogicalTree?: (ctx: ExprLogicalTreeContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprCompare`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprCompare?: (ctx: ExprCompareContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprApply`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprApply?: (ctx: ExprApplyContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprNot`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprNot?: (ctx: ExprNotContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprLogical`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprLogical?: (ctx: ExprLogicalContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprCast`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprCast?: (ctx: ExprCastContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprCountDisinct`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprCountDisinct?: (ctx: ExprCountDisinctContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprAggregate`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprAggregate?: (ctx: ExprAggregateContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprExpr`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprExpr?: (ctx: ExprExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprFunc`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprFunc?: (ctx: ExprFuncContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprPick`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprPick?: (ctx: ExprPickContext) => Result;

	/**
	 * Visit a parse tree produced by the `exprUngroup`
	 * labeled alternative in `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprUngroup?: (ctx: ExprUngroupContext) => Result;

	/**
	 * Visit a parse tree produced by the `exploreArrowQuery`
	 * labeled alternative in `MalloyParser.query`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreArrowQuery?: (ctx: ExploreArrowQueryContext) => Result;

	/**
	 * Visit a parse tree produced by the `arrowQuery`
	 * labeled alternative in `MalloyParser.query`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitArrowQuery?: (ctx: ArrowQueryContext) => Result;

	/**
	 * Visit a parse tree produced by the `defJoinOne`
	 * labeled alternative in `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefJoinOne?: (ctx: DefJoinOneContext) => Result;

	/**
	 * Visit a parse tree produced by the `defJoinMany`
	 * labeled alternative in `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefJoinMany?: (ctx: DefJoinManyContext) => Result;

	/**
	 * Visit a parse tree produced by the `defJoinCross`
	 * labeled alternative in `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefJoinCross?: (ctx: DefJoinCrossContext) => Result;

	/**
	 * Visit a parse tree produced by the `defExploreDimension`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefExploreDimension?: (ctx: DefExploreDimensionContext) => Result;

	/**
	 * Visit a parse tree produced by the `defExploreMeasure`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefExploreMeasure?: (ctx: DefExploreMeasureContext) => Result;

	/**
	 * Visit a parse tree produced by the `defDeclare_stub`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefDeclare_stub?: (ctx: DefDeclare_stubContext) => Result;

	/**
	 * Visit a parse tree produced by the `defJoin_stub`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefJoin_stub?: (ctx: DefJoin_stubContext) => Result;

	/**
	 * Visit a parse tree produced by the `defExploreWhere`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefExploreWhere?: (ctx: DefExploreWhereContext) => Result;

	/**
	 * Visit a parse tree produced by the `defExplorePrimaryKey`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefExplorePrimaryKey?: (ctx: DefExplorePrimaryKeyContext) => Result;

	/**
	 * Visit a parse tree produced by the `defExploreRename`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefExploreRename?: (ctx: DefExploreRenameContext) => Result;

	/**
	 * Visit a parse tree produced by the `defExploreEditField`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefExploreEditField?: (ctx: DefExploreEditFieldContext) => Result;

	/**
	 * Visit a parse tree produced by the `defExploreQuery`
	 * labeled alternative in `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefExploreQuery?: (ctx: DefExploreQueryContext) => Result;

	/**
	 * Visit a parse tree produced by the `filterByShortcut`
	 * labeled alternative in `MalloyParser.filteredBy`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFilterByShortcut?: (ctx: FilterByShortcutContext) => Result;

	/**
	 * Visit a parse tree produced by the `filterByWhere`
	 * labeled alternative in `MalloyParser.filteredBy`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFilterByWhere?: (ctx: FilterByWhereContext) => Result;

	/**
	 * Visit a parse tree produced by the `joinWith`
	 * labeled alternative in `MalloyParser.joinDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJoinWith?: (ctx: JoinWithContext) => Result;

	/**
	 * Visit a parse tree produced by the `joinOn`
	 * labeled alternative in `MalloyParser.joinDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJoinOn?: (ctx: JoinOnContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.malloyDocument`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMalloyDocument?: (ctx: MalloyDocumentContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.malloyStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMalloyStatement?: (ctx: MalloyStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.defineExploreStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefineExploreStatement?: (ctx: DefineExploreStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreKeyword`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreKeyword?: (ctx: ExploreKeywordContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.defineQuery`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefineQuery?: (ctx: DefineQueryContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.topLevelAnonQueryDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTopLevelAnonQueryDef?: (ctx: TopLevelAnonQueryDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.defineSQLStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefineSQLStatement?: (ctx: DefineSQLStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.sqlBlock`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSqlBlock?: (ctx: SqlBlockContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.blockSQLDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBlockSQLDef?: (ctx: BlockSQLDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.sqlString`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSqlString?: (ctx: SqlStringContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.sqlInterpolation`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSqlInterpolation?: (ctx: SqlInterpolationContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.importStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitImportStatement?: (ctx: ImportStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.importURL`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitImportURL?: (ctx: ImportURLContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.topLevelQueryDefs`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTopLevelQueryDefs?: (ctx: TopLevelQueryDefsContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.topLevelQueryDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTopLevelQueryDef?: (ctx: TopLevelQueryDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.refineOperator`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRefineOperator?: (ctx: RefineOperatorContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.query`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitQuery?: (ctx: QueryContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.pipelineFromName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPipelineFromName?: (ctx: PipelineFromNameContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.firstSegment`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFirstSegment?: (ctx: FirstSegmentContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.pipeElement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPipeElement?: (ctx: PipeElementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreTable`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreTable?: (ctx: ExploreTableContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.queryProperties`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitQueryProperties?: (ctx: QueryPropertiesContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.filterShortcut`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFilterShortcut?: (ctx: FilterShortcutContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreQueryName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreQueryName?: (ctx: ExploreQueryNameContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.queryName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitQueryName?: (ctx: QueryNameContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreDefinitionList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreDefinitionList?: (ctx: ExploreDefinitionListContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreDefinition`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreDefinition?: (ctx: ExploreDefinitionContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.explore`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExplore?: (ctx: ExploreContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreSource`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreSource?: (ctx: ExploreSourceContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreNameDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreNameDef?: (ctx: ExploreNameDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreName?: (ctx: ExploreNameContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreProperties`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreProperties?: (ctx: ExplorePropertiesContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreStatement?: (ctx: ExploreStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.renameList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRenameList?: (ctx: RenameListContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreRenameDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreRenameDef?: (ctx: ExploreRenameDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.dimensionDefList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDimensionDefList?: (ctx: DimensionDefListContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.measureDefList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMeasureDefList?: (ctx: MeasureDefListContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.fieldDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFieldDef?: (ctx: FieldDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.fieldNameDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFieldNameDef?: (ctx: FieldNameDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.joinNameDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJoinNameDef?: (ctx: JoinNameDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.measureDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMeasureDef?: (ctx: MeasureDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.declareStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDeclareStatement?: (ctx: DeclareStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.joinStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJoinStatement?: (ctx: JoinStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.joinList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJoinList?: (ctx: JoinListContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.joinDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJoinDef?: (ctx: JoinDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.joinExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJoinExpression?: (ctx: JoinExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.filterStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFilterStatement?: (ctx: FilterStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.filteredBy`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFilteredBy?: (ctx: FilteredByContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.filterClauseList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFilterClauseList?: (ctx: FilterClauseListContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.whereStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitWhereStatement?: (ctx: WhereStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.havingStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitHavingStatement?: (ctx: HavingStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.subQueryDefList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSubQueryDefList?: (ctx: SubQueryDefListContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreQueryNameDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreQueryNameDef?: (ctx: ExploreQueryNameDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.exploreQueryDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExploreQueryDef?: (ctx: ExploreQueryDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.queryStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitQueryStatement?: (ctx: QueryStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.groupByStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitGroupByStatement?: (ctx: GroupByStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.queryFieldList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitQueryFieldList?: (ctx: QueryFieldListContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.dimensionDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDimensionDef?: (ctx: DimensionDefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.queryFieldEntry`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitQueryFieldEntry?: (ctx: QueryFieldEntryContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.nestStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNestStatement?: (ctx: NestStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.nestedQueryList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNestedQueryList?: (ctx: NestedQueryListContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.nestEntry`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNestEntry?: (ctx: NestEntryContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.aggregateStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAggregateStatement?: (ctx: AggregateStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.projectStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitProjectStatement?: (ctx: ProjectStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.orderByStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitOrderByStatement?: (ctx: OrderByStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.ordering`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitOrdering?: (ctx: OrderingContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.orderBySpec`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitOrderBySpec?: (ctx: OrderBySpecContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.limitStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLimitStatement?: (ctx: LimitStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.bySpec`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBySpec?: (ctx: BySpecContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.topStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTopStatement?: (ctx: TopStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.indexElement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIndexElement?: (ctx: IndexElementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.indexFields`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIndexFields?: (ctx: IndexFieldsContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.indexStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIndexStatement?: (ctx: IndexStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.sampleStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSampleStatement?: (ctx: SampleStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.sampleSpec`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSampleSpec?: (ctx: SampleSpecContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.aggregate`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAggregate?: (ctx: AggregateContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.malloyType`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMalloyType?: (ctx: MalloyTypeContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.compareOp`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCompareOp?: (ctx: CompareOpContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.literal`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLiteral?: (ctx: LiteralContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.dateLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDateLiteral?: (ctx: DateLiteralContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.tableName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTableName?: (ctx: TableNameContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.id`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitId?: (ctx: IdContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.timeframe`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTimeframe?: (ctx: TimeframeContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.ungroup`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUngroup?: (ctx: UngroupContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.fieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFieldExpr?: (ctx: FieldExprContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.partialAllowedFieldExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPartialAllowedFieldExpr?: (ctx: PartialAllowedFieldExprContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.pickStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPickStatement?: (ctx: PickStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.pick`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPick?: (ctx: PickContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.argumentList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitArgumentList?: (ctx: ArgumentListContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.fieldNameList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFieldNameList?: (ctx: FieldNameListContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.fieldCollection`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFieldCollection?: (ctx: FieldCollectionContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.collectionMember`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCollectionMember?: (ctx: CollectionMemberContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.fieldPath`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFieldPath?: (ctx: FieldPathContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.joinName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJoinName?: (ctx: JoinNameContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.fieldName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFieldName?: (ctx: FieldNameContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.justExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJustExpr?: (ctx: JustExprContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.json`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJson?: (ctx: JsonContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.jsonValue`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJsonValue?: (ctx: JsonValueContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.jsonObject`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJsonObject?: (ctx: JsonObjectContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.jsonProperty`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJsonProperty?: (ctx: JsonPropertyContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.jsonArray`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitJsonArray?: (ctx: JsonArrayContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.sqlExploreNameRef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSqlExploreNameRef?: (ctx: SqlExploreNameRefContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.nameSQLBlock`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNameSQLBlock?: (ctx: NameSQLBlockContext) => Result;

	/**
	 * Visit a parse tree produced by `MalloyParser.connectionName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitConnectionName?: (ctx: ConnectionNameContext) => Result;
}

