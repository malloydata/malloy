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
import type {ParseTree, TerminalNode} from 'antlr4ts/tree';
import {AbstractParseTreeVisitor} from 'antlr4ts/tree/AbstractParseTreeVisitor';
import type {MalloyParserVisitor} from './lib/Malloy/MalloyParserVisitor';
import type * as parse from './lib/Malloy/MalloyParser';
import * as ast from './ast';
import type {
  LogMessageOptions,
  MessageCode,
  MessageLogger,
  MessageParameterType,
} from './parse-log';
import {makeLogMessage} from './parse-log';
import type {MalloyParseInfo} from './malloy-parse-info';
import {Interval as StreamInterval} from 'antlr4ts/misc/Interval';
import type {FieldDeclarationConstructor} from './ast';
import {TableSource} from './ast';
import type {HasString, HasID} from './parse-utils';
import {
  getId,
  getOptionalId,
  getStringParts,
  getShortString,
  idToStr,
  getPlainString,
} from './parse-utils';
import type {CastType} from '../model';
import type {
  AccessModifierLabel,
  DocumentLocation,
  DocumentRange,
  Note,
  ParameterTypeDef,
} from '../model/malloy_types';
import {
  isCastType,
  isMatrixOperation,
  isParameterType,
} from '../model/malloy_types';
import type {Tag} from '@malloydata/malloy-tag';
import {parseTag} from '@malloydata/malloy-tag';
import {isNotUndefined, rangeFromContext} from './utils';
import {isFilterable} from '@malloydata/malloy-filter';
import type * as Malloy from '@malloydata/malloy-interfaces';
import {Timer} from '../timing';

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

const DEFAULT_COMPILER_FLAGS = [];

type HasAnnotations = ParserRuleContext & {ANNOTATION: () => TerminalNode[]};

/**
 * ANTLR visitor pattern parse tree traversal. Generates a Malloy
 * AST from an ANTLR parse tree.
 */
export class MalloyToAST
  extends AbstractParseTreeVisitor<ast.MalloyElement>
  implements MalloyParserVisitor<ast.MalloyElement>
{
  readonly timer: Timer;
  constructor(
    readonly parseInfo: MalloyParseInfo,
    readonly msgLog: MessageLogger,
    public compilerFlags: Tag
  ) {
    super();
    this.timer = new Timer('generate_ast');
    const parseCompilerFlagsTimer = new Timer('parse_compiler_flags');
    for (const flag of DEFAULT_COMPILER_FLAGS) {
      const withNewTag = parseTag(flag, this.compilerFlags);
      this.compilerFlags = withNewTag.tag;
    }
    this.timer.contribute([parseCompilerFlagsTimer.stop()]);
  }

  public run(): {
    ast: ast.MalloyElement;
    compilerFlags: Tag;
    timingInfo: Malloy.TimingInfo;
  } {
    const ast = this.visit(this.parseInfo.root);
    const compilerFlags = this.compilerFlags;
    return {
      ast,
      compilerFlags,
      timingInfo: this.timer.stop(),
    };
  }

  /**
   * Mostly used to flag a case where the grammar and the type system are
   * no longer in sync. A visitor was written based on a grammar which
   * apparently has changed and now an unexpected element type has appeared.
   * This is a non recoverable error, since the parser and the grammar
   * are not compatible.
   * @return an error object to throw.
   */
  protected internalError(cx: ParserRuleContext, message: string): Error {
    this.contextError(cx, 'internal-translator-error', {message});
    return new Error(`Internal Translator Error: ${message}`);
  }

  /**
   * Log an error message relative to an AST node
   */
  protected astError<T extends MessageCode>(
    el: ast.MalloyElement,
    code: T,
    data: MessageParameterType<T>,
    options?: LogMessageOptions
  ): void {
    this.msgLog.log(makeLogMessage(code, data, {at: el.location, ...options}));
  }

  protected rangeFromContext(cx: ParserRuleContext) {
    return rangeFromContext(this.parseInfo.sourceInfo, cx);
  }

  protected getLocation(cx: ParserRuleContext): DocumentLocation {
    return {
      url: this.parseInfo.sourceURL,
      range: this.rangeFromContext(cx),
    };
  }

  protected getSourceString(cx: ParserRuleContext): string {
    return this.parseInfo.sourceStream.getText(
      new StreamInterval(
        cx.start.startIndex,
        cx.stop ? cx.stop.stopIndex : cx.start.startIndex
      )
    );
  }

  /**
   * Log an error message relative to a parse node
   */
  protected contextError<T extends MessageCode>(
    cx: ParserRuleContext,
    code: T,
    data: MessageParameterType<T>,
    options?: LogMessageOptions
  ): void {
    this.msgLog.log(
      makeLogMessage(code, data, {
        at: this.getLocation(cx),
        ...options,
      })
    );
  }

  protected warnWithReplacement<T extends MessageCode>(
    code: T,
    data: MessageParameterType<T>,
    range: DocumentRange,
    replacement: string
  ): void {
    this.msgLog.log(
      makeLogMessage(code, data, {
        at: {url: this.parseInfo.sourceURL, range},
        severity: 'warn',
        replacement,
      })
    );
  }

  protected inExperiment(experimentId: string, cx: ParserRuleContext): boolean {
    const experimental = this.compilerFlags.tag('experimental');
    if (
      experimental &&
      (experimental.bare() || experimental.has(experimentId))
    ) {
      return true;
    }
    this.contextError(cx, 'experiment-not-enabled', {experimentId});
    return false;
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
          'unexpected-statement-in-translation',
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
      range: this.rangeFromContext(cx),
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

  protected getPlainStringFrom(cx: HasString): string {
    const [result, errors] = getPlainString(cx);
    for (const error of errors) {
      if (error instanceof ParserRuleContext) {
        this.contextError(
          error,
          'illegal-query-interpolation-outside-sql-block',
          '%{ query } illegal in this string'
        );
      }
    }
    return result || '';
  }

  protected makeSqlString(
    pcx: parse.SqlStringContext,
    sqlStr: ast.SQLString
  ): void {
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
      this.contextError(
        pcx,
        'failed-to-parse-time-literal',
        'Time data parse error'
      );
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

  getSourceParameter(
    pcx: parse.SourceParameterContext
  ): ast.HasParameter | null {
    const name = getId(pcx.parameterNameDef());

    let pType: ParameterTypeDef | undefined;
    const typeCx = pcx.legalParamType();
    if (typeCx) {
      const t = this.getMalloyType(typeCx.malloyType());
      if (typeCx.FILTER()) {
        if (isFilterable(t)) {
          pType = {type: 'filter expression', filterType: t};
        } else {
          this.contextError(
            typeCx,
            'parameter-illegal-default-type',
            `Unknown filter type ${t}`
          );
        }
      } else if (isParameterType(t)) {
        pType = {type: t};
      } else {
        this.contextError(
          typeCx,
          'parameter-illegal-default-type',
          `Unknown parameter type ${t}`
        );
      }
    }

    const defaultCx = pcx.fieldExpr();
    let defVal;
    if (defaultCx) {
      defVal = this.astAt(
        new ast.ConstantExpression(this.getFieldExpr(defaultCx)),
        defaultCx
      );
    }

    return this.astAt(
      new ast.HasParameter({name, typeDef: pType, default: defVal}),
      pcx
    );
  }

  getSourceParameters(
    pcx: parse.SourceParametersContext | undefined
  ): ast.HasParameter[] {
    if (pcx === undefined) return [];
    this.inExperiment('parameters', pcx);
    function notNullParam(p: ast.HasParameter | null): p is ast.HasParameter {
      return p !== null;
    }
    return pcx
      .sourceParameter()
      .map(param => this.getSourceParameter(param))
      .filter(notNullParam);
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
    const visited = this.only<ast.SourceProperty>(
      pcx.exploreStatement().map(ecx => this.visit(ecx)),
      x => ast.isSourceProperty(x) && x,
      'source property'
    );
    const propList = new ast.SourceDesc(visited);
    return propList;
  }

  visitExploreTable(pcx: parse.ExploreTableContext): ast.TableSource {
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

  visitDefJoinMany(pcx: parse.DefJoinManyContext): ast.JoinStatement {
    const accessLabel = this.getAccessLabel(pcx.accessLabel());
    const joins: ast.Join[] = [];
    for (const joinCx of pcx.joinList().joinDef()) {
      const join = this.visit(joinCx);
      if (join instanceof ast.Join) {
        joins.push(join);
        if (join instanceof ast.ExpressionJoin) {
          join.joinType = 'many';
          if (join.joinOn === undefined) {
            this.contextError(
              pcx,
              'missing-on-in-join-many',
              'join_many: requires ON expression'
            );
          }
        } else if (join instanceof ast.KeyJoin) {
          this.contextError(
            pcx,
            'foreign-key-in-join-many',
            'Foreign key join not legal in join_many:'
          );
        }
      }
    }
    const joinMany = new ast.JoinStatement(joins, accessLabel);
    joinMany.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return joinMany;
  }

  visitDefJoinOne(pcx: parse.DefJoinOneContext): ast.JoinStatement {
    const accessLabel = this.getAccessLabel(pcx.accessLabel());
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
    const joinOne = new ast.JoinStatement(joins, accessLabel);
    joinOne.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return joinOne;
  }

  visitDefJoinCross(pcx: parse.DefJoinCrossContext): ast.JoinStatement {
    const accessLabel = this.getAccessLabel(pcx.accessLabel());
    const joinList = this.getJoinList(pcx.joinList());
    const joins: ast.Join[] = [];
    for (const join of joinList) {
      if (join instanceof ast.Join) {
        joins.push(join);
        if (join instanceof ast.ExpressionJoin) {
          join.joinType = 'cross';
        } else {
          join.logError(
            'foreign-key-in-join-cross',
            'Foreign key join not legal in join_cross:'
          );
        }
      }
    }
    const joinCross = new ast.JoinStatement(joins, accessLabel);
    joinCross.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return joinCross;
  }

  protected getJoinList(pcx: parse.JoinListContext): ast.Join[] {
    return this.only<ast.Join>(
      pcx.joinDef().map(scx => this.visit(scx)),
      x => x instanceof ast.Join && x,
      'join'
    );
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
    return this.astAt(this.visit(pcx.joinStatement()), pcx);
  }

  visitJoinOn(pcx: parse.JoinOnContext): ast.Join {
    const {joinAs, joinFrom, notes} = this.getJoinFrom(pcx.joinFrom());
    const join = new ast.ExpressionJoin(joinAs, joinFrom);
    const onCx = pcx.joinExpression();
    const mop = pcx.matrixOperation()?.text.toLocaleLowerCase() || 'left';
    if (isMatrixOperation(mop)) {
      join.matrixOperation = mop;
    } else {
      this.contextError(
        pcx,
        'unknown-matrix-operation',
        'Internal Error: Unknown matrixOperation'
      );
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
    const accessLabel = this.getAccessLabel(pcx.accessLabel());
    const defs = this.getFieldDefs(
      pcx.defList().fieldDef(),
      ast.DimensionFieldDeclaration
    );
    const stmt = new ast.Dimensions(defs, accessLabel);
    stmt.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return this.astAt(stmt, pcx);
  }

  getAccessLabel(
    pcx: parse.AccessLabelContext | undefined
  ): AccessModifierLabel | undefined {
    if (pcx === undefined) return undefined;
    if (pcx.INTERNAL_KW()) return 'internal';
    if (pcx.PRIVATE_KW()) return 'private';
    if (pcx.PUBLIC_KW()) return 'public';
    throw this.internalError(pcx, `Unknown access modifier label ${pcx.text}`);
  }

  getAccessLabelProp(
    pcx: parse.AccessLabelPropContext | undefined
  ): AccessModifierLabel | undefined {
    if (pcx === undefined) return undefined;
    if (pcx.INTERNAL()) return 'internal';
    if (pcx.PRIVATE()) return 'private';
    if (pcx.PUBLIC()) return 'public';
    throw this.internalError(pcx, `Unknown access modifier label ${pcx.text}`);
  }

  visitDefMeasures(pcx: parse.DefMeasuresContext): ast.Measures {
    const accessLabel = this.getAccessLabel(pcx.accessLabel());
    const defs = this.getFieldDefs(
      pcx.defList().fieldDef(),
      ast.MeasureFieldDeclaration
    );
    const stmt = new ast.Measures(defs, accessLabel);
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

  visitRenameEntry(pcx: parse.RenameEntryContext): ast.RenameField {
    const newName = pcx.fieldName(0);
    const oldName = pcx.fieldName(1);
    const rename = new ast.RenameField(
      getId(newName),
      this.getFieldName(oldName)
    );
    const notes = this.getNotes(pcx.tags()).concat(
      this.getIsNotes(pcx.isDefine())
    );
    rename.extendNote({notes});
    return this.astAt(rename, pcx);
  }

  visitDefExploreRename(pcx: parse.DefExploreRenameContext): ast.Renames {
    const accessLabel = this.getAccessLabel(pcx.accessLabel());
    const rcxs = pcx.renameList().renameEntry();
    const renames = rcxs.map(rcx => this.visitRenameEntry(rcx));
    const stmt = new ast.Renames(renames, accessLabel);
    const blockNotes = this.getNotes(pcx.tags());
    stmt.extendNote({blockNotes});
    return this.astAt(stmt, pcx);
  }

  visitFilterClauseList(pcx: parse.FilterClauseListContext): ast.Filter {
    return new ast.Filter(pcx.fieldExpr().map(f => this.getFilterElement(f)));
  }

  visitDrillClauseList(pcx: parse.FilterClauseListContext): ast.Drill {
    return new ast.Drill(pcx.fieldExpr().map(f => this.getFilterElement(f)));
  }

  visitWhereStatement(pcx: parse.WhereStatementContext): ast.Filter {
    const where = this.visitFilterClauseList(pcx.filterClauseList());
    where.having = false;
    return this.astAt(where, pcx);
  }

  visitDrillStatement(pcx: parse.DrillStatementContext): ast.Drill {
    const drill = this.visitDrillClauseList(pcx.drillClauseList());
    return this.astAt(drill, pcx);
  }

  visitHavingStatement(pcx: parse.HavingStatementContext): ast.Filter {
    const having = this.visitFilterClauseList(pcx.filterClauseList());
    having.having = true;
    return this.astAt(having, pcx);
  }

  visitDefExploreQuery(pcx: parse.DefExploreQueryContext): ast.Views {
    const accessLabel = this.getAccessLabel(pcx.accessLabel());
    const babyTurtles = pcx
      .subQueryDefList()
      .exploreQueryDef()
      .map(cx => this.visitExploreQueryDef(cx));
    const queryDefs = new ast.Views(babyTurtles, accessLabel);
    const blockNotes = this.getNotes(pcx.tags());
    queryDefs.extendNote({blockNotes});
    return queryDefs;
  }

  visitDefExplorePrimaryKey(
    pcx: parse.DefExplorePrimaryKeyContext
  ): ast.PrimaryKey {
    const node = new ast.PrimaryKey(this.getFieldName(pcx.fieldName()));
    return this.astAt(node, pcx);
  }

  getFieldNameList(
    pcx: parse.FieldNameListContext,
    makeFieldRef: ast.FieldReferenceConstructor
  ): ast.FieldReferences {
    const members = pcx
      .fieldName()
      .map(cx => this.astAt(new makeFieldRef([this.getFieldName(cx)]), cx));
    return new ast.FieldReferences(members);
  }

  visitDefExploreEditField(
    pcx: parse.DefExploreEditFieldContext
  ): ast.FieldListEdit {
    const action = pcx.ACCEPT() ? 'accept' : 'except';
    return new ast.FieldListEdit(
      action,
      this.getFieldNameList(pcx.fieldNameList(), ast.AcceptExceptFieldReference)
    );
  }

  visitSQInclude(pcx: parse.SQIncludeContext): ast.SQExtend {
    const extendSrc = this.getSqExpr(pcx.sqExpr());
    const includeBlock = pcx.includeBlock();
    const includeList = includeBlock
      ? this.getIncludeItems(includeBlock)
      : undefined;
    const src = new ast.SQExtend(
      extendSrc,
      new ast.SourceDesc([]),
      includeList
    );
    return this.astAt(src, pcx);
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
      this.astError(timezoneStatement, 'invalid-timezone', {
        timezone: timezoneStatement.tz,
      });
    }

    return this.astAt(timezoneStatement, cx);
  }

  visitQueryProperties(pcx: parse.QueryPropertiesContext): ast.QOpDesc {
    const qProps = this.only<ast.QueryProperty>(
      pcx.queryStatement().map(qcx => this.astAt(this.visit(qcx), qcx)),
      x => ast.isQueryProperty(x) && x,
      'query statement'
    );
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
          // TODO this error doesn't have any tests
          this.contextError(
            agg,
            'invalid-reference-only-aggregation',
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
    const stmt = this.visitFieldCollection(pcx.fieldCollection());
    stmt.extendNote({blockNotes: this.getNotes(pcx.tags())});
    return stmt;
  }

  visitCollectionWildCard(
    pcx: parse.CollectionWildCardContext
  ): ast.WildcardFieldReference {
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

  visitTopStatement(pcx: parse.TopStatementContext): ast.Limit {
    const topN = this.getNumber(pcx.INTEGER_LITERAL());
    return this.astAt(new ast.Limit(topN), pcx);
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
          'anonymous-nest',
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

  visitPartialCompare(pcx: parse.PartialCompareContext): ast.PartialCompare {
    const partialOp = pcx.compareOp().text;
    if (ast.isComparison(partialOp)) {
      return this.astAt(
        new ast.PartialCompare(partialOp, this.getFieldExpr(pcx.fieldExpr())),
        pcx
      );
    }
    throw this.internalError(
      pcx,
      `partial comparison '${partialOp}' not recognized`
    );
  }

  visitPartialTest(pcx: parse.PartialTestContext): ast.ExpressionDef {
    const cmp = pcx.partialCompare();
    if (cmp) {
      return this.visitPartialCompare(cmp);
    }
    return this.astAt(new ast.PartialIsNull(pcx.NOT() ? '!=' : '='), pcx);
  }

  visitPartialAllowedFieldExpr(
    pcx: parse.PartialAllowedFieldExprContext
  ): ast.ExpressionDef {
    const exprCx = pcx.fieldExpr();
    if (exprCx) {
      return this.getFieldExpr(exprCx);
    }
    const partialCx = pcx.partialTest();
    if (partialCx) {
      return this.visitPartialTest(partialCx);
    }
    throw this.internalError(pcx, 'impossible partial');
  }

  visitExprString(pcx: parse.ExprStringContext): ast.ExprString {
    const str = this.getPlainStringFrom(pcx);
    return new ast.ExprString(str);
  }

  visitRawString(pcx: parse.RawStringContext): ast.ExprString {
    const str = pcx.text.slice(1).trimStart();
    const lastChar = str[str.length - 1];
    if (lastChar === '\n') {
      const t = str[0] === "'" ? '"' : "'";
      this.contextError(
        pcx,
        'literal-string-newline',
        `Missing ${t}${str[0]}${t} before end-of-line`
      );
    }
    const astStr = new ast.ExprString(str.slice(1, -1));
    return this.astAt(astStr, pcx);
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
    return new ast.ExprParens(this.getFieldExpr(pcx.fieldExpr()));
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
    const left = this.getFieldExpr(pcx.fieldExpr(0));
    const right = this.getFieldExpr(pcx.fieldExpr(1));
    if (ast.isEquality(op)) {
      const wholeRange = this.rangeFromContext(pcx);
      if (right instanceof ast.ExprNULL) {
        if (op === '=') {
          this.warnWithReplacement(
            'sql-is-null',
            "Use 'is null' to check for NULL instead of '= null'",
            wholeRange,
            `${this.getSourceCode(pcx.fieldExpr(0))} is null`
          );
        } else if (op === '!=') {
          this.warnWithReplacement(
            'sql-is-not-null',
            "Use 'is not null' to check for NULL instead of '!= null'",
            wholeRange,
            `${this.getSourceCode(pcx.fieldExpr(0))} is not null`
          );
        }
      }
      return this.astAt(new ast.ExprEquality(left, op, right), pcx);
    } else if (ast.isComparison(op)) {
      return this.astAt(new ast.ExprCompare(left, op, right), pcx);
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
        this.contextError(
          exprDef,
          'count-expression-with-locality',
          'Expression illegal inside path.count()'
        );
      }
      return new ast.ExprCount(source);
    }

    const expr = exprDef ? this.getFieldExpr(exprDef) : undefined;

    if (aggFunc === 'min' || aggFunc === 'max') {
      if (expr) {
        this.contextError(
          pcx,
          'invalid-symmetric-aggregate',
          this.symmetricAggregateUsageError(aggFunc)
        );
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
      this.contextError(
        pcx,
        'aggregate-parse-error',
        `Cannot parse aggregate function ${aggFunc}`
      );
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

    if (aggFunc === 'count') {
      return this.astAt(
        expr ? new ast.ExprCountDistinct(expr) : new ast.ExprCount(),
        pcx
      );
    } else if (aggFunc === 'min') {
      if (expr) {
        return new ast.ExprMin(expr);
      } else {
        this.contextError(
          pcx,
          'invalid-symmetric-aggregate',
          this.symmetricAggregateUsageError(aggFunc)
        );
      }
    } else if (aggFunc === 'max') {
      if (expr) {
        return new ast.ExprMax(expr);
      } else {
        this.contextError(
          pcx,
          'invalid-symmetric-aggregate',
          this.symmetricAggregateUsageError(aggFunc)
        );
      }
    } else {
      if (expr === undefined) {
        this.contextError(
          pcx,
          'invalid-asymmetric-aggregate',
          this.asymmetricAggregateUsageError(aggFunc)
        );
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
          'unexpected-malloy-type',
          `'#' assertion for unknown type '${rawRawType}'`
        );
        rawType = undefined;
      }
    }

    let fn = getOptionalId(pcx) || pcx.timeframe()?.text;
    if (fn === undefined) {
      this.contextError(
        pcx,
        'failed-to-parse-function-name',
        'Function name error'
      );
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

  visitCaseStatement(pcx: parse.CaseStatementContext): ast.Case {
    const valueCx = pcx._valueExpr;
    const value = valueCx ? this.getFieldExpr(valueCx) : undefined;
    const whenCxs = pcx.caseWhen();
    const whens = whenCxs.map(whenCx => {
      return new ast.CaseWhen(
        this.getFieldExpr(whenCx._condition),
        this.getFieldExpr(whenCx._result)
      );
    });
    const elseCx = pcx._caseElse;
    const theElse = elseCx ? this.getFieldExpr(elseCx) : undefined;
    this.warnWithReplacement(
      'sql-case',
      'Use a `pick` statement instead of `case`',
      this.rangeFromContext(pcx),
      `${[
        ...(valueCx ? [`${this.getSourceCode(valueCx)} ?`] : []),
        ...whenCxs.map(
          whenCx =>
            `pick ${this.getSourceCode(
              whenCx._result
            )} when ${this.getSourceCode(whenCx._condition)}`
        ),
        elseCx ? `else ${elseCx.text}` : 'else null',
      ].join(' ')}`
    );
    return new ast.Case(value, whens, theElse);
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
    const statements = this.only<ast.FieldPropStatement>(
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

  visitGroupedByStatement(pcx: parse.GroupedByStatementContext) {
    this.inExperiment('grouped_by', pcx);
    return this.astAt(
      new ast.GroupedBy(
        pcx
          .id()
          .map(idCx =>
            this.astAt(
              new ast.GroupedByReference([
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

  visitDebugExpr(pcx: parse.DebugExprContext): ast.ExpressionDef {
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

  updateCompilerFlags(tags: ast.ModelAnnotation) {
    const parseCompilerFlagsTimer = new Timer('parse_compiler_flags');
    this.compilerFlags = tags.getCompilerFlags(this.compilerFlags, this.msgLog);
    this.timer.contribute([parseCompilerFlagsTimer.stop()]);
  }

  visitDocAnnotations(pcx: parse.DocAnnotationsContext): ast.ModelAnnotation {
    const allNotes = pcx.DOC_ANNOTATION().map(note => {
      return {
        text: note.text,
        at: this.getLocation(pcx),
      };
    });
    const tags = new ast.ModelAnnotation(allNotes);
    this.updateCompilerFlags(tags);
    return tags;
  }

  visitIgnoredObjectAnnotations(
    pcx: parse.IgnoredObjectAnnotationsContext
  ): IgnoredElement {
    this.contextError(
      pcx,
      'orphaned-object-annotation',
      'Object annotation not connected to any object'
    );
    return new IgnoredElement(pcx.text);
  }

  visitIgnoredModelAnnotations(
    pcx: parse.IgnoredModelAnnotationsContext
  ): IgnoredElement {
    this.contextError(
      pcx,
      'misplaced-model-annotation',
      'Model annotations not allowed at this scope'
    );
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
      'unexpected-non-source-query-expression-node',
      `Expected a source/query expression, not '${result.elementType}'`
    );
    return new ErrorNode();
  }

  visitSQExtendedSource(pcx: parse.SQExtendedSourceContext) {
    const extendSrc = this.getSqExpr(pcx.sqExpr());
    const includeBlock = pcx.includeBlock();
    const includeList = includeBlock
      ? this.getIncludeItems(includeBlock)
      : undefined;
    const src = new ast.SQExtend(
      extendSrc,
      this.getSourceExtensions(pcx.exploreProperties()),
      includeList
    );
    return this.astAt(src, pcx);
  }

  getIncludeItems(pcx: parse.IncludeBlockContext): ast.IncludeItem[] {
    this.inExperiment('access_modifiers', pcx);
    return pcx
      .includeItem()
      .map(item => this.getIncludeItem(item))
      .filter(isNotUndefined);
  }

  getIncludeItem(pcx: parse.IncludeItemContext): ast.IncludeItem | undefined {
    const tagsCx = pcx.tags();
    const blockNotes = tagsCx ? this.getNotes(tagsCx) : [];
    const exceptList = pcx.includeExceptList();
    if (exceptList) {
      if (tagsCx && blockNotes.length > 0) {
        this.contextError(
          tagsCx,
          'cannot-tag-include-except',
          'Tags on `except:` are ignored',
          {severity: 'warn'}
        );
      }
      const fieldList = this.getExcludeList(exceptList);
      return this.astAt(new ast.IncludeExceptItem(fieldList), pcx);
    } else {
      const listCx = pcx.includeList();
      if (listCx === undefined) {
        this.contextError(
          pcx.orphanedAnnotation() ?? pcx,
          'orphaned-object-annotation',
          'This tag is not attached to anything',
          {severity: 'warn'}
        );
        return undefined;
      }
      const kind = this.getAccessLabelProp(pcx.accessLabelProp());
      const fieldList = this.getIncludeList(listCx);
      const item = this.astAt(new ast.IncludeAccessItem(kind, fieldList), pcx);
      item.extendNote({blockNotes});
      return item;
    }
  }

  getIncludeList(pcx: parse.IncludeListContext): ast.IncludeListItem[] {
    const listCx = pcx.includeField();
    if (listCx === undefined) {
      throw this.internalError(pcx, 'Expected a field name list');
    }
    return listCx.map(fieldCx => this.getIncludeListItem(fieldCx));
  }

  getExcludeList(
    pcx: parse.IncludeExceptListContext
  ): (ast.AccessModifierFieldReference | ast.WildcardFieldReference)[] {
    return pcx.includeExceptListItem().map(fcx => {
      if (fcx.tags().ANNOTATION().length > 0) {
        this.contextError(
          fcx.tags(),
          'cannot-tag-include-except',
          'Tags on `except:` are ignored',
          {severity: 'warn'}
        );
      }
      const fieldNameCx = fcx.fieldPath();
      if (fieldNameCx) {
        return this.astAt(
          this.getFieldPath(fieldNameCx, ast.AccessModifierFieldReference),
          fieldNameCx
        ) as ast.AccessModifierFieldReference;
      }
      const wildcardCx = fcx.collectionWildCard();
      if (wildcardCx) {
        return this.astAt(this.visitCollectionWildCard(wildcardCx), wildcardCx);
      }
      throw this.internalError(fcx, 'Expected a field name or wildcard');
    });
  }

  getIncludeListItem(pcx: parse.IncludeFieldContext): ast.IncludeListItem {
    const wildcardCx = pcx.collectionWildCard();
    const wildcard = wildcardCx
      ? this.visitCollectionWildCard(wildcardCx)
      : undefined;
    const as = pcx._as ? this.getFieldName(pcx._as) : undefined;
    const tags1cx = pcx.tags();
    const tags1 = tags1cx ? this.getNotes(tags1cx) : [];
    const tags2cx = pcx.isDefine();
    const tags2 = tags2cx ? this.getIsNotes(tags2cx) : [];
    const notes = [...tags1, ...tags2];
    const name = pcx._name
      ? (this.astAt(
          this.getFieldPath(pcx._name, ast.AccessModifierFieldReference),
          pcx._name
        ) as ast.AccessModifierFieldReference)
      : undefined;
    const reference = name ?? wildcard;
    if (reference === undefined) {
      throw this.internalError(pcx, 'Expected a field name or wildcard');
    }
    const item = this.astAt(
      new ast.IncludeListItem(reference, as?.refString),
      pcx
    );
    item.extendNote({notes});
    return item;
  }

  visitSQParens(pcx: parse.SQParensContext) {
    // TODO maybe implement a pass-through SQParens node
    const sqExpr = this.getSqExpr(pcx.sqExpr());
    return this.astAt(sqExpr, pcx);
  }

  visitSQCompose(pcx: parse.SQComposeContext) {
    const sources = pcx.sqExpr().map(sqExpr => this.getSqExpr(sqExpr));
    this.inExperiment('composite_sources', pcx);
    return this.astAt(new ast.SQCompose(sources), pcx);
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

  visitRecordRef(pcx: parse.RecordRefContext) {
    const idRef = new ast.ExprIdReference(
      this.getFieldPath(pcx.fieldPath(), ast.ExpressionFieldReference)
    );
    return this.astAt(new ast.RecordElement({path: idRef}), pcx);
  }

  visitRecordExpr(pcx: parse.RecordExprContext) {
    const value = this.getFieldExpr(pcx.fieldExpr());
    const keyCx = pcx.recordKey();
    const recInit = keyCx ? {key: getId(keyCx), value} : {value};
    return this.astAt(new ast.RecordElement(recInit), pcx);
  }

  visitExprLiteralRecord(pcx: parse.ExprLiteralRecordContext) {
    const els = this.only<ast.RecordElement>(
      pcx.recordElement().map(elCx => this.astAt(this.visit(elCx), elCx)),
      visited => visited instanceof ast.RecordElement && visited,
      'a legal record property description'
    );
    return new ast.RecordLiteral(els);
  }

  visitExprArrayLiteral(pcx: parse.ExprArrayLiteralContext): ast.ArrayLiteral {
    const contents = pcx.fieldExpr().map(fcx => this.getFieldExpr(fcx));
    const literal = new ast.ArrayLiteral(contents);
    return this.astAt(literal, pcx);
  }

  visitExprWarnLike(pcx: parse.ExprWarnLikeContext): ast.ExprCompare {
    let op: ast.CompareMalloyOperator = '~';
    const left = pcx.fieldExpr(0);
    const right = pcx.fieldExpr(1);
    const wholeRange = this.rangeFromContext(pcx);
    if (pcx.NOT()) {
      op = '!~';
      this.warnWithReplacement(
        'sql-not-like',
        "Use Malloy operator '!~' instead of 'NOT LIKE'",
        wholeRange,
        `${this.getSourceCode(left)} !~ ${this.getSourceCode(right)}`
      );
    } else {
      this.warnWithReplacement(
        'sql-like',
        "Use Malloy operator '~' instead of 'LIKE'",
        wholeRange,
        `${this.getSourceCode(left)} ~ ${this.getSourceCode(right)}`
      );
    }
    return this.astAt(
      new ast.ExprCompare(
        this.getFieldExpr(left),
        op,
        this.getFieldExpr(right)
      ),
      pcx
    );
  }

  visitExprNullCheck(pcx: parse.ExprNullCheckContext): ast.ExprIsNull {
    const expr = pcx.fieldExpr();
    return this.astAt(
      new ast.ExprIsNull(this.getFieldExpr(expr), pcx.NOT() ? '!=' : '='),
      pcx
    );
  }

  visitExprWarnIn(pcx: parse.ExprWarnInContext): ast.ExprLegacyIn {
    const expr = this.getFieldExpr(pcx.fieldExpr());
    const isNot = !!pcx.NOT();
    const from = pcx.fieldExprList().fieldExpr();
    const inStmt = this.astAt(
      new ast.ExprLegacyIn(
        expr,
        isNot,
        from.map(f => this.getFieldExpr(f))
      ),
      pcx
    );
    this.warnWithReplacement(
      'sql-in',
      `Use = (a|b|c) instead of${isNot ? ' NOT' : ''} IN (a,b,c)`,
      this.rangeFromContext(pcx),
      `${this.getSourceCode(pcx.fieldExpr())} ${isNot ? '!=' : '='} (${from
        .map(f => this.getSourceCode(f))
        .join(' | ')})`
    );
    return inStmt;
  }

  visitTickFilterString(
    pcx: parse.TickFilterStringContext
  ): ast.ExprFilterExpression {
    const fString = pcx.text.slice(1).trimStart(); // remove fSPACE
    const lastChar = fString[fString.length - 1];
    if (lastChar === '\n') {
      const t = fString[0] === "'" ? '"' : "'";
      this.contextError(
        pcx,
        'literal-string-newline',
        `Missing $${t}${fString[0]}${t} before end-of-line`
      );
    }
    const filterText = fString.slice(1, -1);
    const mfe = new ast.ExprFilterExpression(filterText);
    return this.astAt(mfe, pcx);
  }

  visitTripFilterString(
    pcx: parse.TripFilterStringContext
  ): ast.ExprFilterExpression {
    const fString = pcx.text.slice(1).trimStart();
    const filterText = fString.slice(3, -3);
    const mfe = new ast.ExprFilterExpression(filterText);
    return this.astAt(mfe, pcx);
  }
}
