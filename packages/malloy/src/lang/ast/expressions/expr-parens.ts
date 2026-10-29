/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {BinaryMalloyOperator} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {ATNodeType, ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';

export class ExprParens extends ExpressionDef {
  elementType = '(expression)';
  constructor(readonly expr: ExpressionDef) {
    super({expr: expr});
  }

  requestExpression(fs: FieldSpace): ExprValue | undefined {
    return this.expr.requestExpression(fs);
  }

  protected computeExpression(fs: FieldSpace): ExprValue {
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
      // Parens are invisible to `?`/`=`, so hand the tree the operator and
      // doWarn, which decides whether an un-collapsible `|` list is worth a
      // warning. The base ignores doWarn, which is why it is not passed on.
      return this.expr.apply(fs, op, left, doWarn);
    }
    return super.apply(fs, op, left);
  }

  atNodeType(): ATNodeType {
    return this.expr.atNodeType();
  }

  atExpr(): ExpressionDef {
    return this.expr;
  }
}
