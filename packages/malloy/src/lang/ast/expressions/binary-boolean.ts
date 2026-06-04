/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {errorFor} from '../ast-utils';
import * as TDU from '../typedesc-utils';
import type {BinaryMalloyOperator} from '../types/binary_operators';
import {getExprNode} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';

export abstract class BinaryBoolean<
  opType extends BinaryMalloyOperator,
> extends ExpressionDef {
  elementType = 'abstract boolean binary';
  legalChildTypes = [TDU.boolT];
  constructor(
    readonly left: ExpressionDef,
    readonly op: opType,
    readonly right: ExpressionDef
  ) {
    super({left, right});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const left = this.left.getExpression(fs);
    const right = this.right.getExpression(fs);
    if (this.typeCheck(this.left, left) && this.typeCheck(this.right, right)) {
      return computedExprValue({
        dataType: {type: 'boolean'},
        value: {
          node: getExprNode(this.op),
          kids: {left: left.value, right: right.value},
        },
        from: [left, right],
      });
    }
    return errorFor('logical-op expected boolean');
  }
}
