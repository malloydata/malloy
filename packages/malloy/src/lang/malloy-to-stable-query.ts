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
import * as Malloy from '@malloydata/malloy-interfaces';
import * as parse from './lib/Malloy/MalloyParser';
import {
  BaseMessageLogger,
  LogMessageOptions,
  MessageCode,
  MessageLogger,
  MessageParameterType,
  makeLogMessage,
} from './parse-log';
import {getId} from './parse-utils';
import {DocumentLocation, isTimestampUnit} from '../model/malloy_types';
import {
  getSourceInfo,
  ParseInfo,
  rangeFromContext,
  runMalloyParser,
} from './run-malloy-parser';
import {mapLogs} from '../api/core';

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
    cx: parse.IsDefineContext
  ): Malloy.Annotation[] | undefined {
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
    const annotations = this.getAnnotations(pcx.topLevelAnonQueryDef().tags());
    if (definition !== null) {
      return {
        annotations,
        definition,
      };
    }
    return null;
  }

  protected getQueryReference(cx: parse.SQIDContext): Malloy.Reference | null {
    if (cx.sourceArguments()) {
      this.illegal(cx, 'Queries do not support parameters');
    } else {
      return {
        name: getId(cx),
      };
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
      this.notAllowed(cx, 'Parenthesized query expressions');
    } else if (cx instanceof parse.SQComposeContext) {
      this.notAllowed(cx, 'Source compositions');
    } else if (cx instanceof parse.SQRefinedQueryContext) {
      const seg = this.getRefinementSegment(cx.segExpr());
      if (seg === null) return null;
      const qrefCx = cx.sqExpr();
      if (qrefCx instanceof parse.SQIDContext) {
        const qref = this.getQueryReference(qrefCx);
        if (qref === null) return null;
        return {
          kind: 'refinement',
          query_reference: qref,
          refinement: seg,
        };
      }
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
      const seg = this.getRefinementSegment(cx.segExpr());
      if (seg === null) return null;
      // TODO really I need to allow getting any sqExpr that starts with a query reference,
      // then flip the precedence
      if (qrefCx instanceof parse.SQIDContext) {
        const qref = this.getQueryReference(qrefCx);
        if (qref === null) return null;
        return {
          kind: 'arrow',
          source_reference: qref,
          view: seg,
        };
      }
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
    }
    // TODO other kinds
    return null;
  }

  protected getSegmentOperation(
    cx: parse.QueryStatementContext
  ): Malloy.ViewOperation[] | null {
    if (cx.groupByStatement()) {
      const gbcx = cx.groupByStatement()!;
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
    return null;
  }

  protected getFieldPath(pcx: parse.FieldPathContext): {
    name: string;
    path?: string[];
  } {
    const names = pcx.fieldName().map(nameCx => getId(nameCx));
    const name = names[0];
    const path = names.slice(1);
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
    }
    // TODO other kinds
    return null;
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
