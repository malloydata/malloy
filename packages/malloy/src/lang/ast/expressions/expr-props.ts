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

import type {FilterCondition} from '../../../model/malloy_types';
import {expressionIsCalculation} from '../../../model/malloy_types';
import {errorFor} from '../ast-utils';
import * as TDU from '../typedesc-utils';
import {FunctionOrdering} from './function-ordering';
import type {Filter} from '../query-properties/filters';
import {Limit} from '../query-properties/limit';
import {PartitionBy} from './partition_by';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldPropStatement} from '../types/field-prop-statement';
import type {FieldSpace} from '../types/field-space';
import {ExprFunc} from './expr-func';
import {mergeCompositeFieldUsage} from '../../../model/composite_source_utils';

export class ExprProps extends ExpressionDef {
  elementType = 'expression with props';
  legalChildTypes = TDU.anyAtomicT;
  constructor(
    readonly expr: ExpressionDef,
    readonly statements: FieldPropStatement[]
  ) {
    super({expr, statements});
  }

  private getFilteredExpression(
    fs: FieldSpace,
    expr: ExprValue,
    wheres: Filter[]
  ): ExprValue {
    if (wheres.length > 0) {
      if (!this.expr.supportsWhere(expr)) {
        this.expr.logError(
          'filter-of-non-aggregate',
          'Filtered expression requires an aggregate computation'
        );
        return expr;
      }
      const filterList: FilterCondition[] = [];
      for (const where of wheres) {
        const testList = where.getFilterList(fs);
        if (
          testList.find(cond => expressionIsCalculation(cond.expressionType))
        ) {
          where.logError(
            'aggregate-filter-expression-not-scalar',
            'Cannot filter an expresion with an aggregate or analytical computation'
          );
          return expr;
        }
        filterList.push(...testList);
      }
      if (this.typeCheck(this.expr, {...expr, expressionType: 'scalar'})) {
        return {
          ...expr,
          compositeFieldUsage: mergeCompositeFieldUsage(
            expr.compositeFieldUsage,
            ...filterList.map(f => f.compositeFieldUsage)
          ),
          value: {
            node: 'filteredExpr',
            kids: {e: expr.value, filterList},
          },
        };
      }
      this.expr.logError(
        'filter-of-non-aggregate',
        `Cannot filter '${expr.expressionType}' data`
      );
      return errorFor('cannot filter type');
    }
    return expr;
  }

  getExpression(fs: FieldSpace): ExprValue {
    const partitionBys: PartitionBy[] = [];
    let limit: Limit | undefined;
    const orderBys: FunctionOrdering[] = [];
    const wheres: Filter[] = [];
    for (const statement of this.statements) {
      if (statement instanceof PartitionBy) {
        if (!this.expr.canSupportPartitionBy()) {
          statement.logError(
            'partition-by-of-non-window-function',
            '`partition_by` is not supported for this kind of expression'
          );
        } else {
          partitionBys.push(statement);
        }
      } else if (statement instanceof Limit) {
        if (limit) {
          statement.logError(
            'expression-limit-already-specified',
            'limit already specified'
          );
        } else if (!this.expr.canSupportLimit()) {
          statement.logError(
            'limit-of-non-aggregate-function',
            '`limit` is not supported for this kind of expression'
          );
        } else {
          limit = statement;
        }
      } else if (statement instanceof FunctionOrdering) {
        if (!this.expr.canSupportOrderBy()) {
          statement.logError(
            'order-by-of-non-aggregate-function',
            '`order_by` is not supported for this kind of expression'
          );
        } else {
          orderBys.push(statement);
        }
      } else {
        wheres.push(statement);
      }
    }
    const resultExpr =
      this.expr instanceof ExprFunc
        ? this.expr.getPropsExpression(fs, {
            partitionBys,
            limit,
            orderBys,
          })
        : this.expr.getExpression(fs);
    return this.getFilteredExpression(fs, resultExpr, wheres);
  }
}
