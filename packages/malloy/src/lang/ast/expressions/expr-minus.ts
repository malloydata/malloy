/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

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

  protected computeExpression(fs: FieldSpace): ExprValue {
    const expr = this.expr.getExpression(fs);
    // An error is already logged; it stays an error so nothing else logs it
    if (expr.type === 'error') {
      return expr;
    }
    if (TDU.typeIn(expr, this.legalChildTypes)) {
      return {
        ...expr,
        type: 'number',
        value: {node: 'unary-', e: expr.value},
      };
    }
    return this.expr.loggedErrorExpr(
      'expression-type-error',
      `'${this.elementType}' Can't use type ${TDU.inspect(expr)}`
    );
  }
}
