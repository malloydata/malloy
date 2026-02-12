/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ParserRuleContext} from 'antlr4ts';
import type {ParseTree, TerminalNode} from 'antlr4ts/tree';
import {AbstractParseTreeVisitor} from 'antlr4ts/tree/AbstractParseTreeVisitor';
import type {MalloyParserVisitor} from './lib/Malloy/MalloyParserVisitor';
import type * as Malloy from '@malloydata/malloy-interfaces';
import * as parse from './lib/Malloy/MalloyParser';
import type {
  LogMessageOptions,
  MessageCode,
  MessageLogger,
  MessageParameterType,
} from './parse-log';
import {BaseMessageLogger, makeLogMessage} from './parse-log';
import {getId, getPlainString} from './parse-utils';
import type {DocumentLocation} from '../model/malloy_types';
import {isTimestampUnit, isTimeLiteral} from '../model/malloy_types';
import {runMalloyParser} from './run-malloy-parser';
import type {ParseInfo} from './utils';
import {getSourceInfo, rangeFromContext} from './utils';
import {mapLogs} from '../api/util';
import type {TimeLiteral} from './ast';
import {
  LiteralDay,
  LiteralHour,
  LiteralMonth,
  LiteralQuarter,
  LiteralTimestamp,
  LiteralWeek,
  LiteralYear,
} from './ast';

type HasAnnotations = ParserRuleContext & {ANNOTATION: () => TerminalNode[]};

type Node =
  | Malloy.Query
  | Malloy.QueryDefinitionWithArrow
  | Malloy.QueryDefinitionWithQueryReference
  | Malloy.QueryDefinitionWithRefinement
  | null;

const MLQs = 'Malloy query documents';

/**
 * ANTLR visitor pattern parse tree traversal. Generates a Malloy
 * AST from an ANTLR parse tree.
 */
export class MalloyToQuery
  extends AbstractParseTreeVisitor<Node>
  implements MalloyParserVisitor<Node>
{
  constructor(
    readonly parseInfo: ParseInfo,
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
  protected internalError(cx: ParserRuleContext, message: string): Error {
    this.contextError(cx, 'internal-translator-error', {message});
    return new Error(`Internal Translator Error: ${message}`);
  }

  protected getLocation(cx: ParserRuleContext): DocumentLocation {
    return {
      url: this.parseInfo.sourceURL,
      range: rangeFromContext(this.parseInfo.sourceInfo, cx),
    };
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

  protected getNumber(term: ParseTree): number {
    return Number.parseInt(term.text);
  }

  protected defaultResult(): Node {
    return null;
  }

  /**
   * Get all the possibly missing annotations from this parse rule
   * @param cx Any parse context which has an ANNOTATION* rules
   * @returns Array of texts for the annotations
   */
  protected getAnnotations(
    cx: HasAnnotations
  ): Malloy.Annotation[] | undefined {
    const annotations = cx.ANNOTATION().map(a => {
      return {value: a.text};
    });
    return annotations.length > 0 ? annotations : undefined;
  }

  protected getIsAnnotations(
    cx?: parse.IsDefineContext
  ): Malloy.Annotation[] | undefined {
    if (cx === undefined) return undefined;
    const before = this.getAnnotations(cx._beforeIs) ?? [];
    const annotations = before.concat(this.getAnnotations(cx._afterIs) ?? []);
    return annotations.length > 0 ? annotations : undefined;
  }

  protected notAllowed(pcx: ParserRuleContext, what: string) {
    this.illegal(pcx, `${what} are not allowed in ${MLQs}`);
  }

  protected illegal(pcx: ParserRuleContext, what: string) {
    this.contextError(pcx, 'invalid-malloy-query-document', what);
  }

  visitMalloyDocument(pcx: parse.MalloyDocumentContext): Malloy.Query | null {
    const statements = pcx.malloyStatement();
    let runStatement: parse.RunStatementContext | undefined = undefined;
    for (const statement of statements) {
      if (statement.defineSourceStatement()) {
        this.notAllowed(statement, 'Source definitions');
      } else if (statement.defineQuery()) {
        this.notAllowed(statement, 'Query definitions');
      } else if (statement.importStatement()) {
        this.notAllowed(statement, 'Import statements');
      } else if (statement.docAnnotations()) {
        this.notAllowed(statement, 'Model annotations');
      } else if (statement.ignoredObjectAnnotations()) {
        this.notAllowed(statement, 'Detatched object annotations');
      } else if (statement.experimentalStatementForTesting()) {
        this.notAllowed(statement, 'Experimental testing statements');
      } else {
        if (runStatement === undefined) {
          runStatement = statement.runStatement();
        } else {
          this.illegal(statement, `${MLQs} may only have one run statement`);
        }
      }
    }
    if (runStatement === undefined) {
      this.illegal(pcx, `${MLQs} must have a run statement`);
      return null;
    }
    return this.visitRunStatement(runStatement);
  }

  visitRunStatement(pcx: parse.RunStatementContext): Malloy.Query | null {
    const defCx = pcx.topLevelAnonQueryDef();
    const definition = this.getQueryDefinition(defCx.sqExpr());
    const runAnnotations = this.getAnnotations(pcx.tags());
    const defAnnotations = this.getAnnotations(
      pcx.topLevelAnonQueryDef().tags()
    );
    const annotations = this.combineAnnotations(runAnnotations, defAnnotations);
    if (definition !== null) {
      return {
        annotations,
        definition,
      };
    }
    return null;
  }

  protected getSourceArguments(
    cx: parse.SourceArgumentsContext
  ): Malloy.ParameterValue[] | null {
    const params: Malloy.ParameterValue[] = [];
    for (const argCx of cx.sourceArgument()) {
      const idCx = argCx.argumentId();
      if (idCx === undefined) {
        this.contextError(
          argCx,
          'unnamed-source-argument',
          'Source argument must be named'
        );
        return null;
      }
      const name = getId(idCx);
      const value = this.getLiteralIncludingNegativeNumber(argCx.fieldExpr());
      if (value === null) return null;
      params.push({name, value});
    }
    return params;
  }

  protected getQueryReference(cx: parse.SQIDContext): Malloy.Reference | null {
    const argsCx = cx.sourceArguments();
    const name = getId(cx);
    if (argsCx) {
      const parameters = this.getSourceArguments(argsCx);
      if (parameters === null) return null;
      return {name, parameters};
    } else {
      return {name};
    }
    return null;
  }

  protected getQueryDefinition(
    cx: parse.SqExprContext
  ): Malloy.QueryDefinition | null {
    if (cx instanceof parse.SQIDContext) {
      const ref = this.getQueryReference(cx);
      if (ref !== null) {
        return {
          kind: 'query_reference',
          ...ref,
        };
      }
    } else if (cx instanceof parse.SQParensContext) {
      return this.getQueryDefinition(cx.sqExpr());
    } else if (cx instanceof parse.SQComposeContext) {
      this.notAllowed(cx, 'Source compositions');
    } else if (cx instanceof parse.SQRefinedQueryContext) {
      const qrefCx = cx.sqExpr();
      const base = this.getQueryDefinition(qrefCx);
      const seg = this.getRefinementSegment(cx.segExpr());
      if (seg === null || base === null) return null;
      if (seg.kind === 'arrow') {
        this.notAllowed(cx, 'Queries against refined queries');
      }
      return {
        kind: 'refinement',
        base: base,
        refinement: seg,
      };
    } else if (cx instanceof parse.SQExtendedSourceContext) {
      this.notAllowed(cx, 'Source extensions');
    } else if (cx instanceof parse.SQIncludeContext) {
      this.notAllowed(cx, 'Source inclusions');
    } else if (cx instanceof parse.SQTableContext) {
      this.notAllowed(cx, 'Table statements');
    } else if (cx instanceof parse.SQSQLContext) {
      this.notAllowed(cx, 'SQL statements');
    } else if (cx instanceof parse.SQArrowContext) {
      const qrefCx = cx.sqExpr();
      const base = this.getQueryDefinition(qrefCx);
      const seg = this.getRefinementSegment(cx.segExpr());
      if (seg === null || base === null) return null;
      if (base.kind === 'query_reference') {
        return {
          kind: 'arrow',
          source: {
            ...base,
            kind: 'source_reference',
          },
          view: seg,
        };
      }
      if (base.kind === 'arrow') {
        return {
          kind: 'arrow',
          source: base.source,
          view: {
            kind: 'arrow',
            source: base.view,
            view: seg,
          },
        };
      }
      return {
        kind: 'arrow',
        source: base,
        view: seg,
      };
    }
    return null;
  }

  protected getRefinementSegment(
    cx: parse.SegExprContext
  ): Malloy.ViewDefinition | null {
    if (cx instanceof parse.SegOpsContext) {
      const operations = cx
        .queryProperties()
        .queryStatement()
        .flatMap(stmt => this.getSegmentOperation(stmt));
      if (operations.some(o => o === null)) {
        return null;
      }
      return {
        kind: 'segment',
        operations: operations as Malloy.ViewOperation[],
      };
    } else if (cx instanceof parse.SegFieldContext) {
      const {name, path} = this.getFieldPath(cx.fieldPath());
      return {
        kind: 'view_reference',
        name,
        path,
      };
    } else if (cx instanceof parse.SegParenContext) {
      return this.getViewExpression(cx.vExpr());
    } else if (cx instanceof parse.SegRefineContext) {
      const l = this.getRefinementSegment(cx._lhs);
      const r = this.getRefinementSegment(cx._rhs);
      if (l === null || r === null) return null;
      return {
        kind: 'refinement',
        base: l,
        refinement: r,
      };
    }
    return null;
  }

  protected getGroupByStatement(gbcx: parse.GroupByStatementContext) {
    const groupAnnotations = this.getAnnotations(gbcx.tags());
    const fieldCxs = gbcx.queryFieldList().queryFieldEntry();
    const fields = fieldCxs.map(f => this.getQueryField(f));
    if (fields.some(o => o === null)) {
      return null;
    }
    if (fields === null) return null;
    return (fields as {name?: string; field: Malloy.Field}[]).map(f => {
      const annotations = [
        ...(groupAnnotations ?? []),
        ...(f.field.annotations ?? []),
      ];
      const gb: Malloy.ViewOperationWithGroupBy = {
        kind: 'group_by',
        name: f.name,
        field: {
          ...f.field,
          annotations: annotations.length > 0 ? annotations : undefined,
        },
      };
      return gb;
    });
  }

  protected getAggregateStatement(agcx: parse.AggregateStatementContext) {
    const groupAnnotations = this.getAnnotations(agcx.tags());
    const fieldCxs = agcx.queryFieldList().queryFieldEntry();
    const fields = fieldCxs.map(f => this.getQueryField(f));
    if (fields.some(o => o === null)) {
      return null;
    }
    if (fields === null) return null;
    return (fields as {name?: string; field: Malloy.Field}[]).map(f => {
      const annotations = [
        ...(groupAnnotations ?? []),
        ...(f.field.annotations ?? []),
      ];
      const gb: Malloy.ViewOperationWithAggregate = {
        kind: 'aggregate',
        name: f.name,
        field: {
          ...f.field,
          annotations: annotations.length > 0 ? annotations : undefined,
        },
      };
      return gb;
    });
  }

  protected getOrderByStatement(
    obcx: parse.OrderByStatementContext
  ): Malloy.ViewOperationWithOrderBy[] | null {
    const specs = obcx.ordering().orderBySpec();
    const orders: Malloy.ViewOperationWithOrderBy[] = [];
    for (const spec of specs) {
      if (spec.INTEGER_LITERAL()) {
        this.notAllowed(spec, 'Indexed order by statements');
      } else if (spec.fieldPath()) {
        const names = spec.fieldPath()!.fieldName();
        const fieldName = getId(names[names.length - 1]);
        const direction = spec.ASC() ? 'asc' : spec.DESC() ? 'desc' : undefined;
        orders.push({
          kind: 'order_by',
          direction,
          field_reference: {name: fieldName},
        });
      } else {
        return null;
      }
    }
    return orders;
  }

  protected getNestStatement(
    nstcx: parse.NestStatementContext
  ): Malloy.ViewOperationWithNest[] | null {
    const groupAnnotations = this.getAnnotations(nstcx.tags());
    const querylist = nstcx.nestedQueryList().nestEntry();
    const nests: Malloy.ViewOperationWithNest[] = [];
    for (const query of querylist) {
      if (!(query instanceof parse.NestDefContext)) {
        this.internalError(query, 'Expected nestDef');
        return null;
      }
      const annotations1 = this.getAnnotations(query.tags());
      const annotations2 = this.getIsAnnotations(query.isDefine());
      const nameCx = query.queryName();
      const name = nameCx ? getId(nameCx) : undefined;
      const view = this.getViewExpression(query.vExpr());
      if (view === null) {
        return null;
      }
      nests.push({
        kind: 'nest',
        name,
        view: {
          definition: view,
          annotations: this.combineAnnotations(
            groupAnnotations,
            annotations1,
            annotations2
          ),
        },
      });
    }
    return nests;
  }

  protected getViewExpression(
    cx: parse.VExprContext
  ): Malloy.ViewDefinition | null {
    if (cx instanceof parse.VSegContext) {
      return this.getRefinementSegment(cx.segExpr());
    } else if (cx instanceof parse.VArrowContext) {
      const l = this.getRefinementSegment(cx);
      const r = this.getViewExpression(cx._rhs);
      if (l === null) return null;
      if (r === null) return null;
      return {
        kind: 'arrow',
        source: l,
        view: r,
      };
    } else {
      this.internalError(cx, 'Unexpected VExpr node');
      return null;
    }
  }

  protected getLimitStatement(
    cx: parse.LimitStatementContext
  ): Malloy.ViewOperationWithLimit | null {
    const limit = this.getNumber(cx.INTEGER_LITERAL());
    return {
      kind: 'limit',
      limit,
    };
  }

  protected getSegmentOperation(
    cx: parse.QueryStatementContext
  ): Malloy.ViewOperation[] | null {
    if (cx.groupByStatement()) {
      const gbcx = cx.groupByStatement()!;
      return this.getGroupByStatement(gbcx);
    } else if (cx.aggregateStatement()) {
      const agcx = cx.aggregateStatement()!;
      return this.getAggregateStatement(agcx);
    } else if (cx.limitStatement()) {
      const limcx = cx.limitStatement()!;
      const limit = this.getLimitStatement(limcx);
      if (limit === null) return null;
      return [limit];
    } else if (cx.declareStatement()) {
      this.notAllowed(cx, 'Declare statements');
    } else if (cx.queryJoinStatement()) {
      this.notAllowed(cx, 'Query join statements');
    } else if (cx.queryExtend()) {
      this.notAllowed(cx, 'Query extend statements');
    } else if (cx.projectStatement()) {
      this.notAllowed(cx, 'Select statements');
    } else if (cx.indexStatement()) {
      this.notAllowed(cx, 'Index statements');
    } else if (cx.calculateStatement()) {
      this.notAllowed(cx, 'Calculate statements');
    } else if (cx.topStatement()) {
      this.notAllowed(cx, 'Top statements');
    } else if (cx.orderByStatement()) {
      const obcx = cx.orderByStatement()!;
      return this.getOrderByStatement(obcx);
    } else if (cx.whereStatement()) {
      const whcx = cx.whereStatement()!;
      const where = this.getWhere(whcx);
      if (where === null) return null;
      return where.map(w => ({
        kind: 'where',
        ...w,
      }));
    } else if (cx.drillStatement()) {
      const whcx = cx.drillStatement()!;
      const drill = this.getDrill(whcx);
      if (drill === null) return null;
      return drill.map(w => ({
        kind: 'drill',
        ...w,
      }));
    } else if (cx.havingStatement()) {
      const hvcx = cx.havingStatement()!;
      const having = this.getHaving(hvcx);
      if (having === null) return null;
      return having.map(h => ({
        kind: 'having',
        ...h,
      }));
    } else if (cx.nestStatement()) {
      const obcx = cx.nestStatement()!;
      return this.getNestStatement(obcx);
    } else if (cx.sampleStatement()) {
      this.notAllowed(cx, 'Sample statements');
    } else if (cx.timezoneStatement()) {
      this.notAllowed(cx, 'Timezone statements');
    } else if (cx.queryAnnotation() || cx.ignoredModelAnnotations()) {
      this.notAllowed(cx, 'Detached annotation statements');
    }
    return null;
  }

  protected getFieldPath(pcx: parse.FieldPathContext): {
    name: string;
    path?: string[];
  } {
    const names = pcx.fieldName().map(nameCx => getId(nameCx));
    const name = names[names.length - 1];
    const path = names.slice(0, -1);
    return {name, path: path.length > 0 ? path : undefined};
  }

  protected getTimeframe(
    cx: parse.TimeframeContext
  ): Malloy.TimestampTimeframe | null {
    const text = cx.text;
    if (isTimestampUnit(text)) {
      return text;
    }
    this.illegal(cx, `Invalid timeframe ${text}`);
    return null;
  }

  protected getQueryField(
    cx: parse.QueryFieldEntryContext
  ): {name?: string; field: Malloy.Field} | null {
    if (cx.taggedRef()) {
      const trcx = cx.taggedRef()!;
      const annotations = this.getAnnotations(trcx.tags());
      const {name, path} = this.getFieldPath(trcx.fieldPath());
      if (trcx.refExpr()) {
        const refexpr = trcx.refExpr()!;
        if (refexpr.timeframe()) {
          const tf = this.getTimeframe(refexpr.timeframe()!);
          if (tf === null) return null;
          return {
            name: undefined,
            field: {
              annotations,
              expression: {
                kind: 'time_truncation',
                field_reference: {
                  name,
                  path,
                },
                truncation: tf,
              },
            },
          };
        } else if (refexpr.aggregate()) {
          this.notAllowed(refexpr, 'Aggregate expressions');
        }
      } else {
        return {
          name: undefined,
          field: {
            annotations,
            expression: {
              kind: 'field_reference',
              name,
              path,
            },
          },
        };
      }
    } else if (cx.fieldDef()) {
      const defCx = cx.fieldDef()!;
      const annotations1 = this.getAnnotations(defCx.tags());
      const annotations2 = this.getIsAnnotations(defCx.isDefine());
      const name = getId(defCx.fieldNameDef());
      const expression = this.getFieldExpression(defCx.fieldExpr());
      if (expression === null) {
        return null;
      }
      return {
        name,
        field: {
          expression,
          annotations: this.combineAnnotations(annotations1, annotations2),
        },
      };
    }
    return null;
  }

  getFieldExpression(cx: parse.FieldExprContext): Malloy.Expression | null {
    if (cx instanceof parse.ExprFieldPathContext) {
      const {name, path} = this.getFieldPath(cx.fieldPath());
      return {
        kind: 'field_reference',
        name,
        path,
      };
    } else if (cx instanceof parse.ExprTimeTruncContext) {
      const timeframe = this.getTimeframe(cx.timeframe());
      const exprCx = cx.fieldExpr();
      const expr = this.getFieldExpression(exprCx);
      if (expr === null) {
        return null;
      }
      if (timeframe === null) {
        return null;
      }
      if (expr.kind !== 'field_reference') {
        this.illegal(
          exprCx,
          'Left hand side of time truncation must be a field reference'
        );
        return null;
      }
      return {
        kind: 'time_truncation',
        truncation: timeframe,
        field_reference: {
          name: expr.name,
          path: expr.path,
          parameters: expr.parameters,
        },
      };
    } else if (cx instanceof parse.ExprFieldPropsContext) {
      const exprCx = cx.fieldExpr();
      const expr = this.getFieldExpression(exprCx);
      if (expr === null) {
        return null;
      }
      if (expr.kind !== 'field_reference') {
        this.illegal(
          exprCx,
          'Left hand side of filtered field must be a field reference'
        );
        return null;
      }
      const props = cx.fieldProperties().fieldPropertyStatement();
      const where: Malloy.FilterOperation[] = [];
      for (const prop of props) {
        const whereCx = prop.whereStatement();
        if (whereCx) {
          const it = this.getWhere(whereCx);
          if (it === null) return null;
          where.push(...it);
        }
      }
      return {
        kind: 'filtered_field',
        field_reference: {
          name: expr.name,
          path: expr.path,
          parameters: expr.parameters,
        },
        where,
      };
    } else {
      const literal = this.getLiteralIncludingNegativeNumber(cx);
      if (literal === null) return null;
      return {
        kind: 'literal_value',
        literal_value: literal,
      };
    }
    return null;
  }

  stripQuote(s: string, q: string): string {
    return s.slice(s.indexOf(q) + q.length, s.lastIndexOf(q));
  }

  getFilterString(cx: parse.FilterStringContext): string | null {
    const trip = cx.tripFilterString();
    const tick = cx.tickFilterString();
    if (trip) {
      const bq3 = trip.BQ3_FILTER();
      const dq3 = trip.DQ3_FILTER();
      const sq3 = trip.SQ3_FILTER();
      if (bq3) {
        return this.stripQuote(bq3.text, '```');
      } else if (dq3) {
        return this.stripQuote(dq3.text, '"""');
      } else if (sq3) {
        return this.stripQuote(sq3.text, "'''");
      }
    } else if (tick) {
      const bq = tick.BQ_FILTER();
      const dq = tick.DQ_FILTER();
      const sq = tick.SQ_FILTER();
      if (bq) {
        return this.stripQuote(bq.text, '`');
      } else if (dq) {
        return this.stripQuote(dq.text, '"');
      } else if (sq) {
        return this.stripQuote(sq.text, "'");
      }
    }
    return null;
  }

  getFilterExpr(cx: parse.FieldExprContext): Malloy.FilterOperation | null {
    if (cx instanceof parse.ExprCompareContext) {
      if (cx.compareOp().MATCH()) {
        const lhs = cx.fieldExpr()[0];
        const rhs = cx.fieldExpr()[1];
        if (
          lhs instanceof parse.ExprFieldPathContext &&
          rhs instanceof parse.ExprLiteralContext
        ) {
          const {path, name} = this.getFieldPath(lhs.fieldPath());
          const literal = rhs.literal();
          if (literal instanceof parse.FilterString_stubContext) {
            const stringFilter = this.getFilterString(literal.filterString());
            if (stringFilter === null) return null;
            return {
              filter: {
                kind: 'filter_string',
                expression: {
                  kind: 'field_reference',
                  name,
                  path,
                },
                filter: stringFilter,
              },
            };
          }
        }
      } else if (cx.compareOp().EQ()) {
        const lhs = cx.fieldExpr()[0];
        const rhs = cx.fieldExpr()[1];
        if (lhs instanceof parse.ExprFieldPathContext) {
          const {path, name} = this.getFieldPath(lhs.fieldPath());
          const literal = this.getLiteralIncludingNegativeNumber(rhs);
          if (literal === null) {
            this.notAllowed(
              cx,
              'Filters other than comparisons with filter strings or equality with literals'
            );
            return null;
          }
          return {
            filter: {
              kind: 'literal_equality',
              expression: {
                kind: 'field_reference',
                name,
                path,
              },
              value: literal,
            },
          };
        }
      }
    }
    this.notAllowed(
      cx,
      'Filters other than comparisons with filter strings or equality with literals'
    );
    return null;
  }

  getTimeLiteral(
    literalCx: parse.LiteralContext,
    parse: (text: string) => TimeLiteral | undefined
  ):
    | Malloy.LiteralValueWithDateLiteral
    | Malloy.LiteralValueWithTimestampLiteral
    | null {
    const def = parse(literalCx.text);
    if (!def) {
      this.contextError(
        literalCx,
        'failed-to-parse-time-literal',
        'Time data parse error'
      );
      return null;
    }
    const value = def.getValue();
    const granularity = value.timeframe;
    const node = value.value;
    if (!isTimeLiteral(node)) {
      return null;
    }

    if (node.node === 'dateLiteral') {
      if (
        granularity === 'hour' ||
        granularity === 'minute' ||
        granularity === 'second'
      )
        return null;
      return {
        kind: 'date_literal',
        date_value: node.literal,
        granularity,
      };
    } else {
      // timestampLiteral or timestamptzLiteral
      return {
        kind: 'timestamp_literal',
        timestamp_value: node.literal,
        granularity,
        timezone: node.timezone,
      };
    }
  }

  getLiteralIncludingNegativeNumber(
    cx: parse.FieldExprContext
  ): Malloy.LiteralValue | null {
    if (cx instanceof parse.ExprLiteralContext) {
      return this.getLiteral(cx.literal());
    } else if (cx instanceof parse.ExprMinusContext) {
      const value = cx.fieldExpr();
      if (value instanceof parse.ExprLiteralContext) {
        const literal = this.getLiteral(value.literal());
        if (literal === null) return null;
        if (literal.kind !== 'number_literal') {
          return null;
        }
        return {
          kind: 'number_literal',
          number_value: -literal.number_value,
        };
      }
    }
    return null;
  }

  getLiteral(literalCx: parse.LiteralContext): Malloy.LiteralValue | null {
    if (literalCx instanceof parse.ExprTimeContext) {
      const dateCx = literalCx.dateLiteral();
      if (dateCx instanceof parse.LiteralTimestampContext) {
        return this.getTimeLiteral(dateCx, LiteralTimestamp.parse);
      } else if (dateCx instanceof parse.LiteralHourContext) {
        return this.getTimeLiteral(dateCx, LiteralHour.parse);
      } else if (dateCx instanceof parse.LiteralDayContext) {
        return this.getTimeLiteral(dateCx, LiteralDay.parse);
      } else if (dateCx instanceof parse.LiteralWeekContext) {
        return this.getTimeLiteral(dateCx, LiteralWeek.parse);
      } else if (dateCx instanceof parse.LiteralMonthContext) {
        return this.getTimeLiteral(dateCx, LiteralMonth.parse);
      } else if (dateCx instanceof parse.LiteralQuarterContext) {
        return this.getTimeLiteral(dateCx, LiteralQuarter.parse);
      } else if (dateCx instanceof parse.LiteralYearContext) {
        return this.getTimeLiteral(dateCx, LiteralYear.parse);
      }
      return null;
    } else if (literalCx instanceof parse.ExprArrayLiteralContext) {
      this.notAllowed(literalCx, 'array literals');
      return null;
    } else if (literalCx instanceof parse.ExprLiteralRecordContext) {
      this.notAllowed(literalCx, 'record literals');
      return null;
    } else if (literalCx instanceof parse.ExprStringContext) {
      const [result, errors] = getPlainString(literalCx);
      for (const error of errors) {
        if (error instanceof ParserRuleContext) {
          this.contextError(
            error,
            'illegal-query-interpolation-outside-sql-block',
            '%{ query } illegal in this string'
          );
        }
      }
      return {kind: 'string_literal', string_value: result ?? ''};
    } else if (literalCx instanceof parse.ExprBoolContext) {
      return {
        kind: 'boolean_literal',
        boolean_value: literalCx.TRUE() !== null,
      };
    } else if (literalCx instanceof parse.ExprNumberContext) {
      const n = Number(literalCx.text);
      return {kind: 'number_literal', number_value: n};
    } else if (literalCx instanceof parse.ExprNULLContext) {
      return {kind: 'null_literal'};
    } else if (literalCx instanceof parse.FilterString_stubContext) {
      const filterContext = literalCx.getChild(0);
      if (filterContext instanceof parse.FilterStringContext) {
        const filterString = this.getFilterString(filterContext);
        if (filterString) {
          return {
            kind: 'filter_expression_literal',
            filter_expression_value: filterString,
          };
        }
      }
    }
    return null;
  }

  getDrill(
    drillCx: parse.DrillStatementContext
  ): Malloy.DrillOperation[] | null {
    const exprs = drillCx.drillClauseList().fieldExpr();
    const where = exprs.map(exprCx => this.getFilterExpr(exprCx));
    if (where.some(w => w === null)) {
      return null;
    }
    return where as Malloy.DrillOperation[];
  }

  getWhere(
    whereCx: parse.WhereStatementContext
  ): Malloy.FilterOperation[] | null {
    const exprs = whereCx.filterClauseList().fieldExpr();
    const where = exprs.map(exprCx => this.getFilterExpr(exprCx));
    if (where.some(w => w === null)) {
      return null;
    }
    return where as Malloy.FilterOperation[];
  }

  getHaving(
    havingCx: parse.HavingStatementContext
  ): Malloy.FilterOperation[] | null {
    const exprs = havingCx.filterClauseList().fieldExpr();
    const having = exprs.map(exprCx => this.getFilterExpr(exprCx));
    if (having.some(h => h === null)) {
      return null;
    }
    return having as Malloy.FilterOperation[];
  }

  protected combineAnnotations(
    ...a: (Malloy.Annotation[] | undefined)[]
  ): Malloy.Annotation[] | undefined {
    const annotations = a.flatMap(a => a ?? []);
    return annotations.length > 0 ? annotations : undefined;
  }
}

export function malloyToQuery(code: string): {
  query?: Malloy.Query;
  logs: Malloy.LogMessage[];
} {
  const sourceInfo = getSourceInfo(code);
  const logger = new BaseMessageLogger(null);
  const url = 'internal://query.malloy';
  const parse = runMalloyParser(code, url, sourceInfo, logger);
  const secondPass = new MalloyToQuery(parse, logger);
  const query = secondPass.visit(parse.root);
  const logs = mapLogs(logger.getLog(), url);
  if (query === null) {
    return {logs};
  }
  if (!('definition' in query)) {
    throw new Error('Expected a query');
  }
  return {
    query: query as Malloy.Query,
    logs,
  };
}
