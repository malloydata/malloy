/*
 * Copyright 2023 Google LLC
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
    if (fs.dialectObj()?.booleanAsNumbers) {
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
