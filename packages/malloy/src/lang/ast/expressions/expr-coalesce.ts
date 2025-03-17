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

import {maxExpressionType, mergeEvalSpaces} from '../../../model';
import * as TDU from '../typedesc-utils';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';

export class ExprCoalesce extends ExpressionDef {
  elementType = 'coalesce expression';
  legalChildTypes = TDU.anyAtomicT;
  constructor(
    readonly expr: ExpressionDef,
    readonly altExpr: ExpressionDef
  ) {
    super({expr, altExpr});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const maybeNull = this.expr.getExpression(fs);
    const whenNull = this.altExpr.getExpression(fs);
    if (maybeNull.type === 'null') {
      return whenNull;
    }
    /**
     * Could maybe walk altExpr to combine all the times that altExpr
     * is also an ExprCoalesce into a single fragment. Not doing that now.
     *
     * Also this should maybe generate a dialect fragment and not write
     * SQL, but I decided that is will happen when the "expressions are true
     * trees" rewrite happens.
     */
    if (!TDU.typeEq(maybeNull, whenNull)) {
      this.logError(
        'mismatched-coalesce-types',
        `Mismatched types for coalesce (${maybeNull.type}, ${whenNull.type})`
      );
    }
    const srcForType = maybeNull.type === 'error' ? whenNull : maybeNull;
    return {
      ...srcForType,
      expressionType: maxExpressionType(
        maybeNull.expressionType,
        whenNull.expressionType
      ),
      value: {
        node: 'coalesce',
        kids: {left: maybeNull.value, right: whenNull.value},
      },
      evalSpace: mergeEvalSpaces(maybeNull.evalSpace, whenNull.evalSpace),
    };
  }
}
