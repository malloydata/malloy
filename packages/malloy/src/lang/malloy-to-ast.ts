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

import {ParserRuleContext} from 'antlr4ts';
import {ParseTree, TerminalNode} from 'antlr4ts/tree';
import {AbstractParseTreeVisitor} from 'antlr4ts/tree/AbstractParseTreeVisitor';
import {MalloyParserVisitor} from './lib/Malloy/MalloyParserVisitor';
import * as parse from './lib/Malloy/MalloyParser';
import * as ast from './ast';
import {LogSeverity, MessageLogger} from './parse-log';
import {MalloyParseInfo} from './malloy-parse-info';
import {Interval as StreamInterval} from 'antlr4ts/misc/Interval';
import {FieldDeclarationConstructor, TableSource} from './ast';
import {
  getId,
  getOptionalId,
  HasString,
  HasID,
  getStringParts,
  getShortString,
  idToStr,
  getPlainString,
} from './parse-utils';
import {CastType} from '../model';
import {
  DocumentLocation,
  isCastType,
  isMatrixOperation,
  Note,
} from '../model/malloy_types';
import {Tag} from '../tags';
import {ConstantExpression} from './ast/expressions/constant-expression';

class ErrorNode extends ast.SourceQueryElement {
  elementType = 'parseErrorSourceQuery';
}

class IgnoredElement extends ast.MalloyElement {
  elementType = 'ignoredByParser';
  malloySrc: string;
  constructor(src: string) {
    super();
    this.malloySrc = src;
  }
}

const DEFAULT_COMPILER_FLAGS = ['##! m4warnings=error'];

type HasAnnotations = ParserRuleContext & {ANNOTATION: () => TerminalNode[]};

/**
 * ANTLR visitor pattern parse tree traversal. Generates a Malloy
 * AST from an ANTLR parse tree.
 */
export class MalloyToAST
  extends AbstractParseTreeVisitor<ast.MalloyElement>
  implements MalloyParserVisitor<ast.MalloyElement>
{
  constructor(
    readonly parseInfo: MalloyParseInfo,
    readonly msgLog: MessageLogger,
    public compilerFlags: Tag
  ) {
    super();
    for (const flag of DEFAULT_COMPILER_FLAGS) {
      const withNewTag = Tag.fromTagline(flag, this.compilerFlags);
      this.compilerFlags = withNewTag.tag;
    }
  }

  /**
   * Mostly used to flag a case where the grammar and the type system are
   * no longer in sync. A visitor was written based on a grammar which
   * apparently has changed and now an unexpected element type has appeared.
   * This is a non recoverable error, since the parser and the grammar
   * are not compatible.
   * @return an error object to throw.
   */
  protected internalError(cx: ParserRuleContext, msg: string): Error {
    const tmsg = `Internal Translator Error: ${msg}`;
    this.contextError(cx, tmsg);
    return new Error(tmsg);
  }

  /**
   * Log an error message relative to an AST node
   */
  protected astError(
    el: ast.MalloyElement,
    str: string,
    sev: LogSeverity = 'error'
  ): void {
    this.msgLog.log({message: str, at: el.location, severity: sev});
  }

  protected getLocation(cx: ParserRuleContext): DocumentLocation {
    return {
      url: this.parseInfo.sourceURL,
      range: this.parseInfo.rangeFromContext(cx),
    };
  }

  /**
   * Log an error message relative to a parse node
   */
  protected contextError(
    cx: ParserRuleContext,
    msg: string,
    sev: LogSeverity = 'error'
  ): void {
    this.msgLog.log({
      message: msg,
      at: this.getLocation(cx),
      severity: sev,
    });
  }

  protected inExperiment(experimentID: string, cx: ParserRuleContext): boolean {
    const experimental = this.compilerFlags.tag('experimental');
    if (
      experimental &&
      (experimental.bare() || experimental.has(experimentID))
    ) {
      return true;
    }
    this.contextError(
      cx,
      `Experimental flag '${experimentID}' required to enable this feature`
    );
    return false;
  }

  protected m4Severity(): LogSeverity | false {
    const m4severityTag = this.compilerFlags.tag('m4warnings');
    if (m4severityTag) {
      return m4severityTag.text() === 'warn' ? 'warn' : 'error';
    }
    return false;
  }

  protected m4advisory(cx: ParserRuleContext, msg: string): void {
    const m4 = this.m4Severity();
    if (m4) {
      this.contextError(cx, msg, m4);
    }
  }

  protected only<T extends ast.MalloyElement>(
    els: ast.MalloyElement[],
    isGood: (el: ast.MalloyElement) => T | false,
    desc: string
  ): T[] {
    const acceptable: T[] = [];
    for (const el of els) {
      const checked = isGood(el);
      if (checked) {
        acceptable.push(checked);
      } else if (!(el instanceof IgnoredElement)) {
        this.astError(
          el,
          `Parser enountered unexpected statement type '${el.elementType}' when it needed '${desc}'`
        );
      }
    }
    return acceptable;
  }

  protected getNumber(term: ParseTree): number {
    return Number.parseInt(term.text);
  }

  protected getFieldName(cx: HasID): ast.FieldName {
    return this.astAt(new ast.FieldName(getId(cx)), cx.id());
  }

  protected getModelEntryName(cx: HasID): ast.ModelEntryReference {
    return this.astAt(new ast.ModelEntryReference(getId(cx)), cx.id());
  }

  defaultResult(): ast.MalloyElement {
    return new ast.Unimplemented();
  }

  protected astAt<MT extends ast.MalloyElement>(
    el: MT,
    cx: ParserRuleContext
  ): MT {
    el.location = {
      url: this.parseInfo.sourceURL,
      range: this.parseInfo.rangeFromContext(cx),
    };
    return el;
  }

  protected getSourceCode(cx: ParserRuleContext): string {
    const from = cx.start.startIndex;
    const lastToken = cx.stop || cx.start;
    const sourceRange = new StreamInterval(from, lastToken.stopIndex);
    return this.parseInfo.sourceStream.getText(sourceRange);
  }

  protected getFilterElement(cx: parse.FieldExprContext): ast.FilterElement {
    const expr = this.getFieldExpr(cx);
    const fel = new ast.FilterElement(expr, this.getSourceCode(cx));
    return this.astAt(fel, cx);
  }

  protected getFieldDefs(
    cxList: parse.FieldDefContext[],
    makeFieldDef: ast.FieldDeclarationConstructor
  ): ast.AtomicFieldDeclaration[] {
    return cxList.map(cx => this.getFieldDef(cx, makeFieldDef));
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

  protected getFilterShortcut(cx: parse.FilterShortcutContext): ast.Filter {
    const el = this.getFilterElement(cx.fieldExpr());
    this.m4advisory(
      cx,
      'Filter shortcut `{? condition }` is deprecated; use `{ where: condition } instead'
    );
    return new ast.Filter([el]);
  }

  protected getPlainStringFrom(cx: HasString): string {
    const [result, errors] = getPlainString(cx);
    for (const error of errors) {
      if (error instanceof ParserRuleContext) {
        this.contextError(error, '%{ query } illegal in this string');
      }
    }
    return result || '';
  }

  protected makeSqlString(
    pcx: parse.SqlStringContext,
    sqlStr: ast.SQLString
  ): void {
    for (const part of pcx.sqlInterpolation()) {
      if (part.CLOSE_CODE()) {
        this.m4advisory(part, 'Use %{ ... } instead of %{ ... }%');
      }
    }
    for (const part of getStringParts(pcx)) {
      if (part instanceof ParserRuleContext) {
        sqlStr.push(this.visit(part));
      } else {
        sqlStr.push(part);
      }
    }
    // Until SQL writer properly indents turducken, it actually looks better
    // in the output to NOT de-indent the SQL sources
    // unIndent(sqlStr.elements);
    sqlStr.complete();
    this.astAt(sqlStr, pcx);
  }

  /**
   * Parse a time string into an AST TimeLiteral, if the string fails
   * the parse, make sure it highlights properly
   */
  protected parseTime(
    pcx: ParserRuleContext,
    parse: (s: string) => ast.ExpressionDef | undefined
  ): ast.ExpressionDef {
    let def = parse(pcx.text);
    if (!def) {
      this.contextError(pcx, 'Time data parse error');
      // return a value node so the parse can continue
      def = new ast.LiteralTimestamp({text: pcx.text});
    }
    return this.astAt(def, pcx);
  }

  /**
   * Get all the possibly missing annotations from this parse rule
   * @param cx Any parse context which has an ANNOTATION* rules
   * @returns Array of texts for the annotations
   */
  protected getNotes(cx: HasAnnotations): Note[] {
    return cx.ANNOTATION().map(a => {
      return {
        text: a.text,
        at: this.getLocation(cx),
      };
    });
  }

  protected getIsNotes(cx: parse.IsDefineContext): Note[] {
    const before = this.getNotes(cx._beforeIs);
    return before.concat(this.getNotes(cx._afterIs));
  }

  visitMalloyDocument(pcx: parse.MalloyDocumentContext): ast.Document {
    const stmts = this.only<ast.DocStatement | ast.DocStatementList>(
      pcx.malloyStatement().map(scx => this.visit(scx)),
      x => ast.isDocStatementOrDocStatementList(x) && x,
      'statement'
    );
    return new ast.Document(stmts);
  }

  visitDefineSourceStatement(
    pcx: parse.DefineSourceStatementContext
  ): ast.DefineSourceList {
    const defsCx = pcx.sourcePropertyList().sourceDefinition();
    const defs = defsCx.map(dcx => this.visitSourceDefinition(dcx));
    const blockNotes = this.getNotes(pcx.tags());
    const defList = new ast.DefineSourceList(defs);
    defList.extendNote({blockNotes});
    return defList;
  }

  getSourceParameter(pcx: parse.SourceParameterContext): ast.HasParameter {
    const defaultCx = pcx.fieldExpr();
    const defaultValue = defaultCx
      ? this.astAt(
          new ConstantExpression(this.getFieldExpr(defaultCx)),
          defaultCx
        )
      : undefined;
    const typeCx = pcx.malloyType();
    const type = typeCx ? this.getMalloyType(typeCx) : undefined;
    return this.astAt(
      new ast.HasParameter({
        name: getId(pcx.parameterNameDef()),
        type,
        default: defaultValue,
      }),
      pcx
    );
  }

  getSourceParameters(
    pcx: parse.SourceParametersContext | undefined
  ): ast.HasParameter[] {
    if (pcx === undefined) return [];
    this.inExperiment('parameters', pcx);
    return pcx.sourceParameter().map(param => this.getSourceParameter(param));
  }

  visitSourceDefinition(pcx: parse.SourceDefinitionContext): ast.DefineSource {
    const exploreExpr = this.visit(pcx.sqExplore());
    const params = this.getSourceParameters(pcx.sourceParameters());
    const exploreDef = new ast.DefineSource(
      getId(pcx.sourceNameDef()),
      exploreExpr instanceof ast.SourceQueryElement ? exploreExpr : undefined,
      true,
      params
    );
    const notes = this.getNotes(pcx.tags()).concat(
      this.getIsNotes(pcx.isDefine())
    );
    exploreDef.extendNote({notes});
    return this.astAt(exploreDef, pcx);
  }

  protected getSourceExtensions(
    extensions: parse.ExplorePropertiesContext
  ): ast.SourceDesc {
    return this.astAt(this.visitExploreProperties(extensions), extensions);
  }

  visitExploreProperties(pcx: parse.ExplorePropertiesContext): ast.SourceDesc {
    const filterCx = pcx.filterShortcut();
    const visited = this.only<ast.SourceProperty>(
      pcx.exploreStatement().map(ecx => this.visit(ecx)),
      x => ast.isSourceProperty(x) && x,
      'source property'
    );
    const propList = new ast.SourceDesc(visited);
    if (filterCx) {
      propList.push(this.getFilterShortcut(filterCx));
    }
    return propList;
  }

  visitTableFunction(pcx: parse.TableFunctionContext): ast.TableSource {
    const tableURI = this.getPlainStringFrom(pcx.tableURI());
    const el = this.astAt(new ast.TableFunctionSource(tableURI), pcx);
    this.m4advisory(
      pcx,
      "`table('connection_name:table_path')` is deprecated; use `connection_name.table('table_path')`"
    );
    return el;
  }

  visitTableMethod(pcx: parse.TableMethodContext): ast.TableSource {
    const connId = pcx.connectionId();
    const connectionName = this.astAt(this.getModelEntryName(connId), connId);
    const tablePath = this.getPlainStringFrom(pcx.tablePath());
    return this.astAt(
      new ast.TableMethodSource(connectionName, tablePath),
      pcx
    );
  }

  visitSqlSource(pcx: parse.SqlSourceContext): ast.SQLSource {
    const connId = pcx.connectionId();
    const connectionName = this.astAt(this.getModelEntryName(connId), connId);
    const sqlStr = new ast.SQLString();
    const selCx = pcx.sqlString();
    if (selCx) {
      this.makeSqlString(selCx, sqlStr);
    }
    const shortCX = pcx.shortString();
    if (shortCX) {
      sqlStr.push(getShortString(shortCX));
    }
    const expr = new ast.SQLSource(connectionName, sqlStr);
    return this.astAt(expr, pcx);
  }

  visitDefJoinMany(pcx: parse.DefJoinManyContext): ast.Joins {
    const joins: ast.Join[] = [];
    for (const joinCx of pcx.joinList().joinDef()) {
      const join = this.visit(joinCx);
      if (join instanceof ast.Join) {
        joins.push(join);
        if (join instanceof ast.ExpressionJoin) {
          join.joinType = 'many';
          if (join.joinOn === undefined) {
            this.contextError(pcx, 'join_many: requires ON expression');
          }
        } else if (join instanceof ast.KeyJoin) {
          this.contextError(pcx, 'Foreign key join not legal in join_many:');
        }
      }
    }
    const joinMany = new ast.Joins(joins);
    joinMany.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return joinMany;
  }

  visitDefJoinOne(pcx: parse.DefJoinOneContext): ast.Joins {
    const joinList = this.getJoinList(pcx.joinList());
    const joins: ast.Join[] = [];
    for (const join of joinList) {
      if (join instanceof ast.Join) {
        joins.push(join);
        if (join instanceof ast.ExpressionJoin) {
          join.joinType = 'one';
        }
      }
    }
    const joinOne = new ast.Joins(joins);
    joinOne.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return joinOne;
  }

  visitDefJoinCross(pcx: parse.DefJoinCrossContext): ast.Joins {
    const joinList = this.getJoinList(pcx.joinList());
    const joins: ast.Join[] = [];
    for (const join of joinList) {
      if (join instanceof ast.Join) {
        joins.push(join);
        if (join instanceof ast.ExpressionJoin) {
          join.joinType = 'cross';
        } else {
          join.log('Foreign key join not legal in join_cross:');
        }
      }
    }
    const joinCross = new ast.Joins(joins);
    joinCross.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return joinCross;
  }

  protected getJoinList(pcx: parse.JoinListContext): ast.MalloyElement[] {
    return pcx.joinDef().map(jcx => this.visit(jcx));
  }

  protected getJoinFrom(cx: parse.JoinFromContext): {
    joinAs: ast.ModelEntryReference;
    joinFrom: ast.SourceQueryElement;
    notes: Note[];
  } {
    const ecx = cx.isExplore();
    const joinAs = this.getModelEntryName(cx.joinNameDef());
    if (ecx) {
      const joinFrom = this.getSqExpr(ecx.sqExpr());
      const notes = this.getNotes(ecx._before_is).concat(
        this.getNotes(ecx._after_is)
      );
      return {joinFrom, notes, joinAs};
    }
    const acx = cx.sourceArguments();
    if (acx) {
      const joinFrom = this.astAt(
        new ast.SQReference(joinAs, this.getSQArguments(acx)),
        cx
      );
      return {joinFrom, notes: [], joinAs};
    }
    return {joinAs, joinFrom: new ast.SQReference(joinAs), notes: []};
  }

  visitQueryJoinStatement(
    pcx: parse.QueryJoinStatementContext
  ): ast.MalloyElement {
    const result = this.astAt(this.visit(pcx.joinStatement()), pcx);
    this.m4advisory(
      pcx,
      'Joins in queries are deprecated, move into an `extend:` block.'
    );
    return result;
  }

  visitJoinOn(pcx: parse.JoinOnContext): ast.Join {
    const {joinAs, joinFrom, notes} = this.getJoinFrom(pcx.joinFrom());
    const join = new ast.ExpressionJoin(joinAs, joinFrom);
    const onCx = pcx.joinExpression();
    const mop = pcx.matrixOperation()?.text.toLocaleLowerCase() || 'left';
    if (isMatrixOperation(mop)) {
      join.matrixOperation = mop;
    } else {
      this.contextError(pcx, 'Internal Error: Unknown matrixOperation');
    }
    if (onCx) {
      join.joinOn = this.getFieldExpr(onCx);
    }
    join.extendNote({notes: this.getNotes(pcx).concat(notes)});
    return this.astAt(join, pcx);
  }

  visitJoinWith(pcx: parse.JoinWithContext): ast.Join {
    const {joinAs, joinFrom, notes} = this.getJoinFrom(pcx.joinFrom());
    const joinOn = this.getFieldExpr(pcx.fieldExpr());
    const join = new ast.KeyJoin(joinAs, joinFrom, joinOn);
    join.extendNote({notes: this.getNotes(pcx).concat(notes)});
    return this.astAt(join, pcx);
  }

  getFieldDef(
    pcx: parse.FieldDefContext,
    makeFieldDef: ast.FieldDeclarationConstructor
  ): ast.AtomicFieldDeclaration {
    const defCx = pcx.fieldExpr();
    const fieldName = getId(pcx.fieldNameDef());
    const valExpr = this.getFieldExpr(defCx);
    const def = new makeFieldDef(valExpr, fieldName, this.getSourceCode(defCx));
    const notes = this.getNotes(pcx.tags()).concat(
      this.getIsNotes(pcx.isDefine())
    );
    def.extendNote({notes});
    return this.astAt(def, pcx);
  }

  visitDefDimensions(pcx: parse.DefDimensionsContext): ast.Dimensions {
    const defs = this.getFieldDefs(
      pcx.defList().fieldDef(),
      ast.DimensionFieldDeclaration
    );
    const stmt = new ast.Dimensions(defs);
    stmt.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return this.astAt(stmt, pcx);
  }

  visitDefMeasures(pcx: parse.DefMeasuresContext): ast.Measures {
    const defs = this.getFieldDefs(
      pcx.defList().fieldDef(),
      ast.MeasureFieldDeclaration
    );
    const stmt = new ast.Measures(defs);
    stmt.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return this.astAt(stmt, pcx);
  }

  visitQueryExtend(pcx: parse.QueryExtendContext): ast.ExtendBlock {
    const extensions: ast.QueryExtendProperty[] = [];
    const items = pcx
      .queryExtendStatementList()
      .queryExtendStatement()
      .map(ctx => this.visit(ctx));
    for (const item of items) {
      if (ast.isQueryExtendProperty(item)) {
        extensions.push(item);
      } else {
        throw this.internalError(
          pcx,
          `Query extend matched, but ${item.elementType} found`
        );
      }
    }
    const el = new ast.ExtendBlock(extensions);
    return this.astAt(el, pcx);
  }

  visitDeclareStatement(pcx: parse.DeclareStatementContext): ast.DeclareFields {
    const defs = this.getFieldDefs(
      pcx.defList().fieldDef(),
      ast.DeclareFieldDeclaration
    );
    const stmt = new ast.DeclareFields(defs);
    const result = this.astAt(stmt, pcx);
    this.m4advisory(
      pcx,
      '`declare:` is deprecated; use `dimension:` or `measure:` inside a source or `extend:` block'
    );
    return result;
  }

  visitExploreRenameDef(pcx: parse.ExploreRenameDefContext): ast.RenameField {
    const newName = pcx.fieldName(0);
    const oldName = pcx.fieldName(1);
    const rename = new ast.RenameField(
      getId(newName),
      this.getFieldName(oldName)
    );
    return this.astAt(rename, pcx);
  }

  visitDefExploreRename(pcx: parse.DefExploreRenameContext): ast.Renames {
    const rcxs = pcx.renameList().exploreRenameDef();
    const renames = rcxs.map(rcx => this.visitExploreRenameDef(rcx));
    const stmt = new ast.Renames(renames);
    return this.astAt(stmt, pcx);
  }

  visitFilterClauseList(pcx: parse.FilterClauseListContext): ast.Filter {
    return new ast.Filter(pcx.fieldExpr().map(f => this.getFilterElement(f)));
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

  visitSubQueryDefList(pcx: parse.SubQueryDefListContext): ast.Views {
    const babyTurtles = pcx
      .exploreQueryDef()
      .map(cx => this.visitExploreQueryDef(cx));
    return new ast.Views(babyTurtles);
  }

  visitDefExploreQuery(pcx: parse.DefExploreQueryContext): ast.MalloyElement {
    const queryDefs = this.visitSubQueryDefList(pcx.subQueryDefList());
    const blockNotes = this.getNotes(pcx.tags());
    queryDefs.extendNote({blockNotes});
    if (pcx.QUERY()) {
      this.m4advisory(pcx, 'Use view: inside of a source instead of query:');
    }
    return queryDefs;
  }

  visitDefExplorePrimaryKey(
    pcx: parse.DefExplorePrimaryKeyContext
  ): ast.PrimaryKey {
    const node = new ast.PrimaryKey(this.getFieldName(pcx.fieldName()));
    return this.astAt(node, pcx);
  }

  visitFieldNameList(pcx: parse.FieldNameListContext): ast.FieldReferences {
    const members = pcx
      .fieldName()
      .map(cx => new ast.AcceptExceptFieldReference([this.getFieldName(cx)]));
    return new ast.FieldReferences(members);
  }

  visitDefExploreEditField(
    pcx: parse.DefExploreEditFieldContext
  ): ast.FieldListEdit {
    const action = pcx.ACCEPT() ? 'accept' : 'except';
    return new ast.FieldListEdit(
      action,
      this.visitFieldNameList(pcx.fieldNameList())
    );
  }

  visitDefExploreTimezone(
    cx: parse.DefExploreTimezoneContext
  ): ast.TimezoneStatement {
    return this.visitTimezoneStatement(cx.timezoneStatement());
  }

  visitTimezoneStatement(
    cx: parse.TimezoneStatementContext
  ): ast.TimezoneStatement {
    const timezone = this.getPlainStringFrom(cx);
    const timezoneStatement = this.astAt(
      new ast.TimezoneStatement(timezone),
      cx.string()
    );

    if (!timezoneStatement.isValid) {
      this.astError(
        timezoneStatement,
        `Invalid timezone: ${timezoneStatement.tz}`
      );
    }

    return this.astAt(timezoneStatement, cx);
  }

  visitQueryProperties(pcx: parse.QueryPropertiesContext): ast.QOpDesc {
    const qProps = this.only<ast.QueryProperty>(
      pcx.queryStatement().map(qcx => this.astAt(this.visit(qcx), qcx)),
      x => ast.isQueryProperty(x) && x,
      'query statement'
    );
    const fcx = pcx.filterShortcut();
    if (fcx) {
      qProps.push(this.getFilterShortcut(fcx));
    }
    return new ast.QOpDesc(qProps);
  }

  getFieldPath(
    pcx: parse.FieldPathContext,
    makeFieldRef: ast.FieldReferenceConstructor
  ): ast.FieldReference {
    const names = pcx.fieldName().map(nameCx => this.getFieldName(nameCx));
    return this.astAt(new makeFieldRef(names), pcx);
  }

  getQueryFieldDef(
    pcx: parse.FieldDefContext,
    makeFieldDef: ast.FieldDeclarationConstructor
  ): ast.QueryItem {
    const dim = this.getFieldDef(pcx, makeFieldDef);
    return this.astAt(dim, pcx);
  }

  getQueryFieldEntry(
    ctx: parse.QueryFieldEntryContext,
    makeFieldDef: ast.FieldDeclarationConstructor,
    makeFieldRef: ast.FieldReferenceConstructor
  ): ast.QueryItem {
    const refCx = ctx.taggedRef();
    if (refCx) {
      return this.getTaggedRef(refCx, makeFieldDef, makeFieldRef);
    }
    const def = ctx.fieldDef();
    if (def) {
      return this.getQueryFieldDef(def, makeFieldDef);
    }
    throw new Error(
      'Expected query field entry to be a field reference or definition'
    );
  }

  protected getQueryItems(
    pcx: parse.QueryFieldListContext,
    makeFieldDef: ast.FieldDeclarationConstructor,
    makeFieldRef: ast.FieldReferenceConstructor
  ): ast.QueryItem[] {
    return this.only<ast.QueryItem>(
      pcx
        .queryFieldEntry()
        .map(e => this.getQueryFieldEntry(e, makeFieldDef, makeFieldRef)),
      x =>
        x instanceof ast.FieldReference ||
        x instanceof ast.AtomicFieldDeclaration
          ? x
          : false,
      'view field'
    );
  }

  visitAggregateStatement(pcx: parse.AggregateStatementContext): ast.Aggregate {
    const agStmt = new ast.Aggregate(
      this.getQueryItems(
        pcx.queryFieldList(),
        ast.AggregateFieldDeclaration,
        ast.AggregateFieldReference
      )
    );
    agStmt.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return agStmt;
  }

  visitGroupByStatement(pcx: parse.GroupByStatementContext): ast.GroupBy {
    const groupBy = new ast.GroupBy(
      this.getQueryItems(
        pcx.queryFieldList(),
        ast.GroupByFieldDeclaration,
        ast.GroupByFieldReference
      )
    );
    groupBy.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return groupBy;
  }

  visitCalculateStatement(pcx: parse.CalculateStatementContext): ast.Calculate {
    const stmt = new ast.Calculate(
      this.getQueryItems(
        pcx.queryFieldList(),
        ast.CalculateFieldDeclaration,
        ast.CalculateFieldReference
      )
    );
    stmt.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return stmt;
  }

  getTaggedRef(
    pcx: parse.TaggedRefContext,
    makeFieldDef: FieldDeclarationConstructor,
    makeFieldRef: ast.FieldReferenceConstructor
  ): ast.FieldReference | ast.AtomicFieldDeclaration {
    const refExpr = pcx.refExpr();
    if (refExpr) {
      const ref = this.getFieldPath(
        pcx.fieldPath(),
        ast.ExpressionFieldReference
      );
      let expr;
      const timeframe = refExpr.timeframe();
      if (timeframe) {
        expr = new ast.ExprGranularTime(
          new ast.ExprIdReference(ref),
          this.visitTimeframe(timeframe).text,
          true
        );
      }
      const agg = refExpr.aggregate();
      if (agg) {
        const aggFunc = agg.text.toLowerCase();
        if (aggFunc === 'sum') {
          expr = new ast.ExprSum(undefined, ref);
        } else {
          this.contextError(
            agg,
            `\`${aggFunc}\` is not legal in a reference-only aggregation`
          );
          return ref;
        }
      }
      const def = new makeFieldDef(expr, ref.outputName);
      def.extendNote({notes: this.getNotes(pcx.tags())});
      return def;
    }
    const ref = this.getFieldPath(pcx.fieldPath(), makeFieldRef);
    ref.extendNote({notes: this.getNotes(pcx.tags())});
    return ref;
  }

  getFieldCollectionMember(
    pcx: parse.CollectionMemberContext,
    makeFieldDef: FieldDeclarationConstructor,
    makeFieldRef: ast.FieldReferenceConstructor
  ): ast.FieldCollectionMember {
    const fieldDef = pcx.fieldDef();
    if (fieldDef) {
      return this.getFieldDef(fieldDef, makeFieldDef);
    }
    const refCx = pcx.taggedRef();
    if (refCx) {
      return this.getTaggedRef(refCx, makeFieldDef, makeFieldRef);
    }
    const collectionWildcard = pcx.collectionWildCard();
    if (collectionWildcard) {
      return this.visitCollectionWildCard(collectionWildcard);
    }
    throw this.internalError(
      pcx,
      'Unexpected element in fieldCollectionMember'
    );
  }

  // "FieldCollection" can only mean a select statement today
  visitFieldCollection(
    pcx: parse.FieldCollectionContext
  ): ast.ProjectStatement {
    const fields = pcx
      .collectionMember()
      .map(c =>
        this.getFieldCollectionMember(
          c,
          ast.ProjectFieldDeclaration,
          ast.ProjectFieldReference
        )
      );
    return this.astAt(new ast.ProjectStatement(fields), pcx);
  }

  visitProjectStatement(
    pcx: parse.ProjectStatementContext
  ): ast.ProjectStatement {
    if (pcx.PROJECT()) {
      this.m4advisory(pcx, 'project: keyword is deprecated, use select:');
    }
    const stmt = this.visitFieldCollection(pcx.fieldCollection());
    stmt.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return stmt;
  }

  visitCollectionWildCard(
    pcx: parse.CollectionWildCardContext
  ): ast.FieldReferenceElement {
    const nameCx = pcx.fieldPath();
    const join = nameCx
      ? this.getFieldPath(nameCx, ast.ProjectFieldReference)
      : undefined;
    const wild = this.astAt(new ast.WildcardFieldReference(join), pcx);
    const exceptStmts = pcx.starQualified()?.fieldNameList() || [];
    for (const except of exceptStmts) {
      for (const exceptThis of except.fieldName()) {
        wild.except.add(getId(exceptThis));
      }
    }
    return wild;
  }

  visitIndexFields(pcx: parse.IndexFieldsContext): ast.FieldReferences {
    const refList = pcx.indexElement().map(el => {
      const pathCx = el.fieldPath();
      if (!pathCx) {
        return this.astAt(new ast.WildcardFieldReference(undefined), pcx);
      }
      const path = this.getFieldPath(pathCx, ast.IndexFieldReference);
      if (!el.STAR()) {
        return this.astAt(path, pcx);
      }
      return this.astAt(new ast.WildcardFieldReference(path), pcx);
    });
    return new ast.FieldReferences(refList);
  }

  visitIndexStatement(pcx: parse.IndexStatementContext): ast.Index {
    const fields = this.visitIndexFields(pcx.indexFields());
    const indexStmt = new ast.Index(fields);
    const weightCx = pcx.fieldName();
    if (weightCx) {
      indexStmt.useWeight(this.getFieldName(weightCx));
    }
    return this.astAt(indexStmt, pcx);
  }

  visitFieldPropertyLimitStatement(
    pcx: parse.FieldPropertyLimitStatementContext
  ): ast.Limit {
    this.inExperiment('aggregate_limit', pcx);
    return this.visitLimitStatement(pcx.limitStatement());
  }

  visitLimitStatement(pcx: parse.LimitStatementContext): ast.Limit {
    return new ast.Limit(this.getNumber(pcx.INTEGER_LITERAL()));
  }

  visitAggregateOrderBySpec(
    pcx: parse.AggregateOrderBySpecContext
  ): ast.FunctionOrderBy {
    const dir = pcx.ASC() ? 'asc' : pcx.DESC() ? 'desc' : undefined;
    const fCx = pcx.fieldExpr();
    const f = fCx ? this.getFieldExpr(fCx) : undefined;
    return this.astAt(new ast.FunctionOrderBy(f, dir), pcx);
  }

  visitAggregateOrderByStatement(pcx: parse.AggregateOrderByStatementContext) {
    return this.visitAggregateOrdering(pcx.aggregateOrdering());
  }

  visitAggregateOrdering(
    pcx: parse.AggregateOrderingContext
  ): ast.FunctionOrdering {
    const orderList = pcx
      .aggregateOrderBySpec()
      .map(o => this.visitAggregateOrderBySpec(o));
    return this.astAt(new ast.FunctionOrdering(orderList), pcx);
  }

  visitOrderBySpec(pcx: parse.OrderBySpecContext): ast.OrderBy {
    const dir = pcx.ASC() ? 'asc' : pcx.DESC() ? 'desc' : undefined;
    const ncx = pcx.INTEGER_LITERAL();
    if (ncx) {
      return new ast.OrderBy(this.getNumber(ncx), dir);
    }
    const fieldCx = pcx.fieldName();
    if (fieldCx) {
      return new ast.OrderBy(this.getFieldName(fieldCx), dir);
    }
    throw this.internalError(pcx, "can't parse order_by specification");
  }

  visitOrdering(pcx: parse.OrderingContext): ast.Ordering {
    const orderList = pcx.orderBySpec().map(o => this.visitOrderBySpec(o));
    return this.astAt(new ast.Ordering(orderList), pcx);
  }

  visitTopStatement(pcx: parse.TopStatementContext): ast.Top {
    const byCx = pcx.bySpec();
    const topN = this.getNumber(pcx.INTEGER_LITERAL());
    let top: ast.Top | undefined;
    if (byCx) {
      this.m4advisory(
        byCx,
        'by clause of top statement unupported. Use order_by instead'
      );
      const nameCx = byCx.fieldName();
      if (nameCx) {
        const name = this.getFieldName(nameCx);
        top = new ast.Top(topN, name);
      }
      const exprCx = byCx.fieldExpr();
      if (exprCx) {
        top = new ast.Top(topN, this.getFieldExpr(exprCx));
      }
    }
    if (!top) {
      top = new ast.Top(topN, undefined);
    }
    return this.astAt(top, pcx);
  }

  visitTopLevelQueryDefs(
    pcx: parse.TopLevelQueryDefsContext
  ): ast.DefineQueryList {
    const stmts = pcx
      .topLevelQueryDef()
      .map(cx => this.visitTopLevelQueryDef(cx));
    const blockNotes = this.getNotes(pcx.tags());
    const queryDefs = new ast.DefineQueryList(stmts);
    queryDefs.extendNote({blockNotes});
    return queryDefs;
  }

  visitTopLevelQueryDef(pcx: parse.TopLevelQueryDefContext): ast.DefineQuery {
    const queryName = getId(pcx.queryName());
    const queryExpr = this.visit(pcx.sqExpr());
    const notes = this.getNotes(pcx.tags()).concat(
      this.getIsNotes(pcx.isDefine())
    );
    if (queryExpr instanceof ast.SourceQueryElement) {
      const queryDef = new ast.DefineQuery(queryName, queryExpr);
      queryDef.extendNote({notes});
      return this.astAt(queryDef, pcx);
    }
    throw this.internalError(
      pcx,
      `Expected query definition, got a '${queryExpr.elementType}'`
    );
  }

  visitAnonymousQuery(pcx: parse.AnonymousQueryContext): ast.AnonymousQuery {
    const defCx = pcx.topLevelAnonQueryDef();
    const query = this.getSqExpr(defCx.sqExpr());
    const theQuery = this.astAt(new ast.AnonymousQuery(query), defCx);
    const notes = this.getNotes(pcx.topLevelAnonQueryDef().tags());
    const blockNotes = this.getNotes(pcx.tags());
    theQuery.extendNote({notes, blockNotes});
    this.m4advisory(
      defCx,
      'Anonymous `query:` statements are deprecated, use `run:` instead'
    );
    return this.astAt(theQuery, pcx);
  }

  visitRunStatement(pcx: parse.RunStatementContext) {
    const defCx = pcx.topLevelAnonQueryDef();
    const query = this.getSqExpr(defCx.sqExpr());
    const theQuery = this.astAt(new ast.AnonymousQuery(query), defCx);
    const notes = this.getNotes(pcx.topLevelAnonQueryDef().tags());
    const blockNotes = this.getNotes(pcx.tags());
    theQuery.extendNote({notes, blockNotes});
    return this.astAt(theQuery, pcx);
  }

  visitNestStatement(pcx: parse.NestStatementContext): ast.Nests {
    const nests = this.visitNestedQueryList(pcx.nestedQueryList());
    nests.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return nests;
  }

  visitNestedQueryList(pcx: parse.NestedQueryListContext): ast.Nests {
    return new ast.Nests(
      this.only<ast.NestFieldDeclaration>(
        pcx.nestEntry().map(cx => this.visit(cx)),
        x => x instanceof ast.NestFieldDeclaration && x,
        'query'
      )
    );
  }

  visitNestDef(pcx: parse.NestDefContext): ast.NestFieldDeclaration {
    const nameCx = pcx.queryName();
    let name: string;
    const vExpr = this.getVExpr(pcx.vExpr());
    if (nameCx) {
      name = getId(nameCx);
    } else {
      const implicitName = vExpr.getImplicitName();
      if (implicitName === undefined) {
        this.contextError(
          pcx,
          '`nest:` view requires a name (add `nest_name is ...`)'
        );
      }
      name = implicitName ?? '__unnamed__';
    }
    const nestDef = new ast.NestFieldDeclaration(name, vExpr);
    const isDefineCx = pcx.isDefine();
    nestDef.extendNote({
      notes: this.getNotes(pcx.tags()).concat(
        isDefineCx ? this.getIsNotes(isDefineCx) : []
      ),
    });
    return this.astAt(nestDef, pcx);
  }

  visitExploreQueryDef(
    pcx: parse.ExploreQueryDefContext
  ): ast.ViewFieldDeclaration {
    const name = getId(pcx.exploreQueryNameDef());
    const queryDef = new ast.ViewFieldDeclaration(
      name,
      this.getVExpr(pcx.vExpr())
    );
    const notes = this.getNotes(pcx).concat(this.getIsNotes(pcx.isDefine()));
    queryDef.extendNote({notes});
    return this.astAt(queryDef, pcx);
  }

  visitExprNot(pcx: parse.ExprNotContext): ast.ExprNot {
    return new ast.ExprNot(this.getFieldExpr(pcx.fieldExpr()));
  }

  visitExprBool(pcx: parse.ExprBoolContext): ast.Boolean {
    return new ast.Boolean(pcx.TRUE() ? 'true' : 'false');
  }

  allFieldExpressions(exprList: parse.FieldExprContext[]): ast.ExpressionDef[] {
    return exprList.map(ecx => this.getFieldExpr(ecx));
  }

  visitExprLogicalOr(pcx: parse.ExprLogicalOrContext): ast.ExprLogicalOp {
    const left = this.getFieldExpr(pcx.fieldExpr(0));
    const right = this.getFieldExpr(pcx.fieldExpr(1));
    return new ast.ExprLogicalOp(left, 'or', right);
  }

  visitExprLogicalAnd(pcx: parse.ExprLogicalAndContext): ast.ExprLogicalOp {
    const left = this.getFieldExpr(pcx.fieldExpr(0));
    const right = this.getFieldExpr(pcx.fieldExpr(1));
    return new ast.ExprLogicalOp(left, 'and', right);
  }

  visitExprOrTree(pcx: parse.ExprOrTreeContext): ast.ExprAlternationTree {
    const left = this.getFieldExpr(pcx.fieldExpr());
    const right = this.getFieldExpr(pcx.partialAllowedFieldExpr());
    return this.astAt(new ast.ExprAlternationTree(left, '|', right), pcx);
  }

  visitExprAndTree(pcx: parse.ExprAndTreeContext): ast.ExprAlternationTree {
    const left = this.getFieldExpr(pcx.fieldExpr());
    const right = this.getFieldExpr(pcx.partialAllowedFieldExpr());
    return this.astAt(new ast.ExprAlternationTree(left, '&', right), pcx);
  }

  visitExprCoalesce(pcx: parse.ExprCoalesceContext): ast.ExprCoalesce {
    const left = this.getFieldExpr(pcx.fieldExpr()[0]);
    const right = this.getFieldExpr(pcx.fieldExpr()[1]);
    return this.astAt(new ast.ExprCoalesce(left, right), pcx);
  }

  visitPartialAllowedFieldExpr(
    pcx: parse.PartialAllowedFieldExprContext
  ): ast.ExpressionDef {
    const fieldExpr = this.getFieldExpr(pcx.fieldExpr());
    const partialOp = pcx.compareOp()?.text;
    if (partialOp) {
      if (ast.isComparison(partialOp)) {
        return this.astAt(new ast.PartialCompare(partialOp, fieldExpr), pcx);
      }
      throw this.internalError(
        pcx,
        `partial comparison '${partialOp}' not recognized`
      );
    }
    return fieldExpr;
  }

  visitExprString(pcx: parse.ExprStringContext): ast.ExprString {
    const str = this.getPlainStringFrom(pcx);
    return new ast.ExprString(str);
  }

  visitExprRegex(pcx: parse.ExprRegexContext): ast.ExprRegEx {
    const malloyRegex = pcx.HACKY_REGEX().text;
    return new ast.ExprRegEx(malloyRegex.slice(2, -1));
  }

  visitExprNow(_pcx: parse.ExprNowContext): ast.ExprNow {
    return new ast.ExprNow();
  }

  visitExprNumber(pcx: parse.ExprNumberContext): ast.ExprNumber {
    return new ast.ExprNumber(pcx.text);
  }

  visitExprFieldPath(pcx: parse.ExprFieldPathContext): ast.ExprIdReference {
    const idRef = new ast.ExprIdReference(
      this.getFieldPath(pcx.fieldPath(), ast.ExpressionFieldReference)
    );
    return this.astAt(idRef, pcx);
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
    const op = pcx.PLUS() ? '+' : '-';
    return new ast.ExprAddSub(lhs, op, rhs);
  }

  visitExprMulDiv(pcx: parse.ExprMulDivContext): ast.ExprMulDiv {
    const op = pcx.STAR() ? '*' : pcx.SLASH() ? '/' : '%';
    return new ast.ExprMulDiv(
      this.getFieldExpr(pcx.fieldExpr(0)),
      op,
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

  visitExprUngroup(pcx: parse.ExprUngroupContext): ast.ExprUngroup {
    const flist = pcx.fieldName().map(fcx => this.getFieldName(fcx));
    const kw = pcx.ungroup().text.toLowerCase();
    return this.astAt(
      new ast.ExprUngroup(
        kw === 'all' ? kw : 'exclude',
        this.getFieldExpr(pcx.fieldExpr()),
        flist
      ),
      pcx
    );
  }

  symmetricAggregateUsageError(aggFunc: string) {
    return `Symmetric aggregate function \`${aggFunc}\` must be written as \`${aggFunc}(expression)\` or \`path.to.field.${aggFunc}()\``;
  }

  asymmetricAggregateUsageError(aggFunc: string) {
    return `Asymmetric aggregate function \`${aggFunc}\` must be written as \`path.to.field.${aggFunc}()\`, \`path.to.join.${aggFunc}(expression)\`, or \`${aggFunc}(expression)\``;
  }

  visitExprAggregate(pcx: parse.ExprAggregateContext): ast.ExpressionDef {
    const pathCx = pcx.fieldPath();
    const path = this.getFieldPath(pathCx, ast.ExpressionFieldReference);
    const source = pathCx && path ? this.astAt(path, pathCx) : undefined;
    const aggFunc = pcx.aggregate().text.toLowerCase();
    const exprDef = pcx.fieldExpr();

    if (pcx.aggregate().COUNT()) {
      if (exprDef) {
        this.contextError(exprDef, 'Expression illegal inside path.count()');
      }
      return new ast.ExprCount(source);
    }

    const expr = exprDef ? this.getFieldExpr(exprDef) : undefined;

    if (aggFunc === 'min' || aggFunc === 'max') {
      if (expr) {
        this.contextError(pcx, this.symmetricAggregateUsageError(aggFunc));
      } else {
        const idRef = this.astAt(new ast.ExprIdReference(path), pathCx);
        return aggFunc === 'min'
          ? new ast.ExprMin(idRef)
          : new ast.ExprMax(idRef);
      }
    } else if (aggFunc === 'avg') {
      return new ast.ExprAvg(expr, source);
    } else if (aggFunc === 'sum') {
      return new ast.ExprSum(expr, source);
    } else {
      this.contextError(pcx, `Cannot parse aggregate function ${aggFunc}`);
    }
    return new ast.ExprNULL();
  }

  /*
   * error toodos
   * for an aggregate function being called with no path predeeding ...
   * [X] sum/avg() -- always an error
   * [X] sum/avg(fieldName) -- suggest fieldName.sum
   * [X] sum/avg(expr) -- suggest source.sum(expr)
   * [X] count() -- OK
   * [X] count(anything) OK
   * ?? source.count()
   * [X] min/max() -- always an error
   * [X] min/max(expr) -- OK
   * ?? source.min/max(expr)
   */
  visitExprPathlessAggregate(
    pcx: parse.ExprPathlessAggregateContext
  ): ast.ExpressionDef {
    const exprDef = pcx.fieldExpr();
    const expr = exprDef ? this.getFieldExpr(exprDef) : undefined;
    const source = undefined;
    const aggFunc = pcx.aggregate().text.toLowerCase();

    if (pcx.STAR()) {
      this.m4advisory(pcx, `* illegal inside ${aggFunc}()`);
    }
    if (aggFunc === 'count') {
      return this.astAt(
        expr ? new ast.ExprCountDistinct(expr) : new ast.ExprCount(),
        pcx
      );
    } else if (aggFunc === 'min') {
      if (expr) {
        return new ast.ExprMin(expr);
      } else {
        this.contextError(pcx, this.symmetricAggregateUsageError(aggFunc));
      }
    } else if (aggFunc === 'max') {
      if (expr) {
        return new ast.ExprMax(expr);
      } else {
        this.contextError(pcx, this.symmetricAggregateUsageError(aggFunc));
      }
    } else {
      if (expr === undefined) {
        this.contextError(pcx, this.asymmetricAggregateUsageError(aggFunc));
        return new ast.ExprNULL();
      }
      const explicitSource = pcx.SOURCE_KW() !== undefined;
      if (aggFunc === 'avg') {
        return new ast.ExprAvg(expr, source, explicitSource);
      } else if (aggFunc === 'sum') {
        return new ast.ExprSum(expr, source, explicitSource);
      }
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
    const type = this.getMalloyOrSQLType(pcx.malloyOrSQLType());
    return new ast.ExprCast(this.getFieldExpr(pcx.fieldExpr()), type);
  }

  getMalloyType(pcx: parse.MalloyTypeContext) {
    const type = pcx.text;
    if (isCastType(type)) {
      return type;
    }
    throw this.internalError(pcx, `unknown type '${type}'`);
  }

  getMalloyOrSQLType(
    pcx: parse.MalloyOrSQLTypeContext
  ): CastType | {raw: string} {
    const mtcx = pcx.malloyType();
    if (mtcx) {
      return this.getMalloyType(mtcx);
    }
    const rtcx = pcx.string();
    if (rtcx) {
      return {raw: this.getPlainStringFrom({string: () => rtcx})};
    }
    throw this.internalError(
      pcx,
      'Expected Malloy or SQL type to either be a Malloy type or a string'
    );
  }

  visitExprSafeCast(pcx: parse.ExprSafeCastContext): ast.ExpressionDef {
    const type = this.getMalloyOrSQLType(pcx.malloyOrSQLType());
    return new ast.ExprCast(this.getFieldExpr(pcx.fieldExpr()), type, true);
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

  visitExprAggFunc(pcx: parse.ExprAggFuncContext): ast.ExpressionDef {
    const argsCx = pcx.argumentList();
    const args = argsCx ? this.allFieldExpressions(argsCx.fieldExpr()) : [];

    const fn = getId(pcx);

    const pathCx = pcx.fieldPath();
    const path = pathCx
      ? this.getFieldPath(pathCx, ast.ExpressionFieldReference)
      : undefined;
    const source = pathCx && path ? this.astAt(path, pathCx) : undefined;

    if (ast.ExprTimeExtract.extractor(fn)) {
      return this.astAt(new ast.ExprTimeExtract(fn, args), pcx);
    }
    return this.astAt(
      new ast.ExprFunc(fn, args, false, undefined, source),
      pcx
    );
  }

  visitExprFunc(pcx: parse.ExprFuncContext): ast.ExpressionDef {
    const argsCx = pcx.argumentList();
    const args = argsCx ? this.allFieldExpressions(argsCx.fieldExpr()) : [];

    const isRaw = pcx.EXCLAM() !== undefined;
    const rawRawType = pcx.malloyType()?.text;
    let rawType: CastType | undefined = undefined;
    if (rawRawType) {
      if (isCastType(rawRawType)) {
        rawType = rawRawType;
      } else {
        this.contextError(
          pcx,
          `'#' assertion for unknown type '${rawRawType}'`
        );
        rawType = undefined;
      }
    }

    let fn = getOptionalId(pcx) || pcx.timeframe()?.text;
    if (fn === undefined) {
      this.contextError(pcx, 'Function name error');
      fn = 'FUNCTION_NAME_ERROR';
    }

    if (ast.ExprTimeExtract.extractor(fn)) {
      return this.astAt(new ast.ExprTimeExtract(fn, args), pcx);
    }
    return this.astAt(new ast.ExprFunc(fn, args, isRaw, rawType), pcx);
  }

  visitExprDuration(pcx: parse.ExprDurationContext): ast.ExprDuration {
    return new ast.ExprDuration(
      this.getFieldExpr(pcx.fieldExpr()),
      this.visitTimeframe(pcx.timeframe()).text
    );
  }

  visitPickStatement(pcx: parse.PickStatementContext): ast.Pick {
    const picks = pcx.pick().map(pwCx => {
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

  visitExprFieldProps(pcx: parse.ExprFieldPropsContext) {
    const statements = this.only<
      ast.Filter | ast.FunctionOrdering | ast.PartitionBy | ast.Limit
    >(
      pcx
        .fieldProperties()
        .fieldPropertyStatement()
        .map(scx => this.visit(scx)),
      x => ast.isFieldPropStatement(x) && x,
      'field property statement'
    );
    return new ast.ExprProps(this.getFieldExpr(pcx.fieldExpr()), statements);
  }

  visitPartitionByStatement(pcx: parse.PartitionByStatementContext) {
    return this.astAt(
      new ast.PartitionBy(
        pcx
          .id()
          .map(idCx =>
            this.astAt(
              new ast.PartitionByFieldReference([
                this.astAt(new ast.FieldName(idToStr(idCx)), idCx),
              ]),
              idCx
            )
          )
      ),
      pcx
    );
  }

  visitLiteralTimestamp(pcx: parse.LiteralTimestampContext): ast.ExpressionDef {
    return this.parseTime(pcx, ast.LiteralTimestamp.parse);
  }

  visitLiteralHour(pcx: parse.LiteralHourContext): ast.ExpressionDef {
    return this.parseTime(pcx, ast.LiteralHour.parse);
  }

  visitLiteralDay(pcx: parse.LiteralDayContext): ast.ExpressionDef {
    return this.parseTime(pcx, ast.LiteralDay.parse);
  }

  visitLiteralWeek(pcx: parse.LiteralWeekContext): ast.ExpressionDef {
    return this.parseTime(pcx, ast.LiteralWeek.parse);
  }

  visitLiteralMonth(pcx: parse.LiteralMonthContext): ast.ExpressionDef {
    return this.parseTime(pcx, ast.LiteralMonth.parse);
  }

  visitLiteralQuarter(pcx: parse.LiteralQuarterContext): ast.ExpressionDef {
    return this.parseTime(pcx, ast.LiteralQuarter.parse);
  }

  visitLiteralYear(pcx: parse.LiteralYearContext): ast.ExpressionDef {
    return this.parseTime(pcx, ast.LiteralYear.parse);
  }

  visitImportStatement(pcx: parse.ImportStatementContext): ast.ImportStatement {
    const url = this.getPlainStringFrom(pcx.importURL());
    const importStmt = this.astAt(
      new ast.ImportStatement(url, this.parseInfo.importBaseURL),
      pcx
    );
    const selectCx = pcx.importSelect();
    if (selectCx) {
      for (const item of selectCx.importItem()) {
        const ids = item.id();
        const oldName = ids[1]
          ? this.astAt(new ast.ImportSourceName(idToStr(ids[1])), ids[1])
          : undefined;
        importStmt.push(
          this.astAt(new ast.ImportSelect(idToStr(ids[0]), oldName), ids[0])
        );
      }
    }
    return importStmt;
  }

  visitJustExpr(pcx: parse.JustExprContext): ast.ExpressionDef {
    return this.getFieldExpr(pcx.fieldExpr());
  }

  visitSampleStatement(pcx: parse.SampleStatementContext): ast.SampleProperty {
    const rowCx = pcx.sampleSpec().INTEGER_LITERAL();
    if (rowCx) {
      return new ast.SampleProperty({rows: this.getNumber(rowCx)});
    }
    const limitCx = pcx.sampleSpec().PERCENT_LITERAL();
    if (limitCx) {
      return new ast.SampleProperty({percent: this.getNumber(limitCx)});
    }
    const enabled = pcx.sampleSpec().TRUE() !== undefined;
    return new ast.SampleProperty({enable: enabled});
  }

  visitDocAnnotations(pcx: parse.DocAnnotationsContext): ast.ModelAnnotation {
    const allNotes = pcx.DOC_ANNOTATION().map(note => {
      return {
        text: note.text,
        at: this.getLocation(pcx),
      };
    });
    const tags = new ast.ModelAnnotation(allNotes);
    this.compilerFlags = tags.getCompilerFlags(this.compilerFlags, this.msgLog);
    return tags;
  }

  visitIgnoredObjectAnnotations(
    pcx: parse.IgnoredObjectAnnotationsContext
  ): IgnoredElement {
    this.contextError(pcx, 'Object annotation not connected to any object');
    return new IgnoredElement(pcx.text);
  }

  visitIgnoredModelAnnotations(
    pcx: parse.IgnoredModelAnnotationsContext
  ): IgnoredElement {
    this.contextError(pcx, 'Model annotations not allowed at this scope');
    return new IgnoredElement(pcx.text);
  }

  visitDefExploreAnnotation(
    pcx: parse.DefExploreAnnotationContext
  ): ast.ObjectAnnotation {
    const allNotes = this.getNotes(pcx);
    return new ast.ObjectAnnotation(allNotes);
  }

  getSQArgument(pcx: parse.SourceArgumentContext): ast.Argument {
    const id = pcx.argumentId();
    const ref = id
      ? this.astAt(
          new ast.PartitionByFieldReference([
            this.astAt(new ast.FieldName(idToStr(id.id())), id),
          ]),
          id
        )
      : undefined;
    return this.astAt(
      new ast.Argument({
        id: ref,
        value: this.getFieldExpr(pcx.fieldExpr()),
      }),
      pcx
    );
  }

  getSQArguments(
    pcx: parse.SourceArgumentsContext | undefined
  ): ast.Argument[] | undefined {
    if (pcx === undefined) return undefined;
    this.inExperiment('parameters', pcx);
    return pcx.sourceArgument().map(arg => this.getSQArgument(arg));
  }

  visitSQID(pcx: parse.SQIDContext) {
    const ref = this.getModelEntryName(pcx);
    const args = this.getSQArguments(pcx.sourceArguments());
    return this.astAt(new ast.SQReference(ref, args), pcx.id());
  }

  protected getSqExpr(cx: parse.SqExprContext): ast.SourceQueryElement {
    const result = this.visit(cx);
    if (result instanceof ast.SourceQueryElement) {
      return result;
    }
    this.contextError(
      cx,
      `Expected a source/query expression, not '${result.elementType}'`
    );
    return new ErrorNode();
  }

  visitSQExtendedSource(pcx: parse.SQExtendedSourceContext) {
    const extendSrc = this.getSqExpr(pcx.sqExpr());
    const src = new ast.SQExtend(
      extendSrc,
      this.getSourceExtensions(pcx.exploreProperties())
    );
    return this.astAt(src, pcx);
  }

  visitSQParens(pcx: parse.SQParensContext) {
    // TODO maybe implement a pass-through SQParens node
    const sqExpr = this.getSqExpr(pcx.sqExpr());
    return this.astAt(sqExpr, pcx);
  }

  visitSQArrow(pcx: parse.SQArrowContext) {
    const applyTo = this.getSqExpr(pcx.sqExpr());
    const headCx = pcx.segExpr();
    const sqExpr = new ast.SQArrow(applyTo, this.getVExpr(headCx));
    return this.astAt(sqExpr, pcx);
  }

  getVExpr(pcx: ParserRuleContext) {
    const expr = this.visit(pcx);
    if (expr instanceof ast.View) {
      return expr;
    }
    throw this.internalError(pcx, `Expected view, got a '${expr.elementType}'`);
  }

  visitSegField(pcx: parse.SegFieldContext) {
    return new ast.ReferenceView(
      this.getFieldPath(pcx.fieldPath(), ast.ViewOrScalarFieldReference)
    );
  }

  visitSegOps(pcx: parse.SegOpsContext) {
    return new ast.QOpDescView(
      this.visitQueryProperties(pcx.queryProperties())
    );
  }

  visitSegParen(pcx: parse.SegParenContext) {
    // TODO maybe make an actual pass-through node in the AST
    return this.visit(pcx.vExpr());
  }

  visitVSeg(pcx: parse.VSegContext) {
    return this.visit(pcx.segExpr());
  }

  visitSegRefine(pcx: parse.SegRefineContext) {
    return new ast.ViewRefine(this.getVExpr(pcx._lhs), this.getVExpr(pcx._rhs));
  }

  visitVArrow(pcx: parse.VArrowContext) {
    return new ast.ViewArrow(this.getVExpr(pcx._lhs), this.getVExpr(pcx._rhs));
  }

  visitSQRefinedQuery(pcx: parse.SQRefinedQueryContext) {
    const refineThis = this.getSqExpr(pcx.sqExpr());
    const refine = pcx.segExpr();
    const refined = new ast.SQRefine(refineThis, this.getVExpr(refine));
    return this.astAt(refined, pcx);
  }

  visitSQTable(pcx: parse.SQTableContext) {
    const theTable = this.visit(pcx.exploreTable());
    if (theTable instanceof TableSource) {
      const sqTable = new ast.SQSource(theTable);
      return this.astAt(sqTable, pcx);
    }
    return new ErrorNode();
  }

  visitSQSQL(pcx: parse.SQSQLContext) {
    const sqExpr = new ast.SQSource(this.visitSqlSource(pcx.sqlSource()));
    return this.astAt(sqExpr, pcx);
  }

  visitExperimentalStatementForTesting(
    pcx: parse.ExperimentalStatementForTestingContext
  ) {
    this.inExperiment('compilerTestExperimentParse', pcx);
    return this.astAt(
      new ast.ExperimentalExperiment('compilerTestExperimentTranslate'),
      pcx
    );
  }
}
