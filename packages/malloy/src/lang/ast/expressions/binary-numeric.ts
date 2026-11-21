/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as TDU from '../typedesc-utils';
import type {ArithmeticMalloyOperator} from '../types/binary_operators';
import type {Unsettled} from '../types/morphic-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';

export abstract class BinaryNumeric<
  opType extends ArithmeticMalloyOperator,
> extends ExpressionDef {
  elementType = 'numeric binary abstract';
  constructor(
    readonly left: ExpressionDef,
    readonly op: opType,
    readonly right: ExpressionDef
  ) {
    super({left: left, right: right});
    this.legalChildTypes = [TDU.numberT];
  }

  protected computeExpression(fs: FieldSpace): Unsettled {
    return this.right.apply(fs, this.op, this.left);
  }
}
