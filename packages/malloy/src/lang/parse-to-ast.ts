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
import { ParseTree } from "antlr4ts/tree";
import { AbstractParseTreeVisitor } from "antlr4ts/tree/AbstractParseTreeVisitor";
import { MalloyVisitor } from "./lib/Malloy/MalloyVisitor";
import * as parse from "./lib/Malloy/MalloyParser";
import * as ast from "./ast";
import { LogMessage, MessageLogger } from "./parse-log";
import * as Source from "./source-reference";
import { ParseMalloy } from "./parse-malloy";

/**
 * ANTLR visitor pattern parse tree traversal. Generates a Malloy
 * AST from an ANTLR parse tree.
 */
export class MalloyToAST
  extends AbstractParseTreeVisitor<ast.MalloyElement>
  implements MalloyVisitor<ast.MalloyElement>
{
  constructor(readonly parse: ParseMalloy, readonly msgLog: MessageLogger) {
    super();
  }

  /**
   * Mostly used to flag a case where the grammar and the type system are
   * no longer in sync. A visitor was written based on a grammar which
   * apparently has changed and now an unexpected element type has appeared.
   * This is a non recoverable error, since the parser and the grammar
   * are not compatible.
   * @returns an error object to throw.
   */
  protected internalError(cx: ParserRuleContext, msg: string): Error {
    const tmsg = `Internal Translator Error: ${msg}`;
    this.contextError(cx, tmsg);
    return new Error(tmsg);
  }

  /**
   * Log an error message relative to an AST node
   */
  protected astError(el: ast.MalloyElement, str: string): void {
    this.msgLog.log({
      sourceURL: this.parse.sourceURL,
      message: str,
      ...el.location,
    });
  }

  /**
   * Log an error message relative to a parse node
   */
  protected contextError(cx: ParserRuleContext, msg: string): void {
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

  protected onlyExploreProperties(
    els: ast.MalloyElement[]
  ): ast.ExploreProperty[] {
    const eps: ast.ExploreProperty[] = [];
    for (const el of els) {
      if (ast.isExploreProperty(el)) {
        eps.push(el);
      } else {
        this.astError(el, `Expected explore property, not '${el.elementType}'`);
      }
    }
    return eps;
  }

  protected onlyJoins(els: ast.MalloyElement[]): ast.Join[] {
    const eps: ast.Join[] = [];
    for (const el of els) {
      if (el instanceof ast.Join) {
        eps.push(el);
      } else {
        this.astError(el, `Expected explore property, not '${el.elementType}'`);
      }
    }
    return eps;
  }

  protected onlyDocStatements(els: ast.MalloyElement[]): ast.DocStatement[] {
    const eps: ast.DocStatement[] = [];
    for (const el of els) {
      if (ast.isDocStatement(el)) {
        eps.push(el);
      } else {
        this.astError(el, `Expected statement, not '${el.elementType}'`);
      }
    }
    return eps;
  }

  protected onlyNestedQueries(els: ast.MalloyElement[]): ast.NestedQuery[] {
    const eps: ast.NestedQuery[] = [];
    for (const el of els) {
      if (ast.isNestedQuery(el)) {
        eps.push(el);
      } else {
        this.astError(el, `Expected query, not '${el.elementType}'`);
      }
    }
    return eps;
  }

  protected getNumber(term: ParseTree): number {
    return Number.parseInt(term.text);
  }

  protected getIdText(fromTerm: ParseTree): string {
    return this.stripQuotes(fromTerm.text);
  }

  protected stripQuotes(s: string): string {
    if (s[0] === "`" || s[0] === "'" || s[0] === '"') {
      if (s[0] === s[s.length - 1]) {
        return s.slice(1, -1);
      }
    }
    return s;
  }

  defaultResult(): ast.MalloyElement {
    return new ast.Unimplemented();
  }

  protected astAt<MT extends ast.MalloyElement>(
    el: MT,
    cx: ParserRuleContext
  ): MT {
    el.location = Source.rangeFromContext(cx);
    return el;
  }

  protected getFilterElement(cx: parse.FieldExprContext): ast.FilterElement {
    const expr = this.getFieldExpr(cx);
    const fel = new ast.FilterElement(expr, cx.text);
    return this.astAt(fel, cx);
  }

  protected getFieldDefs(
    cxList: ParserRuleContext[],
    isAgg?: boolean
  ): ast.ExprFieldDecl[] {
    const visited: ast.ExprFieldDecl[] = [];
    for (const cx of cxList) {
      const v = this.visit(cx);
      if (v instanceof ast.ExprFieldDecl) {
        this.astAt(v, cx);
        visited.push(v);
        if (isAgg !== undefined) {
          v.isMeasure = isAgg;
        }
      } else {
        this.contextError(cx, "Expected field definition");
      }
    }
    return visited;
  }

  protected getFieldExpr(cx: parse.FieldExprContext): ast.ExpressionDef {
    const element = this.visit(cx);
    if (element instanceof ast.ExpressionDef) {
      return this.astAt(element, cx);
    }
    throw this.internalError(
      cx,
      `expression node unknown type '${element.elementType}'`
    );
  }

  protected getSegments(segments: parse.PipeElementContext[]): ast.QOPDesc[] {
    return segments.map((cx) =>
      this.visitQueryProperties(cx.queryProperties())
    );
  }

  protected getFilterShortcut(cx: parse.FilterShortcutContext): ast.Filter {
    const el = this.getFilterElement(cx.fieldExpr());
    return new ast.Filter([el]);
  }

  protected getFieldPath(pcx: parse.FieldPathContext): string {
    const nameCx = pcx.fieldName();
    const tailCx = pcx.joinField();
    const parts: string[] = [];
    if (nameCx) {
      parts.push(this.getIdText(nameCx));
    } else if (tailCx) {
      const joins = pcx.joinPath()?.joinName() || [];
      parts.push(...joins.map((jcx) => this.getIdText(jcx)));
      parts.push(this.getIdText(tailCx));
    }
    return parts.join(".");
  }

  protected getExploreSource(pcx: parse.ExploreSourceContext): ast.Mallobj {
    const element = this.visit(pcx);
    if (element instanceof ast.Mallobj) {
      return element;
    }
    throw this.internalError(
      pcx,
      `'${element.elementType}': illegal explore source`
    );
  }

  visitMalloyDocument(pcx: parse.MalloyDocumentContext): ast.Document {
    const stmts = this.onlyDocStatements(
      pcx.malloyStatement().map((scx) => this.visit(scx))
    );
    return new ast.Document(stmts);
  }

  visitExploreDefinition(
    pcx: parse.ExploreDefinitionContext
  ): ast.DefineExplore {
    const exploreDef = new ast.DefineExplore(
      this.getIdText(pcx.exploreNameDef()),
      this.visitExplore(pcx.explore()),
      true,
      []
    );
    return this.astAt(exploreDef, pcx);
  }

  visitExplore(pcx: parse.ExploreContext): ast.Mallobj {
    const source = this.getExploreSource(pcx.exploreSource());
    const refineCx = pcx.exploreProperties();
    if (refineCx) {
      return this.astAt(
        new ast.RefinedExplore(source, this.visitExploreProperties(refineCx)),
        pcx
      );
    }
    return source;
  }

  visitExploreProperties(pcx: parse.ExplorePropertiesContext): ast.ExploreDesc {
    const filterCx = pcx.filterShortcut();
    const visited = pcx.exploreStatement().map((ecx) => this.visit(ecx));
    const propList = new ast.ExploreDesc(this.onlyExploreProperties(visited));
    if (filterCx) {
      propList.push(this.getFilterShortcut(filterCx));
    }
    return propList;
  }

  visitExploreTable(pcx: parse.ExploreTableContext): ast.TableSource {
    const tableName = this.stripQuotes(pcx.tableName().text);
    return this.astAt(new ast.TableSource(tableName), pcx);
  }

  visitTableSource(pcx: parse.TableSourceContext): ast.TableSource {
    return this.visitExploreTable(pcx.exploreTable());
  }

  visitQuerySource(pcx: parse.QuerySourceContext): ast.Mallobj {
    const query = this.visit(pcx.query());
    if (ast.isQueryElement(query)) {
      return this.astAt(new ast.QuerySource(query), pcx);
    }
    throw this.internalError(
      pcx,
      `Expect query definition, got a '${query.elementType}'`
    );
  }

  visitDefJoinMany(pcx: parse.DefJoinManyContext): ast.Joins {
    const joinList = this.getJoinList(pcx.joinList());
    const joins: ast.Join[] = [];
    for (const join of joinList) {
      if (join instanceof ast.Join) {
        if (join instanceof ast.ExpressionJoin) {
          join.many = true;
        } else if (join instanceof ast.KeyJoin) {
          join.log("Foreign key join not legal in join_one:");
          continue;
        }
        joins.push(join);
      }
    }
    return new ast.Joins(joins);
  }

  visitDefJoinOne(pcx: parse.DefJoinOneContext): ast.Joins {
    const joinList = this.getJoinList(pcx.joinList());
    const joins: ast.Join[] = [];
    for (const join of joinList) {
      if (join instanceof ast.Join) {
        if (join instanceof ast.ExpressionJoin) {
          join.many = false;
        } else if (join instanceof ast.CrossJoin) {
          join.log("Cross join not legal in join_one:");
          continue;
        }
        joins.push(join);
      }
    }
    return new ast.Joins(joins);
  }

  protected getJoinList(pcx: parse.JoinListContext): ast.MalloyElement[] {
    return pcx.joinDef().map((jcx) => this.visit(jcx));
  }

  protected getJoinSource(
    name: string,
    ecx: parse.ExploreContext | undefined
  ): ast.Mallobj {
    if (ecx) {
      return this.visitExplore(ecx);
    }
    return new ast.NamedSource(name);
  }

  visitJoinOn(pcx: parse.JoinOnContext): ast.Join {
    const joinAs = this.getIdText(pcx.joinNameDef());
    const joinFrom = this.getJoinSource(joinAs, pcx.explore());
    const joinOn = this.getFieldExpr(pcx.joinExpression());
    const join = new ast.ExpressionJoin(joinAs, joinFrom, joinOn);
    return this.astAt(join, pcx);
  }

  visitJoinWith(pcx: parse.JoinWithContext): ast.Join {
    const joinAs = this.getIdText(pcx.joinNameDef());
    const joinFrom = this.getJoinSource(joinAs, pcx.explore());
    const joinOn = this.getIdText(pcx.fieldName());
    const join = new ast.KeyJoin(joinAs, joinFrom, joinOn);
    return this.astAt(join, pcx);
  }

  visitJoinCross(pcx: parse.JoinCrossContext): ast.Join {
    const joinAs = this.getIdText(pcx.joinNameDef());
    const joinFrom = this.getJoinSource(joinAs, pcx.explore());
    const join = new ast.CrossJoin(joinAs, joinFrom);
    return this.astAt(join, pcx);
  }

  visitFieldDef(pcx: parse.FieldDefContext): ast.ExprFieldDecl {
    const defCx = pcx.fieldExpr();
    const fieldName = this.getIdText(pcx.fieldNameDef());
    const valExpr = this.getFieldExpr(defCx);
    const def = new ast.ExprFieldDecl(valExpr, fieldName, defCx.text);
    return this.astAt(def, pcx);
  }

  visitDefExploreDimension(
    pcx: parse.DefExploreDimensionContext
  ): ast.Dimensions {
    const defs = this.getFieldDefs(
      pcx.dimensionDefList().dimensionDef(),
      false
    );
    const stmt = new ast.Dimensions(defs);
    return this.astAt(stmt, pcx);
  }

  visitDefExploreMeasure(pcx: parse.DefExploreMeasureContext): ast.Measures {
    const defs = this.getFieldDefs(pcx.measureDefList().measureDef(), true);
    const stmt = new ast.Measures(defs);
    return this.astAt(stmt, pcx);
  }

  visitDefExploreRename(pcx: parse.DefExploreRenameContext): ast.RenameField {
    const newName = pcx.fieldName(0).id();
    const oldName = pcx.fieldName(1).id();
    const rename = new ast.RenameField(
      this.getIdText(newName),
      this.getIdText(oldName)
    );
    return this.astAt(rename, pcx);
  }

  visitFilterClauseList(pcx: parse.FilterClauseListContext): ast.Filter {
    const oneExprCx = pcx.fieldExpr();
    if (oneExprCx) {
      const fExpr = this.getFilterElement(oneExprCx);
      return new ast.Filter([fExpr]);
    }
    const clauses = pcx.fieldExprList()?.fieldExpr() || [];
    return new ast.Filter(clauses.map((fcx) => this.getFilterElement(fcx)));
  }

  visitFilterByShortcut(pcx: parse.FilterByShortcutContext): ast.Filter {
    const el = this.getFilterElement(pcx.fieldExpr());
    return this.astAt(new ast.Filter([el]), pcx);
  }

  visitWhereStatement(pcx: parse.WhereStatementContext): ast.Filter {
    const where = this.visitFilterClauseList(pcx.filterClauseList());
    where.having = false;
    return this.astAt(where, pcx);
  }

  visitHavingStatement(pcx: parse.HavingStatementContext): ast.Filter {
    const having = this.visitFilterClauseList(pcx.filterClauseList());
    having.having = true;
    return this.astAt(having, pcx);
  }

  visitSubQueryDefList(pcx: parse.SubQueryDefListContext): ast.Turtles {
    const babyTurtles = pcx
      .exploreQueryDef()
      .map((cx) => this.visitExploreQueryDef(cx));
    return new ast.Turtles(babyTurtles);
  }

  visitDefExplorePrimaryKey(
    pcx: parse.DefExplorePrimaryKeyContext
  ): ast.PrimaryKey {
    const node = new ast.PrimaryKey(
      new ast.FieldName(this.getIdText(pcx.fieldName()))
    );
    return this.astAt(node, pcx);
  }

  visitFieldOrStar(pcx: parse.FieldOrStarContext): ast.FieldReference {
    if (pcx.STAR()) {
      return this.astAt(new ast.Wildcard("", "*"), pcx);
    }
    const fcx = pcx.fieldName();
    if (fcx) {
      return this.astAt(new ast.FieldName(this.getIdText(fcx)), fcx);
    }
    throw this.internalError(pcx, "mis-parsed field name reference");
  }

  visitFieldNameList(pcx: parse.FieldNameListContext): ast.FieldReferences {
    const members = pcx.fieldOrStar().map((cx) => this.visitFieldOrStar(cx));
    return new ast.FieldReferences(members);
  }

  visitDefExploreEditField(
    pcx: parse.DefExploreEditFieldContext
  ): ast.FieldListEdit {
    const action = pcx.ACCEPT() ? "accept" : "except";
    return new ast.FieldListEdit(
      action,
      this.visitFieldNameList(pcx.fieldNameList())
    );
  }

  visitQueryProperties(pcx: parse.QueryPropertiesContext): ast.QOPDesc {
    const qProps = pcx
      .queryStatement()
      .map((qcx) => this.astAt(this.visit(qcx), qcx))
      .filter(function (p: ast.MalloyElement): p is ast.QueryProperty {
        if (ast.isQueryProperty(p)) {
          return true;
        }
        p.log(`Unexpected statement type '${p.elementType}' in query`);
        return false;
      });
    const fcx = pcx.filterShortcut();
    if (fcx) {
      qProps.push(this.getFilterShortcut(fcx));
    }
    return new ast.QOPDesc(qProps);
  }

  visitFieldPath(pcx: parse.FieldPathContext): ast.FieldName {
    return this.astAt(new ast.FieldName(this.getFieldPath(pcx)), pcx);
  }

  visitGroupByEntry(pcx: parse.GroupByEntryContext): ast.QueryItem {
    const defCx = pcx.dimensionDef()?.fieldDef();
    if (defCx) {
      const dim = this.visitFieldDef(defCx);
      dim.isMeasure = false;
      return this.astAt(dim, defCx);
    }
    const refCx = pcx.fieldPath();
    if (refCx) {
      return this.astAt(this.visitFieldPath(refCx), refCx);
    }
    throw this.internalError(pcx, "query item was not a ref or a def");
  }

  visitGroupByList(pcx: parse.GroupByListContext): ast.GroupBy {
    const groupBy = pcx.groupByEntry().map((cx) => this.visitGroupByEntry(cx));
    return new ast.GroupBy(groupBy);
  }

  visitAggregateEntry(pcx: parse.AggregateEntryContext): ast.QueryItem {
    const defCx = pcx.measureDef()?.fieldDef();
    if (defCx) {
      const m = this.visitFieldDef(defCx);
      m.isMeasure = true;
      return this.astAt(m, defCx);
    }
    const refCx = pcx.fieldPath();
    if (refCx) {
      return this.astAt(this.visitFieldPath(refCx), refCx);
    }
    throw this.internalError(pcx, "query item was not a ref or a def");
  }

  visitAggregateList(pcx: parse.AggregateListContext): ast.Aggregate {
    const aggList = pcx
      .aggregateEntry()
      .map((e) => this.visitAggregateEntry(e));
    return new ast.Aggregate(aggList);
  }

  visitFieldCollection(
    pcx: parse.FieldCollectionContext
  ): ast.ProjectStatement {
    const fields: ast.FieldCollectionMember[] = [];
    for (const elCx of pcx.collectionMember()) {
      const el = this.visit(elCx);
      if (ast.isFieldCollectionMember(el)) {
        fields.push(el);
      } else {
        throw this.internalError(
          elCx,
          `${el.elementType} is not a query field`
        );
      }
    }
    return this.astAt(new ast.ProjectStatement(fields), pcx);
  }

  visitWildMember(pcx: parse.WildMemberContext): ast.FieldReference {
    const nameCx = pcx.fieldPath();
    const stars = pcx.STAR() ? "*" : "**";
    const join = nameCx ? this.getFieldPath(nameCx) : "";
    return new ast.Wildcard(join, stars);
  }

  visitIndexStatement(pcx: parse.IndexStatementContext): ast.Index {
    const fields = this.visitFieldNameList(pcx.fieldNameList());
    const indexStmt = new ast.Index(fields);
    const weightCx = pcx.fieldName();
    if (weightCx) {
      indexStmt.useWeight(new ast.FieldName(this.getIdText(weightCx)));
    }
    return this.astAt(indexStmt, pcx);
  }

  visitLimitStatement(pcx: parse.LimitStatementContext): ast.Limit {
    return new ast.Limit(this.getNumber(pcx.INTEGER_LITERAL()));
  }

  visitOrderBySpec(pcx: parse.OrderBySpecContext): ast.OrderBy {
    const dir = pcx.ASC() ? "asc" : pcx.DESC() ? "desc" : undefined;
    const ncx = pcx.INTEGER_LITERAL();
    if (ncx) {
      return new ast.OrderBy(this.getNumber(ncx), dir);
    }
    const fieldCx = pcx.fieldName();
    if (fieldCx) {
      return new ast.OrderBy(this.getIdText(fieldCx), dir);
    }
    throw this.internalError(pcx, "can't parse order_by specification");
  }

  visitOrdering(pcx: parse.OrderingContext): ast.Ordering {
    const orderList = pcx.orderBySpec().map((o) => this.visitOrderBySpec(o));
    return this.astAt(new ast.Ordering(orderList), pcx);
  }

  visitTopStatement(pcx: parse.TopStatementContext): ast.Top {
    const byCx = pcx.bySpec();
    const topN = this.getNumber(pcx.INTEGER_LITERAL());
    let top: ast.Top | undefined;
    if (byCx) {
      const nameCx = byCx.fieldName();
      if (nameCx) {
        top = new ast.Top(topN, { byString: this.getIdText(nameCx) });
      }
      const exprCx = byCx.fieldExpr();
      if (exprCx) {
        top = new ast.Top(topN, { byExpr: this.getFieldExpr(exprCx) });
      }
    }
    if (!top) {
      top = new ast.Top(topN, undefined);
    }
    return this.astAt(top, pcx);
  }

  visitExploreName(pcx: parse.ExploreNameContext): ast.NamedSource {
    const name = this.getIdText(pcx.id());
    return this.astAt(new ast.NamedSource(name), pcx);
  }

  visitFirstSegment(pcx: parse.FirstSegmentContext): ast.PipelineDesc {
    const qp = new ast.PipelineDesc();
    const nameCx = pcx.exploreQueryName();
    if (nameCx) {
      qp.headName = this.getIdText(nameCx);
    }
    const propsCx = pcx.queryProperties();
    if (propsCx) {
      const queryDesc = this.visitQueryProperties(propsCx);
      if (nameCx) {
        qp.refineHead(queryDesc);
      } else {
        qp.addSegments(queryDesc);
      }
    }
    return this.astAt(qp, pcx);
  }

  visitPipelineFromName(pcx: parse.PipelineFromNameContext): ast.PipelineDesc {
    const pipe = this.visitFirstSegment(pcx.firstSegment());
    const tail = this.getSegments(pcx.pipeElement());
    pipe.addSegments(...tail);
    return this.astAt(pipe, pcx);
  }

  visitExploreArrowQuery(pcx: parse.ExploreArrowQueryContext): ast.FullQuery {
    const root = this.visitExplore(pcx.explore());
    const queryPipe = this.visitPipelineFromName(pcx.pipelineFromName());
    return this.astAt(new ast.FullQuery(root, queryPipe), pcx);
  }

  visitArrowQuery(pcx: parse.ArrowQueryContext): ast.ExistingQuery {
    const pipe = new ast.PipelineDesc();
    pipe.headName = this.getIdText(pcx.queryName());
    const refCx = pcx.queryProperties();
    if (refCx) {
      pipe.refineHead(this.visitQueryProperties(refCx));
    }
    pipe.addSegments(...this.getSegments(pcx.pipeElement()));
    return this.astAt(new ast.ExistingQuery(pipe), pcx);
  }

  visitTopLevelQueryDefs(
    pcx: parse.TopLevelQueryDefsContext
  ): ast.DocStatement {
    const stmts = pcx
      .topLevelQueryDef()
      .map((cx) => this.visitTopLevelQueryDef(cx));
    if (stmts.length === 1) {
      return stmts[0];
    }
    return new ast.DefineQueryList(stmts);
  }

  visitTopLevelQueryDef(pcx: parse.TopLevelQueryDefContext): ast.DefineQuery {
    const queryName = this.getIdText(pcx.queryName());
    const queryDef = this.visit(pcx.query());
    if (ast.isQueryElement(queryDef)) {
      return this.astAt(new ast.DefineQuery(queryName, queryDef), pcx);
    }
    throw this.internalError(
      pcx,
      `Expect query definition, got a '${queryDef.elementType}'`
    );
  }

  visitAnonymousQuery(pcx: parse.AnonymousQueryContext): ast.AnonymousQuery {
    const query = this.visit(pcx.query());
    if (ast.isQueryElement(query)) {
      return new ast.AnonymousQuery(query);
    }
    throw this.internalError(
      pcx,
      `Anonymous query matched, but ${query.elementType} found`
    );
  }

  visitNestedQueryList(pcx: parse.NestedQueryListContext): ast.MalloyElement {
    const queryList = pcx.nestEntry();
    const nestedList = queryList.map((cx) => this.visit(cx));
    if (queryList.length == 1) {
      return nestedList[0];
    }
    return new ast.Nests(this.onlyNestedQueries(nestedList));
  }

  visitNestExisting(pcx: parse.NestExistingContext): ast.NestedQuery {
    const name = this.getIdText(pcx.queryName());
    return this.astAt(new ast.NestReference(name), pcx);
  }

  visitNestDef(pcx: parse.NestDefContext): ast.NestedQuery {
    const name = this.getIdText(pcx.queryName());
    const pipe = this.visitPipelineFromName(pcx.pipelineFromName());
    return this.astAt(new ast.NestDefinition(name, pipe), pcx);
  }

  visitExploreQueryDef(pcx: parse.ExploreQueryDefContext): ast.TurtleDecl {
    const name = this.getIdText(pcx.exploreQueryNameDef());
    const pipe = this.visitPipelineFromName(pcx.pipelineFromName());
    return this.astAt(new ast.TurtleDecl(name, pipe), pcx);
  }

  visitExprNot(pcx: parse.ExprNotContext): ast.ExprNot {
    return new ast.ExprNot(this.getFieldExpr(pcx.fieldExpr()));
  }

  visitExprBool(pcx: parse.ExprBoolContext): ast.Boolean {
    return new ast.Boolean(pcx.TRUE() ? "true" : "false");
  }

  allFieldExpressions(exprList: parse.FieldExprContext[]): ast.ExpressionDef[] {
    return exprList.map((ecx) => this.getFieldExpr(ecx));
  }

  visitExprLogical(pcx: parse.ExprLogicalContext): ast.ExprLogicalOp {
    const left = this.getFieldExpr(pcx.fieldExpr(0));
    const right = this.getFieldExpr(pcx.fieldExpr(1));
    return new ast.ExprLogicalOp(left, pcx.AND() ? "and" : "or", right);
  }

  visitExprLogicalTree(
    pcx: parse.ExprLogicalTreeContext
  ): ast.ExprAlternationTree {
    const left = this.getFieldExpr(pcx.fieldExpr());
    const right = this.getFieldExpr(pcx.partialAllowedFieldExpr());
    return new ast.ExprAlternationTree(left, pcx.AMPER() ? "&" : "|", right);
  }

  visitExprNotPartial(pcx: parse.ExprNotPartialContext): ast.ExpressionDef {
    return this.getFieldExpr(pcx.fieldExpr());
  }

  visitExprPartialCompare(
    pcx: parse.ExprPartialCompareContext
  ): ast.MalloyElement {
    const op = pcx.compareOp().text;
    if (ast.isComparison(op)) {
      return new ast.PartialCompare(op, this.getFieldExpr(pcx.fieldExpr()));
    }
    throw this.internalError(pcx, `partial comparison '${op}' not recognized`);
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
     * rightly points out that grammvisitExprFieldPathar can change in unexpected ways
     */
    if (number) {
      return new ast.ExprNumber(number);
    } else {
      this.contextError(pcx, `'${pcx.text}' is not a number`);
      return new ast.ExprNumber("42");
    }
  }

  visitExprFieldPath(pcx: parse.ExprFieldPathContext): ast.ExprIdReference {
    return new ast.ExprIdReference(this.getFieldPath(pcx.fieldPath()));
  }

  visitExprNULL(_pcx: parse.ExprNULLContext): ast.ExprNULL {
    return new ast.ExprNULL();
  }

  visitExprExpr(pcx: parse.ExprExprContext): ast.ExprParens {
    return new ast.ExprParens(this.getFieldExpr(pcx.partialAllowedFieldExpr()));
  }

  visitExprMinus(pcx: parse.ExprMinusContext): ast.ExprMinus {
    return new ast.ExprMinus(this.getFieldExpr(pcx.fieldExpr()));
  }

  visitExprAddSub(pcx: parse.ExprAddSubContext): ast.ExprAddSub {
    const lhs = this.getFieldExpr(pcx.fieldExpr(0));
    const rhs = this.getFieldExpr(pcx.fieldExpr(1));
    const op = pcx.PLUS() ? "+" : "-";
    return new ast.ExprAddSub(lhs, op, rhs);
  }

  visitExprMulDiv(pcx: parse.ExprMulDivContext): ast.ExprMulDiv {
    return new ast.ExprMulDiv(
      this.getFieldExpr(pcx.fieldExpr(0)),
      pcx.STAR() ? "*" : "/",
      this.getFieldExpr(pcx.fieldExpr(1))
    );
  }

  visitExprCompare(pcx: parse.ExprCompareContext): ast.ExprCompare {
    const op = pcx.compareOp().text;
    if (ast.isComparison(op)) {
      return new ast.ExprCompare(
        this.getFieldExpr(pcx.fieldExpr(0)),
        op,
        this.getFieldExpr(pcx.fieldExpr(1))
      );
    }
    throw this.internalError(pcx, `untranslatable comparison operator '${op}'`);
  }

  visitExprCountDisinct(
    pcx: parse.ExprCountDisinctContext
  ): ast.ExprCountDistinct {
    return new ast.ExprCountDistinct(this.getFieldExpr(pcx.fieldExpr()));
  }

  visitExprAggregate(pcx: parse.ExprAggregateContext): ast.ExpressionDef {
    const pathCx = pcx.fieldPath();
    const path = pathCx ? this.getFieldPath(pathCx) : undefined;

    const exprDef = pcx.fieldExpr();
    if (pcx.aggregate().COUNT()) {
      if (exprDef) {
        this.contextError(exprDef, "Ignored expression inside COUNT()");
      }
      return new ast.ExprCount(path);
    }

    // * was ok in count, not ok now ... this should be in grammer but at
    // the moment while things are still changing its right to be caught here
    const star = pcx.STAR();
    if (star) {
      this.contextError(pcx, "'*' is not a valid expression");
    }

    const expr = exprDef ? this.getFieldExpr(exprDef) : undefined;

    if (pcx.aggregate().MIN()) {
      if (path) {
        this.contextError(pcx, `Path not legal for min()`);
      } else if (expr) {
        return new ast.ExprMin(expr);
      } else {
        this.contextError(pcx, "Missing expression for min");
      }
    } else if (pcx.aggregate().MAX()) {
      if (path) {
        this.contextError(pcx, `Path not legal for max()`);
      } else if (expr) {
        return new ast.ExprMax(expr);
      } else {
        this.contextError(pcx, "Missing expression for max");
      }
    } else if (pcx.aggregate().AVG()) {
      return new ast.ExprAvg(expr, path);
    } else if (pcx.aggregate().SUM()) {
      return new ast.ExprSum(expr, path);
    }
    return new ast.ExprNULL();
  }

  visitExprApply(pcx: parse.ExprApplyContext): ast.Apply {
    return new ast.Apply(
      this.getFieldExpr(pcx.fieldExpr()),
      this.getFieldExpr(pcx.partialAllowedFieldExpr())
    );
  }

  visitExprRange(pcx: parse.ExprRangeContext): ast.Range {
    return new ast.Range(
      this.getFieldExpr(pcx.fieldExpr(0)),
      this.getFieldExpr(pcx.fieldExpr(1))
    );
  }

  visitExprCast(pcx: parse.ExprCastContext): ast.ExpressionDef {
    const type = pcx.malloyType().text;
    if (ast.isCastType(type)) {
      return new ast.ExprCast(this.getFieldExpr(pcx.fieldExpr()), type);
    }
    this.contextError(pcx, `CAST to unknown type '${type}'`);
    return new ast.ExprNULL();
  }

  visitExprSafeCast(pcx: parse.ExprSafeCastContext): ast.ExpressionDef {
    const type = pcx.malloyType().text;
    if (ast.isCastType(type)) {
      return new ast.ExprCast(this.getFieldExpr(pcx.fieldExpr()), type, true);
    }
    this.contextError(pcx, `'::' cast to unknown type '${type}'`);
    return new ast.ExprNULL();
  }

  visitExprTimeTrunc(pcx: parse.ExprTimeTruncContext): ast.ExprGranularTime {
    return new ast.ExprGranularTime(
      this.getFieldExpr(pcx.fieldExpr()),
      this.visitTimeframe(pcx.timeframe()).text,
      true
    );
  }

  visitTimeframe(pcx: parse.TimeframeContext): ast.Timeframe {
    return new ast.Timeframe(pcx.text);
  }

  visitExprForRange(pcx: parse.ExprForRangeContext): ast.ForRange {
    const begin = this.getFieldExpr(pcx._startAt);
    const duration = this.getFieldExpr(pcx._duration);
    const units = this.visitTimeframe(pcx.timeframe());
    return new ast.ForRange(begin, duration, units);
  }

  visitExprFunc(pcx: parse.ExprFuncContext): ast.ExprFunc {
    const argsCx = pcx.fieldExprList();
    let fn: string | undefined;

    const idCx = pcx.id();
    if (idCx) {
      fn = this.getIdText(idCx);
    }

    const dCx = pcx.timeframe();
    if (dCx) {
      fn = dCx.text;
    }

    if (fn === undefined) {
      this.contextError(pcx, "Funciton name error");
      fn = "FUNCTION_NAME_ERROR";
    }

    if (argsCx) {
      return new ast.ExprFunc(fn, this.allFieldExpressions(argsCx.fieldExpr()));
    }
    return new ast.ExprFunc(fn, []);
  }

  visitExprDuration(pcx: parse.ExprDurationContext): ast.ExprDuration {
    return new ast.ExprDuration(
      this.getFieldExpr(pcx.fieldExpr()),
      this.visitTimeframe(pcx.timeframe()).text
    );
  }

  visitPickStatement(pcx: parse.PickStatementContext): ast.Pick {
    const picks = pcx.pick().map((pwCx) => {
      let pickExpr: ast.ExpressionDef | undefined;
      if (pwCx._pickValue) {
        pickExpr = this.getFieldExpr(pwCx._pickValue);
      }
      return new ast.PickWhen(pickExpr, this.getFieldExpr(pwCx._pickWhen));
    });
    if (pcx.ELSE()) {
      return new ast.Pick(picks, this.getFieldExpr(pcx._pickElse));
    }
    return new ast.Pick(picks);
  }

  visitNamedSource(pcx: parse.NamedSourceContext): ast.NamedSource {
    const name = this.getIdText(pcx.exploreName());
    // Parameters ... coming ...
    // const paramListCx = pcx.isParam();
    // if (paramListCx) {
    //   const paramInit: Record<string, ast.ConstantSubExpression> = {};
    //   for (const cx of paramListCx) {
    //     const pName = this.identifer(cx.id());
    //     const pVal = this.getFieldExpr(cx.isExpr().partialAllowedFieldExpr());
    //     paramInit[pName] = new ast.ConstantSubExpression(pVal);
    //   }
    //   return this.astAt(new ast.NamedSource(name, paramInit), pcx);
    // }
    return this.astAt(new ast.NamedSource(name), pcx);
  }

  visitExprFilter(pcx: parse.ExprFilterContext): ast.ExprFilter {
    const filters = this.visit(pcx.filteredBy());
    return new ast.ExprFilter(
      this.getFieldExpr(pcx.fieldExpr()),
      filters as ast.Filter
    );
  }

  protected getLiteralTime(cx: ParserRuleContext): ast.ExpressionDef {
    const parsed = ast.GranularLiteral.parse(cx.text);
    if (parsed === undefined) {
      this.contextError(cx, `${cx.text} is not a legal day specification`);
      return new ast.ExprNow();
    }
    return parsed;
  }

  visitLiteralTimestamp(pcx: parse.LiteralTimestampContext): ast.ExpressionDef {
    return this.getLiteralTime(pcx);
  }

  visitLiteralDay(pcx: parse.LiteralDayContext): ast.ExpressionDef {
    return this.getLiteralTime(pcx);
  }

  visitLiteralWeek(pcx: parse.LiteralWeekContext): ast.ExpressionDef {
    return this.getLiteralTime(pcx);
  }

  visitLiteralMonth(pcx: parse.LiteralMonthContext): ast.ExpressionDef {
    return this.getLiteralTime(pcx);
  }

  visitLiteralQuarter(pcx: parse.LiteralQuarterContext): ast.ExpressionDef {
    return this.getLiteralTime(pcx);
  }

  visitLiteralYear(pcx: parse.LiteralYearContext): ast.ExpressionDef {
    return this.getLiteralTime(pcx);
  }

  visitImportStatement(pcx: parse.ImportStatementContext): ast.ImportStatement {
    const url = this.stripQuotes(pcx.importURL().text);
    return this.astAt(new ast.ImportStatement(url, this.parse.sourceURL), pcx);
  }

  visitJustExpr(pcx: parse.JustExprContext): ast.ExpressionDef {
    return this.getFieldExpr(pcx.fieldExpr());
  }
}
