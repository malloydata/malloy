/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {CompareMalloyOperator} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {ATNodeType, ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';

export class PartialCompare extends ExpressionDef {
  elementType = '<=> a';
  constructor(
    readonly op: CompareMalloyOperator,
    readonly right: ExpressionDef
  ) {
    super({right: right});
  }

  granular(): boolean {
    return this.right.granular();
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    return this.right.apply(fs, this.op, expr);
  }

  requestExpression(_fs: FieldSpace): ExprValue | undefined {
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.loggedErrorExpr(
      'partial-as-value',
      'Partial comparison does not have a value'
    );
  }

  atNodeType(): ATNodeType {
    return ATNodeType.Partial;
  }
}
