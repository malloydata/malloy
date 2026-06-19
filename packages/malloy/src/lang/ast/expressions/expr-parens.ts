/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {BinaryMalloyOperator} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {applyBinary, ATNodeType, ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';

export class ExprParens extends ExpressionDef {
  elementType = '(expression)';
  constructor(readonly expr: ExpressionDef) {
    super({expr: expr});
  }

  requestExpression(fs: FieldSpace): ExprValue | undefined {
    return this.expr.requestExpression(fs);
  }

  getExpression(fs: FieldSpace): ExprValue {
    const subExpr = this.expr.getExpression(fs);
    return {...subExpr, value: {node: '()', e: subExpr.value}};
  }

  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    left: ExpressionDef,
    doWarn: boolean
  ): ExprValue {
    if (this.expr.atNodeType() === ATNodeType.Or) {
      return this.expr.apply(fs, op, left, doWarn);
    }
    return applyBinary(fs, left, op, this);
  }

  atNodeType(): ATNodeType {
    return this.expr.atNodeType();
  }

  atExpr(): ExpressionDef {
    return this.expr;
  }
}
