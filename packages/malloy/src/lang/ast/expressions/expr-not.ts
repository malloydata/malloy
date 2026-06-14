/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as TDU from '../typedesc-utils';
import type {ExprValue} from '../types/expr-value';
import type {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {Unary} from './unary';

export class ExprNot extends Unary {
  elementType = 'not';
  legalChildTypes = [TDU.boolT, TDU.nullT];
  constructor(expr: ExpressionDef) {
    super(expr);
  }

  getExpression(fs: FieldSpace): ExprValue {
    const notThis = this.expr.getExpression(fs);
    if (fs.dialectObj()?.booleanType !== 'supported') {
      if (this.legalChildTypes.find(t => t.type === 'number') === undefined) {
        this.legalChildTypes.push(TDU.numberT);
      }
    }
    const doNot = this.typeCheck(this.expr, notThis);
    return {
      ...notThis,
      type: 'boolean',
      value: {node: 'not', e: doNot ? notThis.value : {node: 'false'}},
    };
  }
}
