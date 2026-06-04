/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {errorFor} from '../ast-utils';
import type {BinaryMalloyOperator} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';

export class Range extends ExpressionDef {
  elementType = 'range';
  constructor(
    readonly first: ExpressionDef,
    readonly last: ExpressionDef
  ) {
    super({first: first, last: last});
  }

  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    expr: ExpressionDef
  ): ExprValue {
    switch (op) {
      case '=':
      case '!=': {
        const op1 = op === '=' ? '>=' : '<';
        const op2 = op === '=' ? 'and' : 'or';
        const op3 = op === '=' ? '<' : '>=';
        const fromValue = this.first.apply(fs, op1, expr);
        const toValue = this.last.apply(fs, op3, expr);
        return computedExprValue({
          dataType: {type: 'boolean'},
          value: {
            node: op2,
            kids: {left: fromValue.value, right: toValue.value},
          },
          from: [fromValue, toValue],
        });
      }

      /**
       * This is a little surprising, but is actually how you comapre a
       * value to a range ...
       *
       * val > begin to end     val >= end
       * val >= begin to end    val >= begin
       * val < begin to end     val < begin
       * val <= begin to end    val < end
       */
      case '>':
        return this.last.apply(fs, '>=', expr);
      case '>=':
        return this.first.apply(fs, '>=', expr);
      case '<':
        return this.first.apply(fs, '<', expr);
      case '<=':
        return this.last.apply(fs, '<', expr);
    }
    throw new Error('mysterious error in range computation');
  }

  requestExpression(_fs: FieldSpace): undefined {
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    this.logError('range-as-value', 'A Range is not a value');
    return errorFor('a range is not a value');
  }
}
