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

import {ExprValue, computedExprValue} from '../types/expr-value';
import {FieldSpace} from '../types/field-space';
import {ExpressionDef} from '../types/expression-def';
import {BinaryMalloyOperator} from '../types/binary_operators';

export class ExprAlternationTree extends ExpressionDef {
  elementType = 'alternation';
  constructor(
    readonly left: ExpressionDef,
    readonly op: '|' | '&',
    readonly right: ExpressionDef
  ) {
    super({left, right});
    this.elementType = `${op}alternation${op}`;
  }

  apply(
    fs: FieldSpace,
    applyOp: BinaryMalloyOperator,
    expr: ExpressionDef
  ): ExprValue {
    const choice1 = this.left.apply(fs, applyOp, expr);
    const choice2 = this.right.apply(fs, applyOp, expr);
    return computedExprValue({
      dataType: 'boolean',
      value: {
        node: this.op === '&' ? 'and' : 'or',
        kids: {left: choice1.value, right: choice2.value},
      },
      from: [choice1, choice2],
    });
  }

  requestExpression(_fs: FieldSpace): ExprValue | undefined {
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.loggedErrorExpr(
      'alternation-as-value',
      'Alternation tree has no value'
    );
  }
}
