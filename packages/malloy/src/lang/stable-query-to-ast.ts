/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import * as AST from './ast';
import type {Noteable} from './ast/types/noteable';
import {Tag} from '@malloydata/malloy-tag';
import {Timer} from '../timing';
import {
  makeLogMessage,
  type LogMessageOptions,
  type MessageCode,
  type MessageLogger,
  type MessageParameterType,
} from './parse-log';
import type {DocumentLocation} from '../model';

export class StableQueryToAST {
  constructor(
    private readonly query: Malloy.Query,
    readonly importBaseURL: string,
    readonly msgLog: MessageLogger,
    public compilerFlags: Tag
  ) {}

  public run(): {
    ast: AST.MalloyElement;
    compilerFlags: Tag;
    timingInfo: Malloy.TimingInfo;
  } {
    const generateASTTimer = new Timer('generate_ast');
    const ast = this.stableQueryToAST(this.query);
    // TODO add parameter compiler flag if necessary
    const compilerFlags = new Tag();
    return {
      ast,
      compilerFlags,
      timingInfo: generateASTTimer.stop(),
    };
  }

  // TODO it would be nice to attach actual locations to each element
  private get defaultAt(): DocumentLocation {
    return {
      range: {
        start: {
          line: 0,
          character: 0,
        },
        end: {
          line: 0,
          character: 0,
        },
      },
      url: this.importBaseURL,
    };
  }

  /**
   * Log an error message relative to an AST node
   */
  protected astError<T extends MessageCode>(
    code: T,
    data: MessageParameterType<T>,
    options?: LogMessageOptions
  ): void {
    this.msgLog.log(
      makeLogMessage(code, data, {at: this.defaultAt, ...options})
    );
  }

  private stableQueryToAST(query: Malloy.Query): AST.Document {
    const queryStatement = this.addAnnotations(
      new AST.AnonymousQuery(
        this.queryDefinitionToASTSourceQueryElement(query.definition)
      ),
      query.annotations
    );
    const document = new AST.Document([queryStatement]);
    document.location = this.defaultAt;
    return document;
  }

  private queryDefinitionToASTSourceQueryElement(
    query: Malloy.QueryDefinition
  ): AST.SourceQueryElement {
    switch (query.kind) {
      case 'arrow':
        return new AST.SQArrow(
          this.queryArrowSourceToASTSourceQueryElement(query.source),
          this.viewDefinitionToASTView(query.view)
        );
      case 'query_reference':
        return this.referenceToASTSQReference(query);
      case 'refinement':
        return new AST.SQRefine(
          this.queryDefinitionToASTSourceQueryElement(query.base),
          this.viewDefinitionToASTView(query.refinement)
        );
    }
  }

  private queryArrowSourceToASTSourceQueryElement(
    source: Malloy.QueryArrowSource
  ): AST.SourceQueryElement {
    switch (source.kind) {
      case 'refinement':
        return new AST.SQRefine(
          this.queryDefinitionToASTSourceQueryElement(source.base),
          this.viewDefinitionToASTView(source.refinement)
        );
      case 'source_reference':
        return this.referenceToASTSQReference(source);
    }
  }

  private referenceToASTSQReference(
    reference: Malloy.Reference
  ): AST.SQReference {
    const args = reference.parameters?.map(p => this.parameterToASTArgument(p));
    const modelEntRef = new AST.ModelEntryReference(reference.name);
    return new AST.SQReference(modelEntRef, args);
  }

  private parameterToASTArgument(
    parameter: Malloy.ParameterValue
  ): AST.Argument {
    return new AST.Argument({
      id: new AST.ParameterFieldReference([new AST.FieldName(parameter.name)]),
      value: this.literalValueToASTExpression(parameter.value),
    });
  }

  private literalValueToASTExpression(
    value: Malloy.LiteralValue
  ): AST.ExpressionDef {
    switch (value.kind) {
      case 'boolean_literal':
        return new AST.Boolean(value.boolean_value ? 'true' : 'false');
      case 'date_literal': {
        const value_with_timezone =
          value.date_value + (value.timezone ? `[${value.timezone}]` : '');
        // TODO log error if there is one
        const {result} = AST.TimeLiteral.parseTime(
          value_with_timezone,
          value.granularity
        );
        return result;
      }
      case 'timestamp_literal': {
        const value_with_timezone =
          value.timestamp_value + (value.timezone ? `[${value.timezone}]` : '');
        // TODO log error if there is one
        const {result} = AST.TimeLiteral.parseTime(
          value_with_timezone,
          value.granularity
        );
        return result;
      }
      case 'filter_expression_literal':
        return this.makeFilterExpressionLiteral(value);
      case 'null_literal':
        return new AST.ExprNULL();
      case 'number_literal':
        return this.makeLiteralNumber(value.number_value);
      case 'string_literal':
        return new AST.ExprString(value.string_value);
    }
  }

  private makeLiteralNumber(value: number) {
    return new AST.ExprNumber(value.toString());
  }

  private makeFilterExpressionLiteral(
    value: Malloy.FilterExpressionLiteral
  ): AST.ExpressionDef {
    return new AST.ExprFilterExpression(value.filter_expression_value);
  }

  private viewDefinitionToASTView(view: Malloy.ViewDefinition): AST.View {
    switch (view.kind) {
      case 'arrow':
        return new AST.ViewArrow(
          this.viewDefinitionToASTView(view.source),
          this.viewDefinitionToASTView(view.view)
        );
      case 'refinement':
        return new AST.ViewRefine(
          this.viewDefinitionToASTView(view.base),
          this.viewDefinitionToASTView(view.refinement)
        );
      case 'segment': {
        const astOperations: AST.QueryProperty[] = [];
        for (let i = 0; i < view.operations.length; i++) {
          const operation = view.operations[i];
          const likeOperations = [operation];
          while (i < view.operations.length - 1) {
            const nextOperation = view.operations[i + 1];
            if (nextOperation.kind === operation.kind) {
              likeOperations.push(nextOperation);
              i++;
            } else {
              break;
            }
          }
          astOperations.push(
            ...this.likeOperationsToASTQueryProperty(likeOperations)
          );
        }
        return new AST.QOpDescView(new AST.QOpDesc(astOperations));
      }
      case 'view_reference':
        return new AST.ReferenceView(
          this.makeReference(view, AST.ViewOrScalarFieldReference)
        );
    }
  }

  private likeOperationsToASTQueryProperty(operations: Malloy.ViewOperation[]) {
    switch (operations[0].kind) {
      case 'order_by':
        return [
          this.orderByOperationsToASTQueryProperty(
            operations as Malloy.OrderBy[]
          ),
        ];
      default:
        return operations.map(op =>
          this.segmentOperationToASTQueryProperty(op)
        );
    }
  }

  private segmentOperationToASTQueryProperty(operation: Malloy.ViewOperation) {
    switch (operation.kind) {
      case 'aggregate':
        return new AST.Aggregate([
          this.makeQueryItem(
            operation,
            AST.AggregateFieldDeclaration,
            AST.AggregateFieldReference
          ),
        ]);
      case 'calculate':
        return new AST.Calculate([
          this.makeQueryItem(
            operation,
            AST.CalculateFieldDeclaration,
            AST.CalculateFieldReference
          ),
        ]);
      case 'group_by':
        return new AST.GroupBy([
          this.makeQueryItem(
            operation,
            AST.GroupByFieldDeclaration,
            AST.GroupByFieldReference
          ),
        ]);
      case 'drill':
        return new AST.Drill([this.filterToASTFilterElement(operation.filter)]);
      case 'having':
      case 'where': {
        const filter = new AST.Filter([
          this.filterToASTFilterElement(operation.filter),
        ]);
        if (operation.kind === 'having') {
          // TODO I've always hated this; make AST.Having separate...
          filter.having = true;
        }
        return filter;
      }
      case 'limit':
        return new AST.Limit(operation.limit);
      case 'nest': {
        const view = this.viewDefinitionToASTView(operation.view.definition);
        const name = operation.name ?? view.getImplicitName();
        if (name === undefined) {
          this.astError('anonymous-nest', 'This nest must have a name');
        }
        return this.addAnnotations(
          new AST.NestFieldDeclaration(name ?? '__nameless__', view),
          operation.view.annotations
        );
      }
      case 'order_by': {
        return this.orderByOperationsToASTQueryProperty([operation]);
      }
    }
  }

  private orderByOperationsToASTQueryProperty(operations: Malloy.OrderBy[]) {
    const orderBys = operations.map(operation => {
      if (
        operation.field_reference.path &&
        operation.field_reference.path.length > 0
      ) {
        this.astError(
          'invalid-order-by',
          'Order by field references must not have a path'
        );
      }
      return new AST.OrderBy(
        new AST.FieldName(operation.field_reference.name),
        operation.direction
      );
    });

    return new AST.Ordering(orderBys);
  }

  private makeQueryItem(
    operation:
      | Malloy.ViewOperationWithAggregate
      | Malloy.ViewOperationWithCalculate
      | Malloy.ViewOperationWithGroupBy,
    makeFieldDef: AST.FieldDeclarationConstructor,
    makeFieldRef: AST.FieldReferenceConstructor
  ): AST.QueryItem {
    if (
      operation.name === undefined &&
      operation.field.expression.kind === 'field_reference'
    ) {
      return this.addAnnotations(
        this.makeReference(operation.field.expression, makeFieldRef),
        operation.field.annotations
      );
    }
    const expression = this.makeExpression(operation.field.expression);
    const name = operation.name ?? expression.defaultFieldName();
    if (name === undefined) {
      this.astError('anonymous-query-field', 'Query field is missing a name');
    }
    return this.addAnnotations(
      new makeFieldDef(expression, name ?? '__unnamed__'),
      operation.field.annotations
    );
  }

  private addAnnotations<T extends Noteable>(
    def: T,
    annotations: Malloy.Annotation[] | undefined
  ): T {
    if (annotations) {
      def.extendNote({
        notes: annotations.map(annote => ({
          text: annote.value.endsWith('\n')
            ? annote.value
            : annote.value + '\n',
          at: this.defaultAt,
        })),
      });
    }
    return def;
  }

  private makeFieldReferenceExpression(
    ref: Malloy.Reference
  ): AST.ExpressionDef {
    return new AST.ExprIdReference(
      this.makeReference(ref, AST.ExpressionFieldReference)
    );
  }

  private getFilterExpressionDef(filter: Malloy.Filter): AST.ExpressionDef {
    switch (filter.kind) {
      case 'filter_string':
        return new AST.ExprCompare(
          this.makeExpression(filter.expression),
          '~',
          // TODO the RHS should be a filter expression literal, not a string...
          this.makeFilterExpressionLiteral({
            filter_expression_value: filter.filter,
          })
        );
      case 'literal_equality':
        return new AST.ExprEquality(
          this.makeExpression(filter.expression),
          '=',
          this.literalValueToASTExpression(filter.value)
        );
    }
  }

  private filterToASTFilterElement(filter: Malloy.Filter): AST.FilterElement {
    const source = Malloy.filterToMalloy(filter);
    const expr = this.getFilterExpressionDef(filter);
    return new AST.FilterElement(expr, source);
  }

  private makeExpression(expression: Malloy.Expression): AST.ExpressionDef {
    switch (expression.kind) {
      case 'field_reference':
        return this.makeFieldReferenceExpression(expression);
      case 'filtered_field':
        return new AST.ExprProps(
          this.makeFieldReferenceExpression(expression.field_reference),
          [
            new AST.Filter(
              expression.where.map(where =>
                this.filterToASTFilterElement(where.filter)
              )
            ),
          ]
        );
      case 'literal_value':
        return this.literalValueToASTExpression(expression.literal_value);
      case 'moving_average': {
        const functionCall = new AST.ExprFunc(
          'avg_moving',
          [
            this.makeFieldReferenceExpression(expression.field_reference),
            // TODO the thrift type for preceding should not be optional...
            this.makeLiteralNumber(expression.rows_preceding ?? 0),
            ...(expression.rows_following === undefined
              ? []
              : [this.makeLiteralNumber(expression.rows_following)]),
          ],
          false,
          undefined,
          undefined
        );
        if (
          expression.partition_fields !== undefined &&
          expression.partition_fields.length > 0
        ) {
          return new AST.ExprProps(functionCall, [
            new AST.PartitionBy(
              expression.partition_fields.map(field =>
                this.makeReference(field, AST.PartitionByFieldReference)
              )
            ),
          ]);
        }
        return functionCall;
      }
      case 'time_truncation':
        return new AST.ExprGranularTime(
          this.makeFieldReferenceExpression(expression.field_reference),
          expression.truncation,
          true
        );
    }
  }

  private makeReference<T extends AST.FieldReference>(
    reference: Malloy.Reference,
    constr: AST.FieldReferenceConstructor<T>
  ): T {
    return new constr([
      ...(reference.path?.map(name => new AST.FieldName(name)) ?? []),
      new AST.FieldName(reference.name),
    ]);
  }
}
