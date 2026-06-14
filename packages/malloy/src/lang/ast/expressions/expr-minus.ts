/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {errorFor} from '../ast-utils';
import * as TDU from '../typedesc-utils';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';

export class ExprMinus extends ExpressionDef {
  elementType = 'unary minus';
  constructor(readonly expr: ExpressionDef) {
    super({expr: expr});

    this.legalChildTypes = [TDU.numberT];
  }

  getExpression(fs: FieldSpace): ExprValue {
    const expr = this.expr.getExpression(fs);
    if (TDU.typeIn(expr, this.legalChildTypes)) {
      return {
        ...expr,
        type: 'number',
        value: {node: 'unary-', e: expr.value},
      };
    }
    return errorFor('negate requires number');
  }
}
