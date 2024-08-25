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

import {maxExpressionType, mergeEvalSpaces} from '../../../model/malloy_types';

import {errorFor} from '../ast-utils';
import {FT} from '../fragtype-utils';
import {BinaryMalloyOperator, getExprNode} from '../types/binary_operators';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';

export abstract class BinaryBoolean<
  opType extends BinaryMalloyOperator,
> extends ExpressionDef {
  elementType = 'abstract boolean binary';
  legalChildTypes = [FT.boolT];
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
      const evalSpace = mergeEvalSpaces(left.evalSpace, right.evalSpace);
      return {
        dataType: 'boolean',
        expressionType: maxExpressionType(
          left.expressionType,
          right.expressionType
        ),
        value: {
          node: getExprNode(this.op),
          kids: {left: left.value, right: right.value},
        },
        evalSpace,
      };
    }
    return errorFor('logial required boolean');
  }
}
