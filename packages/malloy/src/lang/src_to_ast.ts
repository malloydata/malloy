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

import { ParserRuleContext } from "antlr4ts";
import { TerminalNode } from "antlr4ts/tree/TerminalNode";
import { AbstractParseTreeVisitor } from "antlr4ts/tree/AbstractParseTreeVisitor";
import { MalloyVisitor } from "./lib/Malloy/MalloyVisitor";
import * as parse from "./lib/Malloy/MalloyParser";
import * as ast from "./ast";
import { LogMessage, MessageLogger } from "./parse-log";
import * as Source from "./source-reference";
import { isComparison, isFieldDefinition } from "./ast";
import { ParseMalloy } from "./parse-malloy";
/**
 * Parse tree visitor which generates an AST from the ANTLR parse tree
 */
export class MalloyToAST
  extends AbstractParseTreeVisitor<ast.MalloyElement>
  implements MalloyVisitor<ast.MalloyElement>
{
  private queryIndex = 0;
  constructor(readonly parse: ParseMalloy, readonly msgLog: MessageLogger) {
    super();
  }

  semanticError(cx: ParserRuleContext, msg: string): void {
    const error: LogMessage = {
      sourceURL: this.parse.sourceURL,
      message: msg,
      begin: {
        line: cx.start.line,
        char: cx.start.charPositionInLine,
      },
    };
    if (cx.stop) {
      error.end = {
        line: cx.stop.line,
        char: cx.stop.charPositionInLine,
      };
    }
    this.msgLog.log(error);
  }

  num(term: TerminalNode): number {
    return Number.parseInt(term.text);
  }

  idText(cx: parse.IdContext): string {
    return this.stripQuotes(this.parse.tokens.getText(cx));
  }

  stripQuotes(s: string): string {
    if (s[0] === "`" || s[0] === "'" || s[0] === '"') {
      return s.slice(1, -1);
    }
    return s;
  }

  defaultResult(): ast.MalloyElement {
    return new ast.Unimplemented();
  }

  astAt<MT extends ast.MalloyElement>(el: MT, cx: ParserRuleContext): MT {
    el.location = Source.rangeFromContext(cx);
    return el;
  }

  visitPrimaryKey(pcx: parse.PrimaryKeyContext): ast.PrimaryKey {
    const node = new ast.PrimaryKey(new ast.FieldName(this.idText(pcx.id())));
    return this.astAt(node, pcx);
  }

  visitExprNot(pcx: parse.ExprNotContext): ast.ExprNot {
    return new ast.ExprNot(this.fieldExpression(pcx.fieldExpr()));
  }

  visitExprBool(pcx: parse.ExprBoolContext): ast.Boolean {
    return new ast.Boolean(pcx.TRUE() ? "true" : "false");
  }

  fieldExpression(cx: parse.FieldExprContext): ast.ExpressionDef {
    const element = this.visit(cx);
    if (element instanceof ast.ExpressionDef) {
      return this.astAt(element, cx);
    }
    throw new Error(`expression node unknown type '${element.elementType}`);
  }

  allFieldExpressions(exprList: parse.FieldExprContext[]): ast.ExpressionDef[] {
    return exprList.map((ecx) => this.fieldExpression(ecx));
  }

  visitFieldName(pcx: parse.FieldNameContext): ast.FieldName {
    return this.astAt(
      new ast.FieldName(this.idReference(pcx.idReference())),
      pcx
    );
  }
  idReference(pcx: parse.IdReferenceContext): string {
    const fullRef = pcx
      .id()
      .map((idcx) => this.idText(idcx))
      .join(".");
    return fullRef;
  }

  visitExprLogical(pcx: parse.ExprLogicalContext): ast.ExprLogicalOp {
    const left = this.fieldExpression(pcx.fieldExpr(0));
    const right = this.fieldExpression(pcx.fieldExpr(1));
    return new ast.ExprLogicalOp(left, pcx.AND() ? "and" : "or", right);
  }

  visitExprLogicalTree(
    pcx: parse.ExprLogicalTreeContext
  ): ast.ExprAlternationTree {
    const left = this.fieldExpression(pcx.fieldExpr());
    const right = this.fieldExpression(pcx.partialAllowedFieldExpr());
    return new ast.ExprAlternationTree(left, pcx.AMPER() ? "&" : "|", right);
  }

  visitExprNotPartial(pcx: parse.ExprNotPartialContext): ast.ExpressionDef {
    return this.fieldExpression(pcx.fieldExpr());
  }

  visitExprPartialCompare(
    pcx: parse.ExprPartialCompareContext
  ): ast.MalloyElement {
    const op = pcx.compareOp().text;
    if (isComparison(op)) {
      return new ast.PartialCompare(op, this.fieldExpression(pcx.fieldExpr()));
    }
    throw new Error(`partial comparison '${op}' not recognized`);
  }

  visitExprString(pcx: parse.ExprStringContext): ast.ExprString {
    return new ast.ExprString(pcx.STRING_LITERAL().text);
  }

  visitExprRegex(pcx: parse.ExprRegexContext): ast.ExprRegEx {
    const malloyRegex = pcx.HACKY_REGEX().text;
    return new ast.ExprRegEx(this.stripQuotes(malloyRegex.slice(1)));
  }

  visitExprNow(_pcx: parse.ExprNowContext): ast.ExprNow {
    return new ast.ExprNow();
  }

  visitExprNumber(pcx: parse.ExprNumberContext): ast.ExprNumber {
    const number = pcx.INTEGER_LITERAL()?.text || pcx.NUMERIC_LITERAL()?.text;
    /*
     * I "know" one of these is true because grammar, but Typescript
     * rightly points out that grammar can change in unexpected ways
     */
    if (number) {
      return new ast.ExprNumber(number);
    } else {
      this.semanticError(pcx, `'${pcx.text}' is not a number`);
      return new ast.ExprNumber("42");
    }
  }

  visitExprIdReference(pcx: parse.ExprIdReferenceContext): ast.ExprIdReference {
    return new ast.ExprIdReference(this.idReference(pcx.idReference()));
  }

  visitExprNULL(_pcx: parse.ExprNULLContext): ast.ExprNULL {
    return new ast.ExprNULL();
  }

  visitExprExpr(pcx: parse.ExprExprContext): ast.ExprParens {
    return new ast.ExprParens(
      this.fieldExpression(pcx.partialAllowedFieldExpr())
    );
  }

  visitExprMinus(pcx: parse.ExprMinusContext): ast.ExprMinus {
    return new ast.ExprMinus(this.fieldExpression(pcx.fieldExpr()));
  }

  visitExprAddSub(pcx: parse.ExprAddSubContext): ast.ExprAddSub {
    const lhs = this.fieldExpression(pcx.fieldExpr(0));
    const rhs = this.fieldExpression(pcx.fieldExpr(1));
    const op = pcx.PLUS() ? "+" : "-";
    return new ast.ExprAddSub(lhs, op, rhs);
  }

  visitExprMulDiv(pcx: parse.ExprMulDivContext): ast.ExprMulDiv {
    return new ast.ExprMulDiv(
      this.fieldExpression(pcx.fieldExpr(0)),
      pcx.STAR() ? "*" : "/",
      this.fieldExpression(pcx.fieldExpr(1))
    );
  }

  visitExprCompare(pcx: parse.ExprCompareContext): ast.ExprCompare {
    const op = pcx.compareOp().text;
    if (isComparison(op)) {
      return new ast.ExprCompare(
        this.fieldExpression(pcx.fieldExpr(0)),
        op,
        this.fieldExpression(pcx.fieldExpr(1))
      );
    }
    throw new Error(`untranslatable comparison operator '${op}'`);
  }

  visitExprCountDisinct(
    pcx: parse.ExprCountDisinctContext
  ): ast.ExprCountDistinct {
    return new ast.ExprCountDistinct(this.fieldExpression(pcx.fieldExpr()));
  }

  visitExprAggregate(pcx: parse.ExprAggregateContext): ast.ExpressionDef {
    const pathCx = pcx.fieldName();
    const path = pathCx ? this.visitFieldName(pathCx).name : undefined;

    const exprDef = pcx.fieldExpr();
    if (pcx.aggregate().COUNT()) {
      if (exprDef) {
        this.semanticError(exprDef, "Ignored expression inside COUNT()");
      }
      return new ast.ExprCount(path);
    }

    // * was ok in count, not ok now ... this should be in grammer but at
    // the moment while things are still changing its right to be caught here
    const star = pcx.STAR();
    if (star) {
      this.semanticError(pcx, "'*' is not a valid expression");
    }

    const expr = exprDef ? this.fieldExpression(exprDef) : undefined;

    // These require an expression ...
    if (expr && pcx.aggregate().MIN()) {
      if (path) {
        this.semanticError(pcx, `Ignored ${path}. before min`);
      }
      return new ast.ExprMin(expr);
    }
    if (expr && pcx.aggregate().MAX()) {
      if (path) {
        this.semanticError(pcx, `Ignored ${path}. before min`);
      }
      return new ast.ExprMax(expr);
    }

    // The asymnetric functions have an optional expression
    if (pcx.aggregate().AVG()) {
      return new ast.ExprAvg(expr, path);
    }
    if (pcx.aggregate().SUM()) {
      return new ast.ExprSum(expr, path);
    }
    this.semanticError(pcx, "Missing expression for aggregate function");
    return new ast.ExprNULL();
  }

  visitExprApply(pcx: parse.ExprApplyContext): ast.Apply {
    return new ast.Apply(
      this.fieldExpression(pcx.fieldExpr()),
      this.fieldExpression(pcx.partialAllowedFieldExpr())
    );
  }

  visitExprRange(pcx: parse.ExprRangeContext): ast.Range {
    return new ast.Range(
      this.fieldExpression(pcx.fieldExpr(0)),
      this.fieldExpression(pcx.fieldExpr(1))
    );
  }

  visitExprCast(pcx: parse.ExprCastContext): ast.ExpressionDef {
    const type = pcx.malloyType().text;
    if (ast.isCastType(type)) {
      return new ast.ExprCast(this.fieldExpression(pcx.fieldExpr()), type);
    }
    this.semanticError(pcx, `CAST to unknown type '${type}'`);
    return new ast.ExprNULL();
  }

  visitExprSafeCast(pcx: parse.ExprSafeCastContext): ast.ExpressionDef {
    const type = pcx.malloyType().text;
    if (ast.isCastType(type)) {
      return new ast.ExprCast(
        this.fieldExpression(pcx.fieldExpr()),
        type,
        true
      );
    }
    this.semanticError(pcx, `'::' cast to unknown type '${type}'`);
    return new ast.ExprNULL();
  }

  visitExprTimeTrunc(pcx: parse.ExprTimeTruncContext): ast.ExprGranularTime {
    return new ast.ExprGranularTime(
      this.fieldExpression(pcx.fieldExpr()),
      this.visitTimeframe(pcx.timeframe()).text,
      true
    );
  }

  visitTimeframe(pcx: parse.TimeframeContext): ast.Timeframe {
    return new ast.Timeframe(pcx.text);
  }

  visitExprForRange(pcx: parse.ExprForRangeContext): ast.ForRange {
    const begin = this.fieldExpression(pcx._startAt);
    const duration = this.fieldExpression(pcx._duration);
    const units = this.visitTimeframe(pcx.timeframe());
    return new ast.ForRange(begin, duration, units);
  }

  visitExprFunc(pcx: parse.ExprFuncContext): ast.ExprFunc {
    const argsCx = pcx.fieldExprList();
    let fn = "function_name_error";

    const idCx = pcx.id();
    if (idCx) {
      fn = this.idText(idCx);
    }

    const dCx = pcx.timeframe();
    if (dCx) {
      fn = dCx.text;
    }

    if (argsCx) {
      return new ast.ExprFunc(fn, this.allFieldExpressions(argsCx.fieldExpr()));
    }
    return new ast.ExprFunc(fn, []);
  }

  visitExprDuration(pcx: parse.ExprDurationContext): ast.ExprDuration {
    return new ast.ExprDuration(
      this.fieldExpression(pcx.fieldExpr()),
      this.visitTimeframe(pcx.timeframe()).text
    );
  }

  visitExprCase(pcx: parse.ExprCaseContext): ast.ExprCase {
    return this.visitCaseSpec(pcx.caseSpec());
  }

  visitCaseSpec(pcx: parse.CaseSpecContext): ast.ExprCase {
    const whenList: ast.WhenClause[] = [];
    const exprList = this.allFieldExpressions(pcx.fieldExpr());
    const lastWhen = pcx.ELSE() ? exprList.length - 1 : exprList.length;
    let index = 0;
    while (index < lastWhen) {
      whenList.push(new ast.WhenClause(exprList[index], exprList[index + 1]));
      index += 2;
    }
    if (pcx.ELSE()) {
      return new ast.ExprCase(whenList, exprList[lastWhen]);
    }
    return new ast.ExprCase(whenList);
  }

  visitPickStatement(pcx: parse.PickStatementContext): ast.Pick {
    const picks = pcx.pick().map((pwCx) => {
      let pickExpr: ast.ExpressionDef | undefined;
      if (pwCx._pickValue) {
        pickExpr = this.fieldExpression(pwCx._pickValue);
      }
      return new ast.PickWhen(pickExpr, this.fieldExpression(pwCx._pickWhen));
    });
    if (pcx.ELSE()) {
      return new ast.Pick(picks, this.fieldExpression(pcx._pickElse));
    }
    return new ast.Pick(picks);
  }

  visitRenameFieldDef(pcx: parse.RenameFieldDefContext): ast.RenameField {
    return new ast.RenameField(this.idText(pcx.id(0)), this.idText(pcx.id(1)));
  }

  defineName(cx?: parse.DefineNameContext): ast.FieldName | undefined {
    if (cx) {
      return this.visitDefineName(cx);
    }
    return undefined;
  }

  visitDefineName(pcx: parse.DefineNameContext): ast.FieldName {
    return this.astAt(new ast.FieldName(this.idText(pcx.id())), pcx);
  }

  visitExpressionFieldDef(
    pcx: parse.ExpressionFieldDefContext
  ): ast.ExpressionFieldDef {
    return this.astAt(
      new ast.ExpressionFieldDef(
        this.fieldExpression(pcx.fieldExpr()),
        this.visitDefineName(pcx.defineName()),
        pcx.fieldExpr().text
      ),
      pcx.fieldExpr()
    );
  }

  visitNameOnlyDef(pcx: parse.NameOnlyDefContext): ast.NameOnly {
    return new ast.NameOnly(
      this.visitFieldName(pcx.fieldName()),
      this.optionalFilters(pcx.filterList()),
      this.defineName(pcx.defineName())?.name
    );
  }

  pipeInit(
    stmtList: parse.StageStmtContext[],
    oldOrderCx: parse.OrderLimitContext
  ): Partial<ast.PipeInit> {
    const init: Partial<ast.PipeInit> = {};
    for (const stmtCx of stmtList) {
      const stmt = this.visit(stmtCx);
      if (stmt instanceof ast.Filter) {
        init.filter = stmt;
      } else if (stmt instanceof ast.OrderByList) {
        init.orderBy = stmt.list;
      } else if (stmt instanceof ast.Limit) {
        init.limit = stmt.limit;
      } else if (stmt instanceof ast.Top) {
        init.limit = stmt.limit;
        init.by = stmt.by;
      } else {
        this.semanticError(
          stmtCx,
          `Unexpected statement type '${stmt.elementType}'`
        );
      }
    }
    const oldOrder = this.visitOrderLimit(oldOrderCx);
    init.limit ||= oldOrder.limit;
    init.orderBy ||= oldOrder.orderBy.list;
    return init;
  }

  stageFields(
    defs: parse.FieldDefListContext,
    stage: "reduce" | "project"
  ): ast.ReduceField[] {
    const reduceFields: ast.ReduceField[] = [];
    for (const [cx, field] of this.fieldDefList(defs)) {
      if (
        field instanceof ast.NameOnly ||
        field instanceof ast.ExpressionFieldDef ||
        (stage !== "project" && field instanceof ast.Turtle) ||
        field instanceof ast.FieldReferences
      ) {
        reduceFields.push(field);
      } else {
        this.semanticError(
          cx,
          `Illegal field type '${field.elementType}' in a ${stage} stage`
        );
      }
    }
    return reduceFields;
  }

  visitReduceStage(pcx: parse.ReduceStageContext): ast.Reduce {
    return new ast.Reduce({
      ...this.pipeInit(pcx.stageStmt(), pcx.orderLimit()),
      fields: this.stageFields(pcx.fieldDefList(), "reduce"),
    });
  }

  visitProjectStage(pcx: parse.ProjectStageContext): ast.Project {
    return new ast.Project({
      ...this.pipeInit(pcx.stageStmt(), pcx.orderLimit()),
      fields: this.stageFields(pcx.fieldDefList(), "project"),
    });
  }

  collectInit(stmts: parse.TopStmtContext[]): Partial<ast.PipeInit> {
    const init: Partial<ast.PipeInit> = {};
    for (const stmtCx of stmts) {
      const stmt = this.visit(stmtCx);
      if (stmt instanceof ast.Filter) {
        init.filter = stmt;
      } else if (stmt instanceof ast.OrderByList) {
        init.orderBy = stmt.list;
      } else if (stmt instanceof ast.By) {
        init.by = stmt;
      } else {
        this.semanticError(
          stmtCx,
          `Unexpected statement type '${stmt.elementType}'`
        );
      }
    }
    return init;
  }

  visitNameMember(pcx: parse.NameMemberContext): ast.CollectionMember {
    return this.visitFieldName(pcx.fieldName());
  }

  visitWildMember(pcx: parse.WildMemberContext): ast.CollectionMember {
    const field = pcx.fieldName();
    const join = field ? this.visitFieldName(field).name : "";
    const stars = pcx.STAR() ? "*" : "**";
    return new ast.Wildcard(join, stars);
  }

  visitFieldNameCollection(
    cx: parse.FieldNameCollectionContext
  ): ast.FieldReferences {
    const members = cx
      .collectionMember()
      .map((cx) => this.visit(cx) as ast.CollectionMember);
    return new ast.FieldReferences(members);
  }

  visitIndexStage(pcx: parse.IndexStageContext): ast.Index {
    const index = new ast.Index();
    index.filter = this.optionalFilters(pcx.filterList());
    const fieldListCx = pcx.fieldNameCollection();
    if (fieldListCx) {
      index.fields = fieldListCx.map((ccx) =>
        this.visitFieldNameCollection(ccx)
      );
    }
    const onName = pcx.fieldName();
    if (onName) {
      index.on = this.visitFieldName(onName);
    }
    const limitCx = pcx.limit();
    if (limitCx) {
      index.limit = this.num(limitCx.INTEGER_LITERAL());
    }
    return index;
  }

  visitOrderBySpec(pcx: parse.OrderBySpecContext): ast.OrderBy {
    const dir = pcx.ASC() ? "asc" : pcx.DESC() ? "desc" : undefined;
    const ncx = pcx.INTEGER_LITERAL();
    if (ncx) {
      return new ast.OrderBy(this.num(ncx), dir);
    }
    const fieldCx = pcx.id();
    if (fieldCx) {
      return new ast.OrderBy(this.idText(fieldCx), dir);
    }
    throw new Error("order by what");
  }

  visitLimit(pcx: parse.LimitContext): ast.Limit {
    return new ast.Limit(this.num(pcx.INTEGER_LITERAL()));
  }

  visitByName(pcx: parse.ByNameContext): ast.By {
    return new ast.By(this.idText(pcx.id()));
  }

  visitByExpression(pcx: parse.ByExpressionContext): ast.By {
    return new ast.By(this.fieldExpression(pcx.fieldExpr()));
  }

  visitTopSpec(pcx: parse.TopSpecContext): ast.Top {
    const byCx = pcx.bySpec();
    const topN = this.num(pcx.INTEGER_LITERAL());
    if (byCx) {
      const by = this.visit(byCx);
      if (by instanceof ast.By) {
        return new ast.Top(topN, by);
      } else {
        this.semanticError(
          byCx,
          `TOP(${by.elementType}) recognized but not comprehensible`
        );
      }
    }
    return new ast.Top(topN, undefined);
  }

  visitOrderBy(pcx: parse.OrderByContext | undefined): ast.OrderByList {
    if (pcx) {
      return new ast.OrderByList(
        pcx.orderBySpec().map((cx) => this.visitOrderBySpec(cx))
      );
    }
    return new ast.OrderByList([]);
  }

  visitOrderLimit(pcx: parse.OrderLimitContext): ast.OrderLimit {
    const limit = pcx.limit();
    return new ast.OrderLimit(
      this.visitOrderBy(pcx.orderBy()),
      limit ? this.num(limit.INTEGER_LITERAL()) : undefined
    );
  }

  visitTableSource(pcx: parse.TableSourceContext): ast.TableSource {
    const tableName = this.stripQuotes(pcx.tableName().text);
    return this.astAt(new ast.TableSource(tableName), pcx);
  }

  visitNamedSource(pcx: parse.NamedSourceContext): ast.NamedSource {
    const exploreName = pcx.id();
    const name = this.idText(exploreName);
    return this.astAt(new ast.NamedSource(name), pcx.id());
  }

  visitAnonymousSource(pcx: parse.AnonymousSourceContext): ast.AnonymousSource {
    const query = this.visitExplore(pcx.explore());
    return new ast.AnonymousSource(query);
  }

  exploreSource(pcx: parse.ExploreSourceContext): ast.Mallobj {
    const element = this.visit(pcx);
    return element as ast.Mallobj;
  }

  joinList(cx: parse.JoinListContext): ast.Join[] {
    return cx.join().map((jcx) => this.visit(jcx) as ast.Join);
  }

  fieldDefList(
    pcx: parse.FieldDefListContext | undefined
  ): [parse.FieldDefContext, ast.MalloyElement][] {
    if (pcx) {
      return pcx.fieldDef().map((f) => [f, this.visit(f)]);
    }
    return [];
  }

  visitExplore(pcx: parse.ExploreContext): ast.Explore {
    const source = this.exploreSource(pcx.exploreSource());
    const explore: ast.ExploreInterface = {};

    const fEdit = pcx.fieldListEdit();
    if (fEdit) {
      explore.fieldListEdit = this.visitFieldListEdit(fEdit);
    }

    if (pcx.filterList()) {
      explore.filter = this.optionalFilters(pcx.filterList());
    }

    explore.fields = [];
    for (const [cx, field] of this.fieldDefList(pcx.fieldDefList())) {
      if (isFieldDefinition(field)) {
        explore.fields.push(field);
      } else {
        this.semanticError(
          cx,
          `References('${field.elementType}') not legal in source definition`
        );
      }
    }

    // TODO semanticError if any fields in list redefine existing fields

    const primKeyCx = pcx.primaryKey();
    if (primKeyCx) {
      explore.primaryKey = this.visitPrimaryKey(primKeyCx);
    }

    const pipeCx = pcx.pipeline();
    if (pipeCx) {
      explore.pipeline = this.visitPipeline(pipeCx);
    }

    // TODO semantic error if any joins in list redefine exisitng joins
    const joinsCx = pcx.joinList();
    if (joinsCx) {
      for (const aJoin of this.joinList(joinsCx)) {
        explore.fields.push(aJoin);
      }
    }

    return this.astAt(new ast.Explore(source, explore), pcx);
  }

  visitFilterList(pcx: parse.FilterListContext): ast.Filter {
    return this.astAt(this.visitBoolFilter(pcx.boolFilter()), pcx);
  }

  optionalFilters(pcx: parse.FilterListContext | undefined): ast.Filter {
    if (pcx) {
      return this.visitFilterList(pcx);
    }
    return new ast.Filter([]);
  }

  visitBoolFilter(pcx: parse.BoolFilterContext): ast.Filter {
    return new ast.Filter(
      pcx.filterElement().map((fe) => this.booleanFilterElement(fe.fieldExpr()))
    );
  }

  booleanFilterElement(cx: parse.FieldExprContext): ast.FilterElement {
    const src = cx.text;
    const expr = this.fieldExpression(cx);
    return new ast.FilterElement(expr, src);
  }

  visitExprFilter(pcx: parse.ExprFilterContext): ast.ExprFilter {
    return new ast.ExprFilter(
      this.fieldExpression(pcx.fieldExpr()),
      this.optionalFilters(pcx.filterList())
    );
  }

  visitFieldListEdit(pcx: parse.FieldListEditContext): ast.FieldListEdit {
    const action = pcx.ACCEPT() ? "accept" : "except";
    return new ast.FieldListEdit(
      action,
      this.visitFieldNameCollection(pcx.fieldNameCollection())
    );
  }

  visitJoinDef(pcx: parse.JoinDefContext): ast.Join {
    const joinFromName = this.idText(pcx.id());
    const joinName = new ast.FieldName(joinFromName);
    let joinSource: ast.Mallobj;
    const sourceCx = pcx.exploreSource();
    if (sourceCx) {
      joinSource = this.exploreSource(sourceCx);
    } else {
      joinSource = new ast.NamedSource(joinFromName);
      this.astAt(joinSource, pcx.id());
    }
    const joinKey = this.visitFieldName(pcx.fieldName());
    return this.astAt(new ast.Join(joinName, joinSource, joinKey), pcx);
  }

  visitJoinOn(pcx: parse.JoinOnContext): ast.Join {
    const joinFromName = this.idText(pcx.id());
    const joinName = new ast.FieldName(joinFromName);
    const joinStruct = new ast.NamedSource(joinFromName);
    const joinKey = this.visitFieldName(pcx.fieldName());
    return this.astAt(new ast.Join(joinName, joinStruct, joinKey), pcx);
  }

  visitJoinSource(pcx: parse.JoinSourceContext): ast.Join {
    const joinName = this.astAt(
      new ast.FieldName(this.idText(pcx.id())),
      pcx.id()
    );
    const joinStruct = this.exploreSource(pcx.exploreSource());
    const joinKey = this.visitFieldName(pcx.fieldName());
    return this.astAt(new ast.Join(joinName, joinStruct, joinKey), pcx);
  }

  visitDefineStatement(pcx: parse.DefineStatementContext): ast.Define {
    const exported = pcx.EXPORT() !== undefined;
    const name = this.idText(pcx.id());
    const value = this.visit(pcx.defineValue());
    const has = pcx.has().map((cx) => this.visit(cx));
    if (value instanceof ast.Mallobj) {
      const hasParams = has.length > 0 ? has : undefined;
      const def = new ast.Define(name, value, exported, hasParams);
      return this.astAt(def, pcx);
    }
    this.semanticError(pcx.defineValue(), "Expected exploreable object");
    throw new Error("define needs mallobj");
  }

  visitDefFromExplore(pcx: parse.DefFromExploreContext): ast.Explore {
    return this.visitExplore(pcx.explore());
  }

  visitDefFromJson(pcx: parse.DefFromJsonContext): ast.JSONStructDef {
    const jsonCx = pcx.json();
    // const jsonFrom = jsonCx.start.startIndex;
    if (jsonCx.stop) {
      // const jsonTo = jsonCx.stop.stopIndex;
      // const jsonAt = new Interval(jsonFrom, jsonTo);
      const jsonEl = new ast.JSONElement(jsonCx.text);
      const jsonSource = ast.JSONStructDef.fromJSON(jsonEl);
      if (jsonSource) {
        return jsonSource;
      }
    }
    throw new Error("JSON value is not a legal StructDef");
  }

  visitMalloyDocument(pcx: parse.MalloyDocumentContext): ast.MalloyElement {
    const scxs = pcx.malloyStatement();
    const allStmt = scxs.map((scx) => this.visit(scx));
    function isActual(me: ast.MalloyElement): me is ast.Statement {
      return me instanceof ast.Statement;
    }
    const stmts = allStmt.filter(isActual);
    return new ast.Document(stmts);
  }

  literalTime(cx: ParserRuleContext): ast.MalloyElement {
    const parsed = ast.GranularLiteral.parse(cx.text);
    if (parsed === undefined) {
      this.semanticError(cx, `${cx.text} is not a legal day specification`);
      return new ast.ExprNow();
    }
    return parsed;
  }

  visitLiteralTimestamp(pcx: parse.LiteralTimestampContext): ast.MalloyElement {
    return this.literalTime(pcx);
  }

  visitLiteralDay(pcx: parse.LiteralDayContext): ast.MalloyElement {
    return this.literalTime(pcx);
  }

  visitLiteralWeek(pcx: parse.LiteralWeekContext): ast.MalloyElement {
    return this.literalTime(pcx);
  }

  visitLiteralMonth(pcx: parse.LiteralMonthContext): ast.MalloyElement {
    return this.literalTime(pcx);
  }

  visitLiteralQuarter(pcx: parse.LiteralQuarterContext): ast.MalloyElement {
    return this.literalTime(pcx);
  }

  visitLiteralYear(pcx: parse.LiteralYearContext): ast.MalloyElement {
    return this.literalTime(pcx);
  }

  visitPipeline(pcx: parse.PipelineContext): ast.PipelineElement {
    const pipeCx = pcx.pipeStages();
    const segments: ast.SegmentElement[] = [];
    if (pipeCx) {
      for (const segmentCx of pipeCx.queryStage()) {
        const astStage = this.visit(segmentCx);
        if (astStage instanceof ast.SegmentElement) {
          this.astAt(astStage, segmentCx);
          segments.push(astStage);
        } else {
          this.semanticError(
            segmentCx,
            `Pipe has unexpected memmber ${astStage.elementType}'`
          );
        }
      }
    }

    const pipe = new ast.PipelineElement(segments);
    const turtleCx = pcx.fieldName();
    if (turtleCx) {
      const filterCx = pcx.filterList();
      const filters = filterCx ? this.visitFilterList(filterCx) : undefined;
      pipe.addHead(this.visitFieldName(turtleCx), filters);
    }
    return pipe;
  }

  visitTurtleFieldDef(pcx: parse.TurtleFieldDefContext): ast.Turtle {
    const name = this.visitDefineName(pcx.defineName());
    return this.astAt(
      new ast.Turtle(this.visitPipeline(pcx.pipeline()), name),
      pcx
    );
  }

  visitImportStatement(pcx: parse.ImportStatementContext): ast.ImportStatement {
    const url = this.stripQuotes(pcx.quotedURL().text);
    return this.astAt(new ast.ImportStatement(url, this.parse.sourceURL), pcx);
  }

  visitNamelessQuery(pcx: parse.NamelessQueryContext): ast.DocumentQuery {
    const explore = this.visitExplore(pcx.explore());
    const nq = this.astAt(new ast.DocumentQuery(explore, this.queryIndex), pcx);
    this.queryIndex += 1;
    return nq;
  }

  visitRequiredConditionParam(
    pcx: parse.RequiredConditionParamContext
  ): ast.HasParameter {
    const has = new ast.HasParameter({
      name: this.idText(pcx.id()),
      type: pcx.malloyType().text,
      isCondition: true,
    });
    return this.astAt(has, pcx);
  }

  visitOptionalConditionParam(
    pcx: parse.OptionalConditionParamContext
  ): ast.HasParameter {
    const has = new ast.HasParameter({
      name: this.idText(pcx.id()),
      type: pcx.malloyType()?.text,
      default: this.fieldExpression(pcx.hasExpr()),
      isCondition: true,
    });
    return this.astAt(has, pcx);
  }

  visitRequiredValueParam(
    pcx: parse.RequiredValueParamContext
  ): ast.HasParameter {
    const has = new ast.HasParameter({
      name: this.idText(pcx.id()),
      type: pcx.malloyType().text,
      isCondition: false,
    });
    return this.astAt(has, pcx);
  }

  visitOptionalValueParam(
    pcx: parse.OptionalValueParamContext
  ): ast.HasParameter {
    const has = new ast.HasParameter({
      name: this.idText(pcx.id()),
      type: pcx.malloyType()?.text,
      default: this.fieldExpression(pcx.hasExpr()),
      isCondition: false,
    });
    return this.astAt(has, pcx);
  }
}
