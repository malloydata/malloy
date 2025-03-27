/*
 * Copyright 2024 Google LLC
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

import type {FunctionOrderBy as ModelFunctionOrderBy} from '../../../model/malloy_types';
import {
  expressionIsAggregate,
  expressionIsScalar,
} from '../../../model/malloy_types';
import type {ExpressionDef} from '../types/expression-def';

import type {FieldSpace} from '../types/field-space';
import {ListOf, MalloyElement} from '../types/malloy-element';
import {ExprIdReference} from './expr-id-reference';

export class FunctionOrderBy extends MalloyElement {
  elementType = 'orderBy';
  constructor(
    readonly field?: ExpressionDef,
    readonly dir?: 'asc' | 'desc'
  ) {
    super();
    if (field) this.has({field});
  }

  getAnalyticOrderBy(fs: FieldSpace): ModelFunctionOrderBy {
    if (!this.field) {
      this.logError(
        'analytic-order-by-missing-field',
        'analytic `order_by` must specify an aggregate expression or output field reference'
      );
      return {node: 'functionOrderBy', e: {node: 'error'}, dir: this.dir};
    }
    const expr = this.field.getExpression(fs);
    if (expressionIsAggregate(expr.expressionType)) {
      // Aggregates are okay
    } else if (expressionIsScalar(expr.expressionType)) {
      if (
        !(this.field instanceof ExprIdReference) ||
        expr.evalSpace === 'input'
      ) {
        this.field.logError(
          'analytic-order-by-not-output',
          'analytic `order_by` must be an aggregate or an output field reference'
        );
      }
    } else {
      this.field.logError(
        'analytic-order-by-not-aggregate-or-output',
        'analytic `order_by` must be scalar or aggregate'
      );
    }
    return {node: 'functionOrderBy', e: expr.value, dir: this.dir};
  }

  getAggregateOrderBy(
    fs: FieldSpace,
    allowExpression: boolean
  ): ModelFunctionOrderBy {
    if (this.field) {
      const expr = this.field.getExpression(fs);
      if (!expressionIsScalar(expr.expressionType)) {
        this.field.logError(
          'aggregate-order-by-not-scalar',
          'aggregate `order_by` must be scalar'
        );
      }
      if (!allowExpression) {
        this.field.logError(
          'aggregate-order-by-expression-not-allowed',
          '`order_by` must be only `asc` or `desc` with no expression'
        );
      }
      return {node: 'functionOrderBy', e: expr.value, dir: this.dir};
    } else {
      if (this.dir === undefined) {
        // This error should technically never happen because it can't parse this way
        this.logError(
          'aggregate-order-by-without-field-or-direction',
          'field or order direction must be specified'
        );
        return {node: 'functionDefaultOrderBy', dir: 'asc'};
      }
      return {node: 'functionDefaultOrderBy', dir: this.dir};
    }
  }
}

export class FunctionOrdering extends ListOf<FunctionOrderBy> {
  elementType = 'function-ordering';

  constructor(list: FunctionOrderBy[]) {
    super(list);
  }

  getAnalyticOrderBy(fs: FieldSpace): ModelFunctionOrderBy[] {
    return this.list.map(el => el.getAnalyticOrderBy(fs));
  }

  getAggregateOrderBy(
    fs: FieldSpace,
    allowExpression: boolean
  ): ModelFunctionOrderBy[] {
    return this.list.map(el => el.getAggregateOrderBy(fs, allowExpression));
  }
}
