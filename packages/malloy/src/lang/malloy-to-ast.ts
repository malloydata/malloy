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

import {ParserRuleContext} from 'antlr4ts';
import {ParseTree} from 'antlr4ts/tree';
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
  getNotes,
  getIsNotes,
  HasString,
  HasID,
  getStringParts,
  getShortString,
  getStringIfShort,
  unIndent,
} from './parse-utils';
import {MalloyTagProperties} from '../tags';

class IgnoredElement extends ast.MalloyElement {
  elementType = 'ignoredByParser';
  malloySrc: string;
  constructor(src: string) {
    super();
    this.malloySrc = src;
  }
}

/**
 * ANTLR visitor pattern parse tree traversal. Generates a Malloy
 * AST from an ANTLR parse tree.
 */
export class MalloyToAST
  extends AbstractParseTreeVisitor<ast.MalloyElement>
  implements MalloyParserVisitor<ast.MalloyElement>
{
  compilerFlags: MalloyTagProperties = {};
  constructor(
    readonly parseInfo: MalloyParseInfo,
    readonly msgLog: MessageLogger
  ) {
    super();
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
      at: {
        url: this.parseInfo.sourceURL,
        range: this.parseInfo.rangeFromContext(cx),
      },
      severity: sev,
    });
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
        this.astError(el, `Expected ${desc}, not '${el.elementType}'`);
      }
    }
    return acceptable;
  }

  protected m4WarningsEnabled(): boolean {
    return !!this.compilerFlags['m4warnings'];
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
  ): ast.FieldDeclaration[] {
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

  protected getSegments(segments: parse.PipeElementContext[]): ast.QOPDesc[] {
    return segments.map(cx => this.visitQueryProperties(cx.queryProperties()));
  }

  protected getFilterShortcut(cx: parse.FilterShortcutContext): ast.Filter {
    const el = this.getFilterElement(cx.fieldExpr());
    if (this.m4WarningsEnabled()) {
      this.astError(
        el,
        'Filter shortcut `{? condition }` is deprecated; use `{ where: condition } instead',
        'warn'
      );
    }
    return new ast.Filter([el]);
  }

  protected getPlainString(cx: HasString): string {
    const shortStr = getStringIfShort(cx);
    if (shortStr) {
      return shortStr;
    }
    const safeParts: string[] = [];
    const multiLineStr = cx.string().sqlString();
    if (multiLineStr) {
      for (const part of getStringParts(multiLineStr)) {
        if (part instanceof ParserRuleContext) {
          this.contextError(part, '%{ query } illegal in this string');
        } else {
          safeParts.push(part);
        }
      }
      unIndent(safeParts);
      return safeParts.join('');
    }
    // string: shortString | sqlString; So this will never happen
    return '';
  }

  protected getSource(pcx: parse.ExploreContext) {
    const source = this.visit(pcx);
    if (source instanceof ast.Source) {
      return source;
    }
    throw this.internalError(
      pcx,
      `Source expected, but ${source.elementType} found`
    );
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
      this.contextError(pcx, 'Time data parse error');
      // return a value node so the parse can continue
      def = new ast.LiteralTimestamp({text: pcx.text});
    }
    return this.astAt(def, pcx);
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
    const blockNotes = getNotes(pcx.tags());
    const defList = new ast.DefineSourceList(defs);
    defList.extendNote({blockNotes});
    return defList;
  }

  visitSourceDefinition(pcx: parse.SourceDefinitionContext): ast.DefineSource {
    const exploreDef = new ast.DefineSource(
      getId(pcx.sourceNameDef()),
      this.getSource(pcx.explore()),
      true,
      []
    );
    const notes = getNotes(pcx.tags()).concat(getIsNotes(pcx.isDefine()));
    exploreDef.extendNote({notes});
    return this.astAt(exploreDef, pcx);
  }

  visitQueryFromSQLSource(
    pcx: parse.QueryFromSQLSourceContext
  ): ast.QueryElement {
    const query = new ast.FullQuery(this.visitSqlSource(pcx.sqlSource()));
    return this.astAt(query, pcx);
  }

  visitQueryFromSource(pcx: parse.QueryFromSourceContext): ast.QueryElement {
    const root = this.visitUnextendableSource(pcx.unextendableSource());
    const query = new ast.FullQuery(root);
    query.addSegments(...this.getSegments(pcx.pipeElement()));
    return this.astAt(query, pcx);
  }

  protected getQueryRefinements(
    pcx: parse.QueryRefinementContext
  ): ast.QOPDesc {
    const properties = this.astAt(
      this.visitQueryProperties(pcx.queryProperties()),
      pcx
    );
    if (this.m4WarningsEnabled() && pcx.REFINE() === undefined) {
      this.astError(
        properties,
        'Implicit query refinement is deprecated, use the `refine` operator.',
        'warn'
      );
    }
    return properties;
  }

  visitRefinedQuery(pcx: parse.RefinedQueryContext): ast.QueryElement {
    const base = this.visit(pcx.refinableQuery());
    if (ast.isQueryElement(base)) {
      const rcx = pcx.queryRefinement();
      if (rcx) {
        const properties = this.getQueryRefinements(rcx);
        base.refineWith(properties);
      }
      return base;
    }
    throw this.internalError(
      pcx,
      `Query expected, but ${base.elementType} found`
    );
  }

  visitQueryByTurtleName(
    pcx: parse.QueryByTurtleNameContext
  ): ast.QueryElement {
    const source = this.visitUnextendableSource(pcx.unextendableSource());
    const query = new ast.FullQuery(source);
    query.turtleName = this.getFieldName(pcx);
    return this.astAt(query, pcx);
  }

  visitQueryByName(pcx: parse.QueryByNameContext): ast.QueryElement {
    const query = new ast.ExistingQuery();
    query.head = this.getModelEntryName(pcx);
    const res = this.astAt(query, pcx);
    if (this.m4WarningsEnabled() && pcx.ARROW()) {
      this.astError(
        res,
        'Leading arrow (`->`) when referencing a query is deprecated; remove the arrow',
        'warn'
      );
    }
    return res;
  }

  protected getSourceExtensions(
    pcx: parse.SourceExtensionContext
  ): ast.SourceDesc {
    const extensions = pcx?.exploreProperties();
    const sourceDesc = this.astAt(this.visitExploreProperties(extensions), pcx);
    if (this.m4WarningsEnabled() && pcx.EXTEND() === undefined) {
      this.astError(
        sourceDesc,
        'Implicit source extension is deprecated, use the `extend` operator.',
        'warn'
      );
    }
    return sourceDesc;
  }

  visitUnextendableSource(pcx: parse.UnextendableSourceContext) {
    const unextendedSource = this.visit(pcx.extendableSource());
    if (unextendedSource instanceof ast.Source) {
      const ecx = pcx.sourceExtension();
      if (ecx) {
        const sourceDesc = this.getSourceExtensions(ecx);
        return new ast.RefinedSource(unextendedSource, sourceDesc);
      } else {
        return unextendedSource;
      }
    }
    throw this.internalError(
      pcx,
      `Source expected, but ${unextendedSource.elementType} found`
    );
  }

  visitNormalQuery(pcx: parse.NormalQueryContext): ast.QueryElement {
    const query = this.visit(pcx.unrefinableQuery());
    if (ast.isQueryElement(query)) {
      query.addSegments(...this.getSegments(pcx.pipeElement()));
      return this.astAt(query, pcx);
    }
    throw this.internalError(
      pcx,
      `Expected query, but ${query.elementType} found`
    );
  }

  visitExtendedQuery(pcx: parse.ExtendedQueryContext) {
    const query = this.visit(pcx.query());
    if (!ast.isQueryElement(query)) {
      throw this.internalError(
        pcx,
        `Query expected, but ${query.elementType} found`
      );
    }
    const source = new ast.QuerySource(query);
    const sourceDesc = this.getSourceExtensions(pcx.sourceExtension());
    return this.astAt(new ast.RefinedSource(source, sourceDesc), pcx);
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
    const tableURI = this.getPlainString(pcx.tableURI());
    const el = this.astAt(new ast.TableFunctionSource(tableURI), pcx);
    if (this.m4WarningsEnabled()) {
      this.astError(
        el,
        "`table('connection_name:table_path')` is deprecated; use `connection_name.table('table_path')`",
        'warn'
      );
    }
    return el;
  }

  visitTableMethod(pcx: parse.TableMethodContext): ast.TableSource {
    const connId = pcx.connectionId();
    const connectionName = this.astAt(this.getModelEntryName(connId), connId);
    const tablePath = this.getPlainString(pcx.tablePath());
    return this.astAt(
      new ast.TableMethodSource(connectionName, tablePath),
      pcx
    );
  }

  visitTableSource(pcx: parse.TableSourceContext): ast.TableSource {
    const result = this.visit(pcx.exploreTable());
    if (result instanceof TableSource) {
      return result;
    }
    throw this.internalError(
      pcx,
      `Table source matched, but ${result.elementType} found`
    );
  }

  visitSQLSourceName(pcx: parse.SQLSourceNameContext): ast.FromSQLSource {
    const name = this.getModelEntryName(pcx.sqlExploreNameRef());
    const res = this.astAt(new ast.FromSQLSource(name), pcx);
    if (this.m4WarningsEnabled()) {
      this.astError(
        res,
        '`from_sql` is deprecated; use `connection_name.sql(...)` as a source directly',
        'warn'
      );
    }
    return res;
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

  visitQuerySource(pcx: parse.QuerySourceContext): ast.Source {
    const query = this.visit(pcx.query());
    if (ast.isQueryElement(query)) {
      const el = this.astAt(new ast.QuerySource(query), pcx);
      if (this.m4WarningsEnabled()) {
        this.astError(
          el,
          '`from(some_query)` is deprecated; use `some_query` directly',
          'warn'
        );
      }
      return el;
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
        joins.push(join);
        if (join instanceof ast.ExpressionJoin) {
          join.joinType = 'many';
          if (join.joinOn === undefined) {
            join.log('join_many: requires ON expression');
          }
        } else if (join instanceof ast.KeyJoin) {
          join.log('Foreign key join not legal in join_many:');
        }
      }
    }
    const joinMany = new ast.Joins(joins);
    joinMany.extendNote({blockNotes: getNotes(pcx.tags())});
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
    joinOne.extendNote({blockNotes: getNotes(pcx.tags())});
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
    joinCross.extendNote({blockNotes: getNotes(pcx.tags())});
    return joinCross;
  }

  protected getJoinList(pcx: parse.JoinListContext): ast.MalloyElement[] {
    return pcx.joinDef().map(jcx => this.visit(jcx));
  }

  protected getJoinSource(
    name: ast.ModelEntryReference,
    ecx: parse.IsExploreContext | undefined
  ): {joinFrom: ast.Source; notes: string[]} {
    if (ecx) {
      const joinSrc = this.getSource(ecx.explore());
      const notes = getNotes(ecx._before_is).concat(getNotes(ecx._after_is));
      return {joinFrom: joinSrc, notes};
    }
    return {joinFrom: new ast.NamedSource(name), notes: []};
  }

  visitQueryJoinStatement(
    pcx: parse.QueryJoinStatementContext
  ): ast.MalloyElement {
    const result = this.astAt(this.visit(pcx.joinStatement()), pcx);
    if (this.m4WarningsEnabled()) {
      this.astError(
        result,
        'Joins in queries are deprecated, move into an `extend:` block.',
        'warn'
      );
    }
    return result;
  }

  visitJoinOn(pcx: parse.JoinOnContext): ast.Join {
    const joinAs = this.getModelEntryName(pcx.joinNameDef());
    const {joinFrom, notes} = this.getJoinSource(joinAs, pcx.isExplore());
    const join = new ast.ExpressionJoin(joinAs, joinFrom);
    const onCx = pcx.joinExpression();
    if (onCx) {
      join.joinOn = this.getFieldExpr(onCx);
    }
    join.extendNote({notes: getNotes(pcx).concat(notes)});
    return this.astAt(join, pcx);
  }

  visitJoinWith(pcx: parse.JoinWithContext): ast.Join {
    const joinAs = this.getModelEntryName(pcx.joinNameDef());
    const {joinFrom, notes} = this.getJoinSource(joinAs, pcx.isExplore());
    const joinOn = this.getFieldExpr(pcx.fieldExpr());
    const join = new ast.KeyJoin(joinAs, joinFrom, joinOn);
    join.extendNote({notes: getNotes(pcx).concat(notes)});
    return this.astAt(join, pcx);
  }

  getFieldDef(
    pcx: parse.FieldDefContext,
    makeFieldDef: ast.FieldDeclarationConstructor
  ): ast.FieldDeclaration {
    const defCx = pcx.fieldExpr();
    const fieldName = getId(pcx.fieldNameDef());
    const valExpr = this.getFieldExpr(defCx);
    const def = new makeFieldDef(valExpr, fieldName, this.getSourceCode(defCx));
    const notes = getNotes(pcx.tags()).concat(getIsNotes(pcx.isDefine()));
    def.extendNote({notes});
    return this.astAt(def, pcx);
  }

  visitDefDimensions(pcx: parse.DefDimensionsContext): ast.Dimensions {
    const defs = this.getFieldDefs(
      pcx.defList().fieldDef(),
      ast.DimensionFieldDeclaration
    );
    const stmt = new ast.Dimensions(defs);
    stmt.extendNote({blockNotes: getNotes(pcx.tags())});
    return this.astAt(stmt, pcx);
  }

  visitDefMeasures(pcx: parse.DefMeasuresContext): ast.Measures {
    const defs = this.getFieldDefs(
      pcx.defList().fieldDef(),
      ast.MeasureFieldDeclaration
    );
    const stmt = new ast.Measures(defs);
    stmt.extendNote({blockNotes: getNotes(pcx.tags())});
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
    if (this.m4WarningsEnabled()) {
      this.astError(
        result,
        '`declare:` is deprecated; use `dimension:` or `measure:` inside a source or `extend:` block',
        'warn'
      );
    }
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

  visitFilterByShortcut(pcx: parse.FilterByShortcutContext): ast.Filter {
    const el = this.getFilterElement(pcx.fieldExpr());
    const res = this.astAt(new ast.Filter([el]), pcx);
    if (this.m4WarningsEnabled()) {
      this.astError(
        el,
        'Filter shortcut `{? condition }` is deprecated; use `{ where: condition } instead',
        'warn'
      );
    }
    return res;
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
      .map(cx => this.visitExploreQueryDef(cx));
    return new ast.Turtles(babyTurtles);
  }

  visitDefExploreQuery(pcx: parse.DefExploreQueryContext): ast.MalloyElement {
    const queryDefs = this.visitSubQueryDefList(pcx.subQueryDefList());
    const blockNotes = getNotes(pcx.tags());
    queryDefs.extendNote({blockNotes});
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
    const timezone = this.getPlainString(cx);
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

  visitQueryProperties(pcx: parse.QueryPropertiesContext): ast.QOPDesc {
    const qProps = this.only<ast.QueryProperty>(
      pcx.queryStatement().map(qcx => this.astAt(this.visit(qcx), qcx)),
      x => ast.isQueryProperty(x) && x,
      'query statement'
    );
    const fcx = pcx.filterShortcut();
    if (fcx) {
      qProps.push(this.getFilterShortcut(fcx));
    }
    return new ast.QOPDesc(qProps);
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
      return this.getTaggedRef(refCx, makeFieldRef);
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
        x instanceof ast.FieldReference || x instanceof ast.FieldDeclaration
          ? x
          : false,
      'query field'
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
    agStmt.extendNote({blockNotes: getNotes(pcx.tags())});
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
    groupBy.extendNote({blockNotes: getNotes(pcx.tags())});
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
    stmt.extendNote({blockNotes: getNotes(pcx.tags())});
    return stmt;
  }

  getTaggedRef(
    pcx: parse.TaggedRefContext,
    makeFieldRef: ast.FieldReferenceConstructor
  ): ast.FieldReference {
    const ref = this.getFieldPath(pcx.fieldPath(), makeFieldRef);
    ref.extendNote({notes: getNotes(pcx.tags())});
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
      return this.getTaggedRef(refCx, makeFieldRef);
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

  // "FieldCollection" can only mean a project statement today
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
    stmt.extendNote({blockNotes: getNotes(pcx.tags())});
    return stmt;
  }

  visitCollectionWildCard(
    pcx: parse.CollectionWildCardContext
  ): ast.FieldReferenceElement {
    const nameCx = pcx.fieldPath();
    const stars = pcx.STAR() ? '*' : '**';
    const join = nameCx
      ? this.getFieldPath(nameCx, ast.ProjectFieldReference)
      : undefined;
    return new ast.WildcardFieldReference(join, stars);
  }

  visitIndexFields(pcx: parse.IndexFieldsContext): ast.FieldReferences {
    const refList = pcx.indexElement().map(el => {
      const hasStar = el.STAR() !== undefined;
      const pathCx = el.fieldPath();
      if (!pathCx) {
        return new ast.WildcardFieldReference(undefined, '*');
      }
      const path = this.getFieldPath(pathCx, ast.IndexFieldReference);
      if (!hasStar) {
        return this.astAt(path, pcx);
      }
      return this.astAt(new ast.WildcardFieldReference(path, '*'), pcx);
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

  visitLimitStatement(pcx: parse.LimitStatementContext): ast.Limit {
    return new ast.Limit(this.getNumber(pcx.INTEGER_LITERAL()));
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

  visitSourceID(pcx: parse.SourceIDContext): ast.NamedSource {
    return this.astAt(new ast.NamedSource(getId(pcx)), pcx);
  }

  protected buildPipelineFromName(
    pipe: ast.TurtleHeadedPipe,
    pipeCx: parse.PipelineFromNameContext
  ): void {
    const firstCx = pipeCx.firstSegment();
    const nameCx = firstCx.exploreQueryName();
    if (nameCx) {
      pipe.turtleName = this.getFieldName(nameCx);
    }
    const propsCx = firstCx.queryProperties();
    if (propsCx) {
      const queryDesc = this.visitQueryProperties(propsCx);
      pipe.addSegments(queryDesc);
    }
    const rcx = firstCx.queryRefinement();
    if (rcx) {
      const queryDesc = this.getQueryRefinements(rcx);
      pipe.refineWith(queryDesc);
    }
    const tail = this.getSegments(pipeCx.pipeElement());
    pipe.addSegments(...tail);
  }

  visitTopLevelQueryDefs(
    pcx: parse.TopLevelQueryDefsContext
  ): ast.DefineQueryList {
    const stmts = pcx
      .topLevelQueryDef()
      .map(cx => this.visitTopLevelQueryDef(cx));
    const blockNotes = getNotes(pcx.tags());
    const queryDefs = new ast.DefineQueryList(stmts);
    queryDefs.extendNote({blockNotes});
    return queryDefs;
  }

  visitTopLevelQueryDef(pcx: parse.TopLevelQueryDefContext): ast.DefineQuery {
    const queryName = getId(pcx.queryName());
    const queryExpr = this.visit(pcx.query());
    if (ast.isQueryElement(queryExpr)) {
      const notes = getNotes(pcx.tags()).concat(getIsNotes(pcx.isDefine()));
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
    const query = this.visit(defCx.query());
    if (ast.isQueryElement(query)) {
      const theQuery = this.astAt(new ast.AnonymousQuery(query), defCx);
      const notes = getNotes(pcx.topLevelAnonQueryDef().tags());
      const blockNotes = getNotes(pcx.tags());
      theQuery.extendNote({notes, blockNotes});
      if (this.m4WarningsEnabled()) {
        this.astError(
          theQuery,
          'Anonymous `query:` statements are deprecated, use `run:` instead',
          'warn'
        );
      }
      return this.astAt(theQuery, pcx);
    }
    throw this.internalError(
      pcx,
      `Anonymous query matched, but ${query.elementType} found`
    );
  }

  visitRunStatement(pcx: parse.RunStatementContext): ast.RunQuery {
    const query = this.visit(pcx.topLevelAnonQueryDef().query());
    if (ast.isQueryElement(query)) {
      const el = new ast.RunQuery(query);
      el.extendNote({blockNotes: getNotes(pcx._blockTags)});
      el.extendNote({notes: getNotes(pcx._noteTags)});
      return this.astAt(el, pcx);
    }
    throw this.internalError(
      pcx,
      `Run query matched, but ${query.elementType} found`
    );
  }

  visitNestStatement(pcx: parse.NestStatementContext): ast.Nests {
    const nests = this.visitNestedQueryList(pcx.nestedQueryList());
    nests.extendNote({blockNotes: getNotes(pcx.tags())});
    return nests;
  }

  visitNestedQueryList(pcx: parse.NestedQueryListContext): ast.Nests {
    return new ast.Nests(
      this.only<ast.NestedQuery>(
        pcx.nestEntry().map(cx => this.visit(cx)),
        x => ast.isNestedQuery(x) && x,
        'query'
      )
    );
  }

  visitNestExisting(pcx: parse.NestExistingContext): ast.NestedQuery {
    const name = this.getFieldName(pcx.queryName());
    const rcx = pcx.queryRefinement();
    const notes = getNotes(pcx.tags());
    if (rcx) {
      const nestRefine = new ast.NestRefinement(name);
      const queryDesc = this.getQueryRefinements(rcx);
      nestRefine.refineWith(queryDesc);
      nestRefine.extendNote({notes});
      return this.astAt(nestRefine, pcx);
    }
    const nestRef = this.astAt(new ast.NestReference(name), pcx);
    nestRef.extendNote({notes});
    return nestRef;
  }

  visitNestDef(pcx: parse.NestDefContext): ast.NestDefinition {
    const name = getId(pcx.queryName());
    const nestDef = new ast.NestDefinition(name);
    this.buildPipelineFromName(nestDef, pcx.pipelineFromName());
    nestDef.extendNote({
      notes: getNotes(pcx.tags()).concat(getIsNotes(pcx.isDefine())),
    });
    return this.astAt(nestDef, pcx);
  }

  visitExploreQueryDef(pcx: parse.ExploreQueryDefContext): ast.TurtleDecl {
    const name = getId(pcx.exploreQueryNameDef());
    const queryDef = new ast.TurtleDecl(name);
    const notes = getNotes(pcx).concat(getIsNotes(pcx.isDefine()));
    queryDef.extendNote({notes});
    this.buildPipelineFromName(queryDef, pcx.pipelineFromName());
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
    const str = this.getPlainString(pcx);
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

  visitExprCountDisinct(
    pcx: parse.ExprCountDisinctContext
  ): ast.ExprCountDistinct {
    return this.astAt(
      new ast.ExprCountDistinct(this.getFieldExpr(pcx.fieldExpr())),
      pcx
    );
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

  visitExprAggregate(pcx: parse.ExprAggregateContext): ast.ExpressionDef {
    const pathCx = pcx.fieldPath();
    const path = pathCx
      ? this.getFieldPath(pathCx, ast.ExpressionFieldReference)
      : undefined;
    const source = pathCx && path ? this.astAt(path, pathCx) : undefined;

    const exprDef = pcx.fieldExpr();
    if (pcx.aggregate().COUNT()) {
      if (exprDef) {
        this.contextError(exprDef, 'Ignored expression inside COUNT()');
      }
      return new ast.ExprCount(source);
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
        this.contextError(pcx, 'Path not legal for min()');
      } else if (expr) {
        return new ast.ExprMin(expr);
      } else {
        this.contextError(pcx, 'Missing expression for min');
      }
    } else if (pcx.aggregate().MAX()) {
      if (path) {
        this.contextError(pcx, 'Path not legal for max()');
      } else if (expr) {
        return new ast.ExprMax(expr);
      } else {
        this.contextError(pcx, 'Missing expression for max');
      }
    } else if (pcx.aggregate().AVG()) {
      return new ast.ExprAvg(expr, source);
    } else if (pcx.aggregate().SUM()) {
      return new ast.ExprSum(expr, source);
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
    let rawType: ast.CastType | undefined = undefined;
    if (rawRawType) {
      if (ast.isCastType(rawRawType)) {
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

  visitSourceFromNamedModelEntry(
    pcx: parse.SourceFromNamedModelEntryContext
  ): ast.Source {
    const name = this.getModelEntryName(pcx.sourceID());
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
    const source = new ast.NamedSourceOrQuery(name);
    return this.astAt(source, pcx);
  }

  visitExprFilter(pcx: parse.ExprFilterContext): ast.ExprFilter {
    const filters = this.visit(pcx.filteredBy());
    return new ast.ExprFilter(
      this.getFieldExpr(pcx.fieldExpr()),
      filters as ast.Filter
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
    const url = this.getPlainString(pcx.importURL());
    return this.astAt(
      new ast.ImportStatement(url, this.parseInfo.sourceURL),
      pcx
    );
  }

  visitJustExpr(pcx: parse.JustExprContext): ast.ExpressionDef {
    return this.getFieldExpr(pcx.fieldExpr());
  }

  visitDefineSQLStatement(
    pcx: parse.DefineSQLStatementContext
  ): ast.SQLStatement {
    const blockName = pcx.nameSQLBlock()?.text;
    const blockParts = pcx.sqlBlock().blockSQLDef();
    const sqlStr = new ast.SQLString();
    let connectionName: string | undefined;
    for (const blockEnt of blockParts) {
      const nmCx = blockEnt.connectionName();
      if (nmCx) {
        if (connectionName) {
          this.contextError(nmCx, 'Cannot redefine connection');
        } else {
          connectionName = this.getPlainString(nmCx);
        }
      }
      const selCx = blockEnt.sqlString();
      if (selCx) {
        this.makeSqlString(selCx, sqlStr);
      }
    }
    const stmt = new ast.SQLStatement(sqlStr);
    if (connectionName !== undefined) {
      stmt.connection = connectionName;
    }
    stmt.is = blockName;
    const result = this.astAt(stmt, pcx);
    if (this.m4WarningsEnabled()) {
      this.astError(
        result,
        '`sql:` statement is deprecated, use `connection_name.sql(...)` instead',
        'warn'
      );
    }
    return result;
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
    const allNotes = pcx.DOC_ANNOTATION().map(note => note.text);
    const tags = new ast.ModelAnnotation(allNotes);
    this.compilerFlags = tags.getCompilerFlags(this.compilerFlags);
    return tags;
  }

  visitIgnoredObjectAnnotations(
    pcx: parse.IgnoredObjectAnnotationsContext
  ): IgnoredElement {
    return new IgnoredElement(pcx.text);
  }

  visitIgnoredModelAnnotations(
    pcx: parse.IgnoredModelAnnotationsContext
  ): IgnoredElement {
    return new IgnoredElement(pcx.text);
  }

  visitDefExploreAnnotation(
    pcx: parse.DefExploreAnnotationContext
  ): ast.ObjectAnnotation {
    const allNotes = pcx.ANNOTATION().map(note => note.text);
    return new ast.ObjectAnnotation(allNotes);
  }
}
