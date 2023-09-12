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

import {maxExpressionType, mergeEvalSpaces, mkExpr} from '../../../model';
import {FT} from '../fragtype-utils';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';

export class ExprCoalesce extends ExpressionDef {
  elementType = 'coalesce expression';
  legalChildTypes = FT.anyAtomicT;
  constructor(
    readonly expr: ExpressionDef,
    readonly altExpr: ExpressionDef
  ) {
    super({expr, altExpr});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const maybeNull = this.expr.getExpression(fs);
    const whenNull = this.altExpr.getExpression(fs);
    if (maybeNull.dataType === 'null') {
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
    if (!FT.typeEq(maybeNull, whenNull)) {
      this.log(
        `Mismatched types for coalesce (${maybeNull.dataType}, ${whenNull.dataType})`
      );
    }
    return {
      ...whenNull,
      dataType:
        maybeNull.dataType === 'error' ? whenNull.dataType : maybeNull.dataType,
      expressionType: maxExpressionType(
        maybeNull.expressionType,
        whenNull.expressionType
      ),
      value: mkExpr`COALESCE(${maybeNull.value},${whenNull.value})`,
      evalSpace: mergeEvalSpaces(maybeNull.evalSpace, whenNull.evalSpace),
    };
  }
}
